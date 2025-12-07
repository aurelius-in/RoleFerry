## Non‑AI Backend Services for RoleFerry (Prioritized by Ease & Cost)

### Purpose

This document lists **non‑AI backend services** needed (or nice‑to‑have) for RoleFerry to work end‑to‑end, beyond LLMs and AI‑adjacent APIs.  
Items are grouped and ordered by:

- **Ease of adoption** (dev/setup complexity),
- **Cost** (free → low → higher), and
- Whether they are **core for MVP** vs **optional / later**.

Assumptions:
- Backend is the existing **FastAPI** app in `backend/app/`.
- DB is Postgres; queue is Redis (per `config.Settings`).
- Week‑9–12 focus is on **small beta cohort (~20 users)**.

---

## 1. Core Infra (Free or Very Low Cost First)

### 1.1 Postgres Database (Core)

- **Role**: Primary data store for:
  - Users, resumes, jobs, applications, contacts, campaigns, sequences, events.
  - Lead‑qual tables and `campaign_metrics` style rollups.
- **Current state**:
  - `DATABASE_URL` in `config.py` defaults to `postgres://postgres:postgres@localhost:5432/roleferry`.
  - Migrations already scaffolded in `backend/app/migrations/`.
- **Free / easy options**:
  - **Local Postgres** (Docker or system install) for dev/beta.
  - Free tier on **Railway/Fly.io/Render/Supabase** if we want a managed instance.
- **Rough beta cost**:
  - **$0–$10/month** for a small managed instance; **$0** if self‑hosted.
- **Priority**: **Core, Week 9.**

---

### 1.2 Redis / Queue for Background Jobs (Core, but can be deferred)

- **Role**:
  - Job queue for email sending, warmup jobs, resume/JD parsing, lead‑qual pipelines, analytics aggregation.
- **Current state**:
  - `REDIS_URL` in `config.py` defaults to `redis://localhost:6379/0`.
  - No specific worker implementation wired yet, but Week 8 plan assumes async jobs.
- **Free / easy options**:
  - Local **Redis** (Docker container) for dev + early beta.
  - Tiny managed Redis instances on cloud providers (often under **$10/month**).
- **Rough beta cost**:
  - **$0–$10/month** depending on hosting.
- **Priority**:
  - **Nice‑to‑have Week 9** (for simulation).
  - **Core by Week 10–11** once real sending and scheduled jobs are introduced.

---

### 1.3 Object/File Storage (Resumes, Attachments, Intro Videos)

- **Role**:
  - Persist uploaded resumes, potential intro video links, and any generated assets (e.g., exported CSVs, offer decks if not left at Gamma).
- **Current state**:
  - No explicit storage provider wired yet (MVP can keep text fields only).
- **Free / easy options**:
  - **Local filesystem** for dev (with a `storage` directory).
  - Free tiers on S3‑compatible storage (e.g., Backblaze B2, Wasabi trials).
- **Typical low‑cost option**:
  - **AWS S3** or equivalent: a few GB of storage + minimal bandwidth is usually **≲ $5/month** at beta scale.
- **Priority**:
  - **Optional in Week 9** (can store raw text only).
  - **Core from Week 10+** once file uploads are turned on.

---

### 1.4 Transactional Email Provider (SMTP / API)

- **Role**:
  - Send non‑campaign emails:
    - Account verification, password reset (when auth is added),
    - System notifications,
    - Possibly **campaign sends** if we elect to self‑host sending instead of delegating to Instantly.
- **Current state**:
  - Backend code references email sending via `OUTREACH` + future services; no concrete SMTP provider wired yet.
- **Free / easy options**:
  - **Mailtrap**, **Mailhog** or similar for dev‑only (no real sends).
  - Free tiers:
    - **AWS SES**: very cheap per email, basically pennies at beta scale.
    - **SendGrid/Mailgun/Postmark**: limited free emails/month for testing.
- **Rough beta cost**:
  - With ~**a few thousand emails/month**, SES or similar is effectively **$1–$5/month**.
