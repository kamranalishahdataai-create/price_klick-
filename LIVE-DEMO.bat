@echo off
title PriceKlick Live Demo
color 0A
echo =====================================================
echo        PRICEKLICK LIVE DEMO LAUNCHER
echo =====================================================
echo.
echo Starting backend and frontend servers...
echo.

REM Start the backend server in a new window
echo [1/2] Starting Backend Server (Port 5050)...
start "PriceKlick Backend" cmd /k "cd /d %~dp0server && npm start"

REM Wait for backend to start
timeout /t 5 /nobreak > nul

REM Start the frontend development server in a new window
echo [2/2] Starting Frontend Server (Port 5173)...
start "PriceKlick Frontend" cmd /k "cd /d %~dp0web && npm run dev"

echo.
echo =====================================================
echo        SERVERS STARTING...
echo =====================================================
echo.
echo Backend API:    http://localhost:5050
echo Frontend Web:   http://localhost:5173
echo Health Check:   http://localhost:5050/api/health
echo.
echo Press any key to open the demo in your browser...
pause > nul

start http://localhost:5173

echo.
echo Demo is running! Close this window to stop servers.
pause
