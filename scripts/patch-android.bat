@echo off
REM ============================================================
REM patch-android.bat — يعدل هوية التطبيق (applicationId + strings)
REM الاستخدام: scripts\patch-android.bat rider
REM           scripts\patch-android.bat driver
REM ============================================================

set "TARGET=%~1"
set "GRADLE=android\app\build.gradle"
set "STRINGS=android\app\src\main\res\values\strings.xml"
set "GSERVICES=android\app\google-services.json"

if "%TARGET%"=="rider" (
    echo [PATCH] Patching Android for RIDER ^(com.raan.rider^) ...
    copy /Y "scripts\strings-rider.xml" "%STRINGS%" >nul
    copy /Y "scripts\google-services-rider.json" "%GSERVICES%" >nul
    powershell -NoProfile -Command "$f='%GRADLE%'; $c=Get-Content $f -Raw -Encoding UTF8; if(-not $c){Write-Error 'Empty file'; exit 1}; $c=$c -replace 'applicationId\s*\"com\.raan\.\w+\"','applicationId \"com.raan.rider\"'; [System.IO.File]::WriteAllText($f, $c)"
    echo [PATCH] Done: com.raan.rider
    exit /b 0
)

if "%TARGET%"=="driver" (
    echo [PATCH] Patching Android for DRIVER ^(com.raan.captain^) ...
    copy /Y "scripts\strings-driver.xml" "%STRINGS%" >nul
    copy /Y "scripts\google-services-driver.json" "%GSERVICES%" >nul
    powershell -NoProfile -Command "$f='%GRADLE%'; $c=Get-Content $f -Raw -Encoding UTF8; if(-not $c){Write-Error 'Empty file'; exit 1}; $c=$c -replace 'applicationId\s*\"com\.raan\.\w+\"','applicationId \"com.raan.captain\"'; [System.IO.File]::WriteAllText($f, $c)"
    echo [PATCH] Done: com.raan.captain
    exit /b 0
)

echo [ERROR] Usage: patch-android.bat [rider^|driver]
exit /b 1
