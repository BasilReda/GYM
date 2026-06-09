@echo off
echo.
echo  =========================================
echo   GymDesk - Gym Management System
echo  =========================================
echo.
echo  Choose how to run:
echo    [1] Docker  (recommended - no Node.js needed)
echo    [2] Node.js (requires Node.js installed)
echo.
set /p choice="Enter 1 or 2: "

if "%choice%"=="1" goto docker
if "%choice%"=="2" goto node

:docker
echo.
echo  Starting with Docker...
echo  (First run builds the image - may take 1-2 minutes)
echo.
docker compose up --build -d
echo.
echo  ✅ GymDesk is running at http://localhost:3000
echo.
echo  Useful commands:
echo    View logs:  docker compose logs -f
echo    Stop:       docker compose down
echo    Restart:    docker compose restart
echo.
start http://localhost:3000
goto end

:node
echo.
IF NOT EXIST "node_modules\" (
    echo  Installing dependencies...
    npm install
    echo.
)
echo  Starting GymDesk on http://localhost:3000
echo.
node server.js
goto end

:end
pause
