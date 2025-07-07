#!/bin/bash

set -e

echo "🚀 开始测试 OceanBase 用户连接..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数：打印彩色输出
print_step() {
    echo -e "${YELLOW}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 步骤1：启动 OceanBase CE
print_step "步骤1: 启动 OceanBase CE 服务"
docker-compose -f docker-compose-oceanbase.yml up -d oceanbase-ce mysql-client

# 等待 OceanBase 就绪
print_step "等待 OceanBase CE 服务就绪（约2-3分钟）..."
timeout=300  # 5分钟超时
counter=0
while [ $counter -lt $timeout ]; do
    if docker exec oceanbase-client mysql -h oceanbase-ce -P 2881 -uroot -p123456 -e "SELECT 1" >/dev/null 2>&1; then
        print_success "OceanBase CE 服务已就绪"
        break
    fi
    sleep 10
    counter=$((counter + 10))
    echo "等待中... ($counter/$timeout 秒)"
done

if [ $counter -ge $timeout ]; then
    print_error "OceanBase CE 服务启动超时"
    exit 1
fi

# 步骤2：创建用户和数据库
print_step "步骤2: 创建 a_oneapi 用户和数据库"
docker exec -i oceanbase-client mysql -h oceanbase-ce -P 2881 -uroot -p123456 < create_oceanbase_user.sql

# 步骤3：测试新用户连接
print_step "步骤3: 测试 a_oneapi 用户连接"
if docker exec oceanbase-client mysql -h oceanbase-ce -P 2881 -ua_oneapi -p'5R,cLi3^q9:N' one_api -e "SELECT USER(), DATABASE(), VERSION();" 2>/dev/null; then
    print_success "a_oneapi 用户连接测试成功"
else
    print_error "a_oneapi 用户连接测试失败"
    echo "尝试使用完整用户名格式..."
    if docker exec oceanbase-client mysql -h oceanbase-ce -P 2881 -u'a_oneapi@CATL_CE_OND02:ONEAPI' -p'5R,cLi3^q9:N' one_api -e "SELECT USER(), DATABASE(), VERSION();" 2>/dev/null; then
        print_success "使用完整用户名格式连接成功"
        # 更新环境变量为完整格式
        print_step "更新 docker-compose 配置为完整用户名格式"
        sed -i '' 's/OCEANBASE_USER: "a_oneapi"/OCEANBASE_USER: "a_oneapi@CATL_CE_OND02:ONEAPI"/' docker-compose-oceanbase.yml
    else
        print_error "所有用户名格式连接测试都失败"
        exit 1
    fi
fi

# 步骤4：启动 One API 服务
print_step "步骤4: 启动 One API 服务"
docker-compose -f docker-compose-oceanbase.yml up -d one-api

# 等待 One API 启动
print_step "等待 One API 服务启动..."
sleep 15

# 步骤5：检查 One API 日志
print_step "步骤5: 检查 One API 数据库连接日志"
echo "=== One API 启动日志 ==="
docker logs one-api-oceanbase --tail 30

# 步骤6：测试 One API 数据库连接
print_step "步骤6: 测试 One API 数据库连接状态"
if docker exec one-api-oceanbase ps aux | grep -q "one-api" 2>/dev/null; then
    print_success "One API 进程正在运行"
else
    print_error "One API 进程未运行"
    echo "查看详细错误日志："
    docker logs one-api-oceanbase
    exit 1
fi

# 步骤7：测试 API 端点
print_step "步骤7: 测试 One API HTTP 端点"
sleep 5
if curl -s http://localhost:3000/api/status >/dev/null 2>&1; then
    print_success "One API HTTP 端点可访问"
    echo "API 状态："
    curl -s http://localhost:3000/api/status | jq . 2>/dev/null || curl -s http://localhost:3000/api/status
elif curl -s http://localhost:3000/ >/dev/null 2>&1; then
    print_success "One API 主页可访问"
    echo "访问地址: http://localhost:3000"
else
    print_error "One API HTTP 端点不可访问"
    echo "检查端口映射和服务状态："
    docker-compose -f docker-compose-oceanbase.yml ps
fi

# 步骤8：检查数据库表是否创建
print_step "步骤8: 检查 One API 是否成功创建数据库表"
echo "=== 检查数据库表 ==="
docker exec oceanbase-client mysql -h oceanbase-ce -P 2881 -ua_oneapi -p'5R,cLi3^q9:N' one_api -e "SHOW TABLES;" 2>/dev/null || \
docker exec oceanbase-client mysql -h oceanbase-ce -P 2881 -u'a_oneapi@CATL_CE_OND02:ONEAPI' -p'5R,cLi3^q9:N' one_api -e "SHOW TABLES;" 2>/dev/null

# 完成测试
print_success "测试完成！"
echo ""
echo "=== 测试总结 ==="
echo "• OceanBase CE: 运行在端口 2881"
echo "• One API: 运行在端口 3000"
echo "• 数据库用户: a_oneapi"
echo "• 数据库: one_api"
echo ""
echo "=== 访问信息 ==="
echo "• Web 界面: http://localhost:3000"
echo "• API Token: sk-oceanbase-test123456"
echo ""
echo "=== 手动测试命令 ==="
echo "• 查看 One API 日志: docker logs one-api-oceanbase -f"
echo "• 连接数据库: docker exec -it oceanbase-client mysql -h oceanbase-ce -P 2881 -ua_oneapi -p'5R,cLi3^q9:N' one_api"
echo "• 停止服务: docker-compose -f docker-compose-oceanbase.yml down" 