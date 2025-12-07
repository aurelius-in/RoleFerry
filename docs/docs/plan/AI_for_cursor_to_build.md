---
layout: default
title: AI Features Cursor/GPT Can Pre‑Build 
---

## AI Features Cursor/GPT Can Pre‑Build (No Paid AI Backend Required)

### Purpose

This document lists **AI‑flavored backend features** from the Week 8 plan that **do not strictly require per‑request paid LLM APIs** at runtime. Instead, they can be implemented via:

- Deterministic **rules, regexes, and templates**,
- Light‑weight open‑source libraries, and
- One‑time code/rules authored with help from Cursor/GPT.

These approaches keep the UX close to the “real AI” experience while holding **runtime API spend at \$0** (other than normal hosting costs).

---

### 1. Parsing & Mapping (Resume, JD, Pain Points)

#### 1.1 Resume Parsing (`resume.*` fields)

**Screen / endpoints**
- “Your Resume” screen, `RESUME` entity, planned `/resume/upload` + `/ai/parse-resume`.

**What we can do without paid AI**
- For beta, assume resumes are **English, reverse‑chronological**, and follow a few common patterns (sections like “Experience”, “Education”, “Skills”, bullet points starting with a verb, etc.).
- Implement a **rule‑based parser**:
  - Use regex + keyword heuristics to split into sections.
  - Extract **metrics** by looking for numbers with `%`, `$`, `+`, or “X/Y/Z” patterns.
  - Compute `resume.total_years_experience` from the span between earliest and latest dated roles.
  - Derive `resume.position` from the most recent role title (first H2/H3‑style heading, or first line under “Experience”).
- Use **pre‑authored mapping tables** (static JSON) to normalise common job titles, industries, and skill names.

**Tradeoffs vs live LLM**
- More brittle to unusual resume formats and non‑English text.
- Extracted metrics and accomplishments will be **less nuanced** and may miss subtle achievements.
- Good enough to power **demo flows** and populate variables for templates; can be upgraded to LLM parsing once we observe failure patterns.

**Where to implement**
- New helper module (e.g. `app/services_resume.py` is already present as a stub).
- Keep the interface compatible with a future `/ai/parse-resume` so we can swap it out later.

---

#### 1.2 Job Description Parsing (`JOB` normalization)

**Screen / endpoints**
- Job Descriptions, `JOB` table, planned `/jobs` + `/ai/parse-job-description`.

**Rule‑based approach**
- Focus on a **small subset of JD structure**:
  - Titles and companies from the first `<h1>/<h2>` lines or “About the role” section.
  - Responsibilities vs requirements separated by heading keywords (“Responsibilities”, “What you’ll do”, “Requirements”, “What you bring”).
  - Location from simple patterns like “Location:”, known city names, or “Remote/Hybrid/Onsite”.
- Use a finite list of **keyword buckets**:
  - Map bullet points into categories like “ownership”, “leadership”, “technical depth”, “communication” based on verbs/phrases.

**Tradeoffs**
- Won’t handle extremely free‑form JDs, but gives enough structure for:
  - **Pain point mapping**,
  - Informative cards on Job Descriptions and Pain Point Match,
  - Early analytics around the types of roles being saved.

---

#### 1.3 Pain Point Mapping (JD ↔ Resume)

**Screen / endpoints**
- Pain Point Match screen, `pain_point_matches` table, `/pain-points` + `/pain-points/generate`.

**Heuristic mapping without AI**
- Treat each JD “requirement/responsibility” bullet and each resume metric/accomplishment as bags of tokens.
- Compute simple **overlap scores**:
  - Shared nouns/skills (e.g. “SQL”, “Python”, “HubSpot”).
  - Shared domain words (e.g. “B2B”, “SaaS”, “growth”, “pipeline”).
- For each JD bullet:
  - Choose the **top N resume bullets** by lexical overlap + presence of numbers (prioritize bullets with metrics).
  - Store those as `challenge_text` (JD) and `solution_text` (resume).

**Tradeoffs**
- No deep semantic reasoning; can miss “soft” matches (e.g. leadership capabilities expressed differently).
- Still **visually demonstrates** how the app pairs challenges to solutions and is enough to drive workflow tests and coaching discussions.

---

### 2. Content Generation Without Paid LLMs

Even though Week 8 imagines LLM‑generated copy (offers, sequences, research blurbs), we can deliver a credible beta by treating the backend as a **smart templating engine** rather than a generative model.

#### 2.1 Offer Creation Email Bodies

**Screen / endpoints**
- Offer Creation screen, `offers` table, `/applications/:id/offer`.

**Template‑driven approach**
- Pre‑author a set of **email skeletons** (short, medium, long; tones like “warm”, “direct”, “mentor‑style”) that rely on variables:
  - `{{resume.position}}`, `{{company.name}}`, `{{pain_point.primary}}`, `{{resume.key_metrics[0]}}`, etc.
- Use **conditional logic and simple rules** (already scaffolded in `app/services/template_engine.py` and `conditional_logic.py`) to:
  - Drop in **1–2 best‑matched pain points** from the heuristic mapper above.
  - Include or omit optional sections (intro video link, portfolio links) based on whether those fields exist.
- Cursor/GPT can help write **dozens of high‑quality template variants** up front; at runtime we only perform variable substitution and minor choice logic.

**Tradeoffs**
- Less “magical” than free‑form LLM copy, but:
  - Easier to QA and edit.
  - Very predictable length and tone.
  - Zero per‑send AI cost.

---

#### 2.2 Campaign Sequence Steps (Initial, Nudge, Value‑Add, Final)

