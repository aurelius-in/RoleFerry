RoleFerry Backend (FastAPI)

Dev

1) Create and fill envs

```
copy ..\env.example ..\.env
```

2) Start services

```
docker compose up -d
```

3) Install deps and run API

```
cd backend
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Key endpoints (MVP)

- POST /ijps
- POST /jobs/ingest
- GET  /jobs/{job_id}
- POST /candidates/parse
- POST /matches/score
- POST /contacts/find
- POST /contacts/verify
- POST /outreach/generate
- POST /sequence/export
- GET  /analytics/campaign

Notes

- CORS is enabled for http://localhost:3000 by default.
- In-memory storage is used for MVP.

