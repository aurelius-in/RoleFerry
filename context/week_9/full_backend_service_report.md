## Full Backend Service Report – Weeks 9–12 Roadmap

### Overview

This report combines:

- **`AI_backend_price_estimates.md`** – per‑service cost estimates for LLMs and AI‑adjacent APIs.  
- **`AI_for_cursor_to_build.md`** – AI‑like features that can be implemented via rules/templates instead of paid LLMs.  
- **`non-AI-backend-services.md`** – databases, queues, email, auth, and other core infra, ordered by ease/cost.

It defines a **4‑week backend roadmap (Weeks 9–12)** that:

- Prioritises **free or near‑free services** first,
- Uses **mocked or rule‑based AI** wherever possible,
- Gradually enables real external services so that by **Week 12**, RoleFerry can run end‑to‑end for a small beta cohort (~20 “golden” users).

Assumptions:

- Backend = existing **FastAPI** service in `backend/app/`.  
- Database = Postgres; queue = Redis (per `config.Settings`).  
- We can keep `ROLEFERRY_MOCK_MODE=true` for most flows and selectively enable real integrations as budget allows.

---

## Week 9 – Mock‑Heavy, Realistic Flows with Near‑Zero Spend

### Objectives

- Make **one or two full workflows** feel real (Job Preferences → Resume → Pain Point Match → Offer → Campaign → Launch → Analytics), **entirely on mock/rule‑based logic**, with no meaningful external API spend.
- Produce enough backend structure that front‑end wireframes feel attached to a real system.

### AI / AI‑Adjacent Services (Week 9)

- **LLM (OpenAI GPT‑4o)**:
  - Keep behind a **feature flag**; default to **rule‑based and template implementations** described in `AI_for_cursor_to_build.md`.
  - Allow a **handful of manual test calls** only, for you/Dave to sanity‑check prompts (spend ≪ $10).
- **Serper.dev, Apify, Findymail, NeverBounce/MillionVerifier, Instantly, Gamma, Warmup providers**:
  - Treat all as **mocked**:
    - Use the stub clients already in `app/services/*` (e.g., `findymail_client`, `neverbounce_client`, `serper_client`, `ApifyClient`).
    - Seed static sample data for companies, contacts, and research.

### Non‑AI Backend Services (Week 9)

- **Core infra** (from `non-AI-backend-services.md`):
  - Local **Postgres** instance with migrations applied.
  - Optional local **Redis**, even if only lightly used.
  - Simple **CSV import/export** for jobs, contacts, and leads (lead‑qual scaffolding).
  - Minimal **logging/audit** (e.g., `AUDIT_LOG` table, console logs).
- **No external SMTP/auth/storage yet**:
  - Email sending stays mocked; no real deliverability constraints.
  - `user_id` hard‑coded or stubbed; no external auth provider.

### Screens / Endpoints That Become “Truly Live” (Backed by DB + Rules)

- **Job Preferences**:
  - `/job-preferences` GET/PUT reading and writing real rows in `JOB_PREFERENCES`.
- **Your Resume**:
  - `/resume/upload` and `/resume` wired to rule‑based parsing and `RESUME` records.
- **Job Descriptions + Job Tracker**:
  - `/jobs`, `/jobs/{id}`, `/applications` implemented with DB persistence and basic status transitions.
- **Pain Point Match**:
  - `/pain-points` and `/pain-points/generate` using lexical overlap heuristics (no LLM).
- **Offer Creation + Campaign Sequence (templates only)**:
  - `/applications/:id/offer`, `/sequence-templates`, `/sequence-steps/:id` using static templates and variable substitution.
- **Analytics (stub)**:
  - `/analytics/overview` returning counts derived from stored `OUTREACH` / `APPLICATION` rows, even if sends are mocked.

---

## Week 10 – Turn On Cheapest Real Data Paths

### Objectives

- Introduce **real persistence and external delivery** where they are cheapest and lowest‑risk:
  - Move from “mock send” to **real transactional email** for limited flows.
  - Support at least **one real campaign launch** end‑to‑end for internal testers.

### AI / AI‑Adjacent Services (Week 10)

