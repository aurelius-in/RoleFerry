---
layout: default
title: AI Backend Price Estimate
---

## AI Backend Price Estimates – RoleFerry (Week 9 Draft)

### Scope & Assumptions

- **Goal**: Estimate monthly costs for 3rd‑party AI or AI‑adjacent services that the RoleFerry backend would call at runtime (not generic “development costs”).  
- **Cohort assumption**: ~**20 beta users**, sending **10–30 emails/day each** and experimenting with a few jobs/contacts per week.  
- **Usage style**: Heavy use of **mock mode** for demos, with real API calls used selectively (smoke tests + a few “real runs” per user).  
- **Prices are approximate** and change frequently; bucketed into:
  - **Free/near‑free**: ≲ $10/month at beta volumes.
  - **Low**: Roughly $10–$50/month.
  - **Medium**: Roughly $50–$200/month.
  - **High**: ≳ $200/month or requires higher‑tier SaaS plans.

Below, services are ordered from **lowest to highest expected monthly cost** for the Week‑9–style beta.

---

### 1. LLM Provider – OpenAI GPT‑4o (and peers)

- **Service**: OpenAI GPT‑4o API (`OPENAI_API_KEY` in `backend/app/config.py`).  
- **Role in RoleFerry**:
  - Resume parsing (`/ai/parse-resume`).
  - Job description parsing (`/ai/parse-job-description`).
  - Pain point mapping (`/ai/pain-point-map`).
  - Offer and sequence generation (`/ai/offer`, `/ai/sequence`).
  - Spam‑word checks and company research summaries.
- **Pricing model (2025 ballpark)**:
  - GPT‑4o: **≈ $2.50 per 1M input tokens**, **≈ $10.00 per 1M output tokens** (OpenAI published pricing, via recent comparisons).
- **Beta‑cohort usage estimate**:
  - Assume ~**200 LLM calls/day** across all users (resume/JD parsing + offer/sequence + research), average **2K input + 1K output tokens** per call.
  - Daily tokens: ~400K input + 200K output → monthly ≈ 12M input + 6M output.
  - Estimated monthly cost:
    - Input: 12M × $2.50 / 1M ≈ **$30**
    - Output: 6M × $10 / 1M ≈ **$60**
    - **Total ≈ $90/month** at this usage.
- **Tier**: **Medium** (but easy to dial down via more aggressive mock‑mode / caching).

> **Note**: Comparable alternatives (Claude 3.5 Sonnet, Gemini 1.5 Pro) are in a similar order of magnitude; switching providers doesn’t radically change the beta‑stage bill, but standardising on **one** keeps complexity and cost tracking simpler.

---

### 2. Search API – Serper.dev

- **Service**: Serper.dev (`SERPER_API_KEY`) via `app/services/serper_client.py`.  
- **Role in RoleFerry**:
  - Company and contact discovery for **Decision Makers** and **Company Research**.
  - Support for the lead‑qual pipeline (company probing, SERP‑based research).
- **Pricing model (typical as of 2024–25)**:
  - Free tier with a **few thousand requests/month**.
  - Paid plans on the order of **$5–$50/month** depending on request volume.
- **Beta‑cohort usage estimate**:
  - If we keep SERP usage to **a few dozen searches/day** while in beta (e.g., 1–3 searches per new company), the **free tier or the lowest paid plan** is likely sufficient.
  - **Estimated monthly cost: $0–$10**.
- **Tier**: **Free/near‑free**.

---

### 3. Web Scraping / Job Ingestion – Apify

- **Service**: Apify (`APIFY_TOKEN`) via `backend/app/clients/apify.py`.  
- **Role in RoleFerry**:
  - Pull job postings and company data from job boards for **Job Descriptions**, **Lead‑Qual**, and occasional research scripts.
- **Pricing model (Apify)**:
  - Generous **free tier** (~$5 of compute units/month).
  - Starter paid plans around **$49/month+** for heavier scraping.
