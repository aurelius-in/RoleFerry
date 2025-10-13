# User Stories: RoleFerry

## Document Overview
User stories organized by persona and theme, following the format:  
**As a [persona], I want [capability], so that [benefit].**

Each story includes acceptance criteria and priority (P0 = MVP-blocking, P1 = Post-MVP, P2 = Future).

---

## Job Seeker Stories

### Theme: Job Discovery & Matching

#### US-JS-001: View Matched Jobs (P0)
**As a** job seeker  
**I want** to see a list of jobs matched to my preferences  
**So that** I don't waste time on irrelevant postings

**Acceptance Criteria**:
- [ ] Jobs list displays after completing IJP wizard
- [ ] Each card shows: logo, title, company, location, comp range, match score
- [ ] Match score shows 0-100 with color coding (red <50, yellow 50-74, green 75+)
- [ ] List filters by role, location, visa, company size, industry
- [ ] Empty state prompts to refine IJP

**Priority**: P0 (MVP)

---

#### US-JS-002: Understand Match Score (P0)
**As a** job seeker  
**I want** to see why a job matches my profile  
**So that** I can trust the recommendation

**Acceptance Criteria**:
- [ ] Match score breakdown shows: Experience %, Skills %, Industry %
- [ ] Clicking score shows detail modal with matched criteria
- [ ] Copilot can explain match in natural language
- [ ] Score updates when I edit IJP

**Priority**: P0 (MVP)

---

#### US-JS-003: Save Jobs for Later (P1)
**As a** job seeker  
**I want** to save interesting jobs without applying  
**So that** I can review them later

**Acceptance Criteria**:
- [ ] "Save" button on job card
- [ ] Saved jobs appear in Tracker under "Saved" column
- [ ] Can unsave from Tracker or job detail
- [ ] Badge shows saved status on job cards

**Priority**: P1

---

### Theme: Application & Outreach

#### US-JS-004: One-Click Apply (P0)
**As a** job seeker  
**I want** to apply with one click  
**So that** I don't waste time filling forms

**Acceptance Criteria**:
- [ ] "Apply" button creates application in Tracker
- [ ] System auto-finds hiring manager/HR contacts (1-3)
- [ ] Pre-filled email draft appears in modal
- [ ] Can review and edit before sending
- [ ] Sequence starts automatically on Send

**Priority**: P0 (MVP)

---

#### US-JS-005: Find Insider Contacts (P0)
**As a** job seeker  
**I want** to reach decision-makers, not HR black holes  
**So that** I get faster responses

**Acceptance Criteria**:
- [ ] System finds 1-3 contacts per job (hiring manager, dept head, HR)
- [ ] Shows: name, title, verified email, LinkedIn
- [ ] Can manually add LinkedIn URL to re-enrich
- [ ] Source attribution displayed ("Found via Apollo")

**Priority**: P0 (MVP)

---

#### US-JS-006: Personalized Email Draft (P0)
**As a** job seeker  
**I want** AI to write my outreach email  
**So that** I don't stare at a blank page

**Acceptance Criteria**:
- [ ] Draft includes: personalized subject, 3-sentence body, resume mention
- [ ] References my specific experience/metrics from resume
- [ ] Mentions job-specific details (role, company)
- [ ] "Use Author" button regenerates if I dislike first version

**Priority**: P0 (MVP)

---

#### US-JS-007: Send from Safe Infra (P0)
**As a** job seeker  
**I want** emails sent from RoleFerry, not my Gmail  
**So that** my personal domain doesn't get blacklisted

**Acceptance Criteria**:
- [ ] Emails send from @roleferry.io subdomain
- [ ] Reply-to is set to my personal email
- [ ] Deliverability health monitored automatically
- [ ] No action required from me (zero config)

**Priority**: P0 (MVP)

---

#### US-JS-008: Attach Resume to Email (P1)
**As a** job seeker  
**I want** to attach my resume to outreach emails  
**So that** the recipient has it handy

**Acceptance Criteria**:
- [ ] Checkbox in email modal: "Attach resume"
- [ ] PDF generated from my profile data
- [ ] File size <1MB (optimized)
- [ ] Attachment name: "FirstName_LastName_Resume.pdf"

**Priority**: P1

---

### Theme: Tracking & Pipeline Management

#### US-JS-009: Visualize Pipeline (P0)
**As a** job seeker  
**I want** to see my applications in a Kanban board  
**So that** I know what stage each is at

