# Preyansh ERP - Build & Update
# Run: .\setup.ps1
# Rebuilds the app and updates "Preyansh ERP.exe" in-place.
# Run this every time after making code changes.

Write-Host ""
Write-Host "=== Preyansh ERP - Build & Update ===" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\1 D Drive\Projects\Preyansh Industries"

# Check prerequisites
$nodeVersion = & node --version 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

$rustVersion = & rustc --version 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Rust not found. Install from https://rustup.rs" -ForegroundColor Red; exit 1 }
Write-Host "[OK] $rustVersion" -ForegroundColor Green

# Step 1: Dependencies
Write-Host ""
Write-Host "[1/3] Installing dependencies..." -ForegroundColor Yellow
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[X] npm install failed" -ForegroundColor Red; exit 1 }
Write-Host "      Done." -ForegroundColor Green

# Step 2: Build release
Write-Host "[2/3] Building release (3-15 minutes)..." -ForegroundColor Yellow
npm run tauri build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Build failed" -ForegroundColor Red; exit 1 }
Write-Host "      Done." -ForegroundColor Green

# Step 3: Copy exe
Write-Host "[3/3] Updating exe..." -ForegroundColor Yellow
Copy-Item "target\release\preyansh-erp.exe" "Preyansh ERP.exe" -Force
Write-Host "      Done." -ForegroundColor Green

Write-Host ""
Write-Host "=== UPDATE COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your app:" -ForegroundColor White
Write-Host "  C:\1 D Drive\Projects\Preyansh Industries\Preyansh ERP.exe" -ForegroundColor Yellow
Write-Host ""

$launch = Read-Host "Launch the app now? (y/n)"
if ($launch -eq "y") {
    Start-Process "Preyansh ERP.exe"
}
