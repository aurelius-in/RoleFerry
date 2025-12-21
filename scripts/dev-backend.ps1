param(
  [int]$Port = 8000
)

Set-Location (Join-Path $PSScriptRoot "..\\backend")

if (!(Test-Path ".\\.venv")) {
  python -m venv .venv
}

. .\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt

# Avoid uvicorn --reload watching .venv (it can cause endless reload loops on Windows).
uvicorn app.main:app `
  --reload `
  --reload-dir app `
  --reload-exclude .venv `
  --reload-exclude "**/.venv/**" `
  --port $Port


