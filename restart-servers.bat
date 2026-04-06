@echo off
echo ========================================
echo   Restarting Backend and Frontend
echo ========================================
echo.

echo Step 1: Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done!
echo.

echo Step 2: Starting Backend Server...
cd backend
start "Backend Server" cmd /k "npm start"
timeout /t 3 /nobreak >nul
cd ..
echo Backend starting...
echo.

echo Step 3: Starting Frontend Server...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..
echo Frontend starting...
echo.

echo ========================================
echo   Servers are starting!
echo ========================================
echo.
echo Backend: Check "Backend Server" window
echo Frontend: Check "Frontend Server" window
echo.
echo Wait for both to show ready messages, then:
echo Open: http://localhost:5173
echo.
pause