- **Beta‑cohort usage estimate**:
  - For 20 users, if we mainly run **small, scheduled actors** (e.g., a handful of jobs per week), the **free tier** can likely cover initial demos.
  - Turning on continuous scraping or many parallel actors would quickly move us into the $49+/month range.
  - **Estimated monthly cost at beta volumes: $0–$20** (assuming disciplined use).
- **Tier**: **Free/near‑free → Low** (once we increase actor usage).

---

### 4. Email & Contact Enrichment – Findymail

- **Service**: Findymail (`FINDYMAIL_API_KEY`) via `app/services/findymail_client.py`.  
- **Role in RoleFerry**:
  - Enrich contacts with verified email addresses for **Decision Makers** and lead‑qual flows.
  - Acts as one of the enrichment sources behind an Apollo‑style contact pipeline.
- **Pricing model (typical)**:
  - Subscription plans (e.g., **$39–$99/month**) including a fixed number of enrichment credits.
  - Effective per‑lookup cost often in the **$0.02–$0.05 range**.
- **Beta‑cohort usage estimate**:
  - If we enrich **only a small subset** of contacts (e.g., a few dozen per week for demos and golden‑path users), we could:
    - Either remain within a **trial / low‑tier subscription (~$39/month)**.
    - Or replace live calls entirely with **mock enrichment** until we’re ready to pay.
  - **Estimated monthly cost if enabled lightly: ≈ $40–$60**.
- **Tier**: **Low → Medium**, depending on how many real lookups we allow.

---

### 5. Email Verification – NeverBounce & MillionVerifier

- **Services**:
  - **NeverBounce** (`NEVERBOUNCE_API_KEY`) via `app/services/neverbounce_client.py`.
  - **MillionVerifier** (`MV_API_KEY`) via `backend/app/clients/mv.py`.
- **Role in RoleFerry**:
  - Verify deliverability of contact emails before launching sequences.
  - Feed into **Deliverability & Warmup** metrics and safeguard against high bounce rates.
- **Pricing model (typical public pricing)**:
  - **NeverBounce**: pay‑as‑you‑go around **$0.008–$0.01 per verification** at low volumes (e.g., $10 for 1K, $50 for 10K).
  - **MillionVerifier**: often advertises **cheaper per‑email** (≈ **$0.0007–$0.002 per email**) when buying higher‑volume packs.
- **Beta‑cohort usage estimate**:
  - Suppose we verify **2,000–5,000 emails/month** across all users.
  - Using NeverBounce only:
    - 2K × $0.01 ≈ **$20**  
    - 5K × $0.008 ≈ **$40**
  - Using MillionVerifier for bulk and NeverBounce selectively:
    - Blended cost could be in the **$10–$30/month** range.
- **Tier**: **Low** (and easy to hold near‑zero by mocking in Week 9 and batch‑verifying only “go‑live” contacts later).

---

### 6. Outreach Platform Integration – Instantly

- **Service**: Instantly (`INSTANTLY_API_KEY`) via `backend/app/clients/instantly.py` and notes in `backend/README.md`.  
- **Role in RoleFerry**:
  - Push contacts and sequences into Instantly as a downstream sending engine.
  - Receive webhooks back for analytics/audit if enabled.
- **Pricing model (typical)**:
  - Seat‑based SaaS; common entry tiers around **$97–$197/month** for a modest number of mailboxes and campaigns.
  - API access usually included in higher tiers.
- **Beta‑cohort usage estimate**:
  - If we rely on Instantly as the *primary* sending and warmup engine for the **entire beta cohort**, we probably need at least **one paid plan** in the ~$100/month range.
  - If we instead use Instantly **only for your own test account** and keep beta customers on RoleFerry’s internal/mocked engine, we could:
    - Reuse an existing subscription you already have.
    - Treat this as **$0 incremental** for RoleFerry, at least in Weeks 9–10.
  - **Estimated incremental cost for RoleFerry: $0–$100/month**, depending on whether we count an existing subscription.
- **Tier**: **Medium** if we buy a dedicated plan just for RoleFerry; **effectively Free** if we only piggy‑back on an existing account for demos.

---

### 7. Offer Decks & Slides – Gamma (Offer Deck Provider)

