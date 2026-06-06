@echo off
echo ================================
echo   RAM Project Hub - Git Push
echo ================================

echo Adding hub and config files...
git add CLAUDE.md "04. Project Hub/"

echo.
set /p msg="Enter commit message (or press Enter for 'update project hub'): "
if "%msg%"=="" set msg=update project hub

git commit -m "%msg%"

echo.
echo Pushing to GitHub...
git push -u origin master

echo.
echo ================================
echo   Done! Project Hub is live.
echo ================================
pause
