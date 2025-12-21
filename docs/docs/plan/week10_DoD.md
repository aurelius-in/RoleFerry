### Week 10 – Definition of Done (DoD): Manual Demo + GPT-Backed Screens + Expected Outputs

This document tells you how to **open the app and click through manually**, which screens are intended to exercise the **working GPT backend**, and what outputs you should expect (with GPT enabled vs. stub fallback).

---

## 0) Before you start: don’t paste keys into chat

- Your OpenAI key is a **secret**. Don’t paste it into Slack/GitHub/chat.
- If you already pasted a key anywhere public/logged, **revoke/rotate it** in the OpenAI dashboard.

---

## 1) How to view the app and click through manually (Windows / local)

### A) Set the env var (use RoleFerryKey)

In the **same terminal window you will run the backend from**, set:

```powershell
$env:RoleFerryKey = "YOUR_KEY_HERE"
$env:LLM_MODE = "openai"
$env:OPENAI_MODEL = "gpt-4o-mini"
```

Notes:
- RoleFerry accepts **either** `RoleFerryKey` **or** `OPENAI_API_KEY`.
- `LLM_MODE=openai` enables real model calls.
- If you want to force deterministic outputs, use `LLM_MODE=stub`.

### B) Start backend (port 8000)

From repo root:

```powershell
python -m uvicorn backend.app.main:app --reload --port 8000
```

### C) Start frontend (port 3000)

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

### D) Open the UI

- Open: `http://localhost:3000/`
- You should see the workflow navigation buttons (Job Preference → Resume → Job Description → …).

### E) Confirm GPT is actually on (fastest check)

Open:
- `http://localhost:8000/health/llm`

Expected when GPT is enabled:
- `configured: true`
- `should_use_real_llm: true`

If you see `configured: false` / `should_use_real_llm: false`, it means the backend terminal **does not have the env var** (or `LLM_MODE` is set to `stub`).

### F) How to tell “GPT vs mock” during the demo (the reliable way)

There are two “truth sources”:

1) **Backend truth (authoritative)**: `GET /health/llm`
- If it says `should_use_real_llm: true`, then any GPT-enabled seams will attempt real model calls.
- If it says `should_use_real_llm: false`, then those seams will return deterministic **stub/mock** outputs.

2) **A/B toggle (easy confirmation)**: flip `LLM_MODE`
- Run once with `LLM_MODE=openai`, then run again with `LLM_MODE=stub`.
- If the text becomes perfectly repeatable and “template-like” in stub mode, you’re seeing mock/stub output.

Important note:
- Most screens do **not** display an explicit “GPT source badge” in the UI right now.
- So the most reliable way to know is to keep `/health/llm` open in another tab and check `should_use_real_llm`.

---

## 2) One-click “seed data” so every screen has something to show

To ensure the whole demo has data even on first run:

- Call: `POST http://localhost:8000/demo/bootstrap`

This seeds:
- `job_preferences`
- a `job_description_id`
- `painpoint_matches`
- `selected_contacts`

You can also use the hidden **Debug** panel:
- Go to a non-homepage screen (example: `/tracker`)
- Click **Debug** in the footer
- Use **Clear Demo State** if you want to restart a clean click-through

---

## 3) Which screens are testing the working GPT backend (Week 10)

These are the screens where the backend is intended to use GPT by default when the key is set:

1) **Resume** (`/resume`)
- GPT-backed: resume parsing / summarization seam

2) **Job Descriptions** (`/job-descriptions`)
- GPT-backed: JD parsing into pain points / skills / success metrics

3) **Pain Point Match** (`/painpoint-match`)
- GPT-backed: match generation + alignment scoring

4) **Offer Creation** (`/offer-creation`)
- GPT-backed: offer draft generation (title/content) based on painpoint match + tone/mode/format

5) **Company Research** (`/context-research`)
- GPT-backed: research summarization + outreach hooks helper

6) **Compose** (`/compose`)
- GPT-backed: email subject/body + variants + rationale

7) **Deliverability & Launch** (`/deliverability-launch`)
- GPT helper: explain deliverability + copy tweaks + subject variants (core checks remain deterministic)

8) **Analytics** (`/analytics`)
- GPT helper: interpret results (insights/risks/next actions)

Also GPT-visible helper cards are expected on:
- **Job Preferences** (`/job-preferences`) helper normalization/suggestions
- **Decision Makers** (`/find-contact`) helper openers / questions / talking points

---

## 4) Manual click-through: what you do and what you should see

### Step 1 — Job Preference (`/job-preferences`)
What you do:
- Fill/select a few values and click Save.

Expected if GPT enabled:
- A visible helper section with items like:
  - `normalized_skills`
  - `suggested_skills`
  - `suggested_role_categories`
  - short notes