- **Priority**:  
  - **Core by Week 10–11** (once we send real emails instead of mocks).

---

### 1.5 Logging, Monitoring & Error Tracking

- **Role**:
  - Observe API health, capture exceptions, monitor latency and throughput as we add more services.
- **Current state**:
  - Basic FastAPI/uvicorn logs only.
- **Free / easy options**:
  - **Structured logging** to Postgres tables (audit + event logs).
  - Self‑hosted **Prometheus + Grafana** (or lighter alternatives) if desired.
  - **Sentry** free tier for error tracking.
- **Rough beta cost**:
  - **$0** if self‑hosted or basic.
  - Maybe **$10–$20/month** if we adopt a paid hosted option later.
- **Priority**:
  - **Nice‑to‑have Week 9–10**,
  - Becomes increasingly important by **Week 11–12** as functionality grows.

---

## 2. Data & Enrichment Services (Non‑LLM)

These overlap conceptually with the AI‑adjacent services, but here we treat them as **data/backbone providers** rather than “AI models”.

### 2.1 Contact & Company Data – Apollo / IcyPeas / Similar

- **Role**:
  - Provide high‑quality **company lists and contact records** (names, titles, emails, locations) for Decision Makers and lead‑qual flows.
  - Today, these tools are primarily used **manually** by you/Dave to seed contacts for demos.
- **Planned use in RoleFerry**:
  - Short‑term: manual exports/imports (CSV → RoleFerry) for the beta cohort.
  - Longer‑term: potential **API integrations** for automated enrichment.
- **Cost profile (typical)**:
  - Seat‑based SaaS (often **$50–$150/month per seat**).
  - Given we already use them for consulting work, RoleFerry’s incremental cost might be **$0** at first.
- **Priority**:
  - For the **app itself**, this is **optional**; we can:
    - Seed mock data and a few real CSVs.
    - Add API‑level integration only *after* we’re comfortable with our own data model.
  - Good candidate for **Week 11–12** if needed.

---

### 2.2 Google Sheets Integration

- **Role**:
  - Allow lead‑lists and job data to be imported from **Google Sheets** into RoleFerry.
- **Current state**:
  - `GOOGLE_SHEETS_SERVICE_JSON_PATH` and `GOOGLE_SHEETS_SHEET_ID` env keys in `backend/README.md`.
  - Lead‑qual endpoints reference a Sheets import path.
- **Cost & ease**:
  - Google Sheets API usage is **free** at our expected volumes.
  - Complexity is mainly in service‑account setup and auth.
- **Priority**:
  - **Nice‑to‑have**; not required for Week 9.
  - Reasonable target for **Week 10–11** once basic DB import flows are stable.

---

### 2.3 CSV Import/Export (Lead‑Qual, Jobs, Contacts)

- **Role**:
  - Ingest leads, jobs, and contacts from existing spreadsheets.
  - Export reports and analytics for you/Dave and early testers.
- **Current state**:
  - Scaffolded endpoints for CSV import in lead‑qual docs; limited implementation in `lead_qual` router and `repos/leads_repo.py`.
- **Cost & ease**:
  - Purely application logic + disk/DB; **no external cost**.
  - Implementation work is straightforward: parse CSV, validate, store.
- **Priority**:
  - Very **high leverage for early testers**.
  - Good candidate for **Week 9–10** with no external spend.

---

## 3. Orchestration & Automation

### 3.1 Job Scheduling / Cron

- **Role**:
  - Run recurring tasks:
    - Nightly analytics aggregation,
    - Email warmup sends,
    - Cleanup tasks (old logs, temporary files).
- **Options**:
  - Simple **cron jobs** on the server calling management scripts.
  - Python scheduling libraries (e.g., `APScheduler`) integrated into the FastAPI app.
  - External workflow tools (e.g., **n8n**, already hinted at via `routers/n8n_hooks.py`).
