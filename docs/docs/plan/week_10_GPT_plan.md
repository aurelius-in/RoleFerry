### Week 10 – GPT Integration Plan by Screen

For each of the 12 workflow screens, this document captures:

1. **Intended AI behavior** (now or by Week 12)
2. **Can GPT reasonably power this?** (yes/no + rationale)
3. **How GPT would be used** (example prompts, inputs, outputs)

---

### 1. Job Preferences

1. **Intended AI behavior**
   - Normalize free‑text preferences into structured tags (values, industries, locations).
   - Sanity‑check user selections (e.g., obvious contradictions, missing salary, inconsistent mode vs. role type).
   - Suggest additional filters based on resume and tracked jobs later.

2. **Can GPT reasonably power this?**
   - **Yes, as an optional helper**, not the primary engine.
   - Token sizes are small (short form plus optional free‑text notes), and GPT is well‑suited to text normalization.
   - However, preferences drive low‑latency UX and must remain deterministic, so the current rule‑based select lists and validation should stay the default.

3. **How GPT would be used**
   - **Inputs**: current `JobPreferences` object + any free‑text notes (e.g., "what I want next" textarea), plus recent resume tags.
   - **Prompt (sketch)**:
     - System: "You normalize job search preferences into a small, consistent schema (values, role categories, locations, work type, seniority, industries, salary range). You must respect explicit user choices and only *suggest* additions."
     - User: JSON blob of current preferences, plus a short paragraph of preferences in free text.
   - **Outputs** (JSON):
     - `normalized_values[]`, `normalized_role_categories[]`, `normalized_industries[]`, `location_suggestions[]`, `warnings[]` (e.g., "salary appears inconsistent with role and location").
   - **Placement**:
     - Backend helper seam (planned): `suggest_job_preferences_adjustments(preferences: JobPreferences, notes: str | None) -> JobPreferencesSuggestion`.
     - Exposed in UI as an "Ask AI to review" button, not auto‑applied.

---

### 2. Resume

1. **Intended AI behavior**
   - Parse arbitrary resumes into a structured extract used throughout the flow (positions, tenure, skills, accomplishments, metrics).
   - Highlight quantified impact and business challenges solved.
   - Optionally, rewrite / tighten bullet points for a given role.

2. **Can GPT reasonably power this?**
   - **Yes, as a primary engine for parsing + optional rewriting**, with guardrails.
   - Resumes are comfortably within GPT token limits in most cases; structured JSON extraction is a strong fit.
   - Deterministic rule‑based `parse_resume` (today) should remain as a fallback when GPT is unavailable or for power users who want predictable behavior.

3. **How GPT would be used**
   - **Inputs**: raw resume text (from upload) and optional target role metadata.
   - **Prompt (sketch)**:
     - System: "You are a resume parsing assistant. Extract structured information with clear JSON keys: positions[], key_metrics[], business_challenges[], accomplishments[], skills[], tenure[]. Do not invent facts." 
     - User: raw resume text.
   - **Outputs** (JSON):
     - `positions[]` (company, title, start_date, end_date, current, description).
     - `key_metrics[]` (metric, value, context).
     - `business_challenges[]`, `accomplishments[]`, `skills[]`, `tenure[]` summary.
   - **Backend seam function (design)**:
     - `parse_resume(text: str) -> ResumeParsed` that internally chooses between:
       - GPT path via `OpenAIClient.summarize_resume(text)` and parses JSON.
       - Existing heuristic path in `services_resume.parse_resume` when `mock_mode` is on or GPT fails schema validation.
   - **Rewrite helper (later)**:
     - `rewrite_resume_bullets(context: ResumeRewriteContext) -> list[str]` where GPT rewrites bullets for clarity/impact.

---

### 3. Job Descriptions

1. **Intended AI behavior**
   - Parse job descriptions (from URL or pasted text) into pain points, required skills, and success metrics.
   - Normalize noisy, buzzword‑heavy language into clean, comparable tags.

