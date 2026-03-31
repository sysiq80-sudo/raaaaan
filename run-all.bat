@echo off
title RAAN - All Apps
echo.
echo  ========================================
echo    RAAN - Starting All 3 Apps
echo    Rider:  http://localhost:8081
echo    Driver: http://localhost:8082
echo    Admin:  http://localhost:8083
echo  ========================================
echo.
start "RAAN Rider"  cmd /c "npm run dev:rider"
start "RAAN Driver" cmd /c "npm run dev:driver"
start "RAAN Admin"  cmd /c "npm run dev:admin"
echo  All 3 apps started in separate windows.
echo  Close this window anytime.
pause
