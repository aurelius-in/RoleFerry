# RoleFerry Wireframes — Detailed Screen Reference

This document explains every screen currently accessible from `docs/wireframes.html` (12-step path). For each screen you’ll find the purpose, UI layout, inputs and actions, variables produced for later steps, intended backend tie‑ins, and why it helps job seekers progress. Links point to the corresponding wireframe HTML so you can click-through while reading.

Quick orientation:
- Start at `docs/wireframes.html` (12-Step keypad). Each “stone” opens one of the 12 screens below.
- Progress is tracked in localStorage on the wireframes; many screens also show “Step X of Y” progress indicators.
- Variables shown in green code (for example, `{{company_summary}}`) are the data hand-offs between steps and templates; they’re also the most natural API boundary points.


## Quick reference — the 12 screens

| # | Screen | Link | Primary outcome | Key actions |
|---|---|---|---|---|
| 1 | Signals Engine | `wireframes/signals-engine.html` | Identify buying signals before jobs post | Filter, review signal cards, “Create Campaign from Signal” |
| 2 | Job Preferences | `wireframes/job-preferences.html` | Capture personal preferences for targeting | Fill multi-selects, “Save Preferences” |
| 3 | Your Resume | `wireframes/candidate-resume.html` | Upload resume and parse with AI | Upload file, “Load Resume” |
| 4 | Job Descriptions (Client Profiles) | `wireframes/job-descriptions.html` | Import/analyze job postings | Paste URL or JD text, “Analyze Client Profile” |
| 5 | Pain Point Match | `wireframes/pain-point-match.html` | Align resume to JD, compute Fit Score | Review pain points, fill solution/metric, proceed |
| 6 | Context Research | `wireframes/context-research.html` | AI-assisted company and contact research | Edit sections, “Regenerate Briefing”, “Save Briefing”, CSV export |
| 7 | Find Contact | `wireframes/find-contact.html` | Select decision-makers for outreach | Choose contacts, “Verify Selected Contacts” |
| 8 | Offer Creation | `wireframes/offer-creation.html` | Draft your personalized offer | Edit offer text/link/video, “Save Offer” |
| 9 | Compose | `wireframes/compose.html` | Generate complete personalized email | Select tone, insert variables, “Generate Email”, “Save & Proceed” |
| 10 | Campaign | `wireframes/campaign.html` | Assemble recipients and pre-flight checks | Pick recipient, tweak email, “Launch Campaign”, “Dry Run” |
| 11 | Analytics | `wireframes/analytics.html` | View outcomes and export metrics | Sort/scan table, charts, “Export to CSV” |
| 12 | Deliverability Launch | `wireframes/deliverability-launch.html` | Final checks and launch confirmation | Run pre-flight, “Launch Campaign”, view launch stats |


## 1) Signals Engine
Link: `wireframes/signals-engine.html`

- Purpose (why it matters): Surfaces “buying signals” (funding, leadership change, expansion, launches) so a job seeker can proactively engage companies before a posting goes live. This creates a timing edge and more warm entry points.

- UI and layout:
  - Filter bar across the top: search, “Signal Type”, “Location” dropdowns for narrowing results.
  - Scrollable list of signal cards. Each card shows: headline, source/date, short summary, and a pre-baked email variable.
  - Action region per card with “Create Campaign from Signal” to seed the downstream flow.

- Inputs and actions:
  - Filters: typed query, signal type, location.
  - Card actions: “Create Campaign from Signal” advances you to step 10 later with enriched context.

- Variables produced:
  - `{{signal_context}}` summarizing the newsy trigger in natural language. Useful later in Compose and Campaign:
    - Example: “Innovate Inc. just raised a $25M Series B…”

- Intended backend tie‑ins:
  - Optional: `/context-research/research` to enrich with fresh data.
  - Optional: Signal ingestion endpoints if you store curated feeds.

- Benefits for job seekers:
  - Early timing advantage, richer personalization, and a better reason to reach out beyond “I saw your job posting.”


## 2) Job Preferences
Link: `wireframes/job-preferences.html`

- Purpose: Captures personal targeting criteria that inform search, matching, and tone. Stored preferences reduce friction and help drive more relevant leads and copy later.

- UI and layout:
  - Multi-section form within a centered, rounded panel: values, role categories, locations, work type, role type, company size, industries, skills, minimum salary, job search status, optional state.
  - Clear “Save Preferences” CTA, plus “Reset”. Success and error banners provide feedback.
  - Back-to-Path, “Step 2 of 12” indicator, and a “Your Profile →” next-step link.

- Inputs and actions:
  - Multi-select controls and text inputs.
  - “Save Preferences” persists to backend (and local backup) with optimistic success path.