Expected if stub mode:
- Similar-shaped helper output, deterministic.

How to tell GPT vs mock on this step:
- **GPT**: helper suggestions may vary slightly between runs; language often feels more tailored to your chosen skills/categories.
- **Mock/stub**: helper suggestions are stable/repeatable across runs.
- **Authoritative**: check `/health/llm` (`should_use_real_llm`).

### Step 2 — Resume / Candidate Profile (`/resume`)
What you do:
- Upload a resume file.

Expected if GPT enabled:
- Backend uses GPT seam for resume summary (and stores parsed + raw text for downstream).
- UI shows extracted sections (positions/skills/accomplishments).

Expected if stub mode:
- Deterministic “realistic” extracted resume data.

How to tell GPT vs mock on this step:
- **GPT**: summaries/phrasing may vary, and extracted highlights tend to mirror your uploaded resume more closely.
- **Mock/stub**: extraction tends to look like a consistent sample profile and won’t vary much between runs.
- **Authoritative**: check `/health/llm`.

### Step 3 — Job Description (`/job-descriptions`)
What you do:
- Import a job description (URL or pasted text).

Expected if GPT enabled:
- JD is parsed into:
  - `pain_points[]`
  - `required_skills[]`
  - `success_metrics[]`
- The extracted lists look plausible and specific.

Expected if stub mode:
- Deterministic parsing output with the same schema.

How to tell GPT vs mock on this step:
- **GPT**: `pain_points/required_skills/success_metrics` are more specific to the pasted JD text and can vary slightly run-to-run.
- **Mock/stub**: lists are stable and look “pre-seeded”.
- **Authoritative**: check `/health/llm`.

### Step 4 — Pain Point Match (`/painpoint-match`)
What you do:
- Select a JD and click **Generate Pain Point Matches**.

Expected if GPT enabled:
- Response includes:
  - `painpoint_1/2/3`
  - `solution_1/2/3`
  - `metric_1/2/3` (may be empty sometimes)
  - `alignment_score`
- The pain points and solutions feel aligned and not generic.

Expected if stub mode:
- Same fields with deterministic values.

How to tell GPT vs mock on this step:
- **GPT**: the 3 pairings feel strongly grounded in *your* JD + resume context; alignment score may fluctuate slightly.
- **Mock/stub**: the matches are stable and often read like “canned” example pairings.
- **Authoritative**: check `/health/llm`.

### Step 5 — Decision Makers (`/find-contact`)
What you do:
- Search for contacts
- Select at least 1 contact
- Verify emails (optional)
- Continue

Expected if GPT enabled:
- Helper card/panel with:
  - `opener_suggestions[]`
  - `questions_to_ask[]`
  - `talking_points_by_contact{}`

Expected deterministic parts:
- Email verification uses deterministic mock provider behavior (valid/risky/invalid predictable by email).

How to tell GPT vs mock on this step:
- **GPT** (helper): opener/questions/talking points look more tailored to the company/title and can vary run-to-run.
- **Mock/stub** (helper): suggestions are stable/repeatable.
- **Always deterministic**: verification status/score comes from deterministic providers (not GPT).
- **Authoritative**: check `/health/llm`.

### Step 6 — Company Research (`/context-research`)
What you do:
- Click **Start Research**

Expected if GPT enabled:
- `research_data` filled with:
  - company summary
  - contact bios
  - recent news
  - outreach hooks helper

Expected if stub mode:
- Deterministic “research_data” and helper hooks.

How to tell GPT vs mock on this step:
- **GPT**: research summary and hooks are more nuanced; phrasing varies slightly run-to-run.
- **Mock/stub**: summary text and hooks are stable and repeatable.
- **Also a UI clue**: if the page shows an error banner like “Backend unavailable — using deterministic demo research data.” then you’re seeing fallback data (not GPT).
- **Authoritative**: check `/health/llm`.

### Step 7 — Offer Creation (`/offer-creation`)
What you do:
- Click **Generate AI Offer** (or equivalent)

Expected if GPT enabled:
- Offers that reference `painpoint_1` and `solution_1` and sound like a realistic “value-first” offer.

Expected if stub mode:
- Deterministic offer outputs, still realistic.

How to tell GPT vs mock on this step:
- **GPT**: offer wording tends to be more natural and may vary slightly each run (while staying consistent with the same inputs).
- **Mock/stub**: offer copy is stable and reads more like a fixed template.
- **Authoritative**: check `/health/llm`.

### Step 8 — Compose (`/compose`)
What you do:
- Click **Generate Email**

Expected if GPT enabled:
- Returns:
  - subject
  - body
  - variants[]
  - rationale