- **LLM (OpenAI GPT‑4o)**:
  - Still mostly **rule‑based / template** for production use.
  - Optionally enable GPT‑4o for **one or two flows**, e.g.:
    - A “Generate from AI” button on Offer Creation or Pain Point Match.
  - Keep monthly LLM cost around **$20–$40** (well below the ~$90 “full” usage estimate).
- **Serper.dev & Apify**:
  - Carefully introduce **real calls** for a **handful of companies/jobs**:
    - Example: when you click “Refresh research” on 2–3 demo companies.
  - Stay within **free tiers** or lowest plan (< $10/month).
- **Verification & enrichment (Findymail, NeverBounce/MillionVerifier)**:
  - Continue to use **mocks only**.

### Non‑AI Backend Services (Week 10)

- **Transactional Email provider**:
  - Wire **SES/SendGrid/Mailgun/Postmark** into the OUTREACH pipeline so:
    - Launching a test campaign sends real emails to **internal inboxes** (you/Dave, test accounts).
  - Keep volume low (dozens/hundreds of emails), cost **$1–$5/month**.
- **Job scheduling (cron/APScheduler)**:
  - Add minimal **nightly jobs** for:
    - Aggregating `campaign_metrics` (total sent, roles applied, click/reply counts).
    - Cleaning up temporary data.
- **Optional file storage**:
  - If we enable resume file upload, move from purely in‑DB text to **local filesystem or a free S3‑compatible bucket**.

### Screens / Endpoints That Become More Real

- **Launch Campaign**:
  - `/campaigns/:id/launch` actually creates `OUTREACH` rows and enqueues send jobs.
  - Limited to **internal campaigns** in Week 10.
- **Analytics**:
  - `/analytics/overview` now **reflects real sends** (even if only to internal recipients).
- **Deliverability & Warmup section**:
  - Still scaffolded with mocked warmup stats, but we can start reading **real bounce/reply data** from our transactional provider once webhooks are wired (or approximate via OUTREACH statuses).

---

## Week 11 – Mid‑Tier Integrations & Better Analytics

### Objectives

- Add **mid‑cost, mid‑complexity** integrations that materially improve the experience:
  - Light email verification.
  - Enrichment for a small number of contacts.
  - More robust analytics and warmup scaffolding.

### AI / AI‑Adjacent Services (Week 11)

- **Email Verification (NeverBounce / MillionVerifier)**:
  - Start verifying **only launch‑ready contacts** (e.g., 1–2 per job, per user).
  - Aim for **2K–5K verifications/month**:
    - Expected cost: **$10–$40/month**.
- **Findymail (contact enrichment)**:
  - Use **sparingly** to enrich:
    - A small internal “golden list” of companies and decision makers.
  - Consider a **low‑tier plan (~$40–$60/month)** if we want live enrichment.
- **Serper.dev & Apify**:
  - Expand usage to a **few dozen searches/actor runs per day**, still staying under or near free tiers.
- **LLM usage**:
  - Keep GPT‑4o usage bounded; we can:
    - Use it **only when a user clicks an explicit “Use AI” control**,
    - Continue to rely on templates/rules as the default.

### Non‑AI Backend Services (Week 11)

- **Redis / background workers (Core)**:
  - Put **email send + verification + basic analytics aggregation** onto a real worker queue.
- **Webhook receivers**:
  - Implement `/webhooks/*` handlers for:
    - Transactional email events (delivered, bounced, clicked, replied).
    - Instantly or other outreach tool events, if we choose to integrate.
- **Improved monitoring/logging**:
  - Optional: integrate **Sentry** free tier for error tracking.
  - Add simple metrics endpoints (`/health`, counts) for observability.

### Screens / Endpoints That Become “Data‑Informed”

- **Decision Makers**:
  - Timezones and filter tags can be partly backed by real enriched data (where available), not just mocks.
- **Deliverability & Warmup**:
  - Warmup still mostly simulated, but **bounce/reply analytics** now drive **health labels** (“healthy”, “warming”, “at risk”).
