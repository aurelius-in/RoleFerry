# RoleFerry – Week 7 Updates (Implementation Brief)

You are updating the RoleFerry *wireframe app* (not the production app). The goal is to align the UI and copy with the business logic Oliver and Dave agreed on in the Week 7 meeting.

Do **not** change visual styling, branding, or layout beyond what’s needed to support these behaviors and labels.

---

## 1. Navigation & Step Flow

**Goal:** Simplify the flow and make names consistent so we can talk about them clearly.

1. Remove “Signals engine” as a *separate* step/tab.
2. Ensure the main workflow steps in the nav are (order matters):

   1. Job preferences  
   2. Your profile (resume upload + extracted profile)  
   3. Job descriptions  
   4. Job tracker  
   5. Pain point match  
   6. Company research (was “Context research” / “Client intelligence”)  
   7. Decision makers (was “Find contact”)  
   8. Offer creation (merged with previous “Compose”)  
   9. Campaign (sequencer)  
   10. Dry run / QA  
   11. Launch campaign  
   12. Analytics

   *Note: "Give Feedback" is available globally via the top bar and feedback banner, not as a sequential step.*

3. For every step, the **nav label**, the **page heading**, and any **route/URL name** should match conceptually:
   - “Job descriptions” page must show “Job descriptions” in the title (not “Client profiles”).
   - “Company research” is the canonical name (no “Context research” / “Client intelligence” remnants).
   - “Decision makers” is the canonical name (no “Find contact”, no “Find contact” URL).
   - “Campaign” button; page heading “Campaign sequence”.

---

## 2. Job Preferences Screen

**Goal:** Make this page capture the right segmentation knobs without trying to be infinitely exhaustive.

### 2.1 Role categories

1. Expand role categories to the types Dave actually works with. Include at least:

   - Technology & Engineering  
   - Data & Analytics  
   - AI / ML  
   - Product Management  
   - Program Management  
   - Project Management  
   - Marketing  
   - Sales / GTM  
   - RevOps  
   - Cybersecurity  
   - UI / UX & Design  
   - Finance / FP&A / Accounting  
   - Procurement & Logistics  
   - Recruiter / Talent Acquisition  
   - Career Coach

2. Add an **“Other role category”** free-text field so users can specify a niche role name if they don’t see it.

### 2.2 Role type (seniority)

1. Keep existing options (e.g. VP, Director, Manager, Individual contributor).
2. Add:
   - Entry level  
   - Senior  
   - Principal / Staff / Technical lead (one bucket is fine, label like `Principal / Staff / Tech lead`).
3. We are **not** hard-excluding entry-level; it’s okay if this option exists even if we rarely target them.

### 2.3 Industries

1. Expand the industries list to feel “complete” rather than “just software”.
2. Include non-tech industries where these roles exist (e.g. Healthcare, FinTech, Manufacturing, Retail, Logistics, etc.).
3. Aim for roughly 3–4x the current number of entries so the dropdown feels legit, not toy-ish.

### 2.4 Skills

1. **Remove** the hard-coded list of programming languages and generic skills from this page.
2. Replace with a **tag-style free-text field** (user can type skills and press enter to add chips).
3. If possible, make this field **AI-assist/autocomplete**:
   - As the user types, suggest skills (e.g. “Python”, “Salesforce”, “Strategic planning”, “Pipeline management”).
   - Users should still be able to enter arbitrary text, not only suggestions.

### 2.5 Work type, location, company size, job search status

1. Keep existing fields: Location preference (remote/hybrid/onsite), Work type (full-time / part-time / contract / freelance), Job search status.
2. Company size:
   - Keep sensible ranges like: `0–50`, `51–250`, `251–1000`, `1000–5000`, `5000+`.
   - No extra logic required, just ensure ranges are clear and non-overlapping.

---

## 3. “Your Profile” (Resume Upload) Screen

**Goal:** Normalize the resume into a few “five aspects” that the rest of the system can reuse via variables.

After the user uploads a resume and we “parse” it, show cards for:

1. **Key metrics**  
   - Concrete numbers like revenue impact, % improvement, cost savings, etc.  
   - Example copy: `Grew ARR from $29M to $275M (+37.5%)`.

2. **Business challenges solved**  
   - Plain-language problems the candidate has tackled (from bullets and summary).

3. **Notable accomplishments**  
   - Big wins, awards, promotions, standout projects.

4. **Years of experience / tenure**  
   - Explicit numeric summaries, not just dates.  
   - E.g. `Total relevant experience: 8 years`, `Current company tenure: 4.5 years`.  
   - You can compute this from date ranges; display a human-readable duration.

5. **Positions held**  
   - Titles and companies as a simple list or summary.

6. **Education**  
   - Degrees, institutions, graduation years.

7. **Certifications** (if present)  
   - Show as their own card.

