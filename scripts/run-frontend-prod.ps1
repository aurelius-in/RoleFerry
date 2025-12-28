param(
  [string]$ApiBase = "http://localhost:8000",
  [int]$Port = 3000
)

Set-Location (Join-Path $PSScriptRoot "..\\frontend")

if (!(Test-Path ".\\node_modules")) {
  npm install
}

# Use the real backend by default.
$env:NEXT_PUBLIC_USE_CLIENT_MOCKS = "false"
$env:NEXT_PUBLIC_API_BASE = $ApiBase

# Build once, then run the production server (much faster than dev mode for demos).
npm run build
npm run start -- -p $Port



