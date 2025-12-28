param(
  # Default to 8001 because 8000 is commonly occupied by other local services.
  [int]$Port = 8001
)

Set-Location (Join-Path $PSScriptRoot "..\\backend")

if (!(Test-Path ".\\.venv")) {
  python -m venv .venv
}

. .\\.venv\\Scripts\\Activate.ps1
python -m pip install -r requirements.txt

# Avoid uvicorn --reload watching .venv (it can cause endless reload loops on Windows).
# Use `python -m uvicorn` so it works reliably on Windows PATH/venv activation.
python -m uvicorn app.main:app `
  --reload `
  --reload-dir app `
  --reload-exclude .venv `
  --reload-exclude "**/.venv/**" `
  --host 0.0.0.0 `
  --port $Port


