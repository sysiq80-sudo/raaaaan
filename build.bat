@echo off
chcp 65001 >nul
cls

echo ================================================
echo    🚗 بناء تطبيق ران للإنتاج
echo    RAAN - Production Build
echo ================================================
echo.

:: التحقق من وجود Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ خطأ: Node.js غير مثبت
    pause
    exit /b 1
)

:: التحقق من وجود node_modules
if not exist "node_modules\" (
    echo 📦 تثبيت المكتبات...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ فشل تثبيت المكتبات
        pause
        exit /b 1
    )
)

echo 🔨 بدء عملية البناء...
echo.

:: بناء التطبيق
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo ✅ تم بناء التطبيق بنجاح!
    echo    المجلد: dist\
    echo ================================================
    echo.
    
    :: عرض حجم المجلد
    if exist "dist\" (
        echo 📊 معلومات البناء:
        dir dist /s /-c | find "File(s)"
        echo.
    )
) else (
    echo.
    echo ❌ فشل بناء التطبيق
    echo.
)

pause
