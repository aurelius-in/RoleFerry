### Week 10 Test Plan – GPT Demo Readiness (RoleFerry)

Goal: verify the end-to-end “12-step path” produces a compelling customer demo where GPT-backed components improve the experience, while the app still works in fallback mode.

This plan is **manual click-through first** (what a customer sees), with optional **API spot checks**.

---

### 0) Prerequisites / Setup

#### A. Demo modes you can run

- **Fallback demo (no GPT calls)**
  - Set `ROLEFERRY_MOCK_MODE=true` (default).
  - Expected: the flow works fully with deterministic/stub outputs.
  - Notes:
    - Postgres/Redis may be unavailable in early demos; core endpoints should still work via in-memory fallbacks.

- **GPT demo (real model calls)**
  - Set:
    - `OPENAI_API_KEY=...`
    - (Optional) `OPENAI_MODEL=gpt-4o-mini`
    - (Optional) `LLM_MODE=openai`
  - Expected: JD parsing, offer creation, resume summary (response), pain-point matching, and lead qualifier can become GPT-backed.
  - Notes:
    - Week 10 gating: if `OPENAI_API_KEY` is set and `LLM_MODE=openai`, GPT is the default even if `ROLEFERRY_MOCK_MODE=true`.

#### B0. One-call demo bootstrap (recommended)

If you want to guarantee the 12-step flow has upstream data even on first run:

1. `POST /demo/bootstrap`
2. Expected: returns seeded `job_preferences`, a `job_description_id`, `painpoint_matches`, and `selected_contacts`.

#### B. Quick sanity check: LLM health endpoint

1. Open `GET /health/llm`
2. Expected:
   - `should_use_real_llm=true` in GPT demo mode.
   - `probe_ok=true`
   - `probe_preview` contains a short acknowledgement.

If `should_use_real_llm=false`, the UI will still work, but GPT-backed improvements won’t show.

#### C. Demo Debug Panel (hidden)

- The app includes a hidden debug panel that is **not visible unless clicked**.
- To open it:
  - Navigate to any non-homepage screen (e.g. `/tracker`)
  - Click **Debug** in the footer
- Expected:
  - It shows `GET /health` + `GET /health/llm`
  - It includes a “Clear Demo State” button (clears `localStorage` for a fresh click-through)

---

### 1) End-to-End Customer Demo Script (12 steps)

This is the main click-through test. Run it once in fallback mode, then once in GPT demo mode.

#### Step 1 — Job Preferences

**Where:** `frontend/src/app/job-preferences/page.tsx`

1. Open **Job Preferences**.
2. Select:
   - Values (2–3)
   - Role category
   - Location preferences
   - Add 3–5 skills
   - Add minimum salary
3. Click **Save Preferences**.

**Expected outcome:**
- Preferences save successfully (backend reachable) or UI continues (fallback).
- User feels they set up their “target”.

**What customer wants:**
- Fast and clean setup; no AI needed here yet.

---

#### Step 2 — Job Descriptions (GPT-backed parsing)

**Where:** `frontend/src/app/job-descriptions/page.tsx`

1. Open **Job Descriptions**.
2. Click **Import Job Description**.
3. Paste a real JD text (recommended: 1–2 pages of text) and import.

**Expected outcome (GPT demo mode):**
- The imported JD card shows:
  - Title/company (may still be defaults if the JD was short; otherwise GPT may fill)
  - Business challenges (pain points)
  - Required skills
  - Success metrics
- The extracted lists are coherent, deduplicated, and “feels smart”.

**Expected outcome (fallback mode):**
- JD imports and shows deterministic default lists.

**What customer wants:**
- “I paste a job posting and instantly see what matters, in usable bullets.”

---

#### Step 3 — Resume (GPT-backed response extract)

**Where:** `frontend/src/app/resume/page.tsx`

1. Open **Resume**.
2. Upload a resume file (PDF/DOCX/TXT).

**Expected outcome (GPT demo mode):**
- Upload succeeds.
- Resume extract loads.
- Even if the UI still shows mock-like structure, the backend is now capable of producing GPT-derived:
  - `skills`
  - `accomplishments`
  - `key_metrics`
  - (and optionally positions/tenure if the model returns them)

**Expected outcome (fallback mode):**
- Upload succeeds.
- UI shows deterministic sample extract.

**What customer wants:**
- “It pulled out my impact and skills without me formatting anything.”

---

#### Step 4 — Job Tracker

**Where:** `frontend/src/app/tracker/page.tsx`

1. Open **Tracker**.
2. Toggle Board/Table.
3. Export CSV.

**Expected outcome:**
- The tracker works and looks professional.
- Not AI-driven yet; it’s the “system of record”.

**What customer wants:**
- A place where their pipeline is visible and exportable.

---

#### Step 5 — Pain Point Match (GPT-backed matching)

**Where:** `frontend/src/app/painpoint-match/page.tsx`

1. Open **Pain Point Match**.
2. Select the imported job description.
3. Click **Generate Pain Point Matches**.

**Expected outcome (GPT demo mode):**
- The match result is specific and persuasive:
  - JD snippet is a real challenge
  - Solution snippet references relevant resume experience
  - Metric is present when possible
  - Alignment score feels plausible
- Backend persists pairs to DB.

**Expected outcome (fallback mode):**
- You still get a match; it’s simpler and more template-like.

**What customer wants:**
- “This is exactly how I fit this role—written in hiring-manager language.”

---

#### Step 6 — Decision Makers

**Where:** `frontend/src/app/find-contact/page.tsx`

