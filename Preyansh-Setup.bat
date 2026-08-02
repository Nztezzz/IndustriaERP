@echo off
title Preyansh ERP - Build ^& Update
echo.
echo ============================================
echo   Preyansh ERP - Build ^& Update
echo ============================================
echo.
echo This will rebuild the app and update your
echo "Preyansh ERP.exe" in the project folder.
echo Run this every time after making code changes.
echo.

cd /d "C:\1 D Drive\Projects\Preyansh Industries"

echo [1/3] Installing dependencies...
call npm install >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)
echo       Done.

echo [2/3] Building release (this takes 3-15 minutes)...
call npm run tauri build >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Build failed. Run manually to see details:
    echo        npm run tauri build
    pause
    exit /b 1
)
echo       Done.

echo [3/3] Copying exe...
copy /Y "target\release\preyansh-erp.exe" "Preyansh ERP.exe" >nul
echo       Done.

echo.
echo ============================================
echo   UPDATE COMPLETE
echo.
echo   Your app: "C:\1 D Drive\Projects\Preyansh Industries\Preyansh ERP.exe"
echo.
echo   Double-click "Preyansh ERP.exe" to launch.
echo ============================================
echo.

set /p launch="Launch the app now? (y/n): "
if /i "%launch%"=="y" (
    start "" "Preyansh ERP.exe"
)