8. **Skills**  
   - Same tag behavior as Job Preferences (not just hard-coded languages).

**Variables:**  
Make sure the extracted data is available to later steps as structured variables, e.g.:

- `profile.key_metrics[]`  
- `profile.business_challenges[]`  
- `profile.accomplishments[]`  
- `profile.total_years_experience`  
- `profile.current_company_tenure`  
- `profile.positions[]`  
- `profile.education[]`  
- `profile.certifications[]`  
- `profile.skills[]`

These will be used heavily in Pain Point Match and Offer Creation.

---

## 4. Pain Point Match Screen

**Goal:** Explicitly pair job-side pain points with resume-side solutions.

1. Derive **pain points** from *two* parts of the job description:
   - Responsibilities
   - Qualifications / Requirements
2. For each pain point, create a **pair**:
   - `challenge`: short snippet from the job description (responsibility or requirement).
   - `solution`: matching metric or accomplishment from the candidate profile.

3. In the UI, show this as side-by-side rows:

   - `Challenge 1` (from JD): “Develop predictive models for OEE and quality prediction.”  
   - `Solution 1` (from resume): “Improved line OEE by 14% using predictive maintenance models across 3 plants.”

4. Do this for at least 2–3 pairs per job if data exists:
   - `challenge_1`, `solution_1`, `challenge_2`, `solution_2`, etc.

5. These pairs are consumed as **email variables** later, so ensure variable names are stable and descriptive, e.g.:

   - `pp_match.pairs[0].jd_snippet`  
   - `pp_match.pairs[0].resume_snippet`  

6. Remove any older “generic” placeholder copy like “Need to scale infra 10x”; everything should be grounded in (JD, profile).

---

## 5. Company Research (was “Context / Client intelligence”)

**Goal:** Combine the old “Signals engine” ideas with company-level briefing.

1. Rename this screen everywhere to **“Company research”**:
   - Route/URL, page heading, nav label.
2. Move the **Signals engine** content into the top section of this page:
   - Hiring signals, ad-running signals, funding/layoff news, etc.  
   - Think of it as “signals for whether the company is hiring / receptive”.

3. Below the signals section, show the rest of the company brief:
   - Company overview
   - Recent news
   - Buying signals (if not already covered above)
   - Any other context fields that already exist

4. Expose structured variables to later steps, e.g.:

   - `company.name`  
   - `company.industry`  
   - `company.size`  
   - `company.location`  
   - `company.signals[]` (hiring, ads, funding, layoffs, etc.)  
   - `company.summary`  

---

## 6. Job Tracker Screen

**Goal:** Restore the Kanban-style tracker with stage-to-stage movement and clearer labels.

1. Give Job Tracker its own main nav step, immediately **after “Job descriptions”**.
2. Columns:
   - Rename “Wishlist” to **“Saved”** (these are saved jobs the user is eyeing).  
   - Keep: `Applied`, `Interviewing`, `Offer`, `Rejected`.

3. For each job card in any column, add a **small button** like “Move to next stage”:
   - When clicked, the card moves to the next column (Saved → Applied → Interviewing → Offer → Rejected).
   - Once in `Rejected` or `Offer`, it can either stay there or you can support manual drag-and-drop – but at minimum, “move to next stage” must work forward.

4. Keep the “Add job” behavior but ensure new jobs start in the `Saved` column by default.

---

## 7. Decision Makers Screen (was “Find contact”)

**Goal:** Treat this as *contact research* (person-level), not just a simple name lookup.

1. Rename everywhere:
   - Nav/route/button: **“Decision makers”**  
   - Page heading: **“Decision makers”** (no “Find contact”).

2. On this screen, capture and/or display:

   - Decision maker name  
   - Title  
   - Company  
   - LinkedIn URL  
   - 2–3 interesting facts derived from their LinkedIn (posts, articles, bio, side projects, etc.)

3. Variables should look like:

   - `contact.name`  
   - `contact.title`  
   - `contact.company`  
   - `contact.linkedin_url`  
   - `contact.facts[]` (short bullet phrases we can reference in emails)

4. The intent: emails can say “I enjoyed your recent post about X” or “I noticed you’ve been leading Y initiative”, so make facts specific and human, not generic fluff.

5. This screen **should** have its own variables sidebar (see section 9) because its output feeds the email personality/opening.

---

## 8. Offer Creation (merge with Compose)

**Goal:** Have a single screen where we define tone, audience, and generate the initial email using all upstream variables.

1. Delete the separate **Compose** step/tab.
2. Keep **Offer creation** as the one email-building screen.
3. Add the **variables sidebar** from the old Compose screen to the right side of Offer creation:
   - It should list variables from: `profile`, `job_description`, `pp_match`, `company`, and `contact`.