1. Search for a company name or role.
2. Select 1–2 contacts.
3. Click **Verify Selected Emails**.
4. Continue.

**Expected outcome:**
- Contact selection works.
- Verification statuses update via the backend (`POST /find-contact/verify`) using deterministic provider mocks, so results are stable across runs.

**What customer wants:**
- “I can pick real people to message and see if it’s safe to email them.”

---

#### Step 7 — Company Research (GPT-backed summarization)

**Where:** `frontend/src/app/context-research/page.tsx`

1. Click **Start Research**.
2. Edit company summary and a bio field.
3. Continue.

**Expected outcome:**
- Research fields populate via the backend (`POST /context-research/research`).
- In GPT demo mode, the structured summary should feel “smart” and aligned to the selected company/contacts.
- User can edit to refine.

**What customer wants:**
- A strong “briefing” that makes outreach feel customized.

---

#### Step 8 — Offer Creation (GPT-backed drafting)

**Where:** `frontend/src/app/offer-creation/page.tsx`

1. Select tone (e.g., manager/exec).
2. Click **Generate Offer**.

**Expected outcome (GPT demo mode):**
- The offer body is human, concise, and clearly based on the match.
- The title/content feel like a real pitch, not template filler.

**Expected outcome (fallback mode):**
- Offer still generates using deterministic template.

**What customer wants:**
- “I have a usable pitch in seconds.”

---

#### Step 9 — Compose

**Where:** `frontend/src/app/compose/page.tsx` (and `backend/app/routers/compose.py`)

1. Generate an email template.
2. Toggle simplified/jargon features if present.

**Expected outcome:**
- Template generates via `POST /compose/generate`.
- The variable values should now be populated from upstream steps (selected contact, selected JD, pain point match, research summary) rather than static placeholders.
- Jargon detection runs and simplified copy is available.

**What customer wants:**
- A polished email they can send right now.

---

#### Step 10 — Campaign

**Where:** `frontend/src/app/campaign/page.tsx`

1. Review sequence steps.
2. Ensure spam word count and email length indicators show.

**Expected outcome:**
- The sequence is previewable and editable.
- The Campaign page should also show “GPT Helper: variant ideas” if Compose returned variants (stored in `localStorage.compose_helper`).
- Follow-up steps should show substituted values (no raw `{{first_name}}` placeholders) because the campaign preview resolves variables from the composed email.

**What customer wants:**
- “I can send a full follow-up sequence, not just one email.”

---

#### Step 11 — Deliverability / Launch

**Where:** `frontend/src/app/deliverability-launch/page.tsx` and `backend/app/routers/deliverability_launch.py`

1. Run pre-flight checks.
2. If launch is available in UI, launch a campaign.

**Expected outcome:**
- Pre-flight checks return results.
- Launch records outreach sends (DB-backed), even if delivery is mocked.
- Contacts are passed from the UI into the backend, so verification counts and launch counts reflect selected recipients.

**What customer wants:**
- Confidence they won’t tank deliverability and can “push go” safely.

---

#### Step 12 — Analytics

**Where:** `frontend/src/app/analytics/page.tsx` and `backend/app/routers/analytics.py`

1. View overview.
2. Export CSV if available.

**Expected outcome:**
- Analytics show totals, click/reply rates, breakdown by status.
- If you launched, totals reflect outreach rows.
- The Analytics page includes a “GPT Helper: interpret results” panel (calls `GET /analytics/explain`) that returns insights/risks/next actions (GPT-backed or deterministic stub).

**What customer wants:**
- A clear “is this working?” dashboard.

---

### 2) Quick API Spot Checks (Optional)

These checks help confirm GPT-backed endpoints are actually engaged.

#### A. LLM readiness
- `GET /health/llm`
  - Expected: `should_use_real_llm=true` in GPT mode.

#### B. JD parsing
- `POST /job-descriptions/import`
  - Provide `{"text": "<paste JD>"}`
  - Expected: response includes coherent `pain_points`, `required_skills`, `success_metrics`.

#### C. Resume upload
- `POST /resume/upload` (multipart form)
  - Expected: response extract includes `skills`, `accomplishments`, `key_metrics`.

#### D. Match generation
- `POST /painpoint-match/generate`
  - Expected: `matches[0]` includes good `painpoint_#`, `solution_#`, optional `metric_#`.

#### E. Offer creation
- `POST /offer-creation/create`
  - Expected: `offer.title` and `offer.content` read like a real pitch in GPT mode.

---

### 3) Demo Pass/Fail Criteria

A successful Week 10 demo should show:

- **Paste JD → extracted pain points/skills/metrics** that feel correct.
- **Upload resume → extracted impact** (metrics/accomplishments) visible.
- **Match → persuasive alignment** (challenge → solution → metric) without manual writing.
- **Offer → ready-to-send pitch** in a selectable tone.
- **Launch → analytics** reflect at least some “real” recorded sends.

If any GPT output fails JSON parsing, the app should still remain demoable via deterministic fallbacks.

---

### 4) Known “Demo Acceptable” Limitations (Week 10)

- Resume PDF/DOCX parsing is still simplistic; best results with TXT or copy/paste style content.
- Company research uses a mocked corpus but is summarized via GPT; it is still “demo realistic” but not yet powered by real provider pipelines.
- Campaign sequence generation is simulated client-side in Week 10 (Compose + Deliverability + Analytics remain GPT-backed and visible).
- Deterministic defaults remain in place in many spots to ensure the demo never breaks.
