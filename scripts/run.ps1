param(
  [switch]$Build
)

if ($Build) {
  docker compose build backend
}

docker compose up -d db redis backend
Push-Location frontend
npm install
npm run dev
Pop-Location

