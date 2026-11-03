@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then reopen this file.
  pause
  exit /b 1
)
if not exist "node_modules\astro\package.json" (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts/editor.mjs --open
pause
