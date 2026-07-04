# Prahari one-command demo start (Windows PowerShell).
#   .\run.ps1           start everything (seeds DB on first run)
#   .\run.ps1 -Reset    wipe + reseed the DB first (clean demo state)
param([switch]$Reset)

Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    Write-Host "[prahari] creating venv..."
    python -m venv .venv
}
$py = ".\.venv\Scripts\python.exe"

& $py -c "import fastapi" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[prahari] installing dependencies..."
    & $py -m pip install -q -r requirements.txt
}

if ($Reset -or -not (Test-Path prahari.db)) {
    Write-Host "[prahari] seeding 14 days of baseline history..."
    & $py -m app.simulator.seed --fresh --days 14
}

if (-not (Test-Path frontend\dist)) {
    Write-Host "[prahari] building frontend..."
    Push-Location frontend
    npm install --no-fund --no-audit
    npm run build
    Pop-Location
}

Write-Host "[prahari] SOC dashboard -> http://127.0.0.1:8000"
& $py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
