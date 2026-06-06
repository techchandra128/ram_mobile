@echo off
echo ================================
echo   RAM Web App - Git Push Tool
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
echo Adding web app files...
git add .

echo.
set /p msg="Enter commit message (or press Enter for 'update web'): "
if "%msg%"=="" set msg=update web

git commit -m "%msg%"

echo.
echo Pulling latest from remote...
git pull origin master --no-rebase

echo.
echo Pushing to GitHub...
git push origin master

echo.
echo ================================
echo   Done! GitHub Pages will deploy in
echo   1-2 minutes.
echo ================================
pause
