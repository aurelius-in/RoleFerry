# RoleFerry Demo Runbook (LLM-connected)

This runbook gets you to a **credible “LLM is actually working” demo** quickly and repeatably.

## Prereqs
- **Python 3.11+**
- **Node 20+**
- A working OpenAI key in `backend/.env` as `OPENAI_API_KEY=...`

## 1) Backend (FastAPI on :8000)

From repo root:

```powershell
cd backend
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Verify backend is LLM-connected

In a separate terminal:

```powershell
Invoke-RestMethod http://localhost:8000/health/llm | ConvertTo-Json -Depth 10
```

**Expected:**
- `should_use_real_llm: true`
- `probe_ok: true`
- `probe_preview` does **not** contain `"[Stubbed GPT]"`

If it’s stubbed:
- Re-check `backend/.env` has `OPENAI_API_KEY=...`
- Ensure `LLM_MODE=openai` (or leave unset; default is `openai`)
- Try a different network (hotspot) if corporate Wi‑Fi blocks OpenAI

## 2) Frontend (Next.js on :3000 or :3001)

### Recommended (tomorrow demo): disable client mocks

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_USE_CLIENT_MOCKS=false
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Then:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL shown in the console (commonly `http://localhost:3000` or `http://localhost:3001`).

### Fallback (if backend dies mid-demo)

Set:

```env
NEXT_PUBLIC_USE_CLIENT_MOCKS=true
```

Restart `npm run dev`, and the UI will use local mock responses.

## 3) One-command smoke test (proves it’s “real LLM”)

With backend running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\llm-smoke.ps1 -BaseUrl http://localhost:8000
```

**Expected:** ends with `ALL PASS`.

## 4) Suggested demo click path (high signal)

1. **Pain Point Match** → Generate matches
2. **Offer Creation** → Create offer (should read like a human wrote it)
3. **Compose** → Generate email (subject/body should be coherent; not stitched variables)
4. **Deliverability/Launch** → Pre-flight checks (optional “LLM helper” suggestions)


