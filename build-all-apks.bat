@echo off
REM ران - بناء APK Debug لجميع الأنواع
REM الاستخدام: build-all-apks.bat

setlocal enabledelayedexpansion

echo.
echo ====================================
echo  ران RAAN - بناء جميع ملفات APK
echo ====================================
echo.

set "ROOT=%~dp0"
cd /d "%ROOT%"

REM === Driver (كابتن) ===
echo [1/3] Building Driver (com.raan.captain)...
call npm run build:driver
if errorlevel 1 (echo FAILED: build:driver & exit /b 1)
copy /Y "dist-driver\driver.html" "dist-driver\index.html" >nul
copy /Y "capacitor.driver.config.ts" "capacitor.config.ts" >nul
call scripts\patch-android.bat driver
call npx cap sync android
cd android
set ANDROID_HOME=C:\Users\AN\AppData\Local\Android\Sdk
call gradlew.bat assembleDebug
if errorlevel 1 (echo FAILED: gradle driver & exit /b 1)
cd ..
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "raan-captain-debug.apk" >nul
echo [OK] raan-captain-debug.apk
echo.

REM === Rider (راكب) ===
echo [2/3] Building Rider (com.raan.rider)...
call npm run build:rider
if errorlevel 1 (echo FAILED: build:rider & exit /b 1)
copy /Y "dist-rider\rider.html" "dist-rider\index.html" >nul
copy /Y "capacitor.rider.config.ts" "capacitor.config.ts" >nul
call scripts\patch-android.bat rider
call npx cap sync android
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (echo FAILED: gradle rider & exit /b 1)
cd ..
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "raan-rider-debug.apk" >nul
echo [OK] raan-rider-debug.apk
echo.

REM === Car (سيارة) ===
echo [3/3] Building Car (com.raan.car)...
call npm run build:car
if errorlevel 1 (echo FAILED: build:car & exit /b 1)
copy /Y "dist-car\car.html" "dist-car\index.html" >nul
copy /Y "capacitor.car.config.ts" "capacitor.config.ts" >nul
call scripts\patch-android.bat car
call npx cap sync android
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (echo FAILED: gradle car & exit /b 1)
cd ..
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "raan-car-debug.apk" >nul
echo [OK] raan-car-debug.apk
echo.

REM === Restore default config ===
copy /Y "capacitor.rider.config.ts" "capacitor.config.ts" >nul

echo ====================================
echo  تم بنجاح! الملفات:
echo   - raan-captain-debug.apk
echo   - raan-rider-debug.apk
echo   - raan-car-debug.apk
echo ====================================
echo.
echo الحمد لله رب العالمين