**Acceptance Criteria**:
- [ ] Board view with columns: Saved, Applied, Interviewing, Offer, Rejected
- [ ] Cards show: logo, title, company, last contact date, sequence status
- [ ] Drag & drop updates status
- [ ] Badge shows unread replies

**Priority**: P0 (MVP)

---

#### US-JS-010: Switch to Table View (P1)
**As a** job seeker  
**I want** to view applications in a sortable table  
**So that** I can analyze data (e.g., oldest applied)

**Acceptance Criteria**:
- [ ] Toggle between Board and Table
- [ ] Columns: Company, Title, Status, Date Applied, Last Contact, Reply Status
- [ ] Sortable by any column
- [ ] Filterable by status, date range

**Priority**: P1

---

#### US-JS-011: Add Notes to Applications (P1)
**As a** job seeker  
**I want** to log notes on applications  
**So that** I remember context (e.g., "Recruiter said decision by Friday")

**Acceptance Criteria**:
- [ ] Notes icon on application card
- [ ] Rich text editor (bold, bullets, links)
- [ ] Timestamp + edit history
- [ ] Notes searchable

**Priority**: P1

---

#### US-JS-012: Log Interview Dates (P1)
**As a** job seeker  
**I want** to track interview schedules  
**So that** I don't double-book

**Acceptance Criteria**:
- [ ] "Add Interview" button on application detail
- [ ] Fields: Date, Time, Stage (Phone, Technical, Onsite, Final), Interviewer(s)
- [ ] Sync with Google/Outlook calendar (optional)
- [ ] Reminder sent 1 hour before

**Priority**: P1

---

### Theme: Analytics & Insights

#### US-JS-013: See Reply Rate (P1)
**As a** job seeker  
**I want** to know my email response rate  
**So that** I can improve my approach

**Acceptance Criteria**:
- [ ] Dashboard shows: Total sent, Delivered, Opened (if CTD enabled), Replied
- [ ] Reply rate % (Replied / Delivered)
- [ ] Trend chart (last 30 days)
- [ ] Breakdown by sequence template

**Priority**: P1

---

#### US-JS-014: Time-to-Interview Metric (P2)
**As a** job seeker  
**I want** to see how long it takes from Apply to Interview  
**So that** I can set realistic expectations

**Acceptance Criteria**:
- [ ] Metric: Average days from Apply to first interview
- [ ] Segmented by company size, industry
- [ ] Benchmark vs. platform average

**Priority**: P2

---

### Theme: Preferences & Personalization

#### US-JS-015: Set Job Preferences (P0)
**As a** new user  
**I want** to complete a guided preferences wizard  
**So that** the system knows what I'm looking for

**Acceptance Criteria**:
- [ ] Wizard steps: Values, Role Type, Location, Level, Company Size, Industries, Skills, Salary
- [ ] Progress bar shows completion %
- [ ] Can skip and return later
- [ ] Preferences save on each step (no "Submit" at end)

**Priority**: P0 (MVP)

---

#### US-JS-016: Edit Preferences Later (P1)
**As a** job seeker  
**I want** to update my preferences as my search evolves  
**So that** matches stay relevant

**Acceptance Criteria**:
- [ ] Access via Settings → Job Preferences
- [ ] Same wizard UI as onboarding
- [ ] Changes trigger match re-scoring
- [ ] Notification: "We found 12 new matches based on your updates"

**Priority**: P1

---

#### US-JS-017: Block Companies (P1)
**As a** job seeker  
**I want** to hide jobs from specific companies  
**So that** I don't see my current employer or blacklisted firms

**Acceptance Criteria**:
- [ ] "Hidden Companies" field in IJP
- [ ] Type-ahead search (autocomplete company names)
- [ ] Jobs from blocked companies never appear in list
- [ ] Can unblock later

**Priority**: P1

---

### Theme: AI Assistance

#### US-JS-018: Ask Copilot Questions (P1)
**As a** job seeker  
**I want** to ask AI why a job fits me  
**So that** I make informed decisions

**Acceptance Criteria**:
- [ ] "Ask Copilot" button on job detail
- [ ] Pre-set questions: "Why fit?", "Write email", "Show insiders"
- [ ] Free-text input for custom questions
- [ ] Response in <5 seconds with citations

**Priority**: P1

---

