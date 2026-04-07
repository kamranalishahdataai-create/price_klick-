#!/usr/bin/env powershell
# START-ALL.ps1 - Start all PriceKlick services

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Starting PriceKlick - All Services                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$projectRoot = (Get-Item $PSScriptRoot).FullName

Write-Host "📁 Project Root: $projectRoot" -ForegroundColor Yellow
Write-Host "🔷 Starting Backend Server..." -ForegroundColor Green
Write-Host "🔷 Starting Frontend Web App..." -ForegroundColor Green
Write-Host "🔷 Starting Information Display..." -ForegroundColor Green
Write-Host "`n" -ForegroundColor White

# Open new PowerShell window for backend server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\server'; npm run dev"

# Wait a bit before starting frontend
Start-Sleep -Seconds 2

# Open new PowerShell window for frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\web'; npm run dev"

# Wait and show info
Start-Sleep -Seconds 2
node "$projectRoot\print-info.js"

Write-Host "`n✅ All services started!" -ForegroundColor Green
Write-Host "📱 Backend:   http://127.0.0.1:5050" -ForegroundColor Cyan
Write-Host "🌐 Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔌 Extension: Load from ./extension folder in Chrome" -ForegroundColor Cyan
Write-Host "`nℹ️  See SETUP.md for detailed instructions`n" -ForegroundColor Yellow
