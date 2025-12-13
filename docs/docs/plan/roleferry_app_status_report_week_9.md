# RoleFerry App Status – Live vs Demo Modes (Dec 2025)

## 1. Overview

RoleFerry now closely mirrors the 10–12 step wireframed path (from Job Preferences through Launch and Analytics) with a **mock‑first, Postgres‑backed backend** and a **Next.js frontend** that can present either a rich demo or call real APIs when available.
The system is organized around a **single `demo-user` cohort** plus feature flags: `ROLEFERRY_MOCK_MODE` in the backend and a `DataMode` toggle (`demo` vs `live`) in the frontend, allowing you to flip between purely demo behavior and “real DB + optional integrations” without breaking the UX.

## 2. Current App Status vs Wireframes

### 2.1 End‑to‑end path coverage

The main keypad/path (`/` home) and navbar cover the spec’d journey:
- **Path home (`/`)**: Keypad stones for `Job Preferences → Resume → Job Descriptions → Tracker → Pain Point Match → Company Research → Decision Makers → Offer Creation → Campaign → Deliverability / Launch → Analytics` (see `app/page.tsx`).
- **Navbar**: Primary workflow tabs (`/job-preferences`, `/resume`, `/job-descriptions`, `/painpoint-match`, `/find-contact`, `/context-research`, `/offer-creation`, `/compose`, `/campaign`, `/deliverability-launch`) and utility tabs (`/dashboard`, `/analytics`, `/settings`, `/help`) are wired and styled.

Most screens now have **both** a realistic UI and a concrete backend contract; several also persist to Postgres for the `demo-user`:
- **Job Preferences (`/job-preferences`)**
  - Frontend: loads cached preferences from `localStorage` for snappy UX, then calls `GET /job-preferences/demo-user` and maps the backend shape into UI fields; `Save & Continue` posts to `/job-preferences/save` and optimistically caches.
  - Backend: `job_preferences.py` persists a JSONB blob in `job_preferences` keyed by `user_id = 'demo-user'`, with **DB‑first behavior and mock defaults** as a fallback.
- **Resume (`/resume`)**
  - Frontend: uploads PDF/DOCX/TXT via `/api/resume/upload`, then normalizes the backend `extract` into the resume editor and caches as `resume_extract` in `localStorage`.
  - Backend: `resume.py` uses rule‑based `parse_resume`, stores `raw_text + parsed_json` into `resume` for `demo-user`, and returns a rich mock extract shape; later gets are still mock‑heavy but DB persistence is in place.
- **Job Descriptions (`/job-descriptions`)**
  - Frontend: maintains a locally sortable list, but `Import Job Description` calls `POST /job-descriptions/import` with URL or text, then maps the backend’s parsed JSON into `painPoints`, `requiredSkills`, and `successMetrics`, caching to `localStorage`.
  - Backend: `job_descriptions.py` **writes real rows** to `job` and creates a starter `application` for `demo-user`, and can read/update/delete JDs from Postgres, falling back to mock data if the DB is empty or unavailable.
- **Pain Point Match (`/painpoint-match`)**
  - Frontend: reads cached JDs + resume extract; when you click Generate it POSTs to `/painpoint-match/generate` and persists the mapped matches to `localStorage`.
  - Backend: `pain_point_match.py` pulls `job.parsed_json` and the latest `resume.parsed_json`, performs **lexical, rule‑based pairing**, writes rows into `pain_point_match`, and returns one canonical match object; a read endpoint still returns pure mocks for fast demos.
- **Offer Creation (`/offer-creation`)**
  - Frontend: uses the pain point matches plus a rich, multi‑tone editor; `Generate AI Offer` POSTs to `/offer-creation/create`, and `Save to Library` POSTs to `/offer-creation/save`, then keeps a local offer library.
  - Backend: `offer_creation.py` implements **template‑style offer generation** using the first pain point pair and the requested tone, and persists offers into the `offer` table for `demo-user`.
- **Decision Makers (`/find-contact`)** and **Company Research (`/context-research`)**
  - Frontend: currently **100% mock‑driven** on the client (no backend calls). Contacts are generated in‑memory; verification is simulated; research data (company summary, contact bios, news, shared connections) is synthesized and then cached.
  - Backend: routers for enrichment and research exist but this specific path still acts as a **front‑end‑only experience**, which is fine for demo but not yet wired to real data providers.
