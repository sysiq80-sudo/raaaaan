@echo off
chcp 65001 >nul
echo ========================================
echo    تحديث DSN Sentry الحقيقي
echo ========================================
echo.
echo الرجاء نسخ DSN الحقيقي من Sentry وإدخاله أدناه:
echo (من https://raan-nf.sentry.io/settings/projects/[اسم-المشروع]/keys/)
echo.
echo مثال: https://abcd1234@sentry.io/123456789
echo.

set /p REAL_DSN="أدخل DSN الحقيقي: "

if "%REAL_DSN%"=="" (
    echo خطأ: DSN مطلوب!
    pause
    exit /b 1
)

echo.
echo تحديث .env...
powershell -Command "(Get-Content .env) -replace 'VITE_SENTRY_DSN=.*', 'VITE_SENTRY_DSN=\""%REAL_DSN%\""' | Set-Content .env"

echo.
echo تحديث .env.production...
powershell -Command "(Get-Content .env.production) -replace 'VITE_SENTRY_DSN=.*', 'VITE_SENTRY_DSN=%REAL_DSN%' | Set-Content .env.production"

echo.
echo تحديث قاعدة البيانات...
powershell -Command "
$svcHeaders = @{
  'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MDcwOTYsImV4cCI6MjA4MTE4MzA5Nn0.d71qwqbrpRlBv502ShvhxZWfrmwQI6yWLdSZlaLhtzo'
  'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb2xrY3p0ZHJ3ZHBod2p2cXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTYwNzA5NiwiZXhwIjoyMDgxMTgzMDk2fQ.fE5FXZDa_WLBXaDnu4VFw2aIoT3sXh-egvddmrJQV9o'
  'Content-Type' = 'application/json'
}
$body = '{\"value\": \"'%REAL_DSN%'\", \"description\": \"Sentry DSN لمراقبة الأخطاء\"}'
try {
  Invoke-RestMethod -Method PATCH -Uri 'https://wgolkcztdrwdphwjvqxt.supabase.co/rest/v1/app_settings?key=eq.sentry_dsn' -Headers $svcHeaders -Body $body
  Write-Host '✅ تم تحديث قاعدة البيانات بنجاح'
} catch {
  Write-Host '⚠️ تحذير: فشل تحديث قاعدة البيانات، لكن تم تحديث الملفات المحلية'
}
"

echo.
echo ✅ تم تحديث DSN بنجاح!
echo.
echo الآن يمكنك:
echo 1. إعادة تشغيل التطبيق: npm run dev
echo 2. اختبار Sentry من لوحة Admin → التكاملات
echo 3. مراقبة الأخطاء في https://raan-nf.sentry.io/issues/
echo.
pause