### Backend GPT Seams – Week 10 Design (Code-Level, Not Yet Fully Implemented)

This document enumerates the key "AI seams" in the backend and sketches how each can be backed either by deterministic logic (existing today) or by the new unified GPT layer (`OpenAIClient`). The goal is *design completeness*, not full implementation in Week 10.

---

### 1. Resume Parsing

- **Existing implementation**
  - `backend/app/services_resume.py::parse_resume(text: str) -> dict`
    - Heuristic extraction of `KeyMetrics`, `ProblemsSolved`, `NotableAccomplishments`, `Positions`, `Domains`, `Seniority`.
  - Used by `backend/app/routers/resume.py::upload_resume` to populate `parsed_json` in the `resume` table and to feed mock UI extract.

- **Planned seam function**
  - `def parse_resume(text: str) -> ResumeParsed` (typed wrapper on top of `services_resume.parse_resume`).

- **GPT-backed path (design)**
  - When `settings.openai_api_key` is set, `settings.mock_mode` is `False`, and `settings.llm_mode == 'openai'`:
    - Call `OpenAIClient.summarize_resume(text)` to obtain a JSON‑style response.
    - Validate against a Pydantic model `ResumeParsed` (e.g., positions[], key_metrics[], skills[], accomplishments[], tenure[]).
    - On validation failure or exception, fall back to the existing heuristic `parse_resume` result.

- **Feature flag pattern**
  - `use_gpt = client.should_use_real_llm and settings.llm_mode == "openai"`.
  - `if use_gpt: try GPT -> validate -> return; else: return rule_based`.

---

### 2. Job Description Parsing

- **Existing implementation**
  - `backend/app/routers/job_descriptions.py::import_job_description`
    - Uses deterministic defaults to create `pain_points`, `required_skills`, `success_metrics` and persists them in `job.parsed_json`.

- **Planned seam function**
  - `def parse_job_description(text: str) -> JobParsed`.

- **GPT-backed path (design)**
  - Use `OpenAIClient.extract_job_structure(text)`.
  - Expected JSON schema (Pydantic `JobParsed`):
    - `pain_points: list[str]`
    - `required_skills: list[str]`
    - `success_metrics: list[str]`.
  - Persist the normalized JSON into `job.parsed_json` so downstream consumers (Pinpoint Match, analytics) do not need to care whether GPT or rules produced it.

- **Feature flag pattern**
  - Same as resume: `use_gpt` boolean gating a `try GPT -> fallback` flow.

---

### 3. Pain Point Matching

- **Existing implementation**
  - `backend/app/routers/pain_point_match.py::generate_pinpoint_matches`
    - Reads `job.parsed_json` and `resume.parsed_json` from the DB.
    - Pairs up to 3 JD pain points with up to 3 resume statements using simple list slicing.
    - Persists challenge/solution pairs into `pain_point_match` table.

- **Planned seam function**
  - `def generate_pain_point_matches(jd: JobParsed, resume: ResumeParsed) -> list[Match]`.

- **GPT-backed path (design)**
  - Build a compact context JSON (pain_points, success_metrics, notable_accomplishments, key_metrics).
  - Call `OpenAIClient.generate_pain_point_map(jd_blob, resume_blob)`.
  - Expected JSON schema (Pydantic `Match`):
    - `pairs: list[{ jd_snippet: str, resume_snippet: str, metric: str }]`
    - `alignment_score: float`.
  - Map `pairs` into the existing `PinpointMatch` model and persist each challenge/solution pair as done today.

- **Feature flag pattern**
  - When GPT is off, re‑use the current `PinpointMatch` construction logic untouched.

---

### 4. Offer Creation

- **Existing implementation**
  - `backend/app/routers/offer_creation.py::create_offer`
    - Generates an `Offer` by interpolating `pinpoint_matches`, tone, and mode into a deterministic template.
  - `save_offer` persists the text body into the `offer` table.

- **Planned seam function**
  - `def generate_offer_email(context: OfferContext) -> EmailDraft`.
    - `OfferContext` includes: user_mode, tone, format, first match triplet, company summary, contact facts.

- **GPT-backed path (design)**
  - Call `OpenAIClient.draft_offer_email(context_dict)`.
  - Ask for a concise email body + title (subject‑like line) with explicit length constraints.
  - Validate length and strip any hallucinated variables that do not exist in the context.

- **Feature flag pattern**
  - When GPT is disabled, call the existing `create_offer` logic to produce the same `Offer` shape.

---

### 5. Compose (Email Templates)

- **Existing implementation**
  - `backend/app/routers/compose.py::generate_email`
    - Builds an `EmailTemplate` using deterministic text templates and the Jinja‑style variables.
    - Runs `jargon_detector` to find jargon and produce a simplified variant.

- **Planned seam function**
  - `def rewrite_for_tone(email: EmailDraft, tone: str, max_words: int) -> EmailDraft`.

