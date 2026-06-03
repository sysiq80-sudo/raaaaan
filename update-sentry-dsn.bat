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
$serviceRoleKey = ''
$anonKey = ''
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)') {
      $serviceRoleKey = $Matches[1].Trim(' `\"''')
    }
    if ($_ -match '^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.*)') {
      $anonKey = $Matches[1].Trim(' `\"''')
    }
  }
}
if (-not $serviceRoleKey) { $serviceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY }
if (-not $anonKey) { $anonKey = $env:VITE_SUPABASE_ANON_KEY }

if (-not $serviceRoleKey) {
  Write-Host '❌ خطأ: لم يتم العثور على SUPABASE_SERVICE_ROLE_KEY في ملف .env أو في متغيرات البيئة' -ForegroundColor Red
  exit 1
}

$svcHeaders = @{
  'apikey' = $anonKey
  'Authorization' = 'Bearer ' + $serviceRoleKey
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