- **Campaign & Deliverability / Launch (`/campaign`, `/deliverability-launch`)**
  - Frontend (Deliverability Launch): runs **pre‑flight checks** and `launch` via `/deliverability-launch/*`, but passes an empty `contacts` list for now; the UX clearly walks through checks and launch confirmation.
  - Backend: `deliverability_launch.py` calls `verify_email_async` (mock/real depending on config), computes spam and warmup checks, and writes to the `outreach` table; when `ROLEFERRY_MOCK_MODE=false` and SMTP + internal recipients are configured, it also sends real test emails via `email_sender.send_email`.
- **Analytics (`/analytics`)**
  - Frontend: uses `DataMode` to either render a canned `DEMO_ANALYTICS` object or call `/analytics/overview` via the shared `api` helper; errors are surfaced with actionable “check the backend” guidance and a reminder you can switch back to Demo.
  - Backend: `analytics.py` computes KPIs from real `application` + `outreach` rows for `demo-user`, plus in‑memory message mocks, and returns a shape the frontend renders into Instantly‑style cards and tables.
- **Settings (`/settings`)**
  - Frontend: modal page that calls `GET /settings` and `GET /subscription/status`, exposes the **MillionVerifier threshold** slider (persists via `/api/settings`) and **subscription actions** (upgrade/cancel) that post to `/subscription/*`.
  - Backend: `health.py` provides environment, provider flags, DB/Redis health, and `mock_mode`; `subscription.py` stubs a `beta` plan and records upgrade/cancel intents in `subscription_intent` for `demo-user`.

Overall, the **core job‑seeker path is implemented end‑to‑end for a demo cohort** with DB persistence for preferences, resumes, jobs, applications, pain‑point matches, offers, outreach, and beta feedback; Decision Makers and Research are still mock‑only, and campaign sending is “recorded” but only sends real mail in a narrow, opt‑in configuration.

## 3. Live vs Demo / Mock Behavior

### 3.1 Backend feature flags and health

- **Mock mode (`ROLEFERRY_MOCK_MODE`)**
  - `backend/app/config.py` exposes `Settings.mock_mode`, defaulting to `true` (see `.env.example`, `DEVELOPMENT.md`, and `backend/README.md`).
  - Many services (email sending, external verifiers, some providers) are written to **respect `mock_mode`**: e.g., `deliverability_launch.launch` only sends SMTP test mail when `mock_mode` is `False`, and `demo_reset` is **explicitly restricted to dev/mock** (`/demo/reset` 403s otherwise).
- **Health & infra visibility**
  - `health.py` now checks **Postgres (`SELECT 1`)** and **Redis** (`Redis.from_url(...).ping()`), returns `status`, `env`, `version`, `mock_mode`, and a `providers` map showing whether `SERPER`, `OPENAI`, `FINDYMAIL`, and verifiers have API keys.
  - This gives an at‑a‑glance answer to “are we running in pure demo, partial live, or fully live mode?” for the backend.

### 3.2 Frontend data modes and UX behavior

- **User mode (`rf_mode`)**
  - The primary persona toggle (Job Seeker vs Recruiter) is stored in `localStorage` and broadcast via a `modeChanged` custom event; pages like Job Preferences, Offer Creation, and Deliverability Launch adjust labels and copy based on this.
- **Data mode (`rf_data_mode`)**
  - `frontend/src/lib/dataMode.ts` defines a simple `DataMode = "demo" | "live"` with `getCurrentDataMode`, `setCurrentDataMode`, and an event‑based subscription API.
  - `Navbar` includes a **Demo/Live switch** that calls `setCurrentDataMode`; `Analytics` subscribes to mode changes and either:
    - loads a **static, rich demo dataset** (no backend required), or
    - calls `/analytics/overview` and surfaces a detailed error if the live API is unavailable.
- **Fallback patterns**
  - Many pages follow a **“local first, backend if available”** pattern:
    - Job Preferences: local cache first, then backend; if the backend errors, the UI silently degrades to local‑only.
    - Job Descriptions: local list is authoritative for rendering; backend is used opportunistically for import and persistence.
    - Resume: front‑end always builds an extract object; the backend persists raw text and parsed JSON for later AI/analytics usage.
  - Decision Makers and Context Research are currently **always in “demo” mode**, independent of `DataMode`; wiring them into `DataMode` + backend would be the next logical step.

In practice this means you can run the frontend in **pure demo** (no backend), or run both services and flip **Analytics (and several save actions) into real Postgres‑backed mode** without changing the UX entry points.

## 4. Recent Work That Moved the App Toward Production

This section focuses on concrete changes beyond the Week‑4/5 “wireframes + stubs” that make the app closer to a real, beta‑ready product.

### 4.1 Database schema and migrations