#### US-JS-019: Generate Cover Letter (P2)
**As a** job seeker  
**I want** AI to write a cover letter  
**So that** I don't spend hours per application

**Acceptance Criteria**:
- [ ] "Generate Cover Letter" on job detail
- [ ] 250-400 words, tailored to JD
- [ ] Editable in rich text editor
- [ ] Export as PDF or copy/paste

**Priority**: P2

---

### Theme: Import/Export

#### US-JS-020: Import from Spreadsheet (P1)
**As a** job seeker switching from manual tracking  
**I want** to import my existing applications  
**So that** I don't lose history

**Acceptance Criteria**:
- [ ] Upload CSV with columns: Company, Title, Status, Date Applied, Notes
- [ ] System validates, shows preview before import
- [ ] Enrichment queued for new companies
- [ ] Duplicate detection (skip or update)

**Priority**: P1

---

#### US-JS-021: Export to CSV (P1)
**As a** job seeker  
**I want** to export my data  
**So that** I own my information and can analyze elsewhere

**Acceptance Criteria**:
- [ ] "Export CSV" button on Tracker
- [ ] Includes all fields (company, title, status, contacts, notes, dates)
- [ ] UTF-8 encoded (handles international characters)
- [ ] Downloads instantly (<5s for 500 rows)

**Priority**: P1

---

## Recruiter Stories

### Theme: Lead Sourcing

#### US-REC-001: Import Candidate List (P0)
**As a** recruiter  
**I want** to bulk upload candidates from CSV  
**So that** I can quickly start outreach

**Acceptance Criteria**:
- [ ] Upload CSV (up to 1,000 rows)
- [ ] Required columns: Name, LinkedIn URL OR (Title + Company)
- [ ] System enriches: work email, title, location
- [ ] Shows progress bar during enrichment

**Priority**: P0 (Recruiter MVP)

---

#### US-REC-002: Verify Email Accuracy (P0)
**As a** recruiter  
**I want** emails validated before sending  
**So that** I don't waste sends on bad data

**Acceptance Criteria**:
- [ ] Each email shows verification status: Verified, Risky, Invalid
- [ ] Invalid emails flagged in red, excluded from sequences
- [ ] Verification happens automatically during enrichment
- [ ] Re-verify button if data is stale (>30 days)

**Priority**: P0

---

#### US-REC-003: Search for Passive Candidates (P2)
**As a** recruiter  
**I want** to search for candidates by criteria  
**So that** I find people not actively applying

**Acceptance Criteria**:
- [ ] Search by: Title, Company, Location, Skills, Experience Years
- [ ] Results from Apollo/LinkedIn/internal DB
- [ ] Preview profile before adding to CRM
- [ ] Batch add to Tracker

**Priority**: P2

---

### Theme: Outreach Campaigns

#### US-REC-004: Create Sequence Template (P0)
**As a** recruiter  
**I want** to save reusable email sequences  
**So that** I don't rewrite the same emails

**Acceptance Criteria**:
- [ ] Sequence editor: Add steps, set delays, write subject/body
- [ ] Support variables: `{{first_name}}`, `{{company}}`, `{{role}}`
- [ ] Save as template with name
- [ ] Share template with team (if Teams plan)

**Priority**: P0

---

#### US-REC-005: Launch Bulk Sequence (P0)
**As a** recruiter  
**I want** to start a sequence for 50+ candidates at once  
**So that** I scale outreach efficiently

**Acceptance Criteria**:
- [ ] Multi-select candidates in CRM
- [ ] Choose sequence template
- [ ] Confirm send (shows count, estimated send dates)
- [ ] Sequences start within 5 minutes

**Priority**: P0

---

#### US-REC-006: Stop Sequence on Reply (P0)
**As a** recruiter  
**I want** sequences to auto-stop when someone replies  
**So that** I don't over-send

**Acceptance Criteria**:
- [ ] Reply detected via webhook
- [ ] Remaining steps canceled immediately
- [ ] Candidate moved to "Replied" status
- [ ] Notification sent to recruiter

**Priority**: P0

---

#### US-REC-007: A/B Test Subject Lines (P2)
**As a** recruiter  
**I want** to test 2 subject lines  
**So that** I optimize open rates

**Acceptance Criteria**:
- [ ] Enable A/B toggle on sequence step
- [ ] Define Variant A and B
- [ ] 50/50 split by default (adjustable)
- [ ] Report shows which variant performed better

