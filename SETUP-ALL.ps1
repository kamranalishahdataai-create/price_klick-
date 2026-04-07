#!/usr/bin/env powershell
# SETUP-ALL.ps1 - Install all dependencies for PriceKlick

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Setting Up PriceKlick - All Dependencies            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$projectRoot = (Get-Item $PSScriptRoot).FullName

Write-Host "📁 Project Root: $projectRoot" -ForegroundColor Yellow

# Check Node.js installation
Write-Host "`n🔍 Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
Write-Host "✅ npm: $npmVersion" -ForegroundColor Green

# Install server dependencies
Write-Host "`n📦 Installing Backend Server dependencies..." -ForegroundColor Yellow
Set-Location "$projectRoot\server"
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

# Install web dependencies
Write-Host "`n📦 Installing Frontend Web dependencies..." -ForegroundColor Yellow
Set-Location "$projectRoot\web"
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Frontend dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}

Set-Location $projectRoot

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ Setup Complete!                          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run: .\START-ALL.ps1" -ForegroundColor White
Write-Host "   2. Or manually start each service (see SETUP.md)" -ForegroundColor White
Write-Host "   3. Load the extension in Chrome (chrome://extensions)" -ForegroundColor White
Write-Host "`n📚 For more details, see SETUP.md`n" -ForegroundColor Yellow

Read-Host "Press Enter to exit"
