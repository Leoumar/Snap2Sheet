@echo off
setlocal EnableDelayedExpansion
title Snap2Sheet

echo.
echo  ==========================================
echo    Snap2Sheet - Starting...
echo  ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found.
    echo  Download: https://www.python.org/downloads/
    echo  Check "Add Python to PATH" during install.
    pause & exit /b 1
)

if not exist "%~dp0.venv" (
    echo  [1/3] Creating virtual environment...
    python -m venv "%~dp0.venv"
)

call "%~dp0.venv\Scripts\activate.bat"

echo  [2/3] Installing dependencies...
pip install -q fastapi "uvicorn[standard]" python-multipart pydantic python-dotenv llmwhisperer-client openpyxl

if not exist "%~dp0backend\.env" (
    echo.
    echo  ============================================================
    echo  [SETUP REQUIRED] LLMWhisperer API Key needed!
    echo.
    echo  1. Go to: https://unstract.com/llmwhisperer/
    echo  2. Click "Get API Key" (free - 100 pages/month)
    echo  3. Copy backend\.env.example to backend\.env
    echo  4. Open backend\.env and paste your API key
    echo  ============================================================
    echo.
    copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul 2>&1
    start "" notepad "%~dp0backend\.env"
    echo  Opening .env in Notepad - paste your API key and save, then re-run START.bat
    pause & exit /b 1
)

if not exist "%~dp0backend\uploads" mkdir "%~dp0backend\uploads"
if not exist "%~dp0backend\outputs" mkdir "%~dp0backend\outputs"

echo  [3/3] Starting servers...
start "Snap2Sheet Backend" cmd /k "cd /d "%~dp0backend" && call "%~dp0.venv\Scripts\activate.bat" && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

start "Snap2Sheet Frontend" cmd /k "cd /d "%~dp0frontend" && python -m http.server 3000"
timeout /t 2 /nobreak >nul

start "" "http://localhost:3000"

echo.
echo  ==========================================
echo    Snap2Sheet is running!
echo    Open: http://localhost:3000
echo    API:  http://localhost:8000/docs
echo  ==========================================
echo.
pause
