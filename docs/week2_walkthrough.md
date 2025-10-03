# Week 2 Walkthrough — Stakeholder Demo Script

Use this short, conversational script to demo the Lean Lead‑Qual Engine. The flow mirrors a familiar lead tool but emphasizes RoleFerry’s lower cost per lead, Sheets + webhooks friendliness, and an end‑to‑end “import → enrich → qualify → generate → export” pipeline. Total time: 6–8 minutes.

---

## 0) Framing (20–30s)
“We built a lean, B2B‑first lead pipeline that finds decision‑makers, qualifies them, and generates first‑touch copy — all at well under ten cents per lead. It connects to Google Sheets, supports n8n webhooks, and shows cost per step so you always know your economics.”

---

## 1) Leads
Purpose: Ingest raw domains and preview a normalized table we can run through the pipeline.

Say:
“We can paste a CSV or point to a Google Sheet. Let’s add a few domains, and the app will move them through search → qualify → contact → verify.”

Click path:
- Paste or import CSV (e.g., scramjet.ai, lumenlytics.io, northforge.co)
- Click Run Pipeline → rows appear with Domain, Company, Industry, Country, Employees, Status, Added
- Export → Instantly CSV (shows only sendable emails)

Note to emphasize:
- “You get a clean, ready‑to‑send list that keeps per‑lead cost below $0.10.”

---

## 2) Enrichment
Purpose: Show company facts, tech signals, and contacts — the “what we found” layer.

Say:
“For each domain we capture basics, tech stack, recent signals, and key contacts. The recipe is modular: Company Basics, Tech Stack, Hiring Signals, News, Contacts.”

Click path:
- Run Enrichment → chips appear (Tech Stack, Signals)
- Open a row → side drawer shows company profile (HQ, size est., tech, recent news) and contacts with verification badges

Note to emphasize:
- “We keep a small cost footprint per lead and show it explicitly per step.”

---

## 3) Qualification
Purpose: Share ICP definition and transparent reasons behind a Fit Score.

Say:
“You can tune the ICP — industry, size, signals, tech — and see the Fit Score update. Reasons are clear so you can trust the decision.”

Click path:
- Adjust ICP weights (industry / size / signals / tech)
- Watch Fit Scores update; open ‘Why it fits’ rationale
- Set Priority and proceed to copy generation

Note to emphasize:
- “Scores are explainable; the slider weights are there to reflect your go‑to‑market.”

---

## 4) Sequences
Purpose: Generate first‑touch outreach grounded in enrichment and fit.

Say:
“Once we like the fit, we draft short, signal‑aware outreach — persona and tone aware — with quick edits.”

Click path:
- Persona: Founder‑led / AE / RevOps; Tone: Plain‑spoken / Direct / Consultative
- Generate for selected companies
- Show Regenerate / Shorten / Copy / Add to Sequence actions

Note to emphasize:
- “Emails reference real signals (stack, hiring, launches) and keep to 90–120 words for higher replies.”

---

## 5) Runs
Purpose: A simple history of end‑to‑end pipeline runs.

Say:
“Every run logs the steps, counts, durations, and estimated cost. You can filter by status, view the timeline, and download the CSV.”

Click path:
- New Run → open the most recent run
- Show Steps, Leads processed, Duration, Est. Cost, and Status
- View Log → synthetic lines like ‘Serper: 18 queries’ and ‘Contacts verified: 7/10’

Note to emphasize:
- “Repeatable, transparent pipeline runs make it easy to codify your process.”

---

## 6) Pricing
Purpose: Make the “new economic model” obvious.

Say:
“Here’s the calculator. Set your lead volume and recipe toggles, and you can see the costs we’d expect and your projected savings versus a typical benchmark.”

Click path:
- Leads = 10,000; Verify Emails = on
- Show Est. Cost / Lead (e.g., $0.08) and a small sparkline
- Comparison table: RoleFerry vs benchmark (per‑lead cost, Sheets workflow, fine‑grained recipes)

Note to emphasize:
- “We’re keeping economics in view — the goal is below ten cents per qualified lead.”

---

## 7) Integrations
Purpose: Show the ecosystem alignment without requiring live keys in a demo.

Say:
“We integrate with Google Sheets and n8n for workflows, and we can connect Serper/OpenAI/verification services. The tiles show what’s connected and what’s next.”

Click path:
- Tiles: Google Sheets (Connected) • n8n (Configured) • Serper (API key set) • HubSpot / Close (Coming soon) • CSV Export (Available)

Note to emphasize:
- “Teams already in Sheets or n8n can hook into this immediately.”

---

## 8) Settings
Purpose: Keep knobs in one place, even if mocked for demo.

Say:
“Settings centralize API keys, default persona and tone, ICP presets, and simple compliance rules like ‘never send to catch‑all by default.’”

Click path (brief):
- Show API key inputs (masked), default persona/tone, ICP preset save
- Compliance toggle example

---

## Close (10–20s)
“In short: we import domains, auto‑enrich, score ICP fit, and generate targeted first‑touch — at under ten cents per lead — then export to your sender or CRM. It’s the same outcomes as heavy tools, but simpler and far cheaper.”


