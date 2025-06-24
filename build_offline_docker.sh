#!/bin/bash

# One API 离线Docker镜像构建脚本
# 作者：AI Assistant
# 版本：1.0.0

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查必要的文件
check_prerequisites() {
    print_info "检查构建环境..."
    
    if [ ! -f "Dockerfile.offline" ]; then
        print_error "Dockerfile.offline 文件不存在"
        exit 1
    fi
    
    if [ ! -f "docker-compose.offline.yml" ]; then
        print_error "docker-compose.offline.yml 文件不存在"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装或未在PATH中"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose 未安装或未在PATH中"
        exit 1
    fi
    
    print_success "环境检查通过"
}

# 清理旧容器和镜像
cleanup_old() {
    print_info "清理旧的容器和镜像..."
    
    # 停止并删除现有容器
    if docker ps -a | grep -q "one-api-offline"; then
        print_info "停止现有容器..."
        docker stop one-api-offline 2>/dev/null || true
        docker rm one-api-offline 2>/dev/null || true
    fi
    
    # 删除旧镜像（可选）
    if [ "$1" = "--clean" ]; then
        if docker images | grep -q "one-api.*offline"; then
            print_info "删除旧镜像..."
            docker rmi $(docker images | grep "one-api.*offline" | awk '{print $3}') 2>/dev/null || true
        fi
    fi
    
    print_success "清理完成"
}

# 构建镜像
build_image() {
    print_info "开始构建离线镜像..."
    
    # 获取版本号
    VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
    print_info "版本号: $VERSION"
    
    # 构建镜像
    print_info "执行构建命令..."
    if docker-compose -f docker-compose.offline.yml build; then
        print_success "镜像构建成功"
    else
        print_error "镜像构建失败"
        exit 1
    fi
    
    # 添加版本标签
    IMAGE_ID=$(docker images | grep one-api | grep offline | head -n1 | awk '{print $3}')
    if [ -n "$IMAGE_ID" ]; then
        docker tag $IMAGE_ID one-api:offline-v$VERSION
        print_success "已添加版本标签: one-api:offline-v$VERSION"
    fi
}

# 验证镜像
verify_image() {
    print_info "验证镜像内容..."
    
    # 检查镜像是否存在
    if ! docker images | grep -q "one-api.*offline"; then
        print_error "镜像不存在"
        exit 1
    fi
    
    # 创建临时容器验证tiktoken缓存
    print_info "验证tiktoken缓存文件..."
    TEMP_CONTAINER=$(docker run -d one-api:offline sleep 10)
    
    # 检查缓存文件
    CACHE_FILES=$(docker exec $TEMP_CONTAINER ls -la /tiktoken_cache/ 2>/dev/null | grep ".tiktoken" | wc -l)
    CACHE_SIZE=$(docker exec $TEMP_CONTAINER du -sh /tiktoken_cache/ 2>/dev/null | cut -f1)
    
    # 清理临时容器
    docker stop $TEMP_CONTAINER > /dev/null 2>&1
    docker rm $TEMP_CONTAINER > /dev/null 2>&1
    
    if [ "$CACHE_FILES" -gt 0 ]; then
        print_success "tiktoken缓存验证通过 ($CACHE_FILES 个文件, $CACHE_SIZE)"
    else
        print_warning "tiktoken缓存文件为空，运行时将自动下载"
    fi
}

# 启动测试
start_test() {
    if [ "$1" = "--test" ]; then
        print_info "启动测试容器..."
        
        # 确保数据目录存在
        mkdir -p data logs
        
        # 启动服务
        docker-compose -f docker-compose.offline.yml up -d
        
        # 等待服务启动
        print_info "等待服务启动..."
        sleep 10
        
        # 检查服务状态
        if curl -s http://localhost:3000/api/status > /dev/null; then
            print_success "服务启动成功，访问地址: http://localhost:3000"
            
            # 显示日志（最后20行）
            print_info "服务日志:"
            docker logs one-api-offline --tail 20
        else
            print_error "服务启动失败"
            docker logs one-api-offline
            exit 1
        fi
    fi
}

# 显示使用信息
show_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --clean    构建前清理旧镜像"
    echo "  --test     构建后启动测试"
    echo "  --help     显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                构建镜像"
    echo "  $0 --clean        清理后构建"
    echo "  $0 --test         构建并测试"
    echo "  $0 --clean --test 完整流程"
}

# 主函数
main() {
    echo "🐳 One API 离线Docker镜像构建工具"
    echo "================================================"
    
    # 解析参数
    CLEAN_MODE=false
    TEST_MODE=false
    
    for arg in "$@"; do
        case $arg in
            --clean)
                CLEAN_MODE=true
                ;;
            --test)
                TEST_MODE=true
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_error "未知参数: $arg"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # 执行构建流程
    check_prerequisites
    
    if [ "$CLEAN_MODE" = true ]; then
        cleanup_old --clean
    else
        cleanup_old
    fi
    
    build_image
    verify_image
    
    if [ "$TEST_MODE" = true ]; then
        start_test --test
    fi
    
    echo "================================================"
    print_success "🎉 构建完成！"
    echo ""
    print_info "镜像信息:"
    docker images | grep "one-api.*offline"
    echo ""
    print_info "使用方式:"
    echo "  启动服务: docker-compose -f docker-compose.offline.yml up -d"
    echo "  查看日志: docker logs one-api-offline"
    echo "  停止服务: docker-compose -f docker-compose.offline.yml down"
    echo ""
    print_info "服务地址: http://localhost:3000"
}

# 执行主函数
main "$@" 