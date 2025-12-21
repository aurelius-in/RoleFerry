param(
  [string]$ApiBase = "http://localhost:8000"
)

Set-Location (Join-Path $PSScriptRoot "..\\frontend")

if (!(Test-Path ".\\node_modules")) {
  npm install
}

# Use the real backend by default.
$env:NEXT_PUBLIC_USE_CLIENT_MOCKS = "false"
$env:NEXT_PUBLIC_API_BASE = $ApiBase

npm run dev


