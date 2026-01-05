@echo off
chcp 65001 >nul
cls

echo ================================================
echo    🚗 تطبيق ران للتاكسي الذكي
echo    RAAN - Smart Taxi Application
echo ================================================
echo.
echo    ملف تشغيل التطبيق للمستخدمين الآخرين
echo    Batch file to run the app for other users
echo ================================================
echo.

:: التحقق من وجود Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ خطأ: Node.js غير مثبت
    echo    يرجى تثبيت Node.js من: https://nodejs.org
    echo    Please install Node.js from: https://nodejs.org
    pause
    exit /b 1
)

:: عرض إصدار Node.js
echo ✅ Node.js مثبت (Node.js is installed)
node --version
echo.

:: التحقق من وجود node_modules
if not exist "node_modules\" (
    echo 📦 تثبيت المكتبات المطلوبة للمرة الأولى...
    echo    Installing required libraries for the first time...
    echo    هذا قد يستغرق بضع دقائق...
    echo    This may take a few minutes...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ❌ فشل تثبيت المكتبات (Failed to install libraries)
        pause
        exit /b 1
    )
    echo.
    echo ✅ تم تثبيت المكتبات بنجاح (Libraries installed successfully)
    echo.
)

:: التحقق من ملف .env
if not exist ".env" (
    echo ⚠️  تحذير: ملف .env غير موجود
    echo    Warning: .env file not found
    echo    سيتم استخدام الإعدادات الافتراضية
    echo    Default settings will be used
    echo.
)

echo 🚀 بدء تشغيل التطبيق...
echo    Starting the application...
echo.
echo ================================================
echo    سيتم فتح التطبيق في المتصفح تلقائياً
echo    The application will open in the browser automatically
echo    الرابط: http://localhost:8080
echo    URL: http://localhost:8080
echo.
echo    للإيقاف: اضغط Ctrl+C
echo    To stop: Press Ctrl+C
echo ================================================
echo.

:: فتح المتصفح تلقائياً
start http://localhost:8080

:: تشغيل التطبيق
npm run dev

:: في حالة حدوث خطأ
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ حدث خطأ أثناء تشغيل التطبيق
    echo    An error occurred while running the application
    echo.
    pause
)