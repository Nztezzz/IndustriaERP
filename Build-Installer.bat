@echo off
title Preyansh ERP - Build Shareable Installer
echo.
echo ==========================================================
echo   Preyansh ERP - Build Shareable Installer
echo ==========================================================
echo.
echo This rebuilds the app and produces a single installer file
echo you can send to anyone. They do NOT need Node.js or Rust.
echo.
echo Output:  Installer\Preyansh-ERP-Setup-v0.1.0.exe
echo.
echo This takes 3-15 minutes. Press any key to start...
pause >nul
echo.

cd /d "%~dp0"

echo [1/4] Closing any running copy of the app...
taskkill /IM "preyansh-erp.exe" /F >nul 2>&1
taskkill /IM "Preyansh ERP.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul
echo       Done.
echo.

echo [2/4] Installing dependencies...
call npm install >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install failed. Is Node.js installed?
    echo        Download it from https://nodejs.org
    pause
    exit /b 1
)
echo       Done.
echo.

echo [3/4] Building release installer ^(this is the slow part^)...
call npm run tauri build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed. Scroll up to see the reason.
    pause
    exit /b 1
)
echo       Done.
echo.

echo [4/4] Copying installer to the Installer folder...
if not exist "Installer" mkdir "Installer"
copy /Y "target\release\bundle\nsis\Preyansh ERP_0.1.0_x64-setup.exe" "Installer\Preyansh-ERP-Setup-v0.1.0.exe" >nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not find the built installer.
    echo        Expected at: target\release\bundle\nsis\
    pause
    exit /b 1
)
echo       Done.
echo.

echo ==========================================================
echo   BUILD COMPLETE
echo.
echo   Send BOTH of these files to whoever needs the app:
echo.
echo     Installer\Preyansh-ERP-Setup-v0.1.0.exe
echo     Installer\README.txt
echo.
echo   Or just zip the whole "Installer" folder and send that.
echo ==========================================================
echo.

set /p openfolder="Open the Installer folder now? (y/n): "
if /i "%openfolder%"=="y" start "" "%~dp0Installer"
