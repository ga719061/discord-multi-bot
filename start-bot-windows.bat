@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start-bot-windows.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo Launcher exited with error code %EXIT_CODE%.
) else (
  echo Bot process exited normally.
)
pause
exit /b %EXIT_CODE%
