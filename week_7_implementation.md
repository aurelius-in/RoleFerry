     1|# RoleFerry – Week 7 Updates (Implementation Brief)
     2|
     3|You are updating the RoleFerry *wireframe app* (not the production app). The goal is to align the UI and copy with the business logic Oliver and Dave agreed on in the Week 7 meeting.
     4|
     5|Do **not** change visual styling, branding, or layout beyond what’s needed to support these behaviors and labels.
     6|
     7|---
     8|
     9|## 1. Navigation & Step Flow
    10|
    11|**Goal:** Simplify the 12-step flow and make names consistent so we can talk about them clearly.
    12|
    13|1. Remove “Signals engine” as a *separate* step/tab.
    14|2. Ensure the main workflow steps in the nav are (order matters):
    15|
    16|   1. Job preferences  
    17|   2. Your profile (resume upload + extracted profile)  
    18|   3. Job descriptions  
    19|   4. Job tracker  
    20|   5. Pain point match  
    21|   6. Company research (was “Context research” / “Client intelligence”)  
    22|   7. Decision makers (was “Find contact”)  
    23|   8. Offer creation (merged with previous “Compose”)  
    24|   9. Campaign (sequencer)  
    25|   10. Dry run / QA  
    26|   11. Launch campaign  
    27|   12. Analytics  
    28|   13. Give feedback
    29|
    30|3. For every step, the **nav label**, the **page heading**, and any **route/URL name** should match conceptually:
    31|   - “Job descriptions” page must show “Job descriptions” in the title (not “Client profiles”).
    32|   - “Company research” is the canonical name (no “Context research” / “Client intelligence” remnants).
    33|   - “Decision makers” is the canonical name (no “Find contact”, no “Find contact” URL).
    34|   - “Campaign” button; page heading “Campaign sequence”.
    35|
    36|---
    37|
    38|## 2. Job Preferences Screen
    39|
    40|**Goal:** Make this page capture the right segmentation knobs without trying to be infinitely exhaustive.
    41|
    42|### 2.1 Role categories
    43|
    44|1. Expand role categories to the types Dave actually works with. Include at least:
    45|
    46|   - Technology & Engineering  
    47|   - Data & Analytics  
    48|   - AI / ML  
    49|   - Product Management  
    50|   - Program Management  
    51|   - Project Management  
    52|   - Marketing  
    53|   - Sales / GTM  
    54|   - RevOps  
    55|   - Cybersecurity  
    56|   - UI / UX & Design  
    57|   - Finance / FP&A / Accounting  
    58|   - Procurement & Logistics  
    59|   - Recruiter / Talent Acquisition  
    60|   - Career Coach
    61|
    62|2. Add an **“Other role category”** free-text field so users can specify a niche role name if they don’t see it.
    63|
    64|### 2.2 Role type (seniority)
    65|
    66|1. Keep existing options (e.g. VP, Director, Manager, Individual contributor).
    67|2. Add:
    68|   - Entry level  
    69|   - Senior  
    70|   - Principal / Staff / Technical lead (one bucket is fine, label like `Principal / Staff / Tech lead`).
    71|3. We are **not** hard-excluding entry-level; it’s okay if this option exists even if we rarely target them.
    72|
    73|### 2.3 Industries
    74|
    75|1. Expand the industries list to feel “complete” rather than “just software”.
    76|2. Include non-tech industries where these roles exist (e.g. Healthcare, FinTech, Manufacturing, Retail, Logistics, etc.).
    77|3. Aim for roughly 3–4x the current number of entries so the dropdown feels legit, not toy-ish.
    78|
    79|### 2.4 Skills
    80|
    81|1. **Remove** the hard-coded list of programming languages and generic skills from this page.
    82|2. Replace with a **tag-style free-text field** (user can type skills and press enter to add chips).
    83|3. If possible, make this field **AI-assist/autocomplete**:
    84|   - As the user types, suggest skills (e.g. “Python”, “Salesforce”, “Strategic planning”, “Pipeline management”).
    85|   - Users should still be able to enter arbitrary text, not only suggestions.
    86|
    87|### 2.5 Work type, location, company size, job search status
    88|
    89|1. Keep existing fields: Location preference (remote/hybrid/onsite), Work type (full-time / part-time / contract / freelance), Job search status.
    90|2. Company size:
    91|   - Keep sensible ranges like: `0–50`, `51–250`, `251–1000`, `1000–5000`, `5000+`.
    92|   - No extra logic required, just ensure ranges are clear and non-overlapping.
    93|
    94|---
    95|
    96|## 3. “Your Profile” (Resume Upload) Screen
    97|
    98|**Goal:** Normalize the resume into a few “five aspects” that the rest of the system can reuse via variables.
    99|
   100|After the user uploads a resume and we “parse” it, show cards for:
   101|
   102|1. **Key metrics**  
   103|   - Concrete numbers like revenue impact, % improvement, cost savings, etc.  
   104|   - Example copy: `Grew ARR from $29M to $275M (+37.5%)`.
   105|
   106|2. **Business challenges solved**  
   107|   - Plain-language problems the candidate has tackled (from bullets and summary).
   108|
   109|3. **Notable accomplishments**  
   110|   - Big wins, awards, promotions, standout projects.
   111|
   112|4. **Years of experience / tenure**  
   113|   - Explicit numeric summaries, not just dates.  
   114|   - E.g. `Total relevant experience: 8 years`, `Current company tenure: 4.5 years`.  
   115|   - You can compute this from date ranges; display a human-readable duration.
   116|
   117|5. **Positions held**  
   118|   - Titles and companies as a simple list or summary.
   119|
   120|6. **Education**  
   121|   - Degrees, institutions, graduation years.
   122|
   123|7. **Certifications** (if present)  
   124|   - Show as their own card.
   125|
   126|8. **Skills**  
   127|   - Same tag behavior as Job Preferences (not just hard-coded languages).
   128|
   129|**Variables:**  
   130|Make sure the extracted data is available to later steps as structured variables, e.g.:
   131|
   132|- `profile.key_metrics[]`  
   133|- `profile.business_challenges[]`  
   134|- `profile.accomplishments[]`  
   135|- `profile.total_years_experience`  
   136|- `profile.current_company_tenure`  
   137|- `profile.positions[]`  
   138|- `profile.education[]`  
   139|- `profile.certifications[]`  
   140|- `profile.skills[]`
   141|
   142|These will be used heavily in Pain Point Match and Offer Creation.
   143|
   144|---
   145|
   146|## 4. Pain Point Match Screen
   147|
   148|**Goal:** Explicitly pair job-side pain points with resume-side solutions.
   149|
   150|1. Derive **pain points** from *two* parts of the job description:
   151|   - Responsibilities
   152|   - Qualifications / Requirements
   153|2. For each pain point, create a **pair**:
   154|   - `challenge`: short snippet from the job description (responsibility or requirement).
   155|   - `solution`: matching metric or accomplishment from the candidate profile.
   156|
   157|3. In the UI, show this as side-by-side rows:
   158|
   159|   - `Challenge 1` (from JD): “Develop predictive models for OEE and quality prediction.”  
   160|   - `Solution 1` (from resume): “Improved line OEE by 14% using predictive maintenance models across 3 plants.”
   161|
   162|4. Do this for at least 2–3 pairs per job if data exists:
   163|   - `challenge_1`, `solution_1`, `challenge_2`, `solution_2`, etc.
   164|
   165|5. These pairs are consumed as **email variables** later, so ensure variable names are stable and descriptive, e.g.:
   166|
   167|   - `pp_match.pairs[0].jd_snippet`  
   168|   - `pp_match.pairs[0].resume_snippet`  
   169|
   170|6. Remove any older “generic” placeholder copy like “Need to scale infra 10x”; everything should be grounded in (JD, profile).
   171|
   172|---
   173|
   174|## 5. Company Research (was “Context / Client intelligence”)
   175|
   176|**Goal:** Combine the old “Signals engine” ideas with company-level briefing.
   177|
   178|1. Rename this screen everywhere to **“Company research”**:
   179|   - Route/URL, page heading, nav label.
   180|2. Move the **Signals engine** content into the top section of this page:
   181|   - Hiring signals, ad-running signals, funding/layoff news, etc.  
   182|   - Think of it as “signals for whether the company is hiring / receptive”.
   183|
   184|3. Below the signals section, show the rest of the company brief:
   185|   - Company overview
   186|   - Recent news
   187|   - Buying signals (if not already covered above)
   188|   - Any other context fields that already exist
   189|
   190|4. Expose structured variables to later steps, e.g.:
   191|
   192|   - `company.name`  
   193|   - `company.industry`  
   194|   - `company.size`  
   195|   - `company.location`  
   196|   - `company.signals[]` (hiring, ads, funding, layoffs, etc.)  
   197|   - `company.summary`  
   198|
   199|---
   200|
   201|## 6. Job Tracker Screen
   202|
   203|**Goal:** Restore the Kanban-style tracker with stage-to-stage movement and clearer labels.
   204|
   205|1. Give Job Tracker its own main nav step, immediately **after “Job descriptions”**.
   206|2. Columns:
   207|   - Rename “Wishlist” to **“Saved”** (these are saved jobs the user is eyeing).  
   208|   - Keep: `Applied`, `Interviewing`, `Offer`, `Rejected`.
   209|
   210|3. For each job card in any column, add a **small button** like “Move to next stage”:
   211|   - When clicked, the card moves to the next column (Saved → Applied → Interviewing → Offer → Rejected).
   212|   - Once in `Rejected` or `Offer`, it can either stay there or you can support manual drag-and-drop – but at minimum, “move to next stage” must work forward.
   213|
   214|4. Keep the “Add job” behavior but ensure new jobs start in the `Saved` column by default.
   215|
   216|---
   217|
   218|## 7. Decision Makers Screen (was “Find contact”)
   219|
   220|**Goal:** Treat this as *contact research* (person-level), not just a simple name lookup.
   221|
   222|1. Rename everywhere:
   223|   - Nav/route/button: **“Decision makers”**  
   224|   - Page heading: **“Decision makers”** (no “Find contact”).
   225|
   226|2. On this screen, capture and/or display:
   227|
   228|   - Decision maker name  
   229|   - Title  
   230|   - Company  
   231|   - LinkedIn URL  
   232|   - 2–3 interesting facts derived from their LinkedIn (posts, articles, bio, side projects, etc.)
   233|
   234|3. Variables should look like:
   235|
   236|   - `contact.name`  
   237|   - `contact.title`  
   238|   - `contact.company`  
   239|   - `contact.linkedin_url`  
   240|   - `contact.facts[]` (short bullet phrases we can reference in emails)
   241|
   242|4. The intent: emails can say “I enjoyed your recent post about X” or “I noticed you’ve been leading Y initiative”, so make facts specific and human, not generic fluff.
   243|
   244|5. This screen **should** have its own variables sidebar (see section 9) because its output feeds the email personality/opening.
   245|
   246|---
   247|
   248|## 8. Offer Creation (merge with Compose)
   249|
   250|**Goal:** Have a single screen where we define tone, audience, and generate the initial email using all upstream variables.
   251|
   252|1. Delete the separate **Compose** step/tab.
   253|2. Keep **Offer creation** as the one email-building screen.
   254|3. Add the **variables sidebar** from the old Compose screen to the right side of Offer creation:
   255|   - It should list variables from: `profile`, `job_description`, `pp_match`, `company`, and `contact`.
   256|
   257|4. Tone & audience:
   258|   - Keep existing tone options that make sense (e.g. Executive, Developer, Sales, Recruiter, Standard).  
   259|   - Replace `Enterprise` and `Manager` with:
   260|     - `Flattering` (complimentary tone)  
   261|     - `Mentorship` (respectful, mentor-seeking tone)
   262|
   263|5. The generated email on this screen should:
   264|   - Pull in the pain point pairs (challenge/solution).  
   265|   - Reference company context and signals.  
   266|   - Optionally reference one decision-maker fact.  
   267|   - Use the selected tone and audience.
   268|
   269|---
   270|
   271|## 9. Variables Sidebar – Where It Should Exist
   272|
   273|**Goal:** Only show the “Available variables from this step” where they are actually needed for downstream email building.
   274|
   275|Keep the variables sidebar on:
   276|
   277|1. Your profile  
   278|2. Job descriptions  
   279|3. Pain point match  
   280|4. Company research  
   281|5. Decision makers  
   282|6. Offer creation  
   283|7. (Optional) Campaign sequence, if helpful
   284|
   285|Remove the variables sidebar from:
   286|
   287|1. Decision makers **if** we fully replace it with the richer contact research UX described above (otherwise keep).  
   288|2. Offer creation’s old duplicate / Compose tab (that tab is removed anyway).  
   289|3. Any purely navigational/summary pages where variables are not used downstream.
   290|
   291|---
   292|
   293|## 10. Campaign Screen (Sequencer)
   294|
   295|**Goal:** Represent the multi-email sequence (campaign) clearly.
   296|
   297|1. Button label: **“Campaign”**.  
   298|2. Page heading: **“Campaign sequence”**.
   299|
   300|3. On this screen, define a 3–4 step email sequence (per job or per campaign):
   301|
   302|   Suggested default labels:
   303|   - Step 1: Initial outreach  
   304|   - Step 2: Polite nudge / reminder  
   305|   - Step 3: Additional value add / case study  
   306|   - Step 4: Final attempt
   307|
   308|4. Each step should:
   309|   - Be generated initially from the same variable set as Offer creation.  
   310|   - Have its own editable subject + body.  
   311|   - Be stored as `campaign.steps[n]` for the dry-run and analytics screens.
   312|
   313|5. Remove the variables sidebar here if it clutters; users can edit inline text directly.
   314|
   315|6. Keep or add controls like:
   316|   - Toggle step on/off  
   317|   - Change delay between steps (e.g. +3 days, +7 days, etc.) – even if not wired to a real mailer yet.
   318|
   319|---
   320|
   321|## 11. Dry Run / Sequence QA Screen
   322|
   323|**Goal:** Let the user preview and lightly edit all emails in order before launch.
   324|
   325|1. Show the **entire sequence** (all emails from Campaign) in one scrollable view.
   326|2. For each step:
   327|   - Show a label (Step 1 / Step 2 / Step 3 / Step 4).  
   328|   - Show subject + body as they will be sent (variables already resolved for a sample company/contact).
   329|
   330|3. Add an **Edit** affordance for each email:
   331|   - A small “Edit” button or pencil icon is fine.  
   332|   - Clicking it should allow the user to tweak subject/body inline.
   333|
   334|4. This screen is *read-only by default* but becomes editable when user clicks Edit on a given email.
   335|
   336|---
   337|
   338|## 12. Analytics Screen
   339|
   340|**Goal:** Emulate Instantly-style campaign analytics for clarity.
   341|
   342|At minimum, add the following metrics (even with mock data):
   343|
   344|1. **Top-level campaign stats** (for the current user/campaign):
   345|
   346|   - Total emails sent  
   347|   - Open rate (%)  
   348|   - Click rate (%)  
   349|   - Reply rate (%)  
   350|   - Positive reply rate (%) (replies marked as positive)
   351|
   352|2. **Per-step (sequence) analytics**:
   353|
   354|   For each step (1–4), show:
   355|   - Emails sent at that step  
   356|   - Opens  
   357|   - Clicks  
   358|   - Replies  
   359|   - Positive replies
   360|
   361|3. Keep or add basic segmentation such as:
   362|   - By region (e.g. Austin area vs Bay Area, or similar grouping).  
   363|   - Per-campaign comparisons if multiple campaigns exist.
   364|
   365|4. Deliverability view (can be separate sub-section):
   366|   - Spam rate  
   367|   - Bounce rate  
   368|   - “Inbox vs Promotions vs Spam” breakdown if represented.
   369|
   370|5. All of this can be stubbed with mock data for now; the key is **structure and labels**, not real back-end wiring yet.
   371|
   372|---
   373|
   374|## 13. Launch Campaign Screen
   375|
   376|**Goal:** Simple, clear final step.
   377|
   378|1. When a campaign is ready, this page should:
   379|   - Confirm which campaign/sequence is being launched.  
   380|   - Show a short summary (number of contacts, steps, schedule hints).  
   381|   - Provide a single clear CTA (e.g. “Launch campaign”).
   382|
   383|2. After launch, show a simple success state:
   384|   - E.g. “Campaign launched – you’ll see analytics populate soon.”
   385|
   386|No complex logic needed here now; mostly copy and state management.
   387|
   388|---
   389|
   390|## 14. Give Feedback Screen
   391|
   392|**Goal:** Capture detailed user feedback in exchange for a discount.
   393|
   394|1. Make sure this screen has:
   395|   - Clear copy explaining that feedback unlocks discounted pricing.  
   396|   - Per-screen or per-step questions (e.g. “What confused you on Job preferences?”, “What did you like about Pain point match?”).  
   397|   - A large free-text area for detailed answers.
   398|
   399|2. The important intent:
   400|   - We want **comprehensive** answers that we can later feed back into AI to drive improvements.  
   401|   - Design questions to prompt real commentary, not just star ratings.
   402|
   403|3. Wire up the submit action to a backend endpoint or at least a stub so we can capture these responses later.
   404|
   405|---
   406|
   407|If any existing behavior conflicts with these instructions, **treat this document as the source of truth** for Week 7 RoleFerry wireframe updates.
   408|