### Week 10 – How to Connect OpenAI to RoleFerry (Windows, local-only)

This guide is written for a non-coder. It explains what an API key is, how to get one from OpenAI, where to put it for RoleFerry, and how to verify it’s working.

---

## 1) What is an OpenAI API key?

An **API key** is like a password that lets RoleFerry talk to OpenAI’s models (ChatGPT-style features) from the backend.

- **Keep it secret**: anyone with this key can spend money on your OpenAI account.
- **Do not paste it into GitHub or screenshots**.

---

## 2) Where to get an OpenAI API key (step-by-step)

1. Open the OpenAI Platform: `https://platform.openai.com/`
2. Sign in (or create an account).
3. Go to the API Keys page: `https://platform.openai.com/api-keys`
4. Click **Create new secret key**.
5. Copy the key immediately and store it somewhere safe (password manager recommended).

### Optional but strongly recommended: set a spending limit

In the OpenAI Platform, open **Settings/Billing** and set a small monthly budget/limit before testing.

If you need a starting point:
- Use the default model `gpt-4o-mini` (cheap and fast for demos).
- Keep prompts short (RoleFerry already tries to keep “research corpuses” compact in Week 10).

---

## 3) Where to put the key in RoleFerry

RoleFerry reads environment variables in the backend (see `backend/app/config.py`). You do **not** need to edit code.

### Required environment variable

- **`OPENAI_API_KEY`**: your OpenAI secret key

**Friendly alias (optional):**
- **`RoleFerryKey`**: you can use this instead of `OPENAI_API_KEY` for local demos (RoleFerry will accept either).

### Optional environment variables

- **`OPENAI_MODEL`**: defaults to `gpt-4o-mini`
- **`LLM_MODE`**:
  - `openai` (default): enables real GPT calls when the key is present
  - `stub`: forces deterministic stub outputs (useful for demos without spending)
- **`ROLEFERRY_MOCK_MODE`**: can stay `true`
  - Week 10 behavior: if `OPENAI_API_KEY` is set and `LLM_MODE=openai`, GPT is used even when `ROLEFERRY_MOCK_MODE=true`.

---

## 4) Set environment variables on Windows (PowerShell)

### A) Temporary (only for the current terminal window)

Open PowerShell, then run:

```powershell
$env:OPENAI_API_KEY = "YOUR_KEY_HERE"
$env:OPENAI_MODEL = "gpt-4o-mini"   # optional
$env:LLM_MODE = "openai"           # optional
$env:ROLEFERRY_MOCK_MODE = "true"  # optional
```

Or using the friendly alias:

```powershell
$env:RoleFerryKey = "YOUR_KEY_HERE"
$env:OPENAI_MODEL = "gpt-4o-mini"   # optional
$env:LLM_MODE = "openai"           # optional
$env:ROLEFERRY_MOCK_MODE = "true"  # optional
```

### B) Persistent (saved on your computer)

This makes the variable available in new terminals (you’ll need to restart terminals after setting):

```powershell
setx OPENAI_API_KEY "YOUR_KEY_HERE"
setx OPENAI_MODEL "gpt-4o-mini"
setx LLM_MODE "openai"
setx ROLEFERRY_MOCK_MODE "true"
```

Or using the friendly alias:

```powershell
setx RoleFerryKey "YOUR_KEY_HERE"
setx OPENAI_MODEL "gpt-4o-mini"
setx LLM_MODE "openai"
setx ROLEFERRY_MOCK_MODE "true"
```

---

## 5) Run RoleFerry locally (no hosting required)

Week 10 is designed to run fully locally for testing. **Cheapest option = local-only**.

### A) Start the backend (FastAPI)

From the repo root, create/install dependencies (one-time) and start the server.

1) Create a virtual environment (recommended):

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
```

2) Install backend dependencies:

```powershell
pip install -r backend\requirements.txt
```

3) Start the backend on port 8000:

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

### B) Start the frontend (Next.js)

In a second PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

### Why local-only works

The frontend is configured to forward `http://localhost:3000/api/...` to the backend at `http://localhost:8000/...` (see `frontend/next.config.ts`).

---

## 6) Verify GPT is connected (fast checks)

### A) Confirm the backend sees the key

Open:
- `http://localhost:8000/health/llm`

Expected when GPT is enabled:
- `should_use_real_llm: true`

Expected when GPT is disabled (no key or `LLM_MODE=stub`):
- `should_use_real_llm: false`

### B) Confirm the UI is feeding GPT seams realistic upstream data

Run the click-through from:
- `docs/docs/plan/week_10_test_plan.md`

The most important “GPT wow” steps to watch in Week 10:
- **Job Descriptions** → parsing into pain points/skills/metrics
- **Pain Point Match** → alignment score + 3 challenge/solution/metric triplets
- **Offer Creation** → tone-based draft
- **Compose** → email subject/body + variants + rationale
- **Deliverability** → GPT helper “copy tweaks” + subject variants (deterministic checks remain primary)
- **Analytics** → “GPT Helper: interpret results” panel

---

## 7) Troubleshooting

### Problem: “GPT is not being used”

- Re-check `OPENAI_API_KEY` is set in the same terminal where you started the backend.
- Confirm `LLM_MODE` is not set to `stub`.
- Reload `http://localhost:8000/health/llm`.

### Problem: frontend can’t reach backend

- Confirm backend is running at `http://localhost:8000`.
- Confirm frontend is running at `http://localhost:3000`.
- The proxy rule is in `frontend/next.config.ts` and assumes port 8000.

### Problem: I don’t want to spend money while testing

- Set `LLM_MODE=stub` and run the full demo: Week 10 returns deterministic, schema-correct stub outputs so the workflow still completes end-to-end.

---

## 8) Hosting (optional)

For Week 10 testing, **hosting is not required**. Local-only + `OPENAI_API_KEY` is the cheapest way to test GPT integration.

If you later want a cheap hosted demo, you can deploy the frontend and backend separately (e.g., Vercel for frontend + a low-cost backend host), but that’s out of scope for Week 10’s local connectivity steps.