- **Analytics**:
  - Campaign KPI cards (Total sent, Click rate, Reply rate, Roles applied) now reflect **verified sends and replies** based on webhook + DB events.

---

## Week 12 – Full Stack Online for a Small Beta Cohort

### Objectives

- Have all **major backend features from `week_8_backend_work_list.md`** wired in some form (even if some are still mock‑heavy).  
- Be comfortable onboarding **~20 paying beta users**, with:
  - Real campaigns,
  - Real analytics,
  - Clear cost bounds on external services.

### AI / AI‑Adjacent Services (Week 12)

- **LLM (OpenAI GPT‑4o)**:
  - Decide whether to:
    - Keep **rules/templates as default** and treat GPT‑4o as a premium “assist”,
    - Or **flip** specific critical flows (e.g., pain point map, offer generation) to call GPT‑4o by default.
  - Budget target: **≤ \$100/month** for beta usage.
- **Verification & Enrichment**:
  - Solidify the combo:
    - One primary **email verifier** (NeverBounce or MillionVerifier).
    - One primary **enrichment source** (Findymail).
  - Use them primarily for:
    - Beta users who are actively launching campaigns,
    - Contacts marked as “ready to outreach”.
- **Warmup provider / Instantly**:
  - Decide if we:
    - Keep **warmup & external sending** on an **existing Instantly account / warmup provider** you already pay for, or
    - Purchase a **dedicated plan** for RoleFerry.
  - For Week 12, it’s still acceptable if **only your internal campaigns** use this; beta testers can remain on RoleFerry’s internal sender + light warmup.

### Non‑AI Backend Services (Week 12)

- **Authentication & User Management**:
  - Introduce a real auth mechanism:
    - Either custom JWT + passwordless magic links, or
    - A provider like **Supabase Auth / Auth0 / Clerk** on a free/low plan.
- **Storage & Attachments**:
  - Move file storage (resumes, exported docs) to a **stable S3‑compatible bucket**.
- **Orchestration**:
  - If flows have become complex (multi‑step lead‑qual, multi‑day warmup jobs), optionally:
    - Integrate **n8n** (self‑hosted or SaaS) via `n8n_hooks`.
    - Keep critical flows still runnable via simple cron + worker queue as a fallback.
- **Monitoring**:
  - Have a basic **dashboard or log view** that lets you see:
    - Active campaigns and their send status,
    - Health of background workers,
    - Top‑line email metrics.

### Screens / Endpoints Ready for Real Beta Users

By end of Week 12, the goal is:

- **Job Preferences, Your Resume, Job Descriptions, Job Tracker**:
  - Fully backed by Postgres; import paths for CSV/Sheets in place.
- **Pain Point Match, Company Research, Decision Makers**:
  - At minimum, use **rule‑based mapping and seeded research**, with optional AI assists.
- **Offer Creation, Campaign Sequence, Launch, Analytics**:
  - Work end‑to‑end for live beta users:
    - Emails are actually sent,
    - Key events are tracked,
    - KPIs (Total sent, Click rate, Reply rate, Roles applied) are accurate.
- **Feedback/Beta Survey**:
  - Survey responses stored in `beta_feedback`, including pricing willingness fields tied to the $499 anchor.

---

## Beyond Week 12 – Scaling & Cost Tuning

Once 20 “golden” users are happily running on this stack, further work shifts to:

- **Scaling LLM usage**:
  - Measure real‑world token consumption and gradually enable more AI‑first flows.
  - Consider adding **Claude/Gemini** as alternates if pricing or performance is compelling.
- **Optimising vendor mix**:
  - Monitor actual spend on:
    - GPT‑4o, Findymail, NeverBounce/MillionVerifier, Instantly/warmup tools, Serper, Apify.
  - Consolidate or swap providers where quality/cost is out of line.
- **Hardening infra**:
  - Move DB/Redis to managed, highly‑available instances.
  - Improve auth, rate‑limits, and compliance (if/when needed).

But for now, this Week 9–12 roadmap keeps everything aligned with the Week 8 decisions: **prove value and workflow first**, keep the **illusion of smart AI** via strong templates and heuristics, and only pay for the most impactful backend services as we approach a live beta.


