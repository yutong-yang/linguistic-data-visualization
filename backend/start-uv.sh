#!/bin/bash
# UV启动脚本 - 保持原有的启动方式
# 同时支持环境变量配置

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 设置默认值
HOST=${HOST:-"0.0.0.0"}
PORT=${PORT:-"8000"}
RELOAD=${RELOAD:-"true"}
LOG_LEVEL=${LOG_LEVEL:-"info"}

echo "🚀 使用UV启动语言学知识库API服务器"
echo "📍 主机: $HOST"
echo "🔌 端口: $PORT"
echo "🔄 热重载: $RELOAD"
echo "📝 日志级别: $LOG_LEVEL"
echo "🌍 环境: ${ENVIRONMENT:-development}"
echo "🐍 使用: uv run uvicorn"

# 启动服务器
uv run uvicorn api:app --host $HOST --port $PORT --reload --log-level $LOG_LEVEL
