param(
  # Use IPv4 loopback by default to avoid Windows resolving localhost -> ::1
  # while uvicorn is bound to 127.0.0.1.
  [string]$ApiBase = "http://127.0.0.1:8001"
)

Set-Location (Join-Path $PSScriptRoot "..\\frontend")

if (!(Test-Path ".\\node_modules")) {
  npm install
}

# Use the real backend by default.
$env:NEXT_PUBLIC_USE_CLIENT_MOCKS = "false"
$env:NEXT_PUBLIC_API_BASE = $ApiBase

npm run dev


