#!/usr/bin/env python3
"""
后端启动脚本
支持环境变量配置，避免硬编码
兼容原有的uv run uvicorn启动方式
"""

import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量文件
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    load_dotenv(env_file)

def main():
    """主启动函数"""
    # 从环境变量获取配置
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info")
    
    print(f"🚀 启动语言学知识库API服务器")
    print(f"📍 主机: {host}")
    print(f"🔌 端口: {port}")
    print(f"🔄 热重载: {reload}")
    print(f"📝 日志级别: {log_level}")
    print(f"🌍 环境: {os.getenv('ENVIRONMENT', 'development')}")
    print(f"🐍 使用: Python uvicorn")
    print(f"💡 提示: 也可以使用 'uv run uvicorn api:app --host {host} --port {port} --reload'")
    
    # 启动服务器
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=reload,
        log_level=log_level,
        access_log=True
    )

if __name__ == "__main__":
    main()
