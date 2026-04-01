@echo off
title RAAN - All Apps
echo.
echo  ========================================
echo    RAAN - Starting All 4 Apps
echo    Rider:  http://localhost:8081
echo    Driver: http://localhost:8082
echo    Admin:  http://localhost:8083
echo    Car:    http://localhost:8084
echo  ========================================
echo.
start "RAAN Rider"  cmd /c "npm run dev:rider"
start "RAAN Driver" cmd /c "npm run dev:driver"
start "RAAN Admin"  cmd /c "npm run dev:admin"
start "RAAN Car"    cmd /c "npm run dev:car"
echo  All 4 apps started in separate windows.
echo  Close this window anytime.
pause
