@echo off

echo =======================================
echo Installing dependencies...
echo =======================================
echo.

:: Install server dependencies
echo [1/2] Installing server dependencies...
cd /d "%~dp0server"
if errorlevel 1 (
    echo ERROR: Failed to change to server directory.
    pause
    exit /b 1
)

call npm install express socket.io cors
if errorlevel 1 (
    echo ERROR: Failed to install server dependencies.
    pause
    exit /b 1
)

:: Install client dependencies
echo.
echo [2/2] Installing client dependencies...
cd /d "%~dp0client"
if errorlevel 1 (
    echo ERROR: Failed to change to client directory.
    pause
    exit /b 1
)

call npm install
if errorlevel 1 (
    echo ERROR: Failed to install client dependencies.
    pause
    exit /b 1
)

cd /d "%~dp0"
echo.
echo =======================================
echo Dependencies installed successfully!
echo Run 'start_development.bat' to start the application.
echo =======================================
echo.
pause