- New migrations (`0002_core_entities.sql` through `0006_subscription_intents.sql`) introduce and refine core tables for:
  - **Core job‑search entities**: `job`, `application`, `resume`, `job_preferences`, `pain_point_match`, `offer`, `outreach`.
  - **Feedback & subscription**: `beta_feedback` for survey responses, `subscription_intent` for upgrade/cancel events.
  - **Email verification & outreach analytics**: columns for verification status, status enums, and timestamps used by analytics and deliverability.
- These schemas match the Week 9–12 backend plan and give the FastAPI routers a **real persistence layer** instead of pure in‑memory mocks.

### 4.2 Backend routers upgraded from stubs to DB‑backed flows

- **Job, Resume, Preferences, Pain Point Match, Offers**
  - `job_preferences.py`, `resume.py`, `job_descriptions.py`, `pain_point_match.py`, and `offer_creation.py` are now **read/write routers** that use `get_engine()` and async SQL to persist for `demo-user`, with thoughtful fallbacks to mock data.
  - This turns the ICP → Resume → JD → Match → Offer segments into a **coherent workflow** whose artifacts live in Postgres and can drive analytics.
- **Analytics & deliverability**
  - `analytics.py` computes **real KPIs** from `application` and `outreach`, including status breakdowns and verification ratios, combining them with the existing in‑memory message store.
  - `deliverability_launch.py` layers:
    - async pre‑flight checks (email verification, spam score, DNS, bounce history, warmup),
    - `record_outreach_send` calls for each contact (even when contacts are still mocked upstream), and
    - optional SMTP test sends when `mock_mode` is disabled and internal recipients are configured.
- **Health, feedback, subscription, and demo reset**
  - `health.py` exposes a **production‑style healthcheck** with DB/Redis and provider flags plus Prometheus metrics.
  - `beta_feedback.py` writes structured beta survey responses (email, NPS, willingness to pay, suggested price, free‑form feedback) into `beta_feedback` and lists them for internal review.
  - `subscription.py` provides a **safe, non‑billing stub** that records upgrade/cancel intents into `subscription_intent` so you can test pricing flows without touching Stripe/Paddle.
  - `demo_reset.py` gives you a **dev‑only reset switch** to clear demo‑user data across key tables in a safe order, making repeated walkthroughs and tests much easier.

### 4.3 Frontend wiring to real APIs and data modes

- Many Next.js pages were upgraded from static/wireframe to **API‑aware flows** that match the backend contracts:
  - Job Preferences, Resume, Job Descriptions, Pain Point Match, Offer Creation, Deliverability Launch, Analytics, and Settings all now use the shared `api` helper or `/api/*` to call FastAPI.
  - Local storage is used as a **performance + offline cache**, not the sole source of truth, making the app resilient when the backend is down but capable of real persistence when it is up.
- `dataMode.ts` and the `DataModeToggle` in `Navbar` provide a **clear, global control** for Demo vs Live behavior, currently wired into Analytics and ready to be extended to other pages.

Collectively, these changes move RoleFerry from “beautiful wireframes with mocks” to a **mock‑friendly but genuinely stateful application**: most of the core job‑search workflow can already run end‑to‑end on a live FastAPI + Postgres stack for a demo cohort, while staying cost‑controlled and safe for beta.

## 5. Remaining Gaps Before Broader Production Use

- **Single demo user & auth**: everything is keyed to `user_id = 'demo-user'`; real multi‑user auth and tenancy are not yet wired in, though the schema and routers are structured to support it later.
- **External providers still mostly mocked**: config exists for Serper, Apify, Findymail, NeverBounce/MillionVerifier, Instantly, Gamma, etc., but current flows either don’t call them or call them through mock implementations; going live will require enabling selected providers behind clear feature flags.
- **Decision Makers & Research**: `/find-contact` and `/context-research` are rich but front‑end‑only; to match the backend plan, they should eventually drive and read from real `contacts`, `company`/research tables and (optionally) search/scrape/LLM pipelines.
- **Queues & background jobs**: Redis is health‑checked, but send/verify/analytics aggregation still run synchronously in request handlers; the Week 10–12 plan envisions moving these to a worker/queue model.
- **Unified Demo/Live semantics**: the **backend’s `mock_mode`** and the **frontend’s `DataMode`** are conceptually aligned but not yet fully synchronized; today, Analytics and some save actions can be “live” while other screens remain mock‑only.

Even with these gaps, the app is **substantially closer to beta‑ready** than the wireframes alone: the core workflows are implemented against a real schema, critical metrics are computed from stored events, and you have the controls (mock mode, DataMode, demo reset) to safely run demos now and gradually turn on live behavior as APIs and AI budgets allow.