- Variables/data captured (examples):
  - `values[]`, `role_categories[]`, `location_preferences[]`, `work_type[]`, `role_type[]`, `company_size[]`, `industries[]`, `skills[]`, `minimum_salary`, `job_search_status`, `state`.

- Intended backend tie‑ins:
  - `POST /job-preferences/save`
  - `GET /job-preferences/options/*` to populate select fields.
  - Later steps can use saved preferences to pre-filter jobs and suggest tones.

- Benefits:
  - Precision targeting means better-fit roles, higher response rates, and stronger confidence that you’re spending effort on the right opportunities.


## 3) Candidate Profile
Link: `wireframes/candidate-resume.html`

- Purpose: Converts a resume/profile into structured data with AI. This powers matching, offer creation, and variable substitution (your name, title, and achievements) later.

- UI and layout:
  - Drag-and-drop upload area with supported file types.
  - “Parse Profile with AI” button, a loading spinner, then a results grid of extracted fields (positions, skills, accomplishments, etc.).
  - Back-to-Path and “Job Descriptions →” link; progress indicator “Step 3 of 12”.

- Inputs and actions:
  - Upload file (PDF/DOC/DOCX) then click “Parse Profile with AI”.
  - Preview and store results in localStorage; upstream saves can persist to backend.

- Variables produced (examples on the wireframe):
  - `{{my_name}}`, `{{my_title}}`, `{{my_company}}` — anchor variables for downstream emails.
  - Structured arrays for skills, roles, and metrics used by matching/analytics.

- Intended backend tie‑ins:
  - `POST /resume/upload` (multipart file upload).
  - `POST /resume/save` and `GET /resume/{user}` to persist and retrieve extracts.

- Benefits:
  - Reduces manual data entry; creates re-usable personal facts that auto-personalize future content.


## 4) Job Descriptions (Client Profiles)
Link: `wireframes/job-descriptions.html`

Note: The page heading reads “Client Profiles” in this wireframe. Functionally this is the Job Descriptions analysis step.

- Purpose: Import a job description by URL or text and generate a structured brief of what the company needs. This primes the pain-point alignment and the final email.

- UI and layout:
  - Left column: “Saved Opportunities” list (quick switching, visual memory).
  - Right column: analysis panel with JD URL input, JD text area, optional company name, then “Analyze Client Profile” CTA, loading spinner, and results cards.
  - Navigation includes Back-to-Keypad, plus “Pain Points →” forward link.

- Inputs and actions:
  - Paste job URL or JD text and click analyze.
  - Activate one of the saved opportunities on the left.

- Variables produced (examples shown in the wireframe):
  - `{{client_need_summary}}`, `{{client_company_name}}`, `{{top_3_requirements}}`

- Intended backend tie‑ins:
  - `POST /job-descriptions/import?url=...` or `POST /job-descriptions/import` with text.
  - `POST /job-descriptions/save` and `GET /job-descriptions/{user}` to store/review analyzed JDs.

- Benefits:
  - Clarifies what the employer is actually hiring for; reduces guesswork and powers targeted messaging.


## 5) Pain Point Match
Link: `wireframes/pain-point-match.html`

- Purpose: Converts an analyzed JD into specific “challenges” and lets the candidate supply matching “solutions” and “metrics,” producing a Fit Score and high-signal variables for templates.

- UI and layout:
  - Top summary showing AI-extracted pain points.
  - A prominent Fit Score card with a rationale and contributing variables.
  - Editable “match cards” where the user adds their solution and supporting metric per challenge.
  - Navigation: Back-to-Keypad, “Offer Creation →” forward link, progress indicator.

- Inputs and actions:
  - Review pain points, type in your solution and quantifiable metric for each.

- Variables produced (examples on the wireframe):
  - `{{challenge_1}}`, `{{solution_1}}`, `{{metric_1}}` (and similarly for _2, _3…)
  - `{{resume_keyword_match}}` and a Fit Score value (e.g., 88%). These are used to justify relevance in emails.

- Intended backend tie‑ins:
  - `POST /matches/score` (to compute fit), `POST /matches/save`, `GET /matches/{user}`.

- Benefits:
  - Turns your experience into company-relevant proof points with measurable outcomes — the currency of persuasive outreach.


## 6) Context Research (Client Intelligence)
Link: `wireframes/context-research.html`

- Purpose: Creates a concise client briefing with company summary, buying signals/news, decision-maker bio, culture/values, tech stack, and market position. These become plug-and-play variables for emails.

- UI and layout:
  - Multi-card editor for each research facet (Company Overview, Recent News, Decision-Maker Bio, Culture, Tech Stack, Market Position).
  - Header actions: “Export CSV”, “Regenerate Briefing”, “Save Briefing”; success banner confirms saves.
  - Back-to-Keypad, “Find Contact →” forward link, progress indicator.

- Inputs and actions:
  - Edit or replace AI text; on save, content is persisted and variables become available to templates.

