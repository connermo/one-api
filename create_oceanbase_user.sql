-- OceanBase 用户创建脚本
-- 目标租户: test  
-- 用户: a_oneapi@test:test-cluster
-- 密码: 5R,cLi3^q9:N

-- 注意：此脚本需要以root身份连接到test租户执行
-- 连接命令: mysql -h oceanbase-ce -P 2881 -uroot@test:test-cluster -p123456

-- 1. 确认当前租户
SELECT '=== 当前租户信息 ===' AS Info;
SELECT TENANT_NAME FROM oceanbase.DBA_OB_TENANTS WHERE TENANT_ID = EFFECTIVE_TENANT_ID();

-- 2. 创建数据库（如果需要）
CREATE DATABASE IF NOT EXISTS one_api;

-- 3. 创建用户（在当前租户下）
-- 注意：在 OceanBase 中，用户是租户级别的
CREATE USER IF NOT EXISTS 'a_oneapi'@'%' IDENTIFIED BY '5R,cLi3^q9:N';

-- 4. 授予权限
-- 授予对 one_api 数据库的全部权限
GRANT ALL PRIVILEGES ON one_api.* TO 'a_oneapi'@'%';

-- 5. 刷新权限
FLUSH PRIVILEGES;

-- 6. 验证创建结果
SELECT '=== 用户创建结果 ===' AS Info;
SELECT User, Host FROM mysql.user WHERE User='a_oneapi';

SELECT '=== 用户权限 ===' AS Info;
SHOW GRANTS FOR 'a_oneapi'@'%';

SELECT '=== 数据库列表 ===' AS Info;
SHOW DATABASES;

-- 7. 测试连接
SELECT '=== 连接测试 ===' AS Info;
SELECT USER(), DATABASE(), VERSION(); 