@echo off
echo 正在启动待办事项应用程序...
echo.
cd /d "%~dp0"
cd dist\win-unpacked
"待办事项.exe"
echo 应用程序已关闭。
pause