- **Service**: Gamma (`GAMMA_API_KEY`) via `app/services/offer_decks/gamma_provider.py`.  
- **Role in RoleFerry**:
  - Generate **offer decks / one‑pagers** from RoleFerry data (Offer Creation and Offer Deck flows).
  - Acts as a Clay‑/Gamma‑style doc/presentation generator.
- **Pricing model (typical)**:
  - Free tier with **limited AI credits per month**.
  - Pro tiers around **$15–$30/month per user** for heavier creation.
- **Beta‑cohort usage estimate**:
  - For Week 9–10, we mainly need **internal demo decks**, not one deck per user.
  - We can likely stay on:
    - A **single Pro seat** (~$15–$30/month), or
    - Free tier + occasional manual top‑ups.
  - **Estimated monthly cost: $0–$30**.
- **Tier**: **Free/near‑free → Low**.

---

### 8. Warmup‑Focused Providers (ZapMail‑Style)

- **Service**: External warmup network (ZapMail or similar), mentioned in Week 8 as a benchmark.  
- **Role in RoleFerry**:
  - Automatically send/receive warmup emails between seed mailboxes to improve deliverability.
  - Might be used **instead of** building our own warmup network in early weeks.
- **Pricing model (typical for warmup tools)**:
  - Many providers price **per mailbox**, often in the **$3–$15/mailbox/month** range.
  - Some bundle warmup into broader outreach plans (like Instantly).
- **Beta‑cohort usage estimate**:
  - Realistically, we might only warm up **a handful (3–5) of shared mailboxes** for the initial beta rather than 1 mailbox per user.
  - At ~$3/mailbox/month for 5 mailboxes → **~$15/month**.
- **Tier**: **Low**.  
  - We can avoid this cost entirely in Week 9 by **keeping warmup UI scaffolded but mocked**, and only turning on paid warmup once we’re closer to live sending.

---

### 9. Summary Table (Sorted by Estimated Beta‑Stage Cost)

| Service                            | Role in RoleFerry                                            | Est. Monthly (beta) | Tier              |
|-----------------------------------|--------------------------------------------------------------|---------------------|-------------------|
| Serper.dev                        | Company/contact SERP research                                | $0–$10              | Free/near‑free    |
| Apify                             | Job/company scraping                                         | $0–$20              | Free/near‑free/Low|
| Gamma (offer decks)              | Offer decks / slide generation                               | $0–$30              | Free/near‑free/Low|
| Warmup provider (ZapMail‑style)   | Mailbox warmup network                                       | $0–$15              | Low               |
| NeverBounce / MillionVerifier     | Email verification                                           | $10–$40             | Low               |
| Findymail                         | Contact email enrichment                                     | $40–$60             | Low→Medium        |
| Instantly (incremental)          | External outreach / sending engine                           | $0–$100             | Medium (if added) |
| OpenAI GPT‑4o (LLM)              | Resume/JD parsing, offers, sequences, research, spam checks  | ~**$90**            | Medium            |

---

### 10. Takeaways for Week‑9–12 Planning

- **Week 9 can run almost entirely on free or near‑free tiers** by:
  - Keeping **ROLEFERRY_MOCK_MODE=true** for most flows.
  - Turning on **real LLM calls sparingly** (e.g., for a small number of “golden‑path” examples).
  - Limiting SERPER/APIFY/Findymail/verification calls to a handful of curated test records.
- The **biggest predictable line items** once we scale beyond pure mocks are:
  - **LLM usage (OpenAI GPT‑4o)**.
  - **Contact enrichment (Findymail)** and **verification (NeverBounce/MillionVerifier)**.
  - Possibly a **dedicated Instantly / warmup subscription** if we rely heavily on an external sending engine.
- For the Week‑10–12 roadmap, we should:
  - Decide which **single LLM provider** to standardise on.
  - Pick **one verification path** (NeverBounce vs MillionVerifier) and one **enrichment source** to avoid double‑spending.
  - Continue to treat warmup and external outreach tools as **optional add‑ons** until we see real traction and have a clear per‑user unit‑economics picture.


