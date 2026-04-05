@echo off
title RAAN - Build all web apps (Rider + Driver + Car)
echo.
echo  ========================================
echo    Building: rider, driver, car, admin
echo    Output: dist-rider, dist-driver, dist-car, dist-admin
echo  ========================================
echo.
cd /d "%~dp0"
call npm run build:web:all
if errorlevel 1 exit /b 1
echo.
echo  Done. See docs\WEB_DEPLOYMENT.md for hosting.
pause
