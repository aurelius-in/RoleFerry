# Week 8 Backend Work List – RoleFerry

**Goal:** Make each RoleFerry screen actually do what the UI promises, using the existing data model and architecture docs. This is focused on a small early-user cohort (you, Dave, a few testers), but structured so it can scale later.

Assumptions:

* A `user_id` is available from auth (or hard-coded to `1` for now).
* We use the ERD entities (`USER`, `RESUME`, `JOB_PREFERENCES`, `JOB`, `APPLICATION`, `COMPANY`, `CONTACT`, `SEQUENCE_TEMPLATE`, `SEQUENCE_STEP`, `SEQUENCE_INSTANCE`, `OUTREACH`, `MAILBOX`, `HEALTH_LOG`, etc.).
* Front-end work is defined in `week_8_front-end_work_list.md` and previous Week 7 docs; this file describes what the backend must provide to support those screens.

---

## 0. Cross-cutting Backend Foundations

### 0.1 Core services & infra

* [ ] Stand up the main API service (per system-architecture docs) with:

  * [ ] REST base path (e.g. `/api/v1`).
  * [ ] Access to Postgres (or chosen DB) with the ERD schema migrated.
  * [ ] Redis / queue for background jobs (email send, AI calls, warmup).
* [ ] Implement minimal auth/session:

  * [ ] Accept a `user_id` from JWT / session / header.
  * [ ] For now, allow a fixed `user_id` for internal testing.

### 0.2 AI orchestration layer

Backed by OpenAI or whichever provider, but with our own abstraction.

* [ ] Implement an internal `ai_client` module that can:

  * [ ] Call models for: resume parsing, JD parsing, pain point mapping, offer generation, sequence generation, spam-word analysis, research summaries.
  * [ ] Log prompt + response metadata to `AUDIT_LOG` (no PII in prompts where possible).
  * [ ] Expose cost and timing metrics per call.

* [ ] Expose REST endpoints:

  * [ ] `POST /ai/parse-resume` → normalized `Resume` JSON.
  * [ ] `POST /ai/parse-job-description` → normalized `Job` JSON including responsibilities/requirements.
  * [ ] `POST /ai/pain-point-map` → challenge/solution pairs for resume+JD.
  * [ ] `POST /ai/offer` → draft email body (Offer Creation).
  * [ ] `POST /ai/sequence` → initial 4-email sequence given offer + strategy.
  * [ ] `POST /ai/spam-check` → list of suspected spam trigger words + score.
  * [ ] `POST /ai/company-research` → short company summary + 3–5 “interesting facts”.

### 0.3 Email sending, warmup, and tracking

Core engine behind Launch + Analytics + Warmup sections.

* [ ] Email sending service:

  * [ ] Integrate with chosen SMTP / transactional provider.
  * [ ] Single abstraction: `send_email(outreach_id)` that:

    * Loads OUTREACH record (to, subject, body, headers).
    * Sends via provider and records `sent_at`, `provider_message_id`, `status`.
  * [ ] Enforce send-rate limits per MAILBOX to avoid spam flags.

* [ ] Event tracking & webhooks:

  * [ ] `POST /webhooks/email-events` endpoint to receive provider events.
  * [ ] Map raw events into normalized `email_events` table:

    * Types: `delivered`, `opened`, `clicked`, `replied`, `bounced`, `spam_complaint`.
  * [ ] Link events back to `OUTREACH` rows and `SEQUENCE_INSTANCE`s.

* [ ] Warmup engine (for “Deliverability & warmup” section):

  * [ ] Model entities: `MAILBOX`, `HEALTH_LOG`.
  * [ ] Scheduler to:

    * Send a small number of warmup emails per mailbox per day to warmup network addresses.
    * Auto-reply / auto-archive warmup messages (loopback or co-op accounts).
  * [ ] Calculate daily mailbox health metrics:

    * Sent count, bounce rate, spam flags, inbox vs promotions (if signal available).
  * [ ] API for analytics screen:

    * `GET /mailboxes/:id/health` → time-series of warmup/health.

### 0.4 Analytics aggregation

* [ ] Nightly (or hourly) batch job:

  * [ ] Aggregate counts for each user/campaign:

    * `total_sent`, `total_clicked`, `total_replied`, `roles_applied`.
  * [ ] Store in `campaign_metrics` table keyed by `campaign_id` and date.
