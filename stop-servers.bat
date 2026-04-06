@echo off
echo ========================================
echo   Stopping All Node.js Processes
echo ========================================
echo.

taskkill /F /IM node.exe
echo.
echo All Node.js processes stopped!
echo.
pause
