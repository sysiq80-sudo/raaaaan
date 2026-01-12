@echo off
chcp 65001 >nul
cls

echo ================================================
echo    🚗 تطبيق ران للتاكسي الذكي
echo    RAAN - Smart Taxi Application
echo ================================================
echo.

:: التحقق من وجود Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ خطأ: Node.js غير مثبت
    echo    يرجى تثبيت Node.js من: https://nodejs.org
    pause
    exit /b 1
)

:: عرض إصدار Node.js
echo ✅ Node.js مثبت
node --version
echo.

:: التحقق من وجود node_modules
if not exist "node_modules\" (
    echo 📦 تثبيت المكتبات للمرة الأولى...
    echo    هذا قد يستغرق بضع دقائق...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ❌ فشل تثبيت المكتبات
        pause
        exit /b 1
    )
    echo.
    echo ✅ تم تثبيت المكتبات بنجاح
    echo.
)

:: التحقق من ملف .env
if not exist ".env" (
    echo ⚠️  تحذير: ملف .env غير موجود
    echo    سيتم استخدام الإعدادات الافتراضية
    echo.
)

:: الحصول على عنوان IP الفعلي للشبكة
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4 Address"') do set NETWORK_IP=%%i

echo 🚀 بدء تشغيل التطبيق...
echo.
echo ================================================
echo    سيتم فتح التطبيق في المتصفح تلقائياً
echo.
echo    الرابط المحلي: http://localhost:8081
echo    الرابط على الشبكة: http://%NETWORK_IP%:8081
echo.
echo    للإيقاف: اضغط Ctrl+C
echo ================================================
echo.

:: تشغيل التطبيق
npm run dev

:: في حالة حدوث خطأ
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ حدث خطأ أثناء تشغيل التطبيق
    echo.
    pause
)