4. Tone & audience:
   - Keep existing tone options that make sense (e.g. Executive, Developer, Sales, Recruiter, Standard).  
   - Replace `Enterprise` and `Manager` with:
     - `Flattering` (complimentary tone)  
     - `Mentorship` (respectful, mentor-seeking tone)

5. The generated email on this screen should:
   - Pull in the pain point pairs (challenge/solution).  
   - Reference company context and signals.  
   - Optionally reference one decision-maker fact.  
   - Use the selected tone and audience.

---

## 9. Variables Sidebar – Where It Should Exist

**Goal:** Only show the “Available variables from this step” where they are actually needed for downstream email building.

Keep the variables sidebar on:

1. Your profile  
2. Job descriptions  
3. Pain point match  
4. Company research  
5. Decision makers  
6. Offer creation  
7. (Optional) Campaign sequence, if helpful

Remove the variables sidebar from:

1. Decision makers **if** we fully replace it with the richer contact research UX described above (otherwise keep).  
2. Offer creation’s old duplicate / Compose tab (that tab is removed anyway).  
3. Any purely navigational/summary pages where variables are not used downstream.

---

## 10. Campaign Screen (Sequencer)

**Goal:** Represent the multi-email sequence (campaign) clearly.

1. Button label: **“Campaign”**.  
2. Page heading: **“Campaign sequence”**.

3. On this screen, define a 3–4 step email sequence (per job or per campaign):

   Suggested default labels:
   - Step 1: Initial outreach  
   - Step 2: Polite nudge / reminder  
   - Step 3: Additional value add / case study  
   - Step 4: Final attempt

4. Each step should:
   - Be generated initially from the same variable set as Offer creation.  
   - Have its own editable subject + body.  
   - Be stored as `campaign.steps[n]` for the dry-run and analytics screens.

5. Remove the variables sidebar here if it clutters; users can edit inline text directly.

6. Keep or add controls like:
   - Toggle step on/off  
   - Change delay between steps (e.g. +3 days, +7 days, etc.) – even if not wired to a real mailer yet.

---

## 11. Dry Run / Sequence QA Screen

**Goal:** Let the user preview and lightly edit all emails in order before launch.

1. Show the **entire sequence** (all emails from Campaign) in one scrollable view.
2. For each step:
   - Show a label (Step 1 / Step 2 / Step 3 / Step 4).  
   - Show subject + body as they will be sent (variables already resolved for a sample company/contact).

3. Add an **Edit** affordance for each email:
   - A small “Edit” button or pencil icon is fine.  
   - Clicking it should allow the user to tweak subject/body inline.

4. This screen is *read-only by default* but becomes editable when user clicks Edit on a given email.

---

## 12. Analytics Screen

**Goal:** Emulate Instantly-style campaign analytics for clarity.

At minimum, add the following metrics (even with mock data):

1. **Top-level campaign stats** (for the current user/campaign):

   - Total emails sent  
   - Open rate (%)  
   - Click rate (%)  
   - Reply rate (%)  
   - Positive reply rate (%) (replies marked as positive)

2. **Per-step (sequence) analytics**:

   For each step (1–4), show:
   - Emails sent at that step  
   - Opens  
   - Clicks  
   - Replies  
   - Positive replies

3. Keep or add basic segmentation such as:
   - By region (e.g. Austin area vs Bay Area, or similar grouping).  
   - Per-campaign comparisons if multiple campaigns exist.

4. Deliverability view (can be separate sub-section):
   - Spam rate  
   - Bounce rate  
   - “Inbox vs Promotions vs Spam” breakdown if represented.

5. All of this can be stubbed with mock data for now; the key is **structure and labels**, not real back-end wiring yet.

---

## 13. Launch Campaign Screen

**Goal:** Simple, clear final step.

1. When a campaign is ready, this page should:
   - Confirm which campaign/sequence is being launched.  
   - Show a short summary (number of contacts, steps, schedule hints).  
   - Provide a single clear CTA (e.g. “Launch campaign”).

2. After launch, show a simple success state:
   - E.g. “Campaign launched – you’ll see analytics populate soon.”

No complex logic needed here now; mostly copy and state management.

---

## 14. Give Feedback Screen

**Goal:** Capture detailed user feedback in exchange for a discount.

1. Make sure this screen has:
   - Clear copy explaining that feedback unlocks discounted pricing.  
   - Per-screen or per-step questions (e.g. “What confused you on Job preferences?”, “What did you like about Pain point match?”).  
   - A large free-text area for detailed answers.

2. The important intent:
   - We want **comprehensive** answers that we can later feed back into AI to drive improvements.  
   - Design questions to prompt real commentary, not just star ratings.

3. Wire up the submit action to a backend endpoint or at least a stub so we can capture these responses later.

---

If any existing behavior conflicts with these instructions, **treat this document as the source of truth** for Week 7 RoleFerry wireframe updates.
