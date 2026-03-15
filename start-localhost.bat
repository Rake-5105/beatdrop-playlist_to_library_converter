@echo off
REM Start the localhost server
REM This is for Windows - just double-click me!

echo.
echo ╔════════════════════════════════════════╗
echo ║  🎵 SSS - Localhost Test Server       ║
echo ╚════════════════════════════════════════╝
echo.
echo Starting server...
echo.

REM Check if node is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed!
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if yt-dlp is installed
where yt-dlp >nul 2>nul
if errorlevel 1 (
    echo ❌ yt-dlp is not installed!
    echo Install with: choco install yt-dlp
    echo Or download: https://github.com/yt-dlp/yt-dlp/releases
    pause
    exit /b 1
)

REM Start the server
node localhost-server.js