- Variables produced (as shown):
  - `{{client_company_summary}}`, `{{client_recent_news}}`, `{{decision_maker_bio}}`, `{{client_company_culture}}`, `{{client_tech_stack}}`, `{{client_market_position}}`

- Intended backend tie‑ins:
  - `POST /context-research/research` to auto-generate, `GET /context-research/variables/{user}` for variable bundles, CSV export, and persistence endpoints.

- Benefits:
  - Gives you a “briefing document” you can leverage across offers and emails, ensuring depth without extra research time.


## 7) Find Contact
Link: `wireframes/find-contact.html`

- Purpose: Finds and curates decision-makers (VP, hiring manager, recruiter) for the chosen opportunity. Verification reduces bounces and protects sender reputation.

- UI and layout:
  - Left column: active opportunity context + saved contacts list.
  - Right column: pick-list of suggested contacts, each with role, optional LinkedIn link, and “Recommended” badges.
  - “Verify Selected Contacts” CTA, variable preview section, Back controls.

- Inputs and actions:
  - Check the contacts you plan to message and run verification.

- Variables produced (wireframe examples):
  - `{{decision_maker_name}}`, `{{decision_maker_title}}`, `{{decision_maker_company}}`

- Intended backend tie‑ins:
  - `POST /find-contact/search`, `POST /contacts/verify` or `/email-verification/verify`.

- Benefits:
  - Reduces guesswork on who to message and reduces bounced emails, increasing response and protecting deliverability.


## 8) Offer Creation
Link: `wireframes/offer-creation.html`

- Purpose: Assembles a simple, high-impact pitch (text, link, optional video) that directly addresses the target’s needs discovered earlier.

- UI and layout:
  - Left: Offer Library of saved offers (with tags).
  - Right: Offer editor with text area, optional link, and video upload drop area; “Save Offer” CTA.
  - Back-to-Keypad.

- Inputs and actions:
  - Write or refine your value proposition; include a portfolio URL or short intro video for trust.

- Variables produced:
  - `{{offer_text}}`, `{{offer_link}}`, `{{offer_video}}`

- Intended backend tie‑ins:
  - `POST /offer-creation/create` (AI assist), `POST /offer-creation/save`, and `GET /offer-creation/{user}` for retrieval.

- Benefits:
  - Distills your message so the later email can be assembled in seconds without losing personalization.


## 9) Compose
Link: `wireframes/compose.html`

- Purpose: Generates a complete, ready-to-send email using tone, variables, and jargon-simplification. This is where all upstream variables are stitched together.

- UI and layout:
  - Two-column compose area: large email composer on the left, “Available Variables” panel on the right.
  - Tone selector (Recruiter / Manager / Executive), “Simplify Language” toggle (with detected jargon panel), subject and body editors, live preview, and actions.
  - Back-to-Keypad, “Campaign →” forward link, progress indicator.

- Inputs and actions:
  - Choose tone, insert variables (`{{first_name}}`, `{{company_name}}`, `{{job_title}}`, `{{pain point_1}}`, `{{solution_1}}`, `{{metric_1}}`, `{{company_summary}}`, `{{recent_news}}`, `{{contact_bio}}`, etc.).
  - “Generate Email” (AI assist) and “Save & Proceed” persist the draft and push it forward.

- Variables used/produced:
  - Consumes nearly all prior variables plus tone; persists a composed subject/body for campaigns.

- Intended backend tie‑ins:
  - `POST /compose/generate` (AI), `POST /compose/detect-jargon`, `GET /compose/variables/available` for the sidebar.

- Benefits:
  - Cuts writing time dramatically while maintaining credibility and specificity. The tone switch aligns to audience expectations (recruiter vs. manager vs. exec).


## 10) Campaign
Link: `wireframes/campaign.html`

- Purpose: Final assembly of recipients + email, with a simple pre-flight panel and launch control. Keyboard shortcuts (j/k) support fast review of multiple contacts.

- UI and layout:
  - Three columns: recipient list (left), editable white email preview (center), variables and pre-flight (right).
  - Top-right offers “Launch Campaign” and a “Dry Run” link for safe tests.

- Inputs and actions:
  - Select a recipient to load their tailored email body (dataset), make edits inline, then launch.
  - Review Variables list and Pre-flight statuses (domain health, warm-up, spam words, etc.).

- Variables:
  - Shows typical campaign-time variables — contact info, JD summary, `{{challenge_1}}`, `{{solution_1}}`, `{{metric_1}}`, offer fields, company info.

- Intended backend tie‑ins:
  - `POST /campaign/push` (or Instantly/ESP integration), `GET /campaign` to check status.

- Benefits:
  - Reduces multi-tab juggling: review recipients, tailor copy, and verify deliverability in one place.


