# Text-to-Comic Pipeline - Startup Script
# Usage: .\start-pipeline.ps1

param(
    [string]$Mode = "menu",  # menu, standalone, api, test
    [string]$ApiKey = $null   # Optional: provide API key via parameter
)

# Color codes
$Green = [System.ConsoleColor]::Green
$Red = [System.ConsoleColor]::Red
$Yellow = [System.ConsoleColor]::Yellow
$Cyan = [System.ConsoleColor]::Cyan

function Write-Header {
    param([string]$Text)
    Write-Host "`n" -NoNewline
    Write-Host "=" * 70 -ForegroundColor $Cyan
    Write-Host $Text -ForegroundColor $Cyan
    Write-Host "=" * 70 -ForegroundColor $Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor $Red
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor $Yellow
}

function Check-ApiKey {
    if ($ApiKey) {
        $env:GEMINI_API_KEY = $ApiKey
        Write-Success "API key set from parameter"
        return $true
    }

    $existingKey = $env:GEMINI_API_KEY
    if ($existingKey) {
        Write-Success "API key detected in environment"
        Write-Host "  Key starts with: $($existingKey.Substring(0, 10))..."
        return $true
    }

    Write-Error "GEMINI_API_KEY not found"
    Write-Host "`nPlease set it:"
    Write-Host '  $env:GEMINI_API_KEY = "your-api-key"' -ForegroundColor $Yellow
    return $false
}

function Check-Dependencies {
    Write-Host "`nChecking dependencies..."

    $required = @("fastapi", "google.generativeai", "uvicorn")
    $missing = @()

    foreach ($package in $required) {
        try {
            python -c "import $($package.Replace('-', '_'))" 2>$null
            Write-Success "$package"
        }
        catch {
            Write-Warning "$package (missing)"
            $missing += $package
        }
    }

    if ($missing.Count -gt 0) {
        Write-Warning "Missing dependencies: $($missing -join ', ')"
        Write-Host "`nInstall with:"
        Write-Host "  pip install -r requirements.txt" -ForegroundColor $Yellow
        $response = Read-Host "Install now? (y/n)"
        if ($response -eq "y") {
            pip install -r requirements.txt
        }
    }
}

function Show-Menu {
    Write-Header "TEXT-TO-COMIC GENERATION PIPELINE"

    Write-Host "`nSelect mode:" -ForegroundColor $Cyan
    Write-Host "`n  1. Run Standalone Pipeline (all 4 steps)"
    Write-Host "  2. Start FastAPI Server (REST API)"
    Write-Host "  3. Run System Tests"
    Write-Host "  4. Open Documentation"
    Write-Host "  5. Exit"

    $choice = Read-Host "`nEnter choice (1-5)"
    return $choice
}

function Run-Standalone {
    Write-Header "RUNNING STANDALONE PIPELINE"

    if (-not (Check-ApiKey)) {
        return
    }

    Write-Host "`nStarting pipeline..." -ForegroundColor $Cyan
    python text_to_comic_pipeline.py

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Pipeline completed successfully!"
        Write-Host "`nOutput files created in: pipeline_output/" -ForegroundColor $Green
        Write-Host "Check the files:"
        Write-Host "  • step1_result.json"
        Write-Host "  • step2_result.json"
        Write-Host "  • step3_result.json"
        Write-Host "  • step4_result.json"
        Write-Host "  • Final_Manga_Script.md"
    }
    else {
        Write-Error "Pipeline failed with exit code $LASTEXITCODE"
    }
}

function Run-Api-Server {
    Write-Header "STARTING FASTAPI SERVER"

    if (-not (Check-ApiKey)) {
        return
    }

    Write-Host "`nServer will start at: http://localhost:8000" -ForegroundColor $Cyan
    Write-Host "API Documentation: http://localhost:8000/docs" -ForegroundColor $Cyan
    Write-Host "`nPress Ctrl+C to stop the server" -ForegroundColor $Yellow

    Write-Host "`nStarting server..." -ForegroundColor $Green
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

function Run-Tests {
    Write-Header "RUNNING SYSTEM TESTS"

    if (-not (Check-ApiKey)) {
        Write-Warning "API key not found, continuing with tests anyway..."
    }

    Write-Host "`nRunning test suite..." -ForegroundColor $Cyan
    python test_text_to_comic_pipeline.py
}

function Open-Documentation {
    Write-Header "DOCUMENTATION"

    Write-Host "`nAvailable documentation:" -ForegroundColor $Cyan
    Write-Host "`n  1. TEXT_TO_COMIC_QUICK_REFERENCE.md - Quick start guide"
    Write-Host "  2. TEXT_TO_COMIC_SETUP_GUIDE.md - Complete documentation"
    Write-Host "  3. Open in browser (if available)"
    Write-Host "  4. Back to menu"

    $choice = Read-Host "`nEnter choice (1-4)"

    switch ($choice) {
        "1" {
            if (Test-Path "TEXT_TO_COMIC_QUICK_REFERENCE.md") {
                Get-Content "TEXT_TO_COMIC_QUICK_REFERENCE.md" | more
            }
            else {
                Write-Error "File not found"
            }
        }
        "2" {
            if (Test-Path "TEXT_TO_COMIC_SETUP_GUIDE.md") {
                Get-Content "TEXT_TO_COMIC_SETUP_GUIDE.md" | more
            }
            else {
                Write-Error "File not found"
            }
        }
        "3" {
            if (Test-Path "TEXT_TO_COMIC_QUICK_REFERENCE.md") {
                Invoke-Item "TEXT_TO_COMIC_QUICK_REFERENCE.md"
            }
        }
    }
}

function Main {
    Clear-Host

    if ($Mode -eq "menu") {
        while ($true) {
            $choice = Show-Menu
            switch ($choice) {
                "1" { Run-Standalone }
                "2" { Run-Api-Server }
                "3" { Run-Tests }
                "4" { Open-Documentation }
                "5" {
                    Write-Host "`nGoodbye!" -ForegroundColor $Green
                    exit
                }
                default {
                    Write-Error "Invalid choice"
                }
            }

            Read-Host "`nPress Enter to continue"
        }
    }
    else {
        switch ($Mode) {
            "standalone" { Run-Standalone }
            "api" { Run-Api-Server }
            "test" { Run-Tests }
            default {
                Write-Error "Unknown mode: $Mode"
                Write-Host "Use: standalone, api, test, or menu"
            }
        }
    }
}

# Change to backend directory
if (Test-Path "F:\Thesis\backend") {
    Push-Location "F:\Thesis\backend"
}

# Run main
Main

# Return to original directory
if ($pwd -match "backend") {
    Pop-Location
}

