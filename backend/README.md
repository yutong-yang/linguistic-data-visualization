---
title: GlobalMosaic Backend
emoji: 🌍
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
---

## 快速开始

### 为什么使用 UV？

**UV** 是一个用 Rust 编写的极速 Python 包管理器，比 pip 快 **10-100倍**：

- ⚡ **极速安装**: 依赖安装速度提升10-100倍
- 🔒 **依赖锁定**: 自动生成 `uv.lock`，确保环境一致
- 🎯 **项目管理**: 类似 npm，统一管理项目依赖
- 🚀 **现代化**: 支持虚拟环境、依赖解析等

**对比**:
- `pip install -e .` → 可能需要几分钟
- `uv pip install -e .` → 通常几秒钟

### 安装依赖

```bash
# 1. 安装 uv (如果未安装)
pip install uv
# 或
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. 安装项目依赖 (使用 uv，推荐)
uv pip install -e .

# 或使用传统 pip (较慢)
pip install -e .
```

### 启动服务

```bash
# 使用 uv (推荐，自动管理环境)
./start-uv.sh        # Mac/Linux
start-uv.bat         # Windows

# 或使用标准 Python
python start.py
```

### 可选：安装 Ollama (用于更好的 embedding)

```bash
# Mac
brew install ollama
brew services start ollama
ollama pull nomic-embed-text

# Linux
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull nomic-embed-text
```

**注意**: Ollama 是可选的，系统会自动回退到 sentence-transformers 或 TF-IDF。

---

## 常见问题

### 端口被占用？Ctrl+C 关不掉？

**原因**: 
- `Ctrl+Z` 是挂起进程（不是终止），进程仍在运行
- `Ctrl+C` 可能没有完全终止所有子进程（特别是使用 `uv run` 时）
- 多层进程（uv → uvicorn → Python）需要多次终止

**解决方法**:

```bash
# 方法1: 使用清理脚本（推荐，一键清理所有相关进程）
./kill_backend.sh

# 方法2: 手动清理
lsof -ti:8000 | xargs kill -9
ps aux | grep uvicorn | grep -v grep | awk '{print $2}' | xargs kill -9
ps aux | grep "uv run" | grep -v grep | awk '{print $2}' | xargs kill -9
```

**正确停止方式**:
- ✅ 使用 `Ctrl+C`（在启动的终端中，可能需要按2-3次）
- ✅ 如果 `Ctrl+C` 无效，直接运行 `./kill_backend.sh`
- ❌ 不要使用 `Ctrl+Z`（会挂起进程，导致端口占用）

---

## UV 使用说明

- `uv init`: Create a new Python project with a pyproject.toml file
- `uv add`: Add a dependency to the project
- `uv remove`: Remove a dependency from the project
- `uv sync`: Sync the project's dependencies
- `uv run`: Run a command in the project environment