- Email should incorporate variables from upstream (`first_name`, `company_name`, `painpoint_1`, `solution_1`, `metric_1`, research summary).

Expected if stub mode:
- Same schema, deterministic.

How to tell GPT vs mock on this step:
- **GPT**: subject/body and variants often differ slightly run-to-run and reflect your specific `painpoint_1/solution_1/metric_1`.
- **Mock/stub**: content is stable across runs.
- **Authoritative**: check `/health/llm`.

### Step 9 — Campaign (`/campaign`)
What you do:
- Generate a campaign sequence

Expected:
- Follow-ups should show **placeholders resolved** (real values substituted) in preview.

How to tell GPT vs mock on this step:
- This step is mostly about **continuity** (variable substitution). It is not primarily a GPT seam.
- If upstream steps were stubbed, you’ll still see realistic values—just deterministic ones.
- **Authoritative**: use `/health/llm` to know what generated upstream copy.

### Step 10 — Deliverability & Launch (`/deliverability-launch`)
What you do:
- Run pre-flight checks

Expected:
- Deterministic checks + a visible **GPT helper** check with:
  - summary
  - copy tweaks
  - subject variants

How to tell GPT vs mock on this step:
- **Always deterministic**: core deliverability checks (e.g., statuses/counts) are deterministic mocks.
- **GPT helper**: the “copy tweaks/subject variants” section should be richer and may vary with GPT enabled.
- **Authoritative**: check `/health/llm`.

### Step 11 — Analytics (`/analytics`)
What you do:
- Click the AI explain/interpret button (if present)

Expected:
- A visible GPT helper panel with:
  - insights
  - risks
  - next actions

How to tell GPT vs mock on this step:
- **GPT helper**: insights/risk/next actions vary slightly and are more narrative.
- **Mock/stub**: explanation is stable and repeatable.
- **Authoritative**: check `/health/llm`.

---

## 5) Week 10 “Done” criteria (DoD)

Week 10 is considered done when:

- **Key detection works**:
  - Setting `RoleFerryKey` (or `OPENAI_API_KEY`) makes `/health/llm` show `should_use_real_llm: true`.

- **All workflow screens render** without dead ends:
  - Each screen can load with seeded data (via `/demo/bootstrap`) and the user can continue forward.

- **GPT-backed screens produce realistic outputs**:
  - JD parsing produces plausible lists
  - Pain point match produces coherent pairs + alignment score
  - Offer + Compose produce credible, tailored copy
  - Research + Analytics helpers provide readable, specific summaries

- **Stub mode still demos end-to-end**:
  - With `LLM_MODE=stub` (or no key), all GPT seams return deterministic, schema-correct outputs and the workflow completes.

- **Automated E2E smoke test passes**:
  - `frontend/tests/e2e/workflow.spec.ts` passes (`npm run test:e2e`).

---

## 6) Troubleshooting

- If `/health/llm` returns `configured:false` / `should_use_real_llm:false` with a `probe_preview` that starts with `[Stubbed GPT]`:\n+  - Meaning: **the backend process is not seeing an API key**, so it is falling back to deterministic stubs.\n+  - Fix (PowerShell):\n+    - In the same terminal where you run uvicorn, confirm env vars exist:\n+\n+      ```powershell\n+      Get-ChildItem Env:RoleFerryKey\n+      Get-ChildItem Env:OPENAI_API_KEY\n+      Get-ChildItem Env:LLM_MODE\n+      ```\n+\n+    - Set the key (temporary) and ensure `LLM_MODE=openai`:\n+\n+      ```powershell\n+      $env:RoleFerryKey = \"YOUR_KEY_HERE\"\n+      $env:LLM_MODE = \"openai\"\n+      ```\n+\n+    - Restart the backend (stop with `Ctrl+C`, then run):\n+\n+      ```powershell\n+      python -m uvicorn backend.app.main:app --reload --port 8000\n+      ```\n+\n+    - Reload `http://localhost:8000/health/llm`.\n+  - Common causes:\n+    - You set the env var in Terminal A but started `uvicorn` in Terminal B.\n+    - You used `setx` but didn’t open a new terminal (setx only applies to new sessions).\n+    - The key was pasted with leading/trailing whitespace or was incomplete.\n+\n+- If `/health/llm` shows `configured:false`:
  - You did not set `RoleFerryKey` / `OPENAI_API_KEY` in the same terminal session running the backend.
  - Restart the backend after setting env vars.

- If you want GPT off for demos:
  - Set `LLM_MODE=stub`.

- If the UI has no data:
  - Call `POST /demo/bootstrap` and refresh.
  - Or use Debug → Clear Demo State and re-run.