## 11) Analytics
Link: `wireframes/analytics.html`

- Purpose: Measures outcomes (reply rate, meetings, opportunities, pipeline value) and lets users export results.

- UI and layout:
  - Metric cards for high-level KPIs, a chart of campaign performance, sortable results table, and CSV export action.

- Inputs and actions:
  - Sort table columns; click “Export to CSV” to share or dig in elsewhere.

- Data shown:
  - Reply rate, meetings, opportunities, pipeline value, and per‑campaign metrics.

- Intended backend tie‑ins:
  - `GET /analytics/campaign`, `GET /analytics/timeseries`, `GET /analytics/csv`.

- Benefits:
  - Objective feedback loop to focus time on what’s working (and prune what isn’t).


## 12) Deliverability Launch
Link: `wireframes/deliverability-launch.html`

- Purpose: Runs final pre-flight checks and initiates launch. Displays immediate launch status so users know what happened.

- UI and layout:
  - Campaign summary panel, a grid of simplified checkmarks (verification, domain config, spam score, reputation, tracking, privacy), and a large “Launch Campaign” button.
  - After launch, a status panel shows emails sent/scheduled, bounces, and deliverability.

- Inputs and actions:
  - Click “Launch Campaign”; spinner and success banner confirm the process. Errors show a red banner.

- Variables:
  - Mostly downstream of Compose/Campaign; this step confirms readiness and records launch metadata.

- Intended backend tie‑ins:
  - `POST /deliverability-launch/pre-flight-checks` (optional), final push through `/campaign/push`, and webhooks to update status.

- Benefits:
  - Confidence at send-time and a clean record of what was launched and why checks passed.


## Cross-screen data flow (textual map)

1) Signals Engine → seed context for later emails  
   - Produces: `{{signal_context}}` used in Compose/Campaign to anchor relevance.

2) Job Preferences → guide search, tone, personalization  
   - Stores preference fields used to filter/score Jobs and suggest Tones.

3) Candidate Profile → structured persona variables  
   - Produces: `{{my_name}}`, `{{my_title}}`, `{{my_company}}`, skills/positions/metrics.

4) Job Descriptions → target needs  
   - Produces: `{{client_need_summary}}`, `{{client_company_name}}`, `{{top_3_requirements}}`.

5) Pain Point Match → alignment variables + fit score  
   - Produces: `{{challenge_n}}`, `{{solution_n}}`, `{{metric_n}}`, and a Fit Score.

6) Context Research → richer personalization bundle  
   - Produces: `{{client_company_summary}}`, `{{client_recent_news}}`, `{{decision_maker_bio}}`, `{{client_company_culture}}`, `{{client_tech_stack}}`, `{{client_market_position}}`.

7) Find Contact → addressing the right person  
   - Produces: `{{decision_maker_name}}`, `{{decision_maker_title}}`, `{{decision_maker_company}}`; runs verification.

8) Offer Creation → one-liner value prop assets  
   - Produces: `{{offer_text}}`, `{{offer_link}}`, `{{offer_video}}` for Compose.

9) Compose → final email (tone + variables + clarity)  
   - Consumes everything above; “Save & Proceed” hands a complete message to Campaign.

10) Campaign → recipients + QA + launch intent  
   - Consumes subject/body and variables; runs pre-flight checks before sending.

11) Analytics → outcomes inform iteration  
   - Feeds next campaign and targeting choices.

12) Deliverability Launch → operational confidence  
   - Confirms last-mile readiness and records launch details.


## Accessibility and responsiveness notes

- The wireframes include keyboard shortcuts (j/k navigation on Campaign recipients) and visible focus states in several places.
- Reflow rules make core layouts usable on small screens (cards stack into a single column, side panels move above/below primary content, CTAs remain prominent).
- Color usage keeps contrast high on dark backgrounds; critical statuses (green/yellow/red) are paired with labels, not color alone.


## Current-state deltas observed

- Job Descriptions page is labeled “Client Profiles” in the current wireframe; functionally it behaves as the JD analysis step. This may reflect a recruiting/consulting mode naming convention. The rest of the flow remains consistent.
- Some progress indicators show “Step X of 10” while the keypad flow shows 12 stones; the content still aligns in order. If needed, unify step counts for consistency.


## How this flow helps job seekers

- Structure and momentum: Each step reduces ambiguity and builds a richer dataset, which compounds personalization without extra work.
- Concrete proof: Pain Point Match forces the transformation of experience into measurable outcomes — exactly what hiring teams look for.
- Personalization at scale: Context Research and variables let the same skeleton message become highly specific per contact and company.
- Operational quality: Pre-flight checks and deliverability steps prevent common pitfalls (bounces, spam triggers) that waste momentum.
- Feedback loop: Analytics closes the loop so the next campaign starts smarter than the last.


