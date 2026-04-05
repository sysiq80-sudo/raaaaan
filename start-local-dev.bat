@echo off
chcp 65001 >nul
title RAAN — تشغيل محلي (تطوير)
cd /d "%~dp0"
echo.
echo  ═══════════════════════════════════════
echo    RAAN — وضع التطوير (4 نوافذ)
echo    راكب:  http://localhost:8081
echo    كابتن: http://localhost:8082
echo    أدمن:  http://localhost:8083
echo    سيارة: http://localhost:8084
echo  ═══════════════════════════════════════
echo.
start "RAAN Rider"  /D "%~dp0" cmd /k npm run dev:rider
start "RAAN Driver" /D "%~dp0" cmd /k npm run dev:driver
start "RAAN Admin"  /D "%~dp0" cmd /k npm run dev:admin
start "RAAN Car"    /D "%~dp0" cmd /k npm run dev:car
echo  تم فتح 4 نوافذ. أغلق هذه النافذة في أي وقت.
pause
