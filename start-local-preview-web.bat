@echo off
chcp 65001 >nul
title RAAN — معاينة الويب المبني
cd /d "%~dp0"
echo.
echo  يتطلب تشغيلاً سابقاً: npm run build:web:all
echo  ═══════════════════════════════════════
echo    راكب:  http://localhost:4173
echo    كابتن: http://localhost:4174
echo    سيارة: http://localhost:4175
echo    أدمن:  http://localhost:4176
echo  ═══════════════════════════════════════
echo.
start "Preview Rider"  /D "%~dp0" cmd /k npm run preview:rider
ping 127.0.0.1 -n 2 >nul
start "Preview Driver" /D "%~dp0" cmd /k npm run preview:driver
ping 127.0.0.1 -n 2 >nul
start "Preview Car"    /D "%~dp0" cmd /k npm run preview:car
ping 127.0.0.1 -n 2 >nul
start "Preview Admin"  /D "%~dp0" cmd /k npm run preview:admin
echo  تم فتح 4 نوافذ معاينة.
pause