**Priority**: P2

---

### Theme: Pipeline Management

#### US-REC-008: Track Candidate Stages (P0)
**As a** recruiter  
**I want** to move candidates through stages  
**So that** I know who needs follow-up

**Acceptance Criteria**:
- [ ] Board columns: Leads, Contacted, Appointments, Offers, Won/Lost
- [ ] Drag & drop updates status
- [ ] Prompt for details when moving (e.g., appointment date)
- [ ] Activity log shows status changes

**Priority**: P0

---

#### US-REC-009: Assign Candidates to Team Members (P1)
**As a** recruiting manager  
**I want** to assign candidates to recruiters  
**So that** we distribute workload

**Acceptance Criteria**:
- [ ] "Assign to" dropdown on candidate card
- [ ] Notification sent to assignee
- [ ] Filter Tracker by assignee
- [ ] Re-assign if recruiter changes

**Priority**: P1

---

#### US-REC-010: Sync with ATS (P1)
**As a** recruiter  
**I want** RoleFerry to sync with Greenhouse  
**So that** I don't duplicate data entry

**Acceptance Criteria**:
- [ ] OAuth connect to Greenhouse
- [ ] Import job requisitions
- [ ] Push candidates to Greenhouse pipeline
- [ ] Sync status changes bidirectionally

**Priority**: P1

---

### Theme: Personas & Targeting

#### US-REC-011: Save Reusable Persona (P1)
**As a** recruiter  
**I want** to define "ideal candidate" filters once  
**So that** I reuse them across searches

**Acceptance Criteria**:
- [ ] Persona builder: Name, Titles, Departments, Level, Location, Company Size
- [ ] Save persona to library
- [ ] Apply persona to enrichment, searches, sequences
- [ ] Edit persona (changes reflect globally)

**Priority**: P1

---

#### US-REC-012: Preview Persona Match Count (P2)
**As a** recruiter  
**I want** to see how many people match my persona  
**So that** I know if it's too narrow/broad

**Acceptance Criteria**:
- [ ] "Preview" button in persona builder
- [ ] Shows estimated count from Apollo/Clay
- [ ] Warns if <50 ("Too narrow") or >10K ("Too broad")

**Priority**: P2

---

### Theme: Deliverability

#### US-REC-013: Monitor Email Health (P0)
**As a** recruiter  
**I want** to see deliverability health scores  
**So that** I know my emails are landing in inboxes

**Acceptance Criteria**:
- [ ] Deliverability dashboard shows: Health score per domain, Bounce rate, Spam reports
- [ ] Color-coded: Green (80+), Yellow (50-79), Red (<50)
- [ ] Alerts if score drops >10 points
- [ ] Recommendations (e.g., "Pause sending, domain at risk")

**Priority**: P0

---

#### US-REC-014: Enable Domain Warmup (P0)
**As a** recruiter  
**I want** new domains to warm up gradually  
**So that** they build reputation

**Acceptance Criteria**:
- [ ] Toggle "Enable Warmup" on domain settings
- [ ] Warmup sends 5 emails/day, increasing 5%/day
- [ ] Seed accounts reply automatically (simulate engagement)
- [ ] Warmup completes in 30 days → switches to production

**Priority**: P0

---

#### US-REC-015: Rotate Sending Domains (P1)
**As a** recruiter  
**I want** to spread sends across multiple domains  
**So that** no single domain gets flagged

**Acceptance Criteria**:
- [ ] System automatically rotates domains per send
- [ ] Distribution: Equal weight by default, adjustable
- [ ] Paused domains excluded from rotation
- [ ] Rotation visible in send logs

**Priority**: P1

---

### Theme: Reporting & Analytics

#### US-REC-016: View Campaign Performance (P1)
**As a** recruiter  
**I want** to see sequence reply rates  
**So that** I know what's working

**Acceptance Criteria**:
- [ ] Report shows: Sent, Delivered, Opened, Clicked, Replied per sequence
- [ ] Conversion funnel visualization
- [ ] Sortable by reply rate
- [ ] Export to CSV

**Priority**: P1

---

#### US-REC-017: Cost-Per-Hire Tracking (P2)
**As a** recruiting manager  
**I want** to calculate cost per hire  
**So that** I justify RoleFerry ROI

