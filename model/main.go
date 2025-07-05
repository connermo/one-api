package model

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/env"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/common/random"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB
var LOG_DB *gorm.DB

func CreateRootAccountIfNeed() error {
	var user User
	//if user.Status != util.UserStatusEnabled {
	if err := DB.First(&user).Error; err != nil {
		logger.SysLog("no user exists, creating a root user for you: username is root, password is 123456")
		hashedPassword, err := common.Password2Hash("123456")
		if err != nil {
			return err
		}
		accessToken := random.GetUUID()
		if config.InitialRootAccessToken != "" {
			accessToken = config.InitialRootAccessToken
		}
		rootUser := User{
			Username:    "root",
			Password:    hashedPassword,
			Role:        RoleRootUser,
			Status:      UserStatusEnabled,
			DisplayName: "Root User",
			AccessToken: accessToken,
			Quota:       500000000000000,
		}
		DB.Create(&rootUser)
		if config.InitialRootToken != "" {
			logger.SysLog("creating initial root token as requested")
			token := Token{
				Id:             1,
				UserId:         rootUser.Id,
				Key:            config.InitialRootToken,
				Status:         TokenStatusEnabled,
				Name:           "Initial Root Token",
				CreatedTime:    helper.GetTimestamp(),
				AccessedTime:   helper.GetTimestamp(),
				ExpiredTime:    -1,
				RemainQuota:    500000000000000,
				UnlimitedQuota: true,
			}
			DB.Create(&token)
		}
	}
	return nil
}

func chooseDB(envName string) (*gorm.DB, error) {
	dsn := os.Getenv(envName)

	switch {
	case strings.HasPrefix(dsn, "postgres://"):
		// Use PostgreSQL
		return openPostgreSQL(dsn)
	case strings.HasPrefix(dsn, "oceanbase://") || strings.Contains(dsn, "ob_"):
		// Use OceanBase (MySQL compatible)
		return openOceanBase(dsn)
	case dsn != "":
		// Use MySQL
		return openMySQL(dsn)
	default:
		// Use SQLite
		return openSQLite()
	}
}

func openPostgreSQL(dsn string) (*gorm.DB, error) {
	logger.SysLog("using PostgreSQL as database")
	common.UsingPostgreSQL = true
	return gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // disables implicit prepared statement usage
	}), &gorm.Config{
		PrepareStmt: true, // precompile SQL
	})
}

func openMySQL(dsn string) (*gorm.DB, error) {
	logger.SysLog("using MySQL as database")
	common.UsingMySQL = true
	return gorm.Open(mysql.Open(dsn), &gorm.Config{
		PrepareStmt: true, // precompile SQL
	})
}

func openOceanBase(dsn string) (*gorm.DB, error) {
	logger.SysLog("using OceanBase as database")
	common.UsingOceanBase = true

	// Convert oceanbase:// DSN to MySQL format if needed
	if strings.HasPrefix(dsn, "oceanbase://") {
		dsn = strings.Replace(dsn, "oceanbase://", "", 1)
	}

	// Check if using environment variables for OceanBase connection
	obUser := os.Getenv("OCEANBASE_USER")
	obPassword := os.Getenv("OCEANBASE_PASSWORD")
	obHost := os.Getenv("OCEANBASE_HOST")
	obPort := os.Getenv("OCEANBASE_PORT")
	obDatabase := os.Getenv("OCEANBASE_DATABASE")

	// If all OceanBase environment variables are set, use them instead of DSN
	if obUser != "" && obPassword != "" && obHost != "" && obDatabase != "" {
		if obPort == "" {
			obPort = "2881" // Default OceanBase port
		}
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", obUser, obPassword, obHost, obPort, obDatabase)
		logger.SysLog("using OceanBase environment variables for connection")
	} else {
		// Handle URL-encoded usernames (for cases like user@tenant:cluster)
		// The colon in the username should be encoded as %3A
		logger.SysLog("using OceanBase DSN for connection (note: encode colons in username as %3A)")
	}

	return gorm.Open(mysql.Open(dsn), &gorm.Config{
		PrepareStmt: true, // precompile SQL
	})
}

func openSQLite() (*gorm.DB, error) {
	logger.SysLog("SQL_DSN not set, using SQLite as database")
	common.UsingSQLite = true
	dsn := fmt.Sprintf("%s?_busy_timeout=%d", common.SQLitePath, common.SQLiteBusyTimeout)
	return gorm.Open(sqlite.Open(dsn), &gorm.Config{
		PrepareStmt: true, // precompile SQL
	})
}

func InitDB() {
	var err error
	DB, err = chooseDB("SQL_DSN")
	if err != nil {
		logger.FatalLog("failed to initialize database: " + err.Error())
		return
	}

	sqlDB := setDBConns(DB)

	if !config.IsMasterNode {
		return
	}

	if common.UsingMySQL || common.UsingOceanBase {
		_, _ = sqlDB.Exec("DROP INDEX idx_channels_key ON channels;") // TODO: delete this line when most users have upgraded
	}

	logger.SysLog("database migration started")
	if err = migrateDB(); err != nil {
		logger.FatalLog("failed to migrate database: " + err.Error())
		return
	}
	logger.SysLog("database migrated")
}

func migrateDB() error {
	var err error
	if err = DB.AutoMigrate(&Channel{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&Token{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&User{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&Option{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&Redemption{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&Ability{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&Log{}); err != nil {
		return err
	}
	if err = DB.AutoMigrate(&Channel{}); err != nil {
		return err
	}
	return nil
}

func InitLogDB() {
	if os.Getenv("LOG_SQL_DSN") == "" {
		LOG_DB = DB
		return
	}

	logger.SysLog("using secondary database for table logs")
	var err error
	LOG_DB, err = chooseDB("LOG_SQL_DSN")
	if err != nil {
		logger.FatalLog("failed to initialize secondary database: " + err.Error())
		return
	}

	setDBConns(LOG_DB)

	if !config.IsMasterNode {
		return
	}

	logger.SysLog("secondary database migration started")
	err = migrateLOGDB()
	if err != nil {
		logger.FatalLog("failed to migrate secondary database: " + err.Error())
		return
	}
	logger.SysLog("secondary database migrated")
}

func migrateLOGDB() error {
	var err error
	if err = LOG_DB.AutoMigrate(&Log{}); err != nil {
		return err
	}
	return nil
}

func setDBConns(db *gorm.DB) *sql.DB {
	if config.DebugSQLEnabled {
		db = db.Debug()
	}

	sqlDB, err := db.DB()
	if err != nil {
		logger.FatalLog("failed to connect database: " + err.Error())
		return nil
	}

	sqlDB.SetMaxIdleConns(env.Int("SQL_MAX_IDLE_CONNS", 100))
	sqlDB.SetMaxOpenConns(env.Int("SQL_MAX_OPEN_CONNS", 1000))
	sqlDB.SetConnMaxLifetime(time.Second * time.Duration(env.Int("SQL_MAX_LIFETIME", 60)))
	return sqlDB
}

func closeDB(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	err = sqlDB.Close()
	return err
}

func CloseDB() error {
	if LOG_DB != DB {
		err := closeDB(LOG_DB)
		if err != nil {
			return err
		}
	}
	return closeDB(DB)
}
