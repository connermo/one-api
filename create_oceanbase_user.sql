-- OceanBase 用户创建脚本
-- 用户: a_oneapi@CATL_CE_OND02:ONEAPI
-- 密码: 5R,cLi3^q9:N

-- 1. 创建数据库（如果需要）
CREATE DATABASE IF NOT EXISTS one_api;

-- 2. 创建用户
-- 注意：在 OceanBase CE 中，通常使用简化的用户名格式
CREATE USER IF NOT EXISTS 'a_oneapi'@'%' IDENTIFIED BY '5R,cLi3^q9:N';

-- 3. 授予权限
-- 授予对 one_api 数据库的全部权限
GRANT ALL PRIVILEGES ON one_api.* TO 'a_oneapi'@'%';

-- 如果需要全局权限（谨慎使用）
-- GRANT ALL PRIVILEGES ON *.* TO 'a_oneapi'@'%';

-- 4. 刷新权限
FLUSH PRIVILEGES;

-- 5. 验证创建结果
SELECT '=== 用户创建结果 ===' AS Info;
SELECT User, Host FROM mysql.user WHERE User='a_oneapi';

SELECT '=== 用户权限 ===' AS Info;
SHOW GRANTS FOR 'a_oneapi'@'%';

SELECT '=== 数据库列表 ===' AS Info;
SHOW DATABASES;

-- 6. 测试连接
SELECT '=== 连接测试 ===' AS Info;
SELECT USER(), DATABASE(), VERSION(); 