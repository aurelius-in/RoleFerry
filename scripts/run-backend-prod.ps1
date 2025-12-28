param(
  [int]$Port = 8000
)

Set-Location (Join-Path $PSScriptRoot "..\\backend")

if (!(Test-Path ".\\.venv")) {
  python -m venv .venv
}

. .\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt

# Production-like run (no reload watcher = faster / less CPU)
uvicorn app.main:app --port $Port