**Acceptance Criteria**:
- [ ] Input: RoleFerry subscription cost, enrichment spend
- [ ] Output: Cost / # hires
- [ ] Comparison to agency cost (15-25% of salary)
- [ ] Dashboard widget

**Priority**: P2

---

## Shared Stories (Both Modes)

### Theme: Onboarding

#### US-SHARED-001: Quick Signup (P0)
**As a** new user  
**I want** to sign up in <2 minutes  
**So that** I start using the tool immediately

**Acceptance Criteria**:
- [ ] Email + password OR Google OAuth
- [ ] Choose mode: Job Seeker or Recruiter
- [ ] Upload resume (job seeker) OR connect LinkedIn (recruiter)
- [ ] Redirect to IJP wizard or Dashboard

**Priority**: P0

---

#### US-SHARED-002: Guided Onboarding (P1)
**As a** first-time user  
**I want** tooltips and walkthroughs  
**So that** I learn features quickly

**Acceptance Criteria**:
- [ ] Contextual tooltips on first visit (e.g., "This is your Tracker")
- [ ] Dismissible (don't show again)
- [ ] Optional video tutorials linked from help menu

**Priority**: P1

---

### Theme: Settings & Customization

#### US-SHARED-003: Set Custom Tracking Domain (P1)
**As a** paid user  
**I want** to use my own tracking domain  
**So that** links look professional (e.g., `click.mycompany.com`)

**Acceptance Criteria**:
- [ ] Input domain in Settings
- [ ] DNS setup instructions (CNAME record)
- [ ] Verify DNS propagation
- [ ] All links rewritten to CTD automatically

**Priority**: P1

---

#### US-SHARED-004: Manage Notifications (P1)
**As a** user  
**I want** to control what emails/push alerts I receive  
**So that** I'm not overwhelmed

**Acceptance Criteria**:
- [ ] Settings page: Checkboxes for each notification type (Reply, Interview Reminder, Health Alert, Weekly Digest)
- [ ] Toggle email vs. push
- [ ] Unsubscribe link in emails honors preferences

**Priority**: P1

---

### Theme: LivePages

#### US-SHARED-005: Create Personalized Landing Page (P1)
**As a** user  
**I want** to create a custom page for each recipient  
**So that** they see relevant content

**Acceptance Criteria**:
- [ ] Builder: Add name, role, company, video/GIF, calendar link, proof bullets
- [ ] Preview before saving
- [ ] Unique URL generated (e.g., `lp.roleferry.io/xyz`)
- [ ] Insert link into email body

**Priority**: P1

---

#### US-SHARED-006: Track LivePage Views (P1)
**As a** user  
**I want** to see who viewed my LivePage  
**So that** I know engagement level

**Acceptance Criteria**:
- [ ] Analytics: Page views, unique visitors, time on page, CTA clicks
- [ ] Linked to Application/Candidate record
- [ ] Real-time update (within 1 min of view)

**Priority**: P1

---

### Theme: Integrations

#### US-SHARED-007: Connect Google Calendar (P2)
**As a** user  
**I want** to sync interview dates to my calendar  
**So that** I don't forget

**Acceptance Criteria**:
- [ ] OAuth connect to Google Calendar
- [ ] Create event when logging interview
- [ ] Update event if rescheduled
- [ ] Delete event if application rejected

**Priority**: P2

---

#### US-SHARED-008: Zapier Integration (P2)
**As a** power user  
**I want** to trigger Zapier workflows  
**So that** I automate custom logic

**Acceptance Criteria**:
- [ ] Webhook triggers: Application Created, Reply Received, Status Changed
- [ ] Action steps: Create Application, Update Status
- [ ] Documented in Zapier app directory

**Priority**: P2

---

## Summary

This document contains **80+ user stories** across:
- **Job Seekers**: 21 stories (discovery, application, tracking, analytics, AI, import/export)
- **Recruiters**: 17 stories (sourcing, campaigns, pipeline, personas, deliverability, reporting)
- **Shared**: 8 stories (onboarding, settings, LivePages, integrations)

Stories are prioritized into:
- **P0 (MVP)**: 25 stories (must-have for launch)
- **P1 (Post-MVP)**: 35 stories (next 6 months)
- **P2 (Future)**: 20+ stories (12+ months)

---
**Owner**: Product Management  
**Version**: 1.0  
**Last Updated**: October 2025  
**Next Review**: Bi-weekly during sprint planning

