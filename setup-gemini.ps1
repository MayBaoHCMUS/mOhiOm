# Gemini API Integration Setup Script for Windows PowerShell

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Gemini API Integration Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path "backend")) {
    Write-Host "❌ Error: 'backend' directory not found!" -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path "backend\.env")) {
    Write-Host "Creating .env file in backend directory..." -ForegroundColor Yellow

    $envContent = @"
# Backend Environment Variables

# API Configuration
APP_NAME=mOhiOm
DEBUG=False
API_PREFIX=/api

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db

# Gemini API Configuration
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# CORS Configuration
CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000"]
"@

    Set-Content -Path "backend\.env" -Value $envContent
    Write-Host "✓ Created backend\.env file" -ForegroundColor Green
} else {
    Write-Host "✓ backend\.env already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host " NEXT STEPS:" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Get your Gemini API key:" -ForegroundColor Yellow
Write-Host "   Visit: https://makersuite.google.com/app/apikey" -ForegroundColor White
Write-Host ""
Write-Host "2. Update backend\.env file:" -ForegroundColor Yellow
Write-Host "   Open backend\.env and replace:" -ForegroundColor White
Write-Host "   GEMINI_API_KEY=your_gemini_api_key_here" -ForegroundColor White
Write-Host "   with your actual API key" -ForegroundColor White
Write-Host ""
Write-Host "3. Install Python dependencies:" -ForegroundColor Yellow
Write-Host "   cd backend" -ForegroundColor White
Write-Host "   pip install -r requirements.txt" -ForegroundColor White
Write-Host ""
Write-Host "4. Start the backend:" -ForegroundColor Yellow
Write-Host "   python -m app.main" -ForegroundColor White
Write-Host ""
Write-Host "5. Test Gemini integration:" -ForegroundColor Yellow
Write-Host "   Visit: http://localhost:8000/api/gemini/health" -ForegroundColor White
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Option to open the API key page
$response = Read-Host "Would you like to open the Gemini API key page? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Start-Process "https://makersuite.google.com/app/apikey"
}

# Option to open the .env file
$response = Read-Host "Would you like to open the .env file? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    if (Test-Path "backend\.env") {
        notepad "backend\.env"
    }
}

Write-Host "Setup complete!" -ForegroundColor Green

