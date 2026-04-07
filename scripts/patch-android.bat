@echo off
REM ============================================================
REM patch-android.bat — يعدل هوية التطبيق (applicationId + strings + icons)
REM الاستخدام: scripts\patch-android.bat rider
REM           scripts\patch-android.bat driver
REM           scripts\patch-android.bat car
REM ============================================================

set "TARGET=%~1"
set "GRADLE=android\app\build.gradle"
set "STRINGS=android\app\src\main\res\values\strings.xml"
set "GSERVICES=android\app\google-services.json"
set "RES_DIR=android\app\src\main\res"

if "%TARGET%"=="rider" (
    echo [PATCH] Patching Android for RIDER ^(com.raan.rider^) ...
    copy /Y "scripts\strings-rider.xml" "%STRINGS%" >nul
    copy /Y "scripts\google-services-rider.json" "%GSERVICES%" >nul
    call :COPY_ICONS rider
    powershell -NoProfile -Command "$f='%GRADLE%'; $c=Get-Content $f -Raw -Encoding UTF8; if(-not $c){Write-Error 'Empty file'; exit 1}; $c=$c -replace 'applicationId\s*\"com\.raan\.\w+\"','applicationId \"com.raan.rider\"'; $c=$c -replace 'namespace\s*\"com\.raan\.\w+\"','namespace \"com.raan.rider\"'; [System.IO.File]::WriteAllText($f, $c)"
    echo [PATCH] Done: com.raan.rider
    exit /b 0
)

if "%TARGET%"=="driver" (
    echo [PATCH] Patching Android for DRIVER ^(com.raan.captain^) ...
    copy /Y "scripts\strings-driver.xml" "%STRINGS%" >nul
    copy /Y "scripts\google-services-driver.json" "%GSERVICES%" >nul
    call :COPY_ICONS driver
    powershell -NoProfile -Command "$f='%GRADLE%'; $c=Get-Content $f -Raw -Encoding UTF8; if(-not $c){Write-Error 'Empty file'; exit 1}; $c=$c -replace 'applicationId\s*\"com\.raan\.\w+\"','applicationId \"com.raan.captain\"'; $c=$c -replace 'namespace\s*\"com\.raan\.\w+\"','namespace \"com.raan.captain\"'; [System.IO.File]::WriteAllText($f, $c)"
    echo [PATCH] Done: com.raan.captain
    exit /b 0
)

if "%TARGET%"=="car" (
    echo [PATCH] Patching Android for CAR ^(com.raan.car^) ...
    copy /Y "scripts\strings-car.xml" "%STRINGS%" >nul
    copy /Y "scripts\google-services-car.json" "%GSERVICES%" >nul
    call :COPY_ICONS car
    powershell -NoProfile -Command "$f='%GRADLE%'; $c=Get-Content $f -Raw -Encoding UTF8; if(-not $c){Write-Error 'Empty file'; exit 1}; $c=$c -replace 'applicationId\s*\"com\.raan\.\w+\"','applicationId \"com.raan.car\"'; $c=$c -replace 'namespace\s*\"com\.raan\.\w+\"','namespace \"com.raan.car\"'; [System.IO.File]::WriteAllText($f, $c)"
    echo [PATCH] Done: com.raan.car
    exit /b 0
)

echo [ERROR] Usage: patch-android.bat [rider^|driver^|car]
exit /b 1

REM ============================================================
REM نسخ الأيقونات من scripts/icons-{variant}/ إلى android/res/
REM ============================================================
:COPY_ICONS
set "VARIANT=%~1"
echo [ICONS] Copying icons for %VARIANT% ...
for %%D in (mipmap-ldpi mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi) do (
    if exist "scripts\icons-%VARIANT%\%%D" (
        copy /Y "scripts\icons-%VARIANT%\%%D\ic_launcher.png" "%RES_DIR%\%%D\ic_launcher.png" >nul 2>&1
        copy /Y "scripts\icons-%VARIANT%\%%D\ic_launcher_round.png" "%RES_DIR%\%%D\ic_launcher_round.png" >nul 2>&1
        copy /Y "scripts\icons-%VARIANT%\%%D\ic_launcher_foreground.png" "%RES_DIR%\%%D\ic_launcher_foreground.png" >nul 2>&1
        copy /Y "scripts\icons-%VARIANT%\%%D\ic_launcher_background.png" "%RES_DIR%\%%D\ic_launcher_background.png" >nul 2>&1
    )
)
echo [ICONS] Done.
exit /b 0