* [ ] “Live” rollups:

  * [ ] For same-day numbers, combine stored aggregates + fresh events.

---

## 1. Job Preferences Screen

Purpose: Persist the preferences that shape which jobs we pull in and how we name campaigns.

* [ ] Data model:

  * [ ] Ensure `JOB_PREFERENCES` table has fields for: title(s), location(s), remote preference, salary band, seniority, company size, etc. (per data-architecture docs).
* [ ] Endpoints:

  * [ ] `GET /job-preferences` → current user’s preferences.
  * [ ] `PUT /job-preferences` → upsert for current user.
* [ ] Logic:

  * [ ] Validate ranges (salary, experience).
  * [ ] Normalize enumerations (e.g. `remote_only`, `hybrid`, `onsite`).
  * [ ] Expose computed “preference tags” that can be reused in campaign naming and analytics segmentation.

---

## 2. “Your Resume” Screen

Purpose: Store resume + parsed structure used throughout the funnel.

* [ ] Data model:

  * [ ] Confirm `RESUME` entity with fields: `raw_text`, `roles`, `key_metrics`, `accomplishments`, `skills`, `total_years_experience`, `position` etc.
* [ ] Endpoints:

  * [ ] `POST /resume/upload` (multipart) → stores file, triggers parse job.
  * [ ] `GET /resume` → returns normalized `resume.*` fields for UI.
* [ ] AI parsing:

  * [ ] Background worker:

    * On upload, enqueue `parse_resume` job.
    * Call `POST /ai/parse-resume`.
    * Save returned structured data into `resumes` table.
  * [ ] Expose parse status (pending / complete / failed) to front-end.

---

## 3. Job Descriptions Screen

Purpose: Ingest jobs user wants to apply to and normalize them.

* [ ] Data model:

  * [ ] `JOB` table with: title, company_id, source_url, raw_description, normalized fields (responsibilities, requirements, location, compensation if present).
  * [ ] `APPLICATION` table linking user↔job with application status.
* [ ] Endpoints:

  * [ ] `POST /jobs` → create job from pasted JD or URL.

    * Optional flag to auto-parse via AI.
  * [ ] `GET /jobs?saved=true` → list of jobs saved in “Job Descriptions” pane (for Job Tracker + Pain Point Match).
  * [ ] `GET /jobs/:id` → detail.
* [ ] AI parsing:

  * [ ] Worker to call `POST /ai/parse-job-description` and fill responsibilities/requirements.
* [ ] Link to job tracker:

  * [ ] When a job is added, auto-create an `APPLICATION` row with status `saved`.

---

## 4. Job Tracker Screen

Purpose: Track progress across saved roles.

* [ ] Data model:

  * [ ] Ensure `APPLICATION` supports status enum (`saved`, `applied`, `interviewing`, `offer`, `rejected`, `closed`) and dates (`applied_at`, `last_action_at`).
* [ ] Endpoints:

  * [ ] `GET /applications` with filters for status, company, date.
  * [ ] `PATCH /applications/:id` to update status, notes, next follow-up date.
* [ ] Derived fields:

  * [ ] Compute “roles applied” (used in Analytics KPI).
  * [ ] Expose counts per status for the tracker UI.

---

## 5. Pain Point Match Screen

Purpose: Pair JD pain points with resume solutions for a selected job.

* [ ] Data model:

  * [ ] `pain_point_matches` table keyed by `job_id`, `resume_id`, `user_id` with rows:

    * `challenge_text` (from JD responsibilities/requirements).
    * `solution_text` (from resume metrics/accomplishments).
    * `relevance_score`, `created_at`.

* [ ] Endpoints:

  * [ ] `GET /pain-points?job_id=…` → list of existing challenge/solution pairs.
  * [ ] `POST /pain-points/generate` with `job_id` and `resume_id`:

    * Triggers AI generation if not already present (idempotent).

* [ ] AI logic:

  * [ ] Use `POST /ai/pain-point-map` with normalized JD + resume.
  * [ ] Store pairs; allow regeneration (versioning optional but nice).

* [ ] “Saved opportunities” integration:

  * [ ] `GET /jobs?saved=true` for the left column.
  * [ ] When a job selection changes, use its `job_id` to fetch pain-point map.

---

## 6. Company Research Screen

Purpose: Produce a quick view of the company for personalization.

* [ ] Data model:

  * [ ] `COMPANY` table with: name, website, industry, size, headquarters, and `research_summary` fields (JSON for structured facts and text summaries).
