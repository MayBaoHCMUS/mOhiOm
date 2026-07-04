@echo off
REM Gemini API Setup Script for Windows

echo.
echo ====================================
echo  Gemini API Integration Setup
echo ====================================
echo.

setlocal enabledelayedexpansion

REM Check if .env file exists in backend
if not exist "backend\.env" (
    echo Creating .env file in backend directory...
    (
        echo # Backend Environment Variables
        echo.
        echo # API Configuration
        echo APP_NAME=mOhiOm
        echo DEBUG=False
        echo API_PREFIX=/api
        echo.
        echo # MongoDB Configuration
        echo MONGODB_URL=mongodb://localhost:27017
        echo DATABASE_NAME=mohiom_db
        echo.
        echo # Gemini API Configuration
        echo # Get your API key from: https://makersuite.google.com/app/apikey
        echo GEMINI_API_KEY=your_gemini_api_key_here
        echo.
        echo # CORS Configuration
        echo CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000"]
    ) > backend\.env
    echo ✓ Created backend\.env file
) else (
    echo ✓ backend\.env already exists
)

echo.
echo ====================================
echo  NEXT STEPS:
echo ====================================
echo.
echo 1. Get your Gemini API key:
echo    Visit: https://makersuite.google.com/app/apikey
echo.
echo 2. Update backend\.env file:
echo    Open backend\.env and replace:
echo    GEMINI_API_KEY=your_gemini_api_key_here
echo    with your actual API key
echo.
echo 3. Install Python dependencies:
echo    cd backend
echo    pip install -r requirements.txt
echo.
echo 4. Start the backend:
echo    python -m app.main
echo.
echo 5. Test Gemini integration:
echo    Visit: http://localhost:8000/api/gemini/health
echo.
echo ====================================
echo.
pause

