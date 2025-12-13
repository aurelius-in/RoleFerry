### Backend GPT Seams – Week 10 (As Implemented)

This document enumerates the key “AI seams” in the backend and documents the **actual Week 10 implementation**.

Principles:
- **GPT-default** when `OPENAI_API_KEY` is set and `LLM_MODE=openai`.
- **Deterministic stubs** (schema-correct JSON) when GPT is unavailable or disabled, so the demo never breaks.
- **Deterministic-only** for compliance-critical areas (verification, DNS/warmup, counting/aggregation).

---

## Shared foundation (the unified GPT layer)

- **Client**: `backend/app/clients/openai_client.py`
  - `OpenAIClient.should_use_real_llm`:
    - Uses GPT when `OPENAI_API_KEY` is present, even if `ROLEFERRY_MOCK_MODE=true`.
    - `LLM_MODE=stub` is the explicit “kill switch”.
  - `extract_json_from_text(...)`: best-effort JSON extraction from model output.
  - All GPT calls are made through:
    - `run_chat_completion(messages, ..., stub_json=...)`
    - focused helpers (`summarize_resume`, `extract_job_structure`, `generate_pain_point_map`, `draft_offer_email`, `draft_compose_email`).

---

## Seam 1 — Resume parsing & summarization (Primary GPT)

- **Endpoint**: `POST /resume/upload`
- **File**: `backend/app/routers/resume.py`
- **Inputs**: resume file upload (`.pdf`, `.docx`, `.txt`)
- **Deterministic behavior**:
  - Always runs `services_resume.parse_resume(raw_text)` for stable storage.
  - If DB is unavailable, caches to in-memory demo store.
- **GPT behavior (when enabled)**:
  - Calls `OpenAIClient.summarize_resume(raw_text)`.
  - Expected JSON output:
    - `positions[]`, `key_metrics[]`, `skills[]`, `accomplishments[]`, `tenure[]`
- **Fallback**:
  - If GPT output is missing/invalid, returns a deterministic sample `ResumeExtract`.

---

## Seam 2 — Job description parsing into pain points/skills/metrics (Primary GPT)

- **Endpoint**: `POST /job-descriptions/import`
- **File**: `backend/app/routers/job_descriptions.py`
- **Inputs**: `{ url?: string | null, text?: string | null }`
- **GPT behavior (when enabled)**:
  - Calls `OpenAIClient.extract_job_structure(content)`.
  - Expected JSON output:
    - `title`, `company`, `pain_points[]`, `required_skills[]`, `success_metrics[]`
- **Fallback**:
  - Deterministic defaults for lists + heuristics for `title/company` from the first lines.
- **Persistence / continuity**:
  - Best-effort DB insert.
  - Always caches to `store.demo_job_descriptions[job_id]` so downstream steps work without Postgres.

---

## Seam 3 — Pain point match & alignment scoring (Primary GPT)

- **Endpoint**: `POST /painpoint-match/generate`
- **File**: `backend/app/routers/pain_point_match.py`
- **Inputs**: `{ job_description_id: string, resume_extract_id: string }`
- **GPT behavior (when enabled)**:
  - Builds compact JSON blobs from stored JD + resume.
  - Calls `OpenAIClient.generate_pain_point_map(jd_blob, resume_blob)`.
  - Expected JSON output:
    - `pairs[]: { jd_snippet, resume_snippet, metric }`
    - `alignment_score: number (0-1)`
  - Maps pairs into the existing response schema:
    - `painpoint_1/2/3`, `solution_1/2/3`, `metric_1/2/3`, `alignment_score`.
- **Fallback**:
  - Deterministic pairing based on list slicing.
- **Persistence**:
  - Best-effort DB insert into `pain_point_match` table.

---

## Seam 4 — Offer drafting (Primary GPT)

- **Endpoint**: `POST /offer-creation/create`
- **File**: `backend/app/routers/offer_creation.py`
- **Inputs**:
  - `painpoint_matches[]`, `tone`, `format`, `user_mode`
  - Optional `context_research` (Week 10 enhancement) so the draft can reference company context.
- **GPT behavior (when enabled)**:
  - Calls `OpenAIClient.draft_offer_email(context)`.
  - Expected JSON output: `{ title: string, content: string }`
- **Fallback**:
  - Deterministic template offer.

---

## Seam 5 — Compose drafting + variants + rationale (Primary GPT)

- **Endpoint**: `POST /compose/generate`
- **File**: `backend/app/routers/compose.py`
- **Inputs**:
  - `tone`, `user_mode`, `variables[]`, `painpoint_matches[]`, `context_data`.
  - Note: `context_data` is `Dict[str, Any]` so the UI can pass nested objects (research, contacts, offers, selected JD).
- **GPT behavior (when enabled)**:
  - Calls `OpenAIClient.draft_compose_email(context)`.
  - Expected JSON output:
    - `subject`, `body`, `variants[]`, `rationale`
- **Post-processing**:
  - Runs jargon detection and generates `simplified_body`.
- **Fallback**:
  - Deterministic email template if GPT output is missing/invalid.

---

## Frontend continuity note (not a backend seam)

The Campaign step is intentionally simulated client-side in Week 10, but for demo realism it:
- Substitutes the composed variable values into follow-up steps (so users see real names/company/role instead of raw `{{placeholders}}`).

## Seam 6 — Company + contact research summarization (Primary GPT)

- **Endpoint**: `POST /context-research/research`
- **File**: `backend/app/routers/context_research.py`
- **Inputs**: `{ contact_ids: string[], company_name: string }`
- **Behavior**:
  - Builds a realistic mocked “research corpus” (what provider pipelines would return).
  - Calls `run_chat_completion(..., stub_json=...)` and expects structured JSON:
    - `company_summary`, `contact_bios[]`, `recent_news[]`, `shared_connections[]`, `hooks[]`
- **Helper surface**:
  - Returns `helper.hooks` for outreach talking points.

---

## Seam 7 — Decision makers talking points (Helper GPT)

- **Endpoint**: `POST /find-contact/search`
- **File**: `backend/app/routers/find_contact.py`
- **Behavior**:
  - Contact discovery is mocked for Week 10.
  - GPT helper generates:
    - `opener_suggestions[]`, `questions_to_ask[]`, `talking_points_by_contact`.

Verification:
- **Endpoint**: `POST /find-contact/verify`
- Uses deterministic email verification logic (Week 10 demo-safe), and verifies the real selected emails.

---

## Seam 8 — Deliverability explanations & copy tweaks (Helper GPT)

- **Endpoint**: `POST /deliverability-launch/pre-flight-checks`
- **File**: `backend/app/routers/deliverability_launch.py`
- **Deterministic checks**: verification, spam score, DNS, bounce, warmup.
- **GPT helper**:
  - Adds a “GPT Deliverability Helper” check with:
    - summary, copy_tweaks[], subject_variants[]
  - Never blocks launch.

---

## Seam 9 — Explanatory analytics (Helper GPT)

- **Endpoint**: `GET /analytics/explain`
- **File**: `backend/app/routers/analytics.py`
- **Inputs**: internally composes deterministic `metrics` + `campaign` snapshot.
- **GPT output**:
  - `insights[]`, `risks[]`, `next_actions[]`, `confidence (0-1)`
- **Fallback**:
  - Deterministic `stub_json` output.

---

## Diagnostic seam

- **Endpoint**: `GET /health/llm`
- **Purpose**: confirm whether GPT is enabled and responding; returns a probe preview.
