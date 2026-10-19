# ==============================================================================
# GlucoTwin - One-Click Developer & Demo Launch Script (Windows PowerShell)
# ==============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "       GlucoTwin - Metabolic Digital Twin Dev Environment        " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check .env configuration
$EnvFile = Join-Path $Root "backend\.env"
$EnvExample = Join-Path $Root ".env.example"
if (-not (Test-Path $EnvFile)) {
    if (Test-Path $EnvExample) {
        Write-Host "[-] backend/.env missing. Automatically copying from .env.example..." -ForegroundColor Yellow
        Copy-Item $EnvExample $EnvFile
        Write-Host "[+] backend/.env created with default demo configuration (MOCK_GEMINI=true)." -ForegroundColor Green
    } else {
        Write-Host "[!] WARNING: backend/.env and .env.example are missing!" -ForegroundColor Red
        Write-Host "    Create backend/.env with MOCK_GEMINI=true to run offline demo." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] backend/.env found." -ForegroundColor Green
}

# 2. Check model artifacts in backend/models/
$ModelsDir = Join-Path $Root "backend\models"
$ExpectedModels = @("twin_recommender.pkl", "meals_db.pkl", "shanghai_clinical.pkl", "model_manifest.json")
$MissingModels = @()
foreach ($m in $ExpectedModels) {
    if (-not (Test-Path (Join-Path $ModelsDir $m))) {
        $MissingModels += $m
    }
}

if ($MissingModels.Count -gt 0) {
    Write-Host "[!] WARNING: The following trained model files are missing in backend/models/:" -ForegroundColor Red
    foreach ($m in $MissingModels) {
        Write-Host "    - $m" -ForegroundColor Red
    }
    Write-Host "    The server will run with mock/baseline fallbacks. Refer to README.md for Colab export." -ForegroundColor Yellow
} else {
    Write-Host "[OK] All core model artifacts verified in backend/models/." -ForegroundColor Green
}

# 3. Setup Python Virtual Environment
$VenvDir = Join-Path $Root "backend\.venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$PipExe = Join-Path $VenvDir "Scripts\pip.exe"
$UvicornExe = Join-Path $VenvDir "Scripts\uvicorn.exe"

if (-not (Test-Path $PythonExe)) {
    Write-Host "[-] Creating virtual environment in backend/.venv..." -ForegroundColor Cyan
    python -m venv $VenvDir
    Write-Host "[OK] Virtual environment created." -ForegroundColor Green
} else {
    Write-Host "[OK] Python virtual environment found." -ForegroundColor Green
}

# 4. Install backend dependencies
Write-Host "[-] Verifying backend dependencies..." -ForegroundColor Cyan
& $PipExe install -r (Join-Path $Root "backend\requirements.txt") --quiet
Write-Host "[OK] Backend dependencies verified." -ForegroundColor Green

# 5. Seed synthetic demo patients
Write-Host "[-] Seeding 3 labelled synthetic demo patients (idempotent)..." -ForegroundColor Cyan
& $PythonExe (Join-Path $Root "scripts\seed_demo.py")

# 6. Verify and install frontend dependencies
$FrontendDir = Join-Path $Root "frontend"
$NodeModulesDir = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $NodeModulesDir)) {
    Write-Host "[-] Installing frontend dependencies with npm..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    npm install
    Pop-Location
    Write-Host "[OK] Frontend packages installed." -ForegroundColor Green
} else {
    Write-Host "[OK] Frontend node_modules verified." -ForegroundColor Green
}

# 7. Launch servers
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  Starting Backend (Uvicorn :8000) and Frontend (Vite :5173)...   " -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to terminate both servers.                        " -ForegroundColor Yellow
Write-Host "=================================================================`n" -ForegroundColor Cyan

# Start Backend Process
$BackendJob = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000", "--reload" `
    -WorkingDirectory $Root `
    -PassThru

# Open browser to frontend after short delay
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5173"
} | Out-Null

try {
    # Run Vite in foreground
    Push-Location $FrontendDir
    npm run dev -- --port 5173
}
finally {
    Pop-Location
    Write-Host "`n[-] Shutting down backend server..." -ForegroundColor Yellow
    if ($BackendJob -and -not $BackendJob.HasExited) {
        Stop-Process -Id $BackendJob.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Servers stopped cleanly." -ForegroundColor Green
}
