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

Lead-Qual Engine (Scaffold)

- POST /lead-qual/lead-domains/import-csv — accept CSV with `domain`
- POST /lead-qual/lead-domains/import-sheets — pull from Google Sheets (mock if unconfigured)
- POST /lead-qual/pipeline/run — runs Serper → GPT → Findymail → Verifier (mock-enabled)
- GET  /lead-qual/prospects — returns stubbed prospect summary; will use `v_prospect_summary`

Env keys

```
SERPER_API_KEY=
OPENAI_API_KEY=          # (preferred) OpenAI key for GPT features
RoleFerryKey=            # (alias) alternative name accepted by the app
FINDYMAIL_API_KEY=
NEVERBOUNCE_API_KEY=
GOOGLE_SHEETS_SERVICE_JSON_PATH=
GOOGLE_SHEETS_SHEET_ID=
ROLEFERRY_MOCK_MODE=true
```

Notes

- On startup, the API applies idempotent SQL files in `app/migrations/*.sql` to provision lead-qual tables and a summary view.

Notes

- CORS is enabled for http://localhost:3000 by default.
- In-memory storage is used for MVP.
 - Instantly API v2 (stub): set INSTANTLY_API_KEY in env to enable API push. Webhook receiver at POST /webhooks/instantly logs events to Audit.