2. **Can GPT reasonably power this?**
   - **Yes, as a primary or co‑primary engine**, with rule‑based fallback.
   - JDs are mostly within token limits; GPT excels at extracting business problems and outcomes.
   - We still want deterministic defaults (e.g., keyword extraction) when GPT is unavailable.

3. **How GPT would be used**
   - **Inputs**: cleaned JD text (after scraping) from `/job-descriptions/import`.
   - **Prompt (sketch)**:
     - System: "You are a job description parser. Identify 3–10 business challenges, a deduplicated list of required skills, and 3–8 success metrics the hire will be judged on. Reply with JSON only."
     - User: JD text.
   - **Outputs** (JSON): `pain_points[]`, `required_skills[]`, `success_metrics[]`.
   - **Backend seam function (design)**:
     - `parse_job_description(text: str) -> JobParsed` that can:
       - Call `OpenAIClient.extract_job_structure(text)` when allowed.
       - Fall back to the current deterministic parser in `job_descriptions.import_job_description` when GPT is off.

---

### 4. Job Tracker

1. **Intended AI behavior**
   - Optional clustering/labeling of jobs (e.g., by seniority, domain, risk level) to help prioritization.
   - Natural‑language summaries of a pipeline ("You have 3 strong fits and 2 stretch roles this week...").

2. **Can GPT reasonably power this?**
   - **Yes, as an optional helper**, not on the critical path.
   - The tracker itself is largely non‑AI (CRUD + visualizations).
   - Latency for summaries is not strict; calls can be made lazily or cached.

3. **How GPT would be used**
   - **Inputs**: list of tracked jobs (title, company, JD tags, status) and recent outreach stats.
   - **Prompt (sketch)**:
     - System: "You summarize a job search pipeline and highlight priorities in 3–5 bullets."
     - User: JSON payload of the applications list.
   - **Outputs**: short markdown/HTML summary + optional labels per job (`priority_label`, `risk_label`).
   - **Backend seam function (design)**:
     - `summarize_tracker(applications: list[ApplicationSummary]) -> TrackerSummary` used to drive an "Explain my pipeline" card.

---

### 5. Pain Point Match (Pinpoint Match)

1. **Intended AI behavior**
   - Perform deeper semantic matching between JD pain points and resume experience.
   - Generate up to three (challenge, solution, metric) triplets plus an overall alignment score.

2. **Can GPT reasonably power this?**
   - **Yes, as a primary engine**, with the existing lexical pairing as a safety net.
   - The current router (`pain_point_match.generate_pinpoint_matches`) already builds structured matches from stored JD & resume JSON; GPT can replace the heuristic pairing logic while leaving persistence unchanged.

3. **How GPT would be used**
   - **Inputs**: parsed JD (`pain_points`, `success_metrics`) and parsed resume (`NotableAccomplishments`, `KeyMetrics`).
   - **Prompt (sketch)**:
     - System: "Match each job business challenge to a concrete experience and metric from the resume. Produce JSON: pairs[{jd_snippet, resume_snippet, metric}], alignment_score (0–1)."
     - User: JSON with JD and resume fields.
   - **Outputs**: structured `pairs[]` and `alignment_score` JSON used by frontend.
   - **Backend seam function (design)**:
     - `generate_pain_point_matches(jd: JobParsed, resume: ResumeParsed) -> list[Match]` implemented via `OpenAIClient.generate_pain_point_map(...)` with a fallback to the current rule‑based logic in `pain_point_match.py`.

---

### 6. Company Research (Context Research)

1. **Intended AI behavior**
   - Summarize external signals (search results, funding, product pages) into a concise briefing.
   - Generate company overview, recent news, culture, and market position fields used downstream in Offer/Compose.

2. **Can GPT reasonably power this?**
   - **Yes, as a primary summarization engine**, with strict input curation.
   - Token limits are a concern if we naively paste many pages; we should pre‑filter and truncate textual inputs.

