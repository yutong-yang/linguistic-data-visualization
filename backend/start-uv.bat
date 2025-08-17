@echo off
REM UV启动脚本 - Windows版本
REM 保持原有的启动方式，同时支持环境变量配置

echo 🚀 使用UV启动语言学知识库API服务器

REM 设置默认值
set HOST=%HOST%
if "%HOST%"=="" set HOST=0.0.0.0

set PORT=%PORT%
if "%PORT%"=="" set PORT=8000

set RELOAD=%RELOAD%
if "%RELOAD%"=="" set RELOAD=true

set LOG_LEVEL=%LOG_LEVEL%
if "%LOG_LEVEL%"=="" set LOG_LEVEL=info

set ENVIRONMENT=%ENVIRONMENT%
if "%ENVIRONMENT%"=="" set ENVIRONMENT=development

echo 📍 主机: %HOST%
echo 🔌 端口: %PORT%
echo 🔄 热重载: %RELOAD%
echo 📝 日志级别: %LOG_LEVEL%
echo 🌍 环境: %ENVIRONMENT%
echo 🐍 使用: uv run uvicorn

REM 启动服务器
uv run uvicorn api:app --host %HOST% --port %PORT% --reload --log-level %LOG_LEVEL%

pause
