@echo off
Title Pricing App Launcher
echo ==========================================
echo   Starting Pricing Software (PostgreSQL)
echo ==========================================
echo.

:: 1. Ask for password (hidden input not easily possible in vanilla batch without extra tools, 
:: so simple prompt is standard for local dev)
set /p "PGPASSWORD=Enter your Database Password: "

:: 2. Set other variables if needed (defaults)
set PGUSER=postgres
set PGPORT=3006
set PGDATABASE=pricing_test

:: 3. Navigate to app directory
cd /d "c:\Users\kirk.odooley\.gemini\antigravity\playground\prime-ionosphere\pricing-software"

:: 4. Start App
echo.
echo Connecting to database...
echo Starting Application...
echo.
call npm run dev

pause
