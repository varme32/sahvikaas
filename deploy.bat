@echo off
REM Deployment Script for StudyHub (Windows)
REM This script builds and deploys the frontend to GitHub Pages

echo.
echo ========================================
echo   StudyHub Deployment Script
echo ========================================
echo.

REM Check if .env.production exists
if not exist ".env.production" (
    echo ERROR: .env.production file not found!
    echo.
    echo Please create .env.production with your backend URL:
    echo   VITE_API_URL=https://your-backend-url.onrender.com
    echo.
    echo See .env.production.example for reference
    pause
    exit /b 1
)

REM Show backend URL being used
echo Backend URL:
type .env.production | findstr VITE_API_URL
echo.

REM Confirm deployment
set /p confirm="Deploy to GitHub Pages? (y/n): "
if /i not "%confirm%"=="y" (
    echo Deployment cancelled
    pause
    exit /b 0
)

echo.
echo Building frontend...
call npm run build

if errorlevel 1 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.

REM Check if gh-pages is installed
npm list gh-pages >nul 2>&1
if errorlevel 1 (
    echo Installing gh-pages...
    call npm install -D gh-pages
)

echo.
echo Deploying to GitHub Pages...
call npx gh-pages -d dist

if errorlevel 1 (
    echo.
    echo ERROR: Deployment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Deployment Successful!
echo ========================================
echo.
echo Your app will be available at:
echo   https://varma22.github.io/sahvikaas/
echo.
echo Note: It may take a few minutes for changes to appear
echo.
pause
