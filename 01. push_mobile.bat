@echo off
echo ================================
echo   RAM Mobile - Git Push Tool
echo ================================

:: Check if git repo already initialized
if not exist ".git" (
    echo Initializing git repo...
    git init
    git remote add origin https://github.com/techchandra128/ram_mobile.git
    echo Git initialized.
) else (
    echo Git repo already exists. Skipping init.
)

echo.

:: Read and show current cache version
for /f "tokens=2 delims='" %%a in ('findstr "const CACHE" sw_mobile.js') do set "currentver=%%a"
echo Current cache version: %currentver%

echo.
set /p newnum="Enter new version number (e.g. 9, press Enter to skip): "

if not "%newnum%"=="" (
    powershell -Command "(Get-Content 'sw_mobile.js') -replace 'ram-mobile-v\d+', 'ram-mobile-v%newnum%' | Set-Content 'sw_mobile.js' -Encoding UTF8"
    echo Cache updated to: ram-mobile-v%newnum%
) else (
    echo Skipping version update.
)

echo.
echo Adding mobile files...
git add mobile.html mobile_core.css mobile_library.css mobile_smartdesk.css mobile_dashboard.css mobile_diary.css mobile_core.js mobile_library.js mobile_smartdesk.js mobile_dashboard.js mobile_diary.js sw_mobile.js mobile_manifest.json icon192.png icon512.png

echo.
set /p msg="Enter commit message (or press Enter for 'update mobile'): "
if "%msg%"=="" set msg=update mobile

git commit -m "%msg%"

echo.
echo Pushing to GitHub...
git push -u origin master

echo.
echo ================================
echo   Done! GitHub Pages will deploy in
echo   1-2 minutes.
echo ================================
pause
