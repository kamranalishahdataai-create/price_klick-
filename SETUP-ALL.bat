@echo off
REM SETUP-ALL.bat - Install all dependencies for PriceKlick

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║      Setting Up PriceKlick - All Dependencies            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "projectRoot=%~dp0"
echo 📁 Project Root: %projectRoot%

REM Check Node.js installation
echo.
echo 🔍 Checking Node.js installation...
node --version
npm --version

REM Install server dependencies
echo.
echo 📦 Installing Backend Server dependencies...
cd /d "%projectRoot%server"
call npm install
if errorlevel 1 (
    echo ❌ Failed to install backend dependencies
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed successfully

REM Install web dependencies
echo.
echo 📦 Installing Frontend Web dependencies...
cd /d "%projectRoot%web"
call npm install
if errorlevel 1 (
    echo ❌ Failed to install frontend dependencies
    pause
    exit /b 1
)
echo ✅ Frontend dependencies installed successfully

cd /d "%projectRoot%"

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║              ✅ Setup Complete!                          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo 🚀 Next Steps:
echo    1. Run: START-ALL.bat
echo    2. Or manually start each service (see SETUP.md)
echo    3. Load the extension in Chrome (chrome://extensions)
echo.
echo 📚 For more details, see SETUP.md
echo.

pause
