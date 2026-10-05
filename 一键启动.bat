@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
set RC=%ERRORLEVEL%
if /i "%~1"=="--selftest" exit /b %RC%
echo.
pause
exit /b %RC%
