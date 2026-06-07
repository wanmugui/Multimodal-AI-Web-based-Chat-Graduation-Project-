@echo off
REM 打开 Conda Prompt 并激活指定环境
call conda activate gptsovits

REM 切换到指定目录
cd /d D:\GPT-SoVITS-main

REM 启动 api.py 服务（语音合成服务）
echo Starting api.py...
start cmd /k "python api.py"

REM 等待2秒确保api服务启动
timeout /t 2 /nobreak

REM 启动 app.py 服务（主应用服务）
echo Starting app.py...
start cmd /k "python app.py"

REM 保持窗口打开以便查看输出
pause