* [ ] Endpoints:

  * [ ] `GET /companies/:id` → company profile + research facts.
  * [ ] `POST /companies/:id/research` → trigger refresh of research.
* [ ] AI / external integration:

  * [ ] Worker:

    * Pulls basic info (from internal DB / public API / manual seed).
    * Calls `POST /ai/company-research` to generate:

      * Short narrative summary.
      * 3–5 “interesting facts” for personalization.
  * [ ] Cache results with `last_refreshed_at`.

---

## 7. Decision Makers Screen

Purpose: Store and manage people contacts for each company/job, including time zones.

* [ ] Data model:

  * [ ] `CONTACT` table with: `company_id`, `full_name`, `role_title`, `email`, `linkedin_url`, `timezone`, `notes`.
  * [ ] Relationship `APPLICATION` ↔ `CONTACT` via join table (candidate might target multiple contacts per role).

* [ ] Endpoints:

  * [ ] `GET /contacts?company_id=…` (for decision-makers view).
  * [ ] `POST /contacts` to create contacts.
  * [ ] `PATCH /contacts/:id` to update timezone or other fields.

* [ ] Time zone handling:

  * [ ] Validate `timezone` value (IANA string or a limited list like `America/Chicago`).
  * [ ] Provide default from company HQ if unknown, but allow overriding per contact.

* [ ] Integration with campaign:

  * [ ] Expose a “contact picker” API:

    * `GET /applications/:id/targets` → contacts linked to that role.
  * [ ] This is the pool of recipients for sequence generation and launch.

---

## 8. Offer Creation Screen

Purpose: Generate the core email message (the “offer”) from upstream data.

* [ ] Data model:

  * [ ] `offers` table:

    * `id`, `user_id`, `application_id`, `primary_contact_id` (optional), `body`, `tone`, `length_preset`, `created_at`, `updated_at`.
* [ ] Endpoints:

  * [ ] `GET /applications/:id/offer` → existing offer for that application (if any).
  * [ ] `POST /applications/:id/offer` → generate + save new offer.
  * [ ] `PATCH /offers/:id` → allow edits after generation.
* [ ] AI logic:

  * [ ] Call `POST /ai/offer` with:

    * `resume.*` fields.
    * JD pain-point pairs.
    * Company research facts.
    * Decision maker’s role + name.
    * Selected tone + length preset.
  * [ ] Enforce character length targets in the prompt, not just words.

---

## 9. Campaign Sequence Screen

Purpose: Define the 4-email cadence tied to a campaign and contact(s).

### 9.1 Sequence data model

* [ ] Confirm entities:

  * [ ] `SEQUENCE_TEMPLATE`: definition of a reusable cadence (Intro/Nudge/Value/Final).
  * [ ] `SEQUENCE_STEP`: the individual steps (offset days, subject, body, position in sequence).
  * [ ] `SEQUENCE_INSTANCE`: concrete attachment of a template to a specific application + contact(s).
  * [ ] `OUTREACH`: actual emails scheduled/sent.

### 9.2 API endpoints

* [ ] Template management:

  * [ ] `GET /sequence-templates` → list for library.
  * [ ] `GET /sequence-templates/:id` → detail (4 emails).
  * [ ] `POST /sequence-templates` → create from current on-screen sequence.
  * [ ] `PATCH /sequence-templates/:id` → update copy/timing.

* [ ] Editing experience:

  * [ ] `PATCH /sequence-steps/:id` → update body, subject, and `offset_days` (replacement for hard-coded `+3 days`).
  * [ ] Store `length_preset` per step (small/medium/large) for future AI use.

### 9.3 Character count and spam checks

* [ ] Character count:

  * [ ] Compute `char_count` server-side on save (subject + body).
  * [ ] Return `char_count` and target range to the UI on GET.
* [ ] Spam word detection:

  * [ ] Implement `POST /ai/spam-check` which:

    * Accepts email text.
    * Returns:

      * `spam_score` (0-1).
      * `spam_words` array (exact strings to highlight).
  * [ ] Persist a minimal snapshot in `sequence_steps` or a separate table for debugging.

### 9.4 Left-side contact/campaign selector

