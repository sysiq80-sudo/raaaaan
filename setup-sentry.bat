@echo off
echo ========================================
echo    إعداد Sentry DSN لتطبيق ران RAAN
echo ========================================
echo.
echo الرجاء نسخ DSN من Sentry وإدخاله أدناه:
echo (من https://raan-nf.sentry.io/settings/projects/[project-name]/keys/)
echo.
set /p DSN="أدخل DSN: "

if "%DSN%"=="" (
    echo خطأ: DSN مطلوب!
    pause
    exit /b 1
)

echo.
echo تحديث .env...
echo VITE_SENTRY_DSN="%DSN%"> temp_env.txt
for /f "tokens=*" %%i in (.env) do (
    echo %%i | findstr /v "VITE_SENTRY_DSN" >> temp_env.txt
)
move /y temp_env.txt .env >nul

echo.
echo تحديث .env.production...
powershell -Command "(Get-Content .env.production) -replace 'VITE_SENTRY_DSN=.*', 'VITE_SENTRY_DSN=%DSN%' | Set-Content .env.production"

echo.
echo ✅ تم تحديث DSN بنجاح!
echo.
echo الآن يمكنك:
echo 1. تشغيل التطبيق: npm run dev
echo 2. اختبار Sentry من لوحة Admin
echo.
pause