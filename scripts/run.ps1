param(
  [switch]$Build,
  [switch]$ProdFrontend
)

if ($Build) {
  docker compose build backend
}

docker compose up -d db redis backend
Push-Location frontend
npm install
if ($ProdFrontend) {
  npm run build
  npm run start
} else {
  npm run dev
}
Pop-Location

