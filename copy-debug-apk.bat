@echo off
REM ينسخ آخر app-debug.apk إلى local-builds\raan-android-debug-latest.apk
cd /d "%~dp0"
set "SRC=android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%SRC%" (
  echo [خطأ] لم يُوجد APK. شغّل أولاً: cd android ^&^& gradlew :app:assembleDebug
  echo أو: npm run apk:rider
  pause
  exit /b 1
)
if not exist "local-builds" mkdir local-builds
copy /Y "%SRC%" "local-builds\raan-android-debug-latest.apk" >nul
echo.
echo  تم النسخ إلى:
echo  %~dp0local-builds\raan-android-debug-latest.apk
echo.
pause