- **Cost & ease**:
  - Cron/APScheduler: **free**, low complexity.
  - Hosted n8n or similar: could be **$0** self‑hosted or **$20–$50/month** hosted.
- **Priority**:
  - Basic cron/APScheduler: **Week 10** (for analytics and light warmup).
  - More advanced orchestration: **Week 11–12** if complexity grows.

---

### 3.2 Webhooks & Integrations

- **Role**:
  - Receive events from external tools:
    - Instantly webhooks (campaign events),
    - Email provider events (bounces, clicks, replies),
    - Any future enrichment/warmup platforms.
- **Current state**:
  - `backend/app/routers/webhooks.py` and `n8n_hooks.py` already scaffolded.
- **Cost & ease**:
  - Webhooks themselves are **free**; cost comes from the upstream tools we integrate.
- **Priority**:
  - For MVP analytics, we can **mock events** or generate them from our own sending logic.
  - Real external webhooks land in **Week 11–12** once we decide which tools to rely on in production.

---

## 4. Authentication & User Management

### 4.1 Auth Provider (Optional for Small Beta)

- **Role**:
  - Handle user sign‑up/login, sessions, and basic profile data.
- **Current state**:
  - Week 8 backend plan assumes a **hard‑coded or stubbed `user_id`** for internal testers.
- **Options**:
  - Roll our own JWT/session logic (FastAPI + `python-jose` or similar).
  - Use a BaaS/Auth provider:
    - **Supabase Auth**, **Auth0**, **Clerk**, **Firebase Auth**, etc.
- **Cost**:
  - Most providers have **free tiers** that comfortably support 20–100 users.
  - Paid tiers kick in once we reach thousands of MAUs.
- **Priority**:
  - **Can be skipped in Week 9–10** (single “coach” account + stubbed user).
  - Important by **Week 11–12** once external testers start logging in directly.

---

## 5. Prioritized List (By Ease, Cost, and Importance)

### Week 9 – Zero/Low‑Cost Foundations

- **Core to have working**:
  - Local **Postgres** for all entities.
  - Optional but helpful **Redis** (even if only stubbed).
  - Simple **CSV import/export** for jobs, contacts, and leads.
- **Nice‑to‑have (if time allows)**:
  - Basic **file storage** abstraction (local disk only).
  - Minimal **logging** and an `AUDIT_LOG` table.

### Week 10 – Turn On Real Data Paths

- **Focus**:
  - Production‑ready Postgres instance (if not already).
  - **Transactional email** provider (SES/SendGrid/Mailgun) wired into OUTREACH sends.
  - Basic **job scheduling** (cron/APScheduler) for nightly analytics rollups.
  - **Google Sheets** imports for lead‑lists, if needed.

### Week 11 – Enrichment, Webhooks, and Light Orchestration

- **Focus**:
  - Solidify **Redis + background workers** for:
    - Email sends,
    - Lead‑qual flows,
    - Warmup prototypes.
  - Add **webhook receivers** for whichever external email/outreach provider we standardise on.
  - Optionally introduce **n8n** (self‑hosted or SaaS) if flows become complex.

### Week 12 – Auth, Scaling, and Optional Data Providers

- **Focus**:
  - Introduce a real **auth provider** (or robust custom JWT) for external beta testers.
  - Decide on deeper integration with **Apollo/IcyPeas** or similar (manual CSV vs API).
  - Harden **logging/monitoring** (Sentry + metrics dashboards).
  - Reassess storage, queues, and DB sizing based on beta usage.

---

### Takeaway

Most of RoleFerry’s **non‑AI backend** can be stood up using:

- **Local Postgres + Redis**,  
- A low‑cost **transactional email** service, and  
- Simple **cron + CSV** pipes,

all of which can comfortably sit in the **$0–$30/month** range for Weeks 9–10.  
Heavier, more complex services (auth providers at scale, managed Redis, advanced orchestration, deeper Apollo‑style integrations) can safely wait until **Weeks 11–12**, once you and Dave are confident in the core workflow and early user demand.


