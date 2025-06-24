# One API Docker 离线部署指南

## 🎯 功能特点

本方案在Docker构建阶段预下载所有tiktoken缓存文件，生成完全离线的镜像，解决以下问题：
- ✅ 启动时不再需要连接外网下载tiktoken文件
- ✅ 支持完全离线环境部署
- ✅ 包含所有主要编码器：r50k_base、p50k_base、cl100k_base、o200k_base
- ✅ 自动验证缓存文件完整性

## 📋 文件说明

### 新增文件
- `Dockerfile.offline` - 离线版Dockerfile，预下载tiktoken缓存
- `docker-compose.offline.yml` - 离线版docker-compose配置
- `Docker离线部署指南.md` - 本说明文档

## 🚀 快速部署

### 1. 构建离线镜像

```bash
# 方式1：使用docker-compose构建（推荐）
docker-compose -f docker-compose.offline.yml build

# 方式2：直接构建
docker build -f Dockerfile.offline -t one-api:offline .
```

### 2. 启动服务

```bash
# 使用docker-compose启动
docker-compose -f docker-compose.offline.yml up -d

# 或者直接运行容器
docker run -d \
  --name one-api-offline \
  -p 3000:3000 \
  -v ./data:/data \
  -v ./logs:/logs \
  -e TZ=Asia/Shanghai \
  one-api:offline
```

### 3. 验证部署

```bash
# 检查容器状态
docker ps

# 查看日志
docker logs one-api-offline

# 访问服务
curl http://localhost:3000/api/status
```

## 🔧 详细配置

### Dockerfile.offline 特性

1. **多阶段构建**：
   - 第一阶段：构建前端资源（node:16）
   - 第二阶段：下载tiktoken缓存 + 编译Go程序（golang:alpine）
   - 第三阶段：生成最终镜像（alpine:latest）

2. **预下载tiktoken缓存**：
   ```bash
   # 自动下载所有编码器文件
   - r50k_base.tiktoken
   - p50k_base.tiktoken  
   - cl100k_base.tiktoken
   - o200k_base.tiktoken
   ```

3. **环境变量设置**：
   ```dockerfile
   ENV TIKTOKEN_CACHE_DIR=/tiktoken_cache
   ENV DATA_GYM_CACHE_DIR=/tiktoken_cache
   ENV MEMORY_CACHE_ENABLED=true
   ENV TZ=Asia/Shanghai
   ```

### docker-compose.offline.yml 配置

```yaml
services:
  one-api:
    build:
      context: .
      dockerfile: Dockerfile.offline
    environment:
      - TIKTOKEN_CACHE_DIR=/tiktoken_cache
      - DATA_GYM_CACHE_DIR=/tiktoken_cache
      - TZ=Asia/Shanghai
      - MEMORY_CACHE_ENABLED=true
    volumes:
      - ./data:/data
      - ./logs:/logs
    ports:
      - "3000:3000"
```

## 📊 缓存验证

### 构建时验证
构建过程中会显示下载状态：
```
🌐 下载 tiktoken 缓存文件...
📥 下载 r50k_base.tiktoken ...
✅ r50k_base.tiktoken 下载成功 (1048576 bytes)
📥 下载 p50k_base.tiktoken ...
✅ p50k_base.tiktoken 下载成功 (1048576 bytes)
...
📊 总共下载成功 4 个文件
💾 缓存目录大小: 4.2M
```

### 运行时验证
进入容器检查缓存：
```bash
# 进入容器
docker exec -it one-api-offline sh

# 检查缓存文件
ls -la /tiktoken_cache/
du -sh /tiktoken_cache/

# 验证环境变量
echo $TIKTOKEN_CACHE_DIR
echo $DATA_GYM_CACHE_DIR
```

## 🌐 完全离线模式

### 方案1：使用隔离网络
```yaml
# 在docker-compose.offline.yml中启用
networks:
  isolated:
    driver: bridge
    internal: true  # 完全隔离外网
```

### 方案2：防火墙限制
```bash
# 限制容器网络访问
iptables -I DOCKER-USER -s 172.17.0.0/16 -j DROP
iptables -I DOCKER-USER -s 172.17.0.0/16 -d 172.17.0.0/16 -j ACCEPT
```

## 🛠️ 故障排除

### 问题1：tiktoken缓存下载失败
**现象**：构建时显示下载失败
```
❌ r50k_base.tiktoken 下载失败
```

**解决**：
1. 检查网络连接
2. 重新构建镜像
3. 使用代理构建：
   ```bash
   docker build \
     --build-arg HTTP_PROXY=http://proxy:8080 \
     --build-arg HTTPS_PROXY=http://proxy:8080 \
     -f Dockerfile.offline -t one-api:offline .
   ```

### 问题2：容器启动后仍尝试下载
**现象**：日志显示外网连接错误
```
Failed to download tiktoken cache
```

**解决**：
1. 检查环境变量设置
2. 验证缓存文件存在：
   ```bash
   docker exec one-api-offline ls -la /tiktoken_cache/
   ```

### 问题3：缓存文件损坏
**现象**：编码解码错误
```
tiktoken encoding error
```

**解决**：
1. 重新构建镜像
2. 手动验证缓存文件：
   ```bash
   # 下载标准文件进行对比
   curl -L https://openaipublic.blob.core.windows.net/encodings/r50k_base.tiktoken \
     | md5sum
   ```

## 📈 性能优化

### 1. 多阶段并行构建
- 前端构建并行处理3个主题
- 缓存下载与编译分离
- 最小化最终镜像大小

### 2. 缓存策略
```dockerfile
# 分层缓存优化
RUN go mod download  # 依赖层
COPY . .             # 代码层  
RUN go build ...     # 编译层
```

### 3. 资源限制
```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

## 🔄 更新维护

### 更新tiktoken缓存
如果OpenAI更新编码器，可通过以下方式更新：

1. **重新构建镜像**：
   ```bash
   docker-compose -f docker-compose.offline.yml build --no-cache
   ```

2. **手动更新缓存**：
   ```bash
   # 下载新的编码器文件
   curl -L https://openaipublic.blob.core.windows.net/encodings/new_encoding.tiktoken \
     -o ./cache/new_encoding.tiktoken
   
   # 重新构建
   docker build -f Dockerfile.offline -t one-api:offline .
   ```

### 版本管理
```bash
# 构建带版本标签的镜像
docker build -f Dockerfile.offline -t one-api:offline-v1.0.0 .
docker tag one-api:offline-v1.0.0 one-api:offline
```

## 📝 最佳实践

1. **生产环境部署**：
   - 使用具体版本标签而非latest
   - 配置健康检查
   - 设置资源限制
   - 启用日志轮转

2. **安全考虑**：
   - 使用非root用户运行
   - 限制容器权限
   - 定期更新基础镜像

3. **监控告警**：
   - 配置容器监控
   - 设置磁盘空间告警
   - 监控内存使用

## 🎉 总结

通过使用 `Dockerfile.offline` 和 `docker-compose.offline.yml`，您可以：

✅ **一次构建，随处部署** - 生成的镜像包含所有必要文件  
✅ **完全离线运行** - 无需任何外网连接  
✅ **简化部署流程** - 一条命令启动服务  
✅ **提高启动速度** - 避免运行时下载延迟  
✅ **增强稳定性** - 不依赖外部服务可用性

现在您可以在任何环境中快速部署One API，无需担心网络连接问题！ 