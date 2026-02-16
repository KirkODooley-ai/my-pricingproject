@echo off
Title Run Product Variants Migration
echo.
echo ==========================================
echo   Running Database Migration
echo   (Product Variants & Gauges)
echo ==========================================
echo.
set /p "PGPASSWORD=Enter your Database Password: "

echo.
echo Connecting...
call node run-migration.js
echo.
pause
