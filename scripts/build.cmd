@echo off
setlocal

set SCRIPT_DIR=%~dp0
set SCRIPT_PS1=%SCRIPT_DIR%build.ps1

chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PS1%" %*
exit /b %errorlevel%
