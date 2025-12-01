# Week 8 Front-end Work List – RoleFerry

Scope: UI/copy changes agreed in the Week 8 meeting, applied to the **wireframe app only** (no production backend). The goal is to finish these front-end touches so backend wiring is logical and consistent.

Do **not** change visual styling or branding beyond what is necessary to support the behavior and labels below.

---

## 1. Global Navigation & Layout

* [ ] **Remove all “Progress: X/12” style progress indicators.**

  * Specifically, remove the erroneous `Progress: 4/12` text from the Pain Point Match screen and any similar counters. We decided users do **not** need a progress notifier on these pages. 

* [ ] **Add a “Previous step” back button to all steps except Job Preferences.**

  * On every main workflow screen *after* Job Preferences, place in the top-left:

    * Existing **Home** button.
    * Next to it, add a **fat left-pointing arrow** icon button labeled `Previous step`.
  * Clicking `Previous step` should route to the previous step in the linear flow (Job Descriptions → Job Tracker → Pain Point Match → Company Research → Decision Makers → Offer Creation → Campaign → Launch → Analytics).
  * Job Preferences is the first step and **does not** get a previous-step button. 

* [ ] **Clarify step order on the home / wireframes screen.**

  * Keep the footprint animation, but add an **explicit ordering cue** so users can tell what comes first on both desktop and mobile.
  * Options (pick one and implement):

    * Add small numbers (1–11) on each “stone” button in the order of the funnel.
    * Or add a thin arrow path that clearly shows the sequence between stones.
  * Ensure this still looks sane when the stones wrap into multiple rows on mobile. 

* [ ] **Remove the “Dry run / QA” step from the workflow.**

  * Remove its stone from the home / wireframes page.
  * Remove its route/page entirely (no separate `dry-run.html`).
  * Anywhere the step list is shown or referenced as “12 steps”, update to the new count (likely 11) but **don’t obsess over the exact number in copy yet** – we explicitly agreed not to over-fixate on the step count right now. 

---

## 2. Home / Wireframes Screen (`wireframes.html`)

* [ ] **Rename “Your profile” stone to “Your resume”.**

  * Update the button/stone label on the home/wireframes page from `Your profile` to `Your resume`. 

* [ ] **Remove the “Dry run / QA” stone.**

  * Delete the stone and any associated icon/label.
  * Ensure the footprint animation and any numbering still form a coherent path without this step. 

---

## 3. “Your Resume” Screen

File: rename `candidate-profile.html` → `candidate-resume.html`

* [ ] **Rename the file and main heading.**

  * File name: `candidate-profile.html` → `candidate-resume.html`.
  * Page heading text: `Your profile` → `Your resume`. 

* [ ] **Sync the variable names from `profile.*` → `resume.*`.**
  In the “available variables” section at the bottom of this screen (and anywhere else they’re shown in the UI), rename: 

  * `profile.key_metrics` → `resume.key_metrics`
  * `profile.business_challenges` → `resume.business_challenges`
  * `profile.accomplishments` → `resume.accomplishments`
  * `profile.total_years_experience` → `resume.total_years_experience`
  * `profile.position` → `resume.position`

* [ ] **Update any copy that references “profile” to “resume” where it’s clearly about the uploaded CV.**

  * Example: “This step builds your profile from your resume” is okay; but variable names need to be consistently `resume.*` to match how they will be referenced in Offer Creation and beyond.

---

## 4. Pain Point Match Screen (`pain-point-map.html`)

* [ ] **Add a left-hand “Saved opportunities” column, mirroring Job Descriptions.**

  * Replicate the left column from the **Job Descriptions** screen that lists `Saved opportunities`. 
  * Include:

    * List of saved jobs (titles + company names).
    * Sorting options (reuse whatever Job Descriptions currently supports, eg. sort by date or grade; exact sort keys are less important than having consistency).
  * When the user selects a job in this left column, the **right-hand side** Pain Point Match content should be **scoped to that job** (i.e., the JD being compared to the resume is the selected opportunity). 

* [ ] **Remove any “Progress X/12” text from this page.**

  * Covered under global, but explicitly: the “Progress: 4/12” line must go. 

---

## 5. Campaign Sequence Screen (`campaign.html`)

### 5.1 Editing experience

* [ ] **Inline editing instead of tiny dialog popups.**

  * Currently, clicking **Edit** opens a tiny single-line dialog that is too small to see the full message.
  * Change behavior so that when you click **Edit** on a message: 

    * The existing message box on the page becomes an editable `<textarea>` (multi-line) **in-place**.
    * Do **not** open a separate modal dialog.
  * You can keep the Edit button as a safety toggle (view vs edit), but once in edit mode, all content is edited inline.

### 5.2 Email length & spam check

* [ ] **Replace “Sequence length” metric with “Email length (characters)”.**

  * On `campaign.html`, remove the “Sequence length” metric; it’s redundant (we can all count to 4). 
  * Add a new metric labeled **Email length** that tracks **character count** of the current email body (not words).
  * Display something like:

    * `Email length: 342 characters (optimal: 300–500)`
  * We explicitly decided optimal outreach messages are between **300–500 characters**, not words. 

* [ ] **Add a “size preset” dropdown for target length.**

  * Add a dropdown near Email length that lets the user choose:

    * Small (≈ 200 chars)
    * Medium (≈ 400 chars)
    * Large (≈ 600 chars)
  * This is purely front-end for now (just show the preset and maybe a target label; actual trimming will be backend/AI later). 

* [ ] **Spam word detection UI (front-end scaffolding).**

  * Add a line like: `Spam words: 0 found` with room to show a number.
  * When the backend supplies a list of spammy words, those words in the email body should be **highlighted (e.g., red)** so the user can decide what to change. 
  * For now, it’s fine if this is just a placeholder area wired to a dummy value; the key is having the UI ready for AI/infra.

