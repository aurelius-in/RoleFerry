# Week 7 Takeaways – RoleFerry App (Expanded for Cursor Intent)

## 1. Signals Engine
The standalone Signals step is too context-free at the start of the workflow. Users don't know their role, preferences, or target target companies yet, so results feel ambiguous.
**Intent:** Fold Signals into the **Company Research** page so Signals are evaluated *with company context*, making them actionable.

## 2. Step Ordering and Naming
Naming was inconsistent across pages and buttons, which breaks flow and confuses Cursor AI.
**Intent:** Align steps to reflect natural user journey and eliminate redundant pages.
New order:
1. Job Preferences
2. Your Profile
3. Job Descriptions
4. Job Tracker
5. Pain Point Match
6. Company Research (with Signals)
7. Decision Makers
8. Offer Creation (merged with Compose)
9. Campaign Sequence
10. Dry Run / QA
11. Launch
12. Analytics
13. Feedback

Rename pages so headings match button names. Cursor relies on this consistency.

## 3. Job Preferences Page
### Role Categories
List was too narrow.
**Intent:** Be inclusive while highlighting core niches.
Add categories: technology, engineering, product, program, project, cybersecurity, UX/UI, AI/ML, data, sales/GTM, finance, RevOps, recruiters, etc.

### Role Type
Currently incomplete.
**Intent:** Users self-identify level; affects email tone and job matching.
Add: entry-level, senior, principal/technical leader.

### Company Size
**Intent:** Keep focus on realistic employers for people impacted by big-company layoffs.
Use: 0–10, 11–50, 51–200, 200–1000, 1000–5000, 5000+.

### Skills
Fixed list was unmaintainable.
**Intent:** Free text with autocomplete ensures flexibility and scalability.

### Industries
Too sparse.
**Intent:** Expand to 10x to provide legitimacy and match actual background diversity.

## 4. Your Profile Page
Extraction misses Dave’s five-aspect system.
**Intent:** Resume becomes the user's “source of truth” for variables and matching.
Required sections:
- Key metrics
- Business challenges solved
- Notable accomplishments
- Positions held
- Length of tenure
- Years of experience
- Education
- Certifications
- Skills (free text)

Variables extracted here feed Pain Point Match and Offer Creation.

## 5. Pain Point Match
Currently too generic.
**Intent:** Create side-by-side mapping between job pain points and candidate solutions.
Pull responsibilities + qualifications from JD → treat as “challenges.”
Resume metrics + accomplishments → “solutions” and “proof.”

## 6. Company Research
Multiple inconsistent names.
**Intent:** Combine Signals, company briefing, news, culture notes, challenges, and industry context into one research hub.

## 7. Decision Makers Page
Previously called Find Contact.
**Intent:** Provide high-quality personalization inputs for outreach.
Add LinkedIn URL input.
Extract at least 3 interesting facts (posts, patterns, tone, achievements).
Expose variables: name, title, company, facts.

## 8. Offer Creation (Merged with Compose)
Two pages performed the same function.
**Intent:** Centralize email building so variable injection is cleaner.
Tone options updated:
- Replace Enterprise → Flattery
- Replace Manager → Mentorship

Offer Creation becomes the master builder; variable sidebar included.

## 9. Campaign Sequence
Campaign lacked clarity.
**Intent:** Represent a 3–4 email outbound sequence with clear edits.
Steps:
1. Intro
2. Polite Nudge
3. Value Add
4. Final Attempt

Add pencil edit icon to each email.
Remove variable list — handled in Offer Creation.

## 10. Job Tracker
Was buried and missing actions.
**Intent:** Make job tracking a core feature.
Columns: Saved, Applied, Interviewing, Offer, Rejected
Each card gets a “Move to Next Stage” button.
Rename Wish List → Saved.

## 11. Analytics Page
Intent: Mimic Instantly-style analytics for clarity and trust.
Include:
- Total sent
- Open rate
- Click rate
- Reply rate
- Positive reply rate
- Step analytics (per email)

Keep option to integrate Instantly API later.

## 12. Launch Screen
Intent: Simple transition to active job search. Avoid gimmicks.

## 13. Feedback Page
Intent: Get actionable data from early users.
Weekly survey for discount.
Ask detailed screen-by-screen questions.

## 14. Pricing Model
Intent: Small, premium cohort at first.
Plan: 20 clients @ $250/mo = $5k MRR.
Split 50/50 but reinvest part for growth.

## 15. Immigration Eligibility
Intent: Avoid high-friction cases.
Only accept US citizens or green card holders.

## 16. Product Philosophy
Intent: High-touch, high-quality, intelligent job search companion.
Avoid “AI slop.”
Scale Dave’s proprietary system thoughtfully with personalization at the core.
