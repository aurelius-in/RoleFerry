RoleFerry Dev Quickstart

Prereqs

- Docker Desktop
- Node 20+, Python 3.11+

Services

```
docker compose up -d db redis backend
```

Backend (local)

```
cd backend
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend

```
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and http://localhost:8000/health

