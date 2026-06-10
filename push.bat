@echo off
echo ================================
echo   RAM - Git Push Tool
echo ================================
echo.

:: Read current version from sw_mobile.js
for /f "tokens=2 delims='" %%a in ('findstr "const CACHE" sw_mobile.js') do set "currentver=%%a"
set "vernum=%currentver:ram-mobile-v=%"
echo Current version: %vernum%
echo.
set /p newver="New version number? (press Enter to skip): "

if not "%newver%"=="" (
    powershell -Command "(Get-Content 'sw_mobile.js') -replace 'ram-mobile-v[\d.]+', 'ram-mobile-v%newver%' | Set-Content 'sw_mobile.js' -Encoding UTF8"
    powershell -Command "(Get-Content 'sw.js') -replace 'ram-v[\d.]+', 'ram-v%newver%' | Set-Content 'sw.js' -Encoding UTF8"
    echo Version updated to: %newver%
) else (
    echo Version unchanged.
)

echo.
echo Staging all changed files...
git add -A

echo.
set /p msg="Commit message (or press Enter for 'update'): "
if "%msg%"=="" set msg=update

git commit -m "%msg%"

echo.
echo Pulling latest...
git pull origin master --no-rebase

echo.
echo Pushing to GitHub...
git push origin master

echo.
echo ================================
echo   Done! Site updates in 1-2 min.
echo ================================
pause