### 5.3 Step timing controls

* [ ] **Make the “+3 days” offsets configurable via dropdowns.**

  * For each email after the initial outreach (`Polite nudge`, `Value-add`, `Final attempt`), replace hard-coded `+3 days` text with:

    * `Send after [dropdown: 1–10] days`
  * Defaults should roughly match the agreed recommendation:

    * Polite nudge: 2 days after initial outreach.
    * Value-add: ~4–5 days after initial outreach.
    * Final attempt: ~7 days after initial outreach. 

### 5.4 Removing “Dry run / QA” dependency

* [ ] **Change the button that previously navigated to Dry run / QA to “Preview campaign”.**

  * On `campaign.html`, the button that used to send users to the Dry run/QA screen should now be labeled **Preview campaign** and stay within this page. 
  * For now, “Preview campaign” can simply scroll the user to a preview section or show a read-only version of the four emails plus metrics on the same page (text-only is fine).
  * No separate Dry run route anymore; see global section above.

### 5.5 Contact / campaign selection on left side

* [ ] **Add a left-side selector to clarify “who/what this sequence is for”.**

  * Left column on Campaign Sequence should show either:

    * A **Campaign library** (list of named campaigns), **or**
    * A list of **contacts** tied to campaigns.
  * Minimum front-end requirement for now:

    * Left column contains a list (even if static) the user can click.
    * When they select an item, the right-hand sequence updates to show the associated messages for that campaign/contact. 
  * Use contact email as the unique identifier under the hood; we explicitly called that out as the safest key. 

---

## 6. Launch Campaign Screen (`launch-campaign.html`)

* [ ] **Campaign name should be editable with a smart default.**

  * Make the “Campaign name” field an editable input field. 
  * Use a **templated default** that reflects how the campaign is built (e.g., date + segment + offer style), but the user can override it.
  * Placeholder example (for copy only; not strict):

    * `2025-11-30 – Top 20 growth-stage SaaS – Personalized video intro` 

* [ ] **Show the number of roles this campaign will hit.**

  * At or near the top, show something like:

    * `This campaign will apply to 20 roles.`
  * This is the dopamine moment (“Come here, honey, look, I applied to 20 roles”), and needs to be visually salient. 

---

## 7. Analytics Screen (`analytics.html`)

* [ ] **KPI label and value changes.**

  * KPIs across the top should be:

    * Total sent
    * Click rate
    * Reply rate
    * **Roles applied** (rename from “Opportunities”).
  * Remove the **Open rate** metric entirely (we don’t want open-tracking pixels that harm deliverability). 
  * For the demo numbers:

    * `Roles applied: 43` (no dollar value, no “pipeline value”). 
    * Reply rate should be an **impressively good** percentage (the transcript mentions 12.7% and then a recap at 22.7% with click rate ~29–30%; use something in that ballpark for static placeholders). 

* [ ] **Remove pipeline dollar amounts.**

  * Delete any `$` amounts associated with “opportunities”; we decided users will not understand what “43 roles at $17,000” means. 

* [ ] **Retain “Deliverability & warmup” section visually.**

  * Keep the bottom “Deliverability / warmup” panel visible; no major UI changes now.
  * This will later hook into backend email warmup infrastructure (ZapMail-like), but front-end should simply show the section with a short description and maybe a stubbed status. 

---

## 8. Decision Makers Screen (`decision-makers.html`)

* [ ] **Add a per-contact time zone field.**

  * In the table/list of decision makers (e.g., `Jane Doe`, `John Smith`), add a **Time zone** column or label per person. 
  * It should be specific to the *person*, not the company, since people at the same company can be in different locations.
  * For now, it’s okay to store/display a string like `America/Chicago`, `PST`, etc; the exact format can be refined when backend hooks scheduling into it.

* [ ] **Ensure “Select contact and research” flow still works.**

  * After adding time zone, verify the UI still supports selecting a contact and navigating to their research details (company research, LinkedIn, etc.).

---

## 9. Give Feedback / Beta Survey (`feedback.html`)

* [ ] **Update the pricing question to the new anchor price.**

  * Change the last question from:

    * `Would you pay $99 a month for this tool? If not, what price point makes sense?`
  * To something like:

    * `Would you pay $499 for this tool? If not, what price point makes sense?` 

* [ ] **Align example answers with the new pricing.**

  * Example response choices / placeholders should reflect the updated price point, e.g.:

    * `Yes – it saves me hours each week.`
    * `No – I’d pay around $200/month instead.` 

* [ ] **Ensure beta-discount messaging is present at the top.**

  * At the top of the survey, keep (or add) copy along the lines of:

    * `Your detailed insights are critical for our beta release. Complete the survey to unlock your 50% early adopter discount.`
    * `RoleFerry beta tester: we need rigorous feedback to justify your discount. Please be specific, critical, and honest.` 

---

## 10. Sanity Pass & Mobile Responsiveness

* [ ] **Responsive behavior on mobile.**

  * Verify that the home/wireframes screen, especially with footprints and new numbering/arrow cues, still makes sense when buttons stack into 2–3 columns on a phone. 
  * Ensure new elements (previous-step arrow, spam highlights, dropdowns, etc.) don’t break layout on small screens.

* [ ] **Consistency check across labels and headings.**

  * Confirm that:

    * Nav labels, page headings, and URLs continue to match conceptually (e.g., `Company research`, `Decision makers`, `Offer creation`, `Campaign`).
    * Any remaining references to `profile.*` in visible copy are only where we truly mean “profile” and not the uploaded resume.

