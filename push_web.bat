@echo off
echo ================================
echo   RAM Web App - Git Push Tool
echo ================================

echo Adding web app files...
git add index.html fileview.html preview.html settings.html ai.html
git add allfiles.js allsections.js allsections.css
git add campaign.js campaign.css
git add diary.js diary.css
git add smart_desk.js smart_desk.css
git add playlist.js playlist.css
git add column1-2.js column1-2.css column3.js column3.css column4.js column4.css column5.js column5.css
git add editor.js editor.css
git add graphs.js graphs.css heatmap.js heatmap.css
git add uploaddocx.js uploadpdf.js uploadpdf.css uploadtext.js uploadtextcontent.js
git add series_modal.js series_modal.css
git add settings.js settings.css
git add ai.js ai.css ai-prompt.js ai-config.js
git add supabase_sync.js
git add theme.css fflate.js
git add sw.js manifest.json
git add CNAME _redirects
git add icon192.png icon512.png
git add .gitignore .github

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
