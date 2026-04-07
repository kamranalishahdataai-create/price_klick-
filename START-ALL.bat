@echo off
REM START-ALL.bat - Start all PriceKlick services

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║      Starting PriceKlick - All Services                 ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set "projectRoot=%~dp0"
echo 📁 Project Root: %projectRoot%

echo 🔷 Starting Backend Server...
echo 🔷 Starting Frontend Web App...
echo 🔷 Starting Information Display...
echo.

REM Open new CMD window for backend server
start "PriceKlick - Backend Server" cmd /k "cd /d %projectRoot%server && npm run dev"

REM Wait a bit before starting frontend
timeout /t 2 /nobreak

REM Open new CMD window for frontend
start "PriceKlick - Frontend App" cmd /k "cd /d %projectRoot%web && npm run dev"

REM Wait and show info
timeout /t 2 /nobreak
node "%projectRoot%print-info.js"

echo.
echo ✅ All services started!
echo 📱 Backend:   http://127.0.0.1:5050
echo 🌐 Frontend:  http://localhost:3000
echo 🔌 Extension: Load from ./extension folder in Chrome
echo.
echo ℹ️  See SETUP.md for detailed instructions
echo.

pause
