<p align="center">
  <img src="wordmark.png" alt="RoleFerryWordmark" width="90%" />
</p>

# Recruiting Mode Workflow  

<p align="center">
  <img src="role_ferry_white.png" alt="RF Logo Concept 1" width="45%" />
  <img src="role_ferry_black.png" alt="RF Logo Concept 2" width="45%" />
</p>

## 0) Goal

Carry the right candidates across to the right hiring teams: 
**from role → shortlist → verified contact → booked meeting**.

---

## 1) Define IJP (Ideal Job Profile)

**Fields**

* Company size, industry
* Level (Principal, Director, etc.), target titles
* Locations / time zones
* Salary band (target/ceiling)
* Must-have & nice-to-have skills

**Output:** `IJP.json` (saved, reusable filter)

---

## 2) Ingest Roles (Apify → Indeed)

* Use Apify’s Indeed scraper by title+location or search URLs.
* Normalize to `JobPosting`: title, company, location, comp text, JD URL, post age, employment type, ratings.

**Output:** `job_postings.csv` → stored as `JobPosting` rows.

---

## 3) Parse Candidate Resume

* Extract Dave’s five sections for matching:

  1. **Key Metrics** (quantified outcomes)
  2. **Problems Solved** (business challenges)
  3. **Notable Accomplishments**
  4. **Positions Held**
  5. **Tenure per role**

**Output:** `CandidateProfile` + `CandidateExperience[]`.

---

## 4) Match & Explain

* Score candidate ↔ role (0–100) using title proximity, seniority, skills, domain, comp, location.
* Provide **reasons for fit** and **blockers** with quoted evidence.

**Output:** `Match` with `reasons[]`, `blockers[]`.

---

## 5) Offer Package (what we send)

* Pick relevant **portfolio item** / 1-pager / 30-sec intro video.
* Provide CTA options: coffee chat, culture Q\&A, quick screen.

**Output:** `OfferBundle` (links + short blurb).

---

## 6) Find Contacts (Apollo / Apify People)

* Target **Heads/VPs/Directors** and in-house recruiters.
* Fields: name, title, tenure, email (if available), LinkedIn URL, city/state/country.

**Output:** `Contact[]` (unverified).

---

## 7) **Verify Emails (NEW — MillionVerifier)**

**Why:** Protect deliverability; don’t burn domains or Instantly reputation.

**Flow**

1. Queue discovered emails for verification.
2. Call MillionVerifier API (single or batch).
3. Store result + score and stamp time.
4. **Gating rules**

   * **Send email** if status ∈ {`valid`, `accept_all`(score≥threshold)}.
   * **Route to LinkedIn only** if {`invalid`, `disposable`, `unknown`(score\<threshold)}.
   * **Fallback to intro-via-mutual** for invalids when a warm angle exists.

**Contact verification fields (new)**

* `verification_status`: enum {valid, invalid, accept\_all, unknown, disposable, catch\_all, risky}
* `verification_score`: 0–100 (if provided)
* `verified_at`: timestamp
* `verifier`: "MillionVerifier"

**UI**

* Badge on each contact: ✅ Valid / ⚠️ Accept-All / ❌ Invalid.
* Bulk filter: “Show only sendable contacts.”

---

## 8) Draft Outreach (Candidate mode or Recruiter-on-behalf)

* Short / Medium / Long variants.
* Inserts JD link (company site preferred, else Indeed), portfolio link, and **your exact Calendly line**.
* Uses warm angles when present (mutuals, alma mater, recent post).

**Output:** `Message[]` with variables resolved.

---

## 9) Sequence & Send (Instantly)

* Export **Instantly-ready CSV** (or push via API).
* Columns include:

  * `email, first_name, last_name, company, title`
  * `jd_link, portfolio_url, match_score`
  * `verified_status, verification_score`
  * `subject, message`
* Respect daily caps / staggered sends.

---

## 10) Track & Learn

* Labels: delivered, opened, replied, positive, meeting-set.
* A/B by subject/CTA.
* Dashboard: per IJP, per role, per candidate.

---

### Agents 

* **IJP Cartographer** → Step 1
* **JD Prospector** → Step 2
* **Resume Alchemist** → Step 3
* **Matchmaker** → Step 4
* **Portfolio Curator** → Step 5
* **Signals Sherlock** → Step 6
* **Verifier** (NEW) → Step 7 (MillionVerifier)
* **Ghostwriter** → Step 8
* **Sequencer** → Step 9
* **Coach Analyst** → Step 10

---

## Data Model 

```sql
-- Contacts
ALTER TABLE contact
  ADD COLUMN verification_status TEXT,      -- valid, invalid, accept_all, unknown, etc.
  ADD COLUMN verification_score   INTEGER,  -- optional 0..100
  ADD COLUMN verified_at          TIMESTAMP,
  ADD COLUMN verifier             TEXT;     -- 'MillionVerifier'

-- Messages export view
CREATE VIEW instantly_export AS
SELECT c.email, c.first_name, c.last_name, c.company, c.title,
       jp.jd_url AS jd_link,
       ob.portfolio_url,
       m.score   AS match_score,
       c.verification_status, c.verification_score,
       msg.subject, msg.body
FROM message msg
JOIN contact c ON msg.contact_id = c.id
JOIN match m   ON msg.match_id = m.id
JOIN job_posting jp ON m.job_id = jp.id
LEFT JOIN offer_bundle ob ON msg.offer_id = ob.id
WHERE c.verification_status IN ('valid','accept_all');
```

---

## MillionVerifier Integration (pseudo)

```python
# enqueue
to_check = [c.email for c in contacts if not c.verified_at]
# call MV (single or batch)
res = mv_verify(to_check)  # returns list of {email, status, score}

# persist + gate
for r in res:
    db.contact.update(email=r['email'],
                      verification_status=r['status'],
                      verification_score=r.get('score'),
                      verified_at=now(),
                      verifier='MillionVerifier')

sendable = [c for c in contacts if c.verification_status in ('valid','accept_all')]
```

*(Use retries + backoff; record raw JSON for audits.)*

---

## Outreach Snippets (verification-aware)

* **Email:**
  “Quick intro on {{RoleTitle}} at {{Company}} (JD: {{JD\_Link}}). I mapped outcomes to your goals here: {{OnePager}}. Please find some availability in my calendar: {{CalendlyURL}}.”
* **LinkedIn (fallback when invalid):**
  “Noticed {{TheirRecentThing}}. I’ve worked on {{YourEdge}}—happy to share a 1-pager if useful. Open to a quick intro this week?”

---

## Acceptance Criteria 

* Contacts show verification badges and can be filtered by sendability.
* Instantly export includes `verified_status` + `verification_score`.
* Sequencer excludes non-sendable emails; offers LinkedIn export instead.
* Analytics split rates by verification tier.

Notes

- Email verification threshold (MV) can be adjusted in-app on Settings (MVP stores in-memory).
- If `INSTANTLY_API_KEY` is set in the environment, push-to-Instantly uses the API path; otherwise CSV export is used.

---