- **GPT-backed path (design)**
  - Freeze the variable placeholders ({{...}}) and ask GPT to rewrite the body while preserving those tokens and core facts.
  - Use `OpenAIClient.run_chat_completion` with a strict system prompt: "Do not invent new variables or change existing placeholders."
  - Re‑run `jargon_detector` on the GPT output and keep both original and rewritten text.

- **Feature flag pattern**
  - The base template generation remains deterministic; GPT is used as a second pass when invoked.

---

### 6. Company & Contact Research

- **Existing implementation**
  - `backend/app/services/serper_client.py` + `context_research` router (front‑end) currently rely on mocked research summaries.

- **Planned seam function**
  - `def summarize_company_and_contact(context: ResearchContext) -> ResearchSummary`.
    - `ResearchContext` includes:
      - Company name, domain, industry.
      - A small set of curated SERP/snippet texts.
      - One or more contact bios.

- **GPT-backed path (design)**
  - Call `OpenAIClient.run_chat_completion` with a system prompt that asks for JSON fields:
    - `company_summary`, `recent_news[]`, `company_culture`, `market_position`, `contact_bios[]`.
  - Validate via a Pydantic `ResearchSummary` model before storing in the `research` table or local storage.

- **Feature flag pattern**
  - When GPT is off, keep the current hard‑coded/example summaries.

---

### 7. Lead Qualification (Already Partially Wired)

- **Existing implementation**
  - `backend/app/services/ai_qualifier.py::qualify_prospect`
    - Previously: purely rule‑based (title heuristics) with a TODO for OpenAI.
    - Now (Week 10): uses `OpenAIClient.run_chat_completion` when enabled, with a JSON decision schema and a rule‑based fallback.
  - Used by `lead_qual` and `n8n_hooks` routers.

- **Seam behavior**
  - GPT path returns a small JSON object: `decision` (`yes`/`no`/`maybe`) and `reason`.
  - On any exception or schema mismatch, the function falls back to deterministic title‑based logic.

- **Feature flag pattern**
  - Fully controlled by `OpenAIClient.should_use_real_llm` (API key + `mock_mode` + `llm_mode`).

---

### 8. Sequence Suggestions (Campaign)

- **Existing implementation**
  - Campaign router primarily uses static sequences and rule‑based spam checks.

- **Planned seam function**
  - `def suggest_sequence_steps(context: CampaignContext) -> list[EmailStep]`.
    - `CampaignContext` includes target persona, initial email text, and current steps.

- **GPT-backed path (design)**
  - Ask GPT to propose updated subjects/bodies and/or timing suggestions for each step, with explicit constraints (no sending, no deliverability promises).
  - Represent suggestions as `EmailStep` objects that the UI can diff against existing steps.

- **Feature flag pattern**
  - Suggestions are only generated on explicit user action (e.g., "Ask AI to improve sequence").

---

### 9. Deliverability Explanation

- **Existing implementation**
  - `backend/app/routers/deliverability_launch.py`
    - Deterministic pre‑flight checks: verification, spam score, DNS, bounce history, warmup.
    - `validate_content` uses `jargon_detector` and simple spam heuristics.

- **Planned seam function**
  - `def explain_deliverability(findings: PreFlightSummary, email_body: str) -> DeliverabilityAdvice`.

- **GPT-backed path (design)**
  - GPT reads the structured findings plus body text and outputs:
    - `summary`: 2–4 bullet points explaining issues.
    - `suggested_edits[]`: localized wording suggestions.
  - This is strictly advisory; the actual pass/fail logic stays in code.

- **Feature flag pattern**
  - Exposed behind an "Explain issues" button; the deliverability pipeline never depends on GPT.

---

### 10. Analytics Narratives

- **Existing implementation**
  - `backend/app/routers/analytics.py` aggregates metrics from `application` and `outreach` tables + in‑memory mocks.

- **Planned seam function**
  - `def explain_analytics(snapshot: AnalyticsSnapshot) -> AnalyticsNarrative`.

- **GPT-backed path (design)**
  - Snapshot from `/analytics/overview` or `/analytics/campaign` is passed as JSON.
  - GPT outputs a short narrative and `suggested_actions[]`.

- **Feature flag pattern**
  - Purely optional; analytics endpoints remain fully functional without GPT.

---

### Shared Feature Flag & Error-Handling Pattern

Across all seams, the pattern is:

```python
client = get_openai_client()
use_gpt = client.should_use_real_llm  # API key + !mock_mode + llm_mode == 'openai'

if use_gpt:
    try:
        raw = client.run_chat_completion(...)
        parsed = SchemaModel.model_validate(extract_json(raw))
        return parsed
    except Exception:
        # Log and fall back to deterministic behavior
        return rule_based_fallback(...)
else:
    return rule_based_fallback(...)
```

This ensures:

- No caller needs to handle provider‑specific errors.
- In `mock_mode` or when no key is present, all seams behave deterministically.
- Switching to future providers is centralized in `OpenAIClient` and `settings.llm_mode`.