* [ ] Campaign/contact linking:

  * [ ] Decide on a simple model for now:

    * Option A: Sequence is attached to a `campaign` object, which references many applications/contacts.
    * Option B: Sequence attached directly to an `application + contact`.
  * [ ] API:

    * `GET /campaigns` → list of campaigns (for left side).
    * `GET /campaigns/:id/sequence` → steps for that campaign.
  * [ ] Use `contact.email` as unique identifier when mapping UI selections to `CONTACT` rows; enforce uniqueness per user.

---

## 10. Launch Campaign Screen

Purpose: Instantiate sequences for actual roles/contacts and schedule sends.

* [ ] Data model:

  * [ ] `campaigns` table:

    * `id`, `user_id`, `name`, `created_from_template_id`, `segment_description`, `created_at`.
  * [ ] `campaign_targets` table:

    * `campaign_id`, `application_id`, `contact_id`, `mailbox_id`, `status`.

* [ ] Endpoints:

  * [ ] `GET /campaigns/:id/summary` → includes:

    * `name`, `roles_applied_count` (number of applications/targets).
    * Bound sequence template.
    * Total scheduled emails.
  * [ ] `POST /campaigns/:id/launch`:

    * Materializes `SEQUENCE_INSTANCE`s for each target.
    * Creates `OUTREACH` rows with planned send times (respecting `offset_days` and contact time zones).
    * Enqueues jobs in the email queue.

* [ ] Campaign naming:

  * [ ] Implement helper to generate default campaign name from:

    * Key job preferences (growth/remote etc).
    * Offer type (e.g. “video intro”, “portfolio link”).
  * [ ] Save generated name in `campaigns.name` but allow override from UI.

* [ ] Time-window enforcement:

  * [ ] For each scheduled send, respect a send window (e.g. 8am-5pm recipient local time).
  * [ ] If calculated time falls outside window, shift to next allowed time.

---

## 11. Analytics Screen

Purpose: Give high-level results: total sent, click rate, reply rate, roles applied, plus warmup.

* [ ] Data model:

  * [ ] `campaign_metrics` table:

    * `campaign_id`, `date`, `total_sent`, `total_clicked`, `total_replied`, `roles_applied`.

* [ ] Endpoints:

  * [ ] `GET /analytics/overview` → returns:

    * Aggregated KPIs for the current user across all campaigns.
    * List of campaigns with per-campaign KPIs (for a table or chart).
  * [ ] `GET /analytics/campaigns/:id` → granular metrics for a single campaign.

* [ ] Metrics computation rules:

  * [ ] `total_sent`: count `OUTREACH` where `status = sent`.
  * [ ] `roles_applied`: count distinct `application_id` where any outbound email has been sent or application status >= `applied`.
  * [ ] `click_rate`: `clicked / delivered`.
  * [ ] `reply_rate`: `replied / delivered`.
  * [ ] Do **not** compute or surface “open rate” (to avoid pixel-based tracking that harms deliverability).

* [ ] Deliverability & warmup section:

  * [ ] `GET /analytics/deliverability` → combines mailbox `HEALTH_LOG` metrics.
  * [ ] Return simple status like `healthy`, `warming`, `at_risk` per mailbox for UI to display.

---

## 12. “Give Feedback” / Beta Survey Screen

Purpose: Capture survey responses (including updated pricing anchor).

* [ ] Data model:

  * [ ] `beta_feedback` table:

    * `id`, `user_id` (optional), `created_at`, `answers` JSON (store full response), `pricing_willingness` numeric or categorical.
* [ ] Endpoints:

  * [ ] `POST /beta-feedback` → store response payload.
  * [ ] `GET /beta-feedback/summary` (internal only) → aggregated stats for you/Dave.
* [ ] Pricing field:

  * [ ] Ensure the “Would you pay $499?” answer is captured as:

    * Boolean `would_pay_at_499`.
    * Optional `suggested_price` numeric.

---

## 13. Misc / Glue Work

* [ ] Consistent IDs & slugs:

  * [ ] Ensure entities referenced across screens all use stable IDs (campaigns, sequences, contacts, jobs).

* [ ] Audit logging:

  * [ ] Log key actions:

    * Resume parse, JD parse, pain-point generation, offer/sequence generation, campaign launches, email sends.
  * [ ] Store in `AUDIT_LOG` with `user_id`, `entity_type`, `entity_id`, `action`, `timestamp`.

* [ ] Feature flags:

  * [ ] Wrap heavy AI and warmup features in flags so you can:

    * Run the app in “local/offline” mode using mocked responses.
    * Turn on real integrations gradually.
