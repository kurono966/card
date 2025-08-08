@echo off
chcp 65001 >nul

echo Starting development servers...
echo.

:: Change to the script directory
cd /d %~dp0

echo Starting server...
start "NeoCard Server" cmd /k "cd /d "%~dp0server" && echo Starting server... && node index.js"

:: Wait a bit
timeout /t 5 >nul

echo Starting client...
start "NeoCard Client" cmd /k "cd /d "%~dp0client" && echo Starting client... && npm start"

echo.
echo Development servers started.
echo Server: http://localhost:3001
echo Client: http://localhost:3000
echo.
echo If browser doesn't open automatically, please visit the URLs above.
echo.
echo Press any key to close this window...
pause >nul
