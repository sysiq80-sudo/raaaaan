@echo off
chcp 65001 >nul
echo ========================================
echo    تشغيل تطبيقات الويب - ران RAAN
echo ========================================
echo.

:: تنظيف البورتات المشغولة من جلسات سابقة
echo تنظيف البورتات القديمة 8081-8084...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8084 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8083 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8082 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING 2^>nul') do taskkill /PID %%a /F >nul 2>&1
echo تم التنظيف.
echo.

echo [1] Rider Web App
echo     - http://localhost:8081
start "RAAN Rider" cmd /k "cd /d d:\projects\taksi-iraqi\RAAN\RAAN && npm run dev:rider"

echo [2] Driver Web App
echo     - http://localhost:8082
start "RAAN Driver" cmd /k "cd /d d:\projects\taksi-iraqi\RAAN\RAAN && npm run dev:driver"

echo [3] Admin Web App
echo     - http://localhost:8083
start "RAAN Admin" cmd /k "cd /d d:\projects\taksi-iraqi\RAAN\RAAN && npm run dev:admin"

echo [4] Car Web App
echo     - http://localhost:8084
start "RAAN Car" cmd /k "cd /d d:\projects\taksi-iraqi\RAAN\RAAN && npm run dev:car"

echo.
echo ========================================
echo    تطبيقات الويب تعمل الآن!
echo ========================================
echo.
echo الروابط:
echo   Rider : http://localhost:8081
echo   Driver: http://localhost:8082
echo   Admin : http://localhost:8083
echo   Car   : http://localhost:8084
echo.
pause