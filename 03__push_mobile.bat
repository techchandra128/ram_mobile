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
echo Adding mobile files...
git add .

echo.
set /p msg="Enter commit message (or press Enter for 'update mobile'): "
if "%msg%"=="" set msg=update mobile

git commit -m "%msg%"

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo ================================
echo   Done! GitHub Pages will deploy in
echo   1-2 minutes.
echo ================================
pause
