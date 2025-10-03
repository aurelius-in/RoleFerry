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

Env Notes

- INSTANTLY_API_KEY: set to enable API push; otherwise CSV fallback is used.

Mesh-Clone: Lead-Qual Engine
----------------------------

Architecture

- Routers: `lead_qual`, `exports`, `n8n_hooks`, `prospects`, `costs`
- Services: `serper_client`, `ai_qualifier`, `findymail_client`, `email_verifier`, `neverbounce_client`, `cost_meter`
- DB: SQL migrations in `backend/app/migrations/*.sql` provision tables and `v_prospect_summary`

Env keys

```
SERPER_API_KEY=
OPENAI_API_KEY=
FINDYMAIL_API_KEY=
NEVERBOUNCE_API_KEY=
GOOGLE_SHEETS_SERVICE_JSON_PATH=
GOOGLE_SHEETS_SHEET_ID=
ROLEFERRY_MOCK_MODE=true
MESH_CLONE_ENABLED=true
```

Commands

- Migrations run automatically on startup (idempotent). Reset by recreating DB.
- Instantly CSV: GET `http://localhost:8000/exports/instantly.csv`

Sample CSV

```
domain
acme.com
globex.com
```

Demo flow

1) POST `/lead-qual/lead-domains/import-csv` with the CSV above (or use the UI)
2) POST `/lead-qual/pipeline/run` with `{ "domains": ["acme.com"], "role_query": "CEO" }`
3) GET `/lead-qual/prospects` to view the summary rows
4) GET `/exports/instantly.csv` for Instantly‑ready export

