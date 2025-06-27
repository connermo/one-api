FROM --platform=$BUILDPLATFORM node:16 AS builder

WORKDIR /web
COPY ./VERSION .
COPY ./web .

WORKDIR /web/default
RUN npm install
RUN DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat VERSION) npm run build

WORKDIR /web/berry
RUN npm install
RUN DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat VERSION) npm run build

WORKDIR /web/air
RUN npm install
RUN DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat VERSION) npm run build

FROM golang:alpine AS builder2

RUN apk add --no-cache \
    gcc \
    musl-dev \
    sqlite-dev \
    build-base \
    curl \
    wget

ENV GO111MODULE=on \
    CGO_ENABLED=1 \
    GOOS=linux

WORKDIR /build
ADD go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=builder /web/build ./web/build

# 设置tiktoken缓存目录并下载缓存文件
ENV TIKTOKEN_CACHE_DIR=/build/tiktoken_cache
ENV DATA_GYM_CACHE_DIR=/build/tiktoken_cache
RUN mkdir -p /build/tiktoken_cache

# 下载tiktoken缓存文件
RUN echo "🌐 下载 tiktoken 缓存文件..." && \
    cd /build/tiktoken_cache && \
    BASE_URL="https://openaipublic.blob.core.windows.net/encodings" && \
    FILES="r50k_base.tiktoken p50k_base.tiktoken cl100k_base.tiktoken o200k_base.tiktoken" && \
    for file in $FILES; do \
        echo "📥 下载 $file ..."; \
        curl -L -o "$file" "$BASE_URL/$file"; \
    done && \
    echo "📊 下载完成" && \
    ls -la

RUN go build -trimpath -ldflags "-s -w -X 'github.com/songquanpeng/one-api/common.Version=$(cat VERSION)' -linkmode external -extldflags '-static'" -o one-api

FROM alpine:latest

RUN apk update \
    && apk upgrade \
    && apk add --no-cache ca-certificates tzdata wget \
    && update-ca-certificates 2>/dev/null || true

COPY --from=builder2 /build/one-api /
COPY --from=builder2 /build/tiktoken_cache /tiktoken_cache

# 设置tiktoken缓存环境变量
ENV TIKTOKEN_CACHE_DIR=/tiktoken_cache
ENV DATA_GYM_CACHE_DIR=/tiktoken_cache

EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/one-api"]