3. **How GPT would be used**
   - **Inputs**: selected SERP/snippet data and scraped text (already fetched through `serper_client` and related services), plus selected contacts.
   - **Prompt (sketch)**:
     - System: "You are a sales research assistant. From the following snippets about a company, extract: company overview, 3–5 bullets of recent news, culture/values summary, and 3–5 bullets about their market position. Respond in JSON only."
     - User: JSON array of snippets.
   - **Outputs** (JSON): `company_summary`, `recent_news[]`, `company_culture`, `market_position` aligned with the fields in `ContextResearchPage`.
   - **Backend seam function (design)**:
     - `summarize_company_and_contact(context: ResearchContext) -> ResearchSummary` using `OpenAIClient.run_chat_completion` with a strict JSON schema.

---

### 7. Decision Makers (Find Contact)

1. **Intended AI behavior**
   - Interpret titles and departments to infer seniority, function, and likely decision‑maker status.
   - Generate short "interesting facts" summaries from LinkedIn bios/posts when available.

2. **Can GPT reasonably power this?**
   - **Yes, as a helper**, but not for discovery or email finding.
   - Email discovery and verification must remain with deterministic services (Findymail, NeverBounce/MillionVerifier) for compliance and reliability.

3. **How GPT would be used**
   - **Inputs**: structured contact profile (name, title, department, level, LinkedIn bio snippet), plus optional scraped posts.
   - **Prompt (sketch)**:
     - System: "You categorize B2B contacts and generate 2–3 talking points for outreach."
     - User: JSON with contact/bio plus candidate context.
   - **Outputs**: `seniority_label`, `function_label`, `talking_points[]` used to annotate cards.
   - **Backend seam function (design)**:
     - `classify_contact_and_summarize(contact: ContactProfile) -> ContactInsights`.
     - Remains optional; the decision‑maker search UX should work fully without GPT.

---

### 8. Offer Creation

1. **Intended AI behavior**
   - Draft personalized value propositions ("offers") that tie pain‑point matches + research into a short pitch.
   - Support tone presets (manager, exec, recruiter, startup, enterprise, etc.) and formats (text, link, video script).

2. **Can GPT reasonably power this?**
   - **Yes, as a primary drafting engine.**
   - We already have a stub `offer_creation.create_offer` that builds content deterministically; GPT can replace that logic while preserving the same `Offer` schema.

3. **How GPT would be used**
   - **Inputs**: selected pain‑point match, research summary, and user mode/tone/format.
   - **Prompt (sketch)**:
     - System: "You are writing a short outbound pitch for a candidate or a role. Use the structured context JSON and stay under 200 words. Do not change the underlying facts." 
     - User: context JSON (pain points, solutions, metrics, company summary, tone, format).
   - **Outputs**: `title`, `content`, plus optional subject line variants; returned in the existing `Offer` model.
   - **Backend seam function (design)**:
     - `generate_offer_email(context: OfferContext) -> EmailDraft` backed by `OpenAIClient.draft_offer_email(context)` and falling back to `offer_creation.create_offer` when GPT is not available.

---

### 9. Compose (Email Composer)

1. **Intended AI behavior**
   - Turn structured variables ({{job_title}}, {{company_name}}, {{pinpoint_1}}, {{solution_1}}, {{metric_1}}, {{company_summary}}, {{recent_news}}, {{contact_bio}}) into a full email template.
   - Detect and explain jargon, and optionally simplify language.

2. **Can GPT reasonably power this?**
   - **Yes, but alongside the existing deterministic template/jargon engine.**
   - GPT is ideal for stylistic rewrites and tone control; the current `compose.generate_email` logic already produces a solid base template and runs `jargon_detector` for clarity.

3. **How GPT would be used**
   - **Inputs**: current template subject/body + variable values + tone + mode.
   - **Prompt (sketch)**:
     - System: "Rewrite this email to be concise, clear, and relationship‑first. Preserve all variable placeholders and factual content."
     - User: email body with variables in‑place, plus constraints (tone, max length).
   - **Outputs**: rewritten `body`, possibly multiple variants, which are still run through `jargon_detector` as a post‑processing step.
   - **Backend seam function (design)**:
     - `rewrite_for_tone(email: EmailDraft, tone: str, max_words: int) -> EmailDraft` using `OpenAIClient.run_chat_completion` with guardrails on variables.

---

### 10. Campaign (Sequence Builder)

