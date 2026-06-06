@echo off
echo ================================
echo   RAM Web App - Git Push Tool
echo ================================

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
