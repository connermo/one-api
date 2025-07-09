package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/controller"
	"github.com/songquanpeng/one-api/model"
)

type CustomOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type CustomOAuthUser struct {
	RawData map[string]interface{}
}

func (u *CustomOAuthUser) GetField(fieldName string) string {
	if fieldName == "" {
		return ""
	}

	// 支持嵌套字段，如 "user.profile.name"
	fieldParts := strings.Split(fieldName, ".")
	current := u.RawData

	for i, part := range fieldParts {
		if i == len(fieldParts)-1 {
			// 最后一个字段
			if value, ok := current[part]; ok {
				if str, ok := value.(string); ok {
					return str
				}
				return fmt.Sprintf("%v", value)
			}
		} else {
			// 中间字段，需要继续深入
			if nested, ok := current[part].(map[string]interface{}); ok {
				current = nested
			} else {
				return ""
			}
		}
	}
	return ""
}

func (u *CustomOAuthUser) GetUserId() string {
	return u.GetField(config.CustomOAuthUserIdField)
}

func (u *CustomOAuthUser) GetUsername() string {
	username := u.GetField(config.CustomOAuthUsernameField)
	if username == "" {
		// 如果没有配置用户名字段，尝试常见字段
		for _, field := range []string{"username", "login", "name", "preferred_username"} {
			if username = u.GetField(field); username != "" {
				break
			}
		}
	}
	return username
}

func (u *CustomOAuthUser) GetDisplayName() string {
	displayName := u.GetField(config.CustomOAuthDisplayNameField)
	if displayName == "" {
		// 如果没有配置显示名称字段，尝试常见字段
		for _, field := range []string{"display_name", "name", "full_name", "nickname"} {
			if displayName = u.GetField(field); displayName != "" {
				break
			}
		}
	}
	return displayName
}

func (u *CustomOAuthUser) GetEmail() string {
	return u.GetField(config.CustomOAuthEmailField)
}

func getCustomOAuthUserInfoByCode(code string) (*CustomOAuthUser, error) {
	if code == "" {
		return nil, errors.New("无效的参数")
	}

	// 检查必要的配置
	if config.CustomOAuthClientId == "" || config.CustomOAuthClientSecret == "" ||
		config.CustomOAuthTokenEndpoint == "" || config.CustomOAuthUserinfoEndpoint == "" {
		return nil, errors.New("自定义OAuth配置不完整")
	}

	// 获取access token
	tokenData := url.Values{}
	tokenData.Set("client_id", config.CustomOAuthClientId)
	tokenData.Set("client_secret", config.CustomOAuthClientSecret)
	tokenData.Set("code", code)
	tokenData.Set("grant_type", "authorization_code")
	tokenData.Set("redirect_uri", fmt.Sprintf("%s/oauth/custom", config.ServerAddress))

	req, err := http.NewRequest("POST", config.CustomOAuthTokenEndpoint, strings.NewReader(tokenData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{
		Timeout: 10 * time.Second,
	}

	res, err := client.Do(req)
	if err != nil {
		logger.SysLog(err.Error())
		return nil, errors.New("无法连接至OAuth服务器，请稍后重试！")
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OAuth服务器返回错误状态: %d", res.StatusCode)
	}

	var oAuthResponse CustomOAuthResponse
	err = json.NewDecoder(res.Body).Decode(&oAuthResponse)
	if err != nil {
		return nil, err
	}

	if oAuthResponse.AccessToken == "" {
		return nil, errors.New("未能获取访问令牌")
	}

	// 获取用户信息
	req, err = http.NewRequest("GET", config.CustomOAuthUserinfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", oAuthResponse.AccessToken))
	req.Header.Set("Accept", "application/json")

	res2, err := client.Do(req)
	if err != nil {
		logger.SysLog(err.Error())
		return nil, errors.New("无法连接至OAuth服务器，请稍后重试！")
	}
	defer res2.Body.Close()

	if res2.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("获取用户信息失败，状态码: %d", res2.StatusCode)
	}

	var userData map[string]interface{}
	err = json.NewDecoder(res2.Body).Decode(&userData)
	if err != nil {
		return nil, err
	}

	customUser := &CustomOAuthUser{
		RawData: userData,
	}

	// 验证必要字段
	if customUser.GetUserId() == "" {
		return nil, errors.New("无法从OAuth响应中获取用户唯一标识")
	}

	return customUser, nil
}

func CustomOAuth(c *gin.Context) {
	ctx := c.Request.Context()
	session := sessions.Default(c)
	state := c.Query("state")
	if state == "" || session.Get("oauth_state") == nil || state != session.Get("oauth_state").(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "state is empty or not same",
		})
		return
	}
	username := session.Get("username")
	if username != nil {
		CustomOAuthBind(c)
		return
	}

	if !config.CustomOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启自定义OAuth登录以及注册",
		})
		return
	}

	code := c.Query("code")
	customUser, err := getCustomOAuthUserInfoByCode(code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	user := model.User{
		CustomOAuthId: customUser.GetUserId(),
	}

	if model.IsCustomOAuthIdAlreadyTaken(user.CustomOAuthId) {
		err := user.FillUserByCustomOAuthId()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	} else {
		if config.RegisterEnabled {
			// 生成用户名
			username := customUser.GetUsername()
			if username == "" {
				username = "custom_" + strconv.Itoa(model.GetMaxUserId()+1)
			} else {
				// 确保用户名唯一
				if model.IsUsernameAlreadyTaken(username) {
					username = username + "_" + strconv.Itoa(model.GetMaxUserId()+1)
				}
			}
			user.Username = username

			// 设置显示名称
			displayName := customUser.GetDisplayName()
			if displayName == "" {
				providerName := config.CustomOAuthProviderName
				if providerName == "" {
					providerName = "Custom OAuth"
				}
				displayName = providerName + " User"
			}
			user.DisplayName = displayName

			// 设置邮箱
			user.Email = customUser.GetEmail()

			user.Role = model.RoleCommonUser
			user.Status = model.UserStatusEnabled

			if err := user.Insert(ctx, 0); err != nil {
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}
		} else {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "管理员关闭了新用户注册",
			})
			return
		}
	}

	if user.Status != model.UserStatusEnabled {
		c.JSON(http.StatusOK, gin.H{
			"message": "用户已被封禁",
			"success": false,
		})
		return
	}
	controller.SetupLogin(&user, c)
}

func CustomOAuthBind(c *gin.Context) {
	if !config.CustomOAuthEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "管理员未开启自定义OAuth登录以及注册",
		})
		return
	}

	code := c.Query("code")
	customUser, err := getCustomOAuthUserInfoByCode(code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	user := model.User{
		CustomOAuthId: customUser.GetUserId(),
	}

	if model.IsCustomOAuthIdAlreadyTaken(user.CustomOAuthId) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "该自定义OAuth账户已被绑定",
		})
		return
	}

	session := sessions.Default(c)
	id := session.Get("id")
	user.Id = id.(int)
	err = user.FillUserById()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	user.CustomOAuthId = customUser.GetUserId()
	err = user.Update(false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "bind",
	})
}