1. **Intended AI behavior**
   - Suggest step timing, subject lines, and text variants across a multi‑step sequence.
   - Highlight risky language (spammy phrases) and overly long emails.

2. **Can GPT reasonably power this?**
   - **Yes, as an assistant for content & timing suggestions**, but not as the sending engine.
   - The current campaign wireframe already includes heuristic spam checks; GPT can complement that by proposing alternative phrasing.

3. **How GPT would be used**
   - **Inputs**: existing sequence steps (subject/body), campaign metadata (audience, volume), and deliverability constraints.
   - **Prompt (sketch)**:
     - System: "Given this campaign, propose clearer subject lines and shorter bodies while preserving the core message. Call out any spam‑like patterns."
     - User: JSON of steps.
   - **Outputs**: list of suggested edits per step (`suggested_subject`, `suggested_body`, `notes[]`).
   - **Backend seam function (design)**:
     - `suggest_sequence_steps(context: CampaignContext) -> list[EmailStep]` where GPT outputs revised sequences that the user can accept per‑step.

---

### 11. Deliverability / Launch

1. **Intended AI behavior**
   - (Primary) Deterministic checks: verification, DNS, bounce history, warmup status.
   - (Optional) Explain pre‑flight results in plain English and propose simple edits to reduce spam risk.

2. **Can GPT reasonably power this?**
   - **No, not as the primary engine.**
   - Deliverability must remain deterministic and compliant, as implemented in `deliverability_launch.run_pre_flight_checks` and `validate_content` (which already uses a rule‑based `jargon_detector`).
   - GPT is appropriate only as an "Ask AI to explain/fix" sidekick.

3. **How GPT would be used**
   - **Inputs**: pre‑flight check results + candidate email body.
   - **Prompt (sketch)**:
     - System: "You explain deliverability risks and suggest small wording tweaks. Do *not* claim to send or guarantee inbox placement."
     - User: JSON of pre‑flight checks plus the email.
   - **Outputs**: bullet list of explanations + suggested alternative lines.
   - **Backend seam function (design)**:
     - `explain_deliverability(findings: PreFlightSummary, email_body: str) -> DeliverabilityAdvice`.

---

### 12. Analytics

1. **Intended AI behavior**
   - Explain numeric metrics (opens, replies, meetings, cost per qualified lead) and suggest next actions.
   - Optionally, cluster variants by performance and recommend which ones to keep/kill.

2. **Can GPT reasonably power this?**
   - **Yes, as an explanatory layer only.**
   - Core aggregation, counting, and CSV export must remain SQL‑based and deterministic (as in `analytics_overview`, `analytics_campaign`).

3. **How GPT would be used**
   - **Inputs**: analytics payload from `/analytics/overview` and `/analytics/campaign` endpoints.
   - **Prompt (sketch)**:
     - System: "You are an email campaign analyst. Explain the current results in 3–6 bullets and suggest 3 concrete next experiments. Be precise with numbers and avoid hallucinating events that are not present."
     - User: JSON stats object.
   - **Outputs**: short markdown summary + `suggested_actions[]`.
   - **Backend seam function (design)**:
     - `explain_analytics(snapshot: AnalyticsSnapshot) -> AnalyticsNarrative` exposed behind a "Ask AI to interpret results" control.

---

### GPT‑Appropriate vs. Non‑Appropriate Areas

- **Appropriate as default or co‑default**:
  - Resume parsing and summarization.
  - JD parsing into pain points/skills/metrics.
  - Pain point matching and alignment scoring.
  - Offer/Compose drafting and rewriting.
  - Research summarization and explanatory analytics.

- **Appropriate only as optional helper**:
  - Job Preferences normalization and suggestion.
  - Decision‑maker insights and talking points.
  - Campaign timing/variant suggestions.
  - Deliverability explanations and copy tweaks (never the sending logic or verification itself).

- **Not appropriate as a primary engine**:
  - Email verification, DNS/warmup checks, and bounce history (must use deterministic providers).
  - Core analytics aggregation and counting.
  - Security/compliance checks where deterministic policies are required.
