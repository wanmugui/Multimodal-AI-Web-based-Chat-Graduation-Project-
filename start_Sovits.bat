@echo off
REM 打开 Conda Prompt 并激活指定环境
call conda activate gptsovits

REM 切换到指定目录
cd /d D:\GPT-SoVITS-main



REM 启动 app.py 服务
echo Starting webui.py...
start python webui.py

REM 保持窗口打开以便查看输出
pause