**Screen / endpoints**
- Campaign Sequence screen, `SEQUENCE_TEMPLATE`, `SEQUENCE_STEP`, `/sequence-templates`, `/sequence-steps/:id`.

**What we can pre‑build**
- A small **library of canned sequences** tuned for:
  - Channel (email vs LinkedIn),
  - Segment (e.g. “growth‑stage SaaS”, “enterprise”, “startups”),
  - Tone (mentor, peer, formal).
- Each sequence step is a template that:
  - References variables from Resume, JD, Pain Points, Company Research, and Decision Maker.
  - Stays within target **character counts** for “Small/Medium/Large”.

**Runtime behavior (no paid AI)**
- When the user picks tone/length presets:
  - We **select an appropriate template** from the library.
  - Perform substitution and record the char counts in `SEQUENCE_STEP`.
- Users can still **inline‑edit** anything; our engine is just the starting point.

---

#### 2.3 Campaign Name Generation

**Screen / endpoints**
- Deliverability/Launch screen, `campaigns` table, `/campaigns/:id/summary`.

**Deterministic naming helper**
- Generate names like:

> `{{date}} – {{role_focus}} – {{segment}} – {{channel}} – {{tone}}`

Examples:
- `2025-12-08 – Data roles – Growth-stage SaaS – Email – Mentor tone`
- `2025-12-08 – Staff Engineer – FAANG-alikes – LI+Drops – Short & punchy`

**Implementation**
- Pull from existing data:
  - Job Preferences (roles, industries, company size).
  - Offer tone/length.
  - Channel choice (email vs LinkedIn) from settings.
- Concatenate into a slug‑like string, truncated gracefully for display.

**Why it’s enough for beta**
- Delivers exactly what you and Dave wanted: **consistent, interpretable names** for analytics, without incurring LLM cost.

---

### 3. Scoring, Spam Checks & Analytics

#### 3.1 Spam Word Detection & “Score”

**Screen / endpoints**
- Campaign Sequence sidebar (“Spam words: 0 found”), possible `/ai/spam-check`.

**Rule‑based spam detection**
- Maintain a **curated list** of spammy phrases (e.g., “FREE!!!”, “guaranteed”, “risk‑free”, “act now”, “limited time”, “earn $$$”).
- At save time:
  - Scan subjects and bodies for these tokens (case‑insensitive, word‑boundary aware).
  - Return:
    - `spam_words`: list of matches.
    - `spam_score`: simple function of count/rarity.
- UI already has scaffolding to **highlight matches in red**; no LLM needed.

**Tradeoffs**
- Simpler than sophisticated deliverability tools, but:
  - Easy for users to understand.
  - Avoids most egregious spam patterns.

---

#### 3.2 Character Count & Length “Health”

**Screen / endpoints**
- Campaign Sequence, Launch Campaign, analytics summaries.

**Purely deterministic**
- Backends can:
  - Count characters for each email at save time (`char_count` per step).
  - Mark ranges: `<200 = short`, `200–500 = optimal`, `>500 = long/risky`.
- This supports Week 8’s insight (LinkedIn / email response rates best under ~500 characters) without any AI.

---

#### 3.3 Basic Outcome Analytics

**Screen / endpoints**
- Analytics (`/analytics/overview`, `/analytics/campaigns/:id`).

**What doesn’t require AI**
- All high‑level KPIs:
  - `total_sent`, `click_rate`, `reply_rate`, `roles_applied`.
- Derived purely from:
  - `OUTREACH` send logs,
  - `email_events` (delivered, clicked, replied),
  - `APPLICATION` statuses.

Cursor/GPT can help design good **SQL views** (e.g., `campaign_metrics`) and roll‑up logic, but the runtime cost is just normal Postgres queries.

---

### 4. Company & Contact Research Scaffolding

#### 4.1 Company “Interesting Facts”

**Screen / endpoints**
- Company Research screen, `COMPANY.research_summary`, `/companies/:id/research`.

**Non‑AI implementation for beta**
- Use lightweight external APIs like Serper/Apify **once per company** (or even manual CSV seeds) to store:
  - Homepage title/tagline.
  - Short blurb or “About” text.
  - 3 static “interesting facts” per sample company (pre‑written using Cursor/GPT).
- At runtime, just read from the DB; no live LLM call required.

---

#### 4.2 Decision Maker “Signals”

**Screen / endpoints**
- Decision Makers, filters (Location, Management level, Signals).

**Rule‑based enrichment**
- For early demos:
  - Seed `CONTACT` rows with plausible titles, locations, LinkedIn URLs.
  - Hard‑code a few **signal tags** (e.g., “Changed jobs recently”, “Active on LinkedIn”) based on static sample data rather than live scraping/AI.
- Later, we can add real signal detection via Serper/Apify + LLM; for now, these fields are just **filters over mock data**.

---

### 5. How This Interacts With the Real LLM Layer Later

The key design principle is: **keep interfaces LLM‑shaped, but default implementations cheap and deterministic.**

- Each “AI” endpoint described in `week_8_backend_work_list.md` can have:
  - A **pure‑Python implementation** (rules/regex/templates/SQL) used when `ROLEFERRY_MOCK_MODE=true` or when no API key is set.
  - A **real LLM-backed implementation** behind the same function signature, enabled when keys and budget allow.
- Cursor/GPT’s job now is to help you:
  - Write and refine those rule‑based implementations.
  - Generate initial template libraries and spam word lists.
  - Keep logic small, testable, and easy to swap out.

This lets Week 9–10 focus on **proving workflow value** with almost no incremental AI spend, while leaving clear seams to “flip on” paid AI providers once you and Dave are confident in the flows and budget.


