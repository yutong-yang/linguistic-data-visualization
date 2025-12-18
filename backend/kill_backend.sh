#!/bin/bash
# 清理后端进程脚本 - 强制终止所有相关进程

echo "🔍 查找所有后端相关进程..."

# 1. 查找占用8000端口的进程
PORT_PIDS=$(lsof -ti:8000 2>/dev/null)

# 2. 查找所有uvicorn进程
UVICORN_PIDS=$(ps aux | grep uvicorn | grep -v grep | awk '{print $2}')

# 3. 查找所有uv run进程
UV_PIDS=$(ps aux | grep "uv run" | grep -v grep | awk '{print $2}')

# 合并所有PID（去重）
ALL_PIDS=$(echo "$PORT_PIDS $UVICORN_PIDS $UV_PIDS" | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' ')

if [ -z "$ALL_PIDS" ]; then
    echo "✅ 没有发现后端进程"
    exit 0
fi

echo "发现以下进程:"
if [ ! -z "$PORT_PIDS" ]; then
    echo "  占用端口8000: $PORT_PIDS"
    lsof -i:8000 | grep -v COMMAND
fi
if [ ! -z "$UVICORN_PIDS" ]; then
    echo "  uvicorn进程: $UVICORN_PIDS"
fi
if [ ! -z "$UV_PIDS" ]; then
    echo "  uv run进程: $UV_PIDS"
fi
echo ""

echo "正在强制终止这些进程..."
for PID in $ALL_PIDS; do
    if [ ! -z "$PID" ] && [ "$PID" != "" ]; then
        echo "  终止进程 $PID..."
        kill -9 $PID 2>/dev/null
    fi
done

sleep 2

# 再次检查
REMAINING_PORT=$(lsof -ti:8000 2>/dev/null)
REMAINING_PROC=$(ps aux | grep -E "(uvicorn|uv run)" | grep -v grep)

if [ -z "$REMAINING_PORT" ] && [ -z "$REMAINING_PROC" ]; then
    echo "✅ 所有进程已终止，端口8000已释放"
else
    echo "⚠️  仍有进程运行:"
    if [ ! -z "$REMAINING_PORT" ]; then
        echo "  端口8000仍被占用:"
        lsof -i:8000
    fi
    if [ ! -z "$REMAINING_PROC" ]; then
        echo "  仍有进程:"
        echo "$REMAINING_PROC"
    fi
fi
