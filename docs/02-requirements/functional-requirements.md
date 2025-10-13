# Functional Requirements Specification
## RoleFerry Platform

**Document Type**: Requirements  
**Audience**: Product Managers, Engineers, QA  
**Purpose**: Detailed functional specifications for all features

---

## 1. Document Overview

### 1.1 Scope
This document specifies the functional behavior of RoleFerry platform features across Job Seeker and Recruiter modes, covering:
- User authentication and onboarding
- Job discovery and matching
- Application tracking
- Contact enrichment and outreach
- Deliverability management
- Analytics and reporting

### 1.2 Requirements Format
Each requirement follows the format:
- **ID**: Unique identifier (REQ-XXX-###)
- **Priority**: P0 (MVP), P1 (Post-MVP), P2 (Future)
- **Description**: What the system shall do
- **Acceptance Criteria**: How to verify

---

## 2. Authentication & User Management (REQ-AUTH)

### REQ-AUTH-001: User Registration (P0)
**Description**: System shall allow new users to create accounts via email/password or OAuth (Google, Microsoft).

**Acceptance Criteria**:
- [ ] Registration form collects: email, password, full name
- [ ] Password requirements: min 8 characters, 1 uppercase, 1 number, 1 special char
- [ ] Email verification sent upon signup (verify within 48 hours)
- [ ] OAuth flow redirects to provider, returns to RoleFerry with token
- [ ] Duplicate email returns error: "Email already registered"
- [ ] Successful signup redirects to onboarding (mode selection)

---

### REQ-AUTH-002: Login (P0)
**Description**: System shall authenticate users via email/password or OAuth.

**Acceptance Criteria**:
- [ ] Login form accepts email + password
- [ ] Invalid credentials return error: "Invalid email or password" (no hints)
- [ ] Successful login generates JWT token (15-min expiry) + refresh token (30-day)
- [ ] OAuth login checks if user exists; if not, redirects to signup completion
- [ ] "Remember me" checkbox extends refresh token to 90 days
- [ ] Failed login attempts >5 in 10 minutes triggers CAPTCHA

---

### REQ-AUTH-003: Password Reset (P1)
**Description**: System shall allow users to reset forgotten passwords.

**Acceptance Criteria**:
- [ ] "Forgot password" link on login page
- [ ] User enters email → receives reset link (expires in 1 hour)
- [ ] Reset link redirects to password change form
- [ ] New password must meet complexity requirements
- [ ] Successful reset invalidates old password + all active sessions

---

### REQ-AUTH-004: Mode Selection (P0)
**Description**: System shall allow users to choose Job Seeker or Recruiter mode during onboarding.

**Acceptance Criteria**:
- [ ] Mode selection screen after signup
- [ ] Radio buttons: "I'm looking for a job" / "I'm hiring talent"
- [ ] Selection saved to User.mode (job_seeker | recruiter)
- [ ] Mode determines UI labels, features (e.g., "Applications" vs "Leads")
- [ ] Users can switch modes later in Settings (data preserved)

---

## 3. Onboarding & Profile Setup (REQ-ONBOARD)

### REQ-ONBOARD-001: Resume Upload (P0 - Job Seeker)
**Description**: System shall allow job seekers to upload resume for AI parsing.

**Acceptance Criteria**:
- [ ] Upload accepts PDF, DOCX (max 5MB)
- [ ] AI extraction populates: roles, tenure, skills, accomplishments, metrics
- [ ] Extracted data displayed for user review/edit
- [ ] Resume PDF stored in S3 (private, signed URL for download)
- [ ] User can re-upload to replace resume

---

### REQ-ONBOARD-002: IJP Wizard (P0 - Job Seeker)
**Description**: System shall guide job seekers through Intent & Job Preferences setup.

**Acceptance Criteria**:
- [ ] Wizard steps: Values → Role Type → Location → Level → Company Size → Industries → Skills → Salary
- [ ] Progress bar shows completion %
- [ ] Each step saves automatically (no "Submit" at end)
- [ ] User can skip optional fields (Skills, Salary)
- [ ] "Save & Continue" navigates to next step
- [ ] Completion redirects to Jobs List

**Field Validations**:
- **Values**: Pick 3 from preset list
- **Location**: Multi-select + "Remote OK" checkbox
- **Salary**: Numeric, optional
- **Industries**: Multi-select from taxonomy

---

### REQ-ONBOARD-003: LinkedIn Import (P1 - Recruiter)
**Description**: System shall allow recruiters to import candidate leads from LinkedIn.

**Acceptance Criteria**:
- [ ] "Import from LinkedIn" button (OAuth connect)
- [ ] User authorizes LinkedIn access
- [ ] System fetches connections, saved candidates (LinkedIn API limits apply)
- [ ] Displayed in preview table (name, title, company)
- [ ] User selects candidates to import → creates Lead records

---

## 4. Job Discovery & Matching (REQ-JOBS)

### REQ-JOBS-001: Job List Display (P0)
**Description**: System shall display jobs matched to user's IJP preferences.

**Acceptance Criteria**:
- [ ] Jobs list shows after IJP completion
- [ ] Each card displays: logo, title, company, location, comp range (if available), match score
- [ ] Match score: 0-100, color-coded (red <50, yellow 50-74, green 75+)
- [ ] Jobs sorted by match score descending (default)
- [ ] Pagination: 20 jobs per page
- [ ] Loading state (skeleton cards) during fetch

---

### REQ-JOBS-002: Job Filters (P0)
**Description**: System shall allow users to filter jobs by criteria.

**Acceptance Criteria**:
- [ ] Filters: Role (text search), Location (multi-select), Remote (checkbox), Visa (checkbox), Company Size, Industry, Salary Range
- [ ] Filters applied via API query params (real-time update, no page reload)
- [ ] Active filters displayed as removable chips
- [ ] "Clear all filters" button resets to IJP defaults
- [ ] Filter state persists in URL (shareable link)

---

### REQ-JOBS-003: Job Detail View (P0)
**Description**: System shall display full job details on click.

**Acceptance Criteria**:
- [ ] Clicking job card navigates to /jobs/{id}
- [ ] Tabs: Overview, Company
- [ ] **Overview tab**: Full JD, extracted keywords (tags), posted date, "Apply" button
- [ ] **Company tab**: Logo, industry, size, funding, Glassdoor rating (if available), social links
- [ ] "Back to Jobs" navigation
- [ ] "Save" and "Apply" buttons fixed at bottom

---

### REQ-JOBS-004: Match Score Breakdown (P0)
**Description**: System shall explain match score calculation.

**Acceptance Criteria**:
- [ ] Clicking match score shows modal
- [ ] Breakdown: Experience X%, Skills Y%, Industry Z%
- [ ] Each category shows matched criteria (e.g., "Your 5 years PM experience matches 'Senior PM' role")
- [ ] Copilot can expand explanation (natural language)

---

## 5. Application Tracking (REQ-TRACKER)

### REQ-TRACKER-001: Create Application (P0)
**Description**: System shall create application record when user clicks "Apply".

**Acceptance Criteria**:
- [ ] "Apply" button on job detail/card
- [ ] Clicking creates Application record (user_id, job_id, status="applied", timestamp)
- [ ] Application appears in Tracker immediately
- [ ] Duplicate apply (same user + job) shows warning: "You already applied to this job"
- [ ] Enrichment job queued automatically

---

### REQ-TRACKER-002: Board View (P0)
**Description**: System shall display applications in Kanban board.

**Acceptance Criteria**:
- [ ] Columns (Job Seeker): Saved, Applied, Interviewing, Offer, Rejected
- [ ] Columns (Recruiter): Leads, Contacted, Appointments, Offers, Won/Lost
- [ ] Cards show: logo, title, company, last contact date, sequence status badge
- [ ] Drag & drop updates status (optimistic UI, API call on drop)
- [ ] Cards sortable within column (manual reorder)
- [ ] Empty columns show "No applications" placeholder

---

### REQ-TRACKER-003: Table View (P1)
**Description**: System shall provide table view of applications.

**Acceptance Criteria**:
- [ ] Toggle button: Board ↔ Table
- [ ] Columns: Company, Title, Status, Date Applied, Last Contact, Reply Status, Match Score
- [ ] Sortable by any column (click header)
- [ ] Filterable: text search (company/title), status dropdown, date range picker
- [ ] Pagination: 50 rows per page
- [ ] Row click opens application detail

---

### REQ-TRACKER-004: Application Detail (P1)
**Description**: System shall display detailed application information.

**Acceptance Criteria**:
- [ ] Modal or sidebar (clicking card/row)
- [ ] Sections: Job Info, Contacts, Outreach History, Notes, Interviews
- [ ] **Job Info**: Title, company, link to job detail
- [ ] **Contacts**: List of enriched contacts (name, title, email, LinkedIn, "Contact" button)
- [ ] **Outreach History**: Timeline (sent, delivered, opened, clicked, replied)
- [ ] **Notes**: Rich text editor (bold, bullets, links), save button
- [ ] **Interviews**: Add interview (date, time, stage, interviewer), calendar sync

---

### REQ-TRACKER-005: CSV Import (P1)
**Description**: System shall allow bulk import of applications via CSV.

**Acceptance Criteria**:
- [ ] "Import CSV" button on Tracker
- [ ] Upload modal with template download link
- [ ] Required columns: Company, Title; Optional: Status, Date Applied, Notes
- [ ] Preview table shows parsed data (first 10 rows)
- [ ] Validation: missing required fields → error highlights
- [ ] Duplicate detection (same company + title) → skip or update (user choice)
- [ ] Import creates Application records + enrichment jobs
- [ ] Summary: "25 imported, 3 duplicates skipped, 2 errors"

---

### REQ-TRACKER-006: CSV Export (P1)
**Description**: System shall allow export of applications to CSV.

**Acceptance Criteria**:
- [ ] "Export CSV" button on Tracker
- [ ] Exports current view (respects filters)
- [ ] Columns: Company, Title, Status, Date Applied, Last Contact, Reply Status, Notes
- [ ] UTF-8 encoding (handles international characters)
- [ ] File name: roleferry_applications_YYYY-MM-DD.csv
- [ ] Download triggers instantly (<5s for 500 rows)

---

## 6. Enrichment & Contact Discovery (REQ-ENRICH)

### REQ-ENRICH-001: Auto-Enrichment on Apply (P0)
**Description**: System shall automatically find contacts when user applies to job.

**Acceptance Criteria**:
- [ ] Applying to job triggers enrichment job (Celery queue)
- [ ] Enrichment steps: Company domain → Find people → Email discovery → Verification
- [ ] Completion <30 seconds (P95)
- [ ] Results: 1-3 verified contacts saved
- [ ] User notification: "2 contacts found for Acme Corp"
- [ ] If no contacts found: "No contacts found. Add manually or try later."

---

### REQ-ENRICH-002: Manual Contact Addition (P1)
**Description**: System shall allow users to manually add contacts (e.g., from LinkedIn stalking).

**Acceptance Criteria**:
- [ ] "Add Contact" button on application detail
- [ ] Form: Name, Title, Email, LinkedIn URL
- [ ] Email validation: format check, optional verification
- [ ] LinkedIn URL triggers enrichment (fetch title, company)
- [ ] Contact added to application's contact list

---

### REQ-ENRICH-003: Persona Filters (P1)
**Description**: System shall apply persona filters to contact discovery.

**Acceptance Criteria**:
- [ ] Default persona (job seeker): Hiring Manager, Head of Dept, HR
- [ ] Default persona (recruiter): User-defined (via Persona Builder)
- [ ] Filters: Job titles, seniority (VP, Director, Manager), location, department
- [ ] Persona selection in enrichment settings (per application or global)
- [ ] Contact results ranked by persona match (VP > Director > Manager)

---

### REQ-ENRICH-004: Email Verification (P0)
**Description**: System shall verify email deliverability before sending.

**Acceptance Criteria**:
- [ ] Verification via NeverBounce or ZeroBounce
- [ ] Statuses: Valid (0.95 confidence), Risky (0.70-0.94), Invalid (<0.70), Unknown
- [ ] Invalid emails excluded from sequences
- [ ] Risky emails included with warning badge
- [ ] Re-verification available (manual trigger, or auto after 30 days)

---

## 7. Outreach Sequences (REQ-SEQ)

### REQ-SEQ-001: Start Sequence (P0)
**Description**: System shall launch email sequence after enrichment.

**Acceptance Criteria**:
- [ ] Sequence auto-starts after contacts found (default behavior)
- [ ] User can review draft before sending (modal: subject, body, contacts)
- [ ] "Use Author" button regenerates draft (AI)
- [ ] "Send" button queues sequence (confirmation: "Sequence started")
- [ ] Sequence appears in Tracker with status badge ("Step 1 sent")

---

### REQ-SEQ-002: Multi-Step Sequences (P0)
**Description**: System shall support sequences with delays between steps.

**Acceptance Criteria**:
- [ ] Sequence template defines steps: Step 1 (delay: 0), Step 2 (delay: 2 days), Step 3 (delay: 3 days)
- [ ] Delays calculated from previous step's delivery (not send time)
- [ ] Queued steps visible in application detail ("Step 2 scheduled for Oct 15")
- [ ] Stop-on-reply: If contact replies, cancel future steps
- [ ] Manual stop: User can pause/cancel sequence

---

### REQ-SEQ-003: Variable Substitution (P0)
**Description**: System shall substitute variables in email templates.

**Acceptance Criteria**:
- [ ] Supported variables: `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{role}}`, `{{my_name}}`, custom (from resume)
- [ ] Substitution happens at send time (not template edit)
- [ ] Missing variables replaced with fallback (e.g., {{first_name}} → "there")
- [ ] Preview shows substituted version
- [ ] Custom variables: User can define (e.g., {{my_metric}} → "30% faster time-to-hire")

---

### REQ-SEQ-004: Sequence Templates (P1)
**Description**: System shall provide and allow creation of sequence templates.

**Acceptance Criteria**:
- [ ] Platform templates: "Job Seeker Default", "Recruiter Cold Intro", "Agency Outreach"
- [ ] User can create custom templates (saved to library)
- [ ] Template editor: Add/remove steps, edit subject/body, set delays
- [ ] Templates support variables
- [ ] Templates shareable (Team plan: team library)

---

### REQ-SEQ-005: A/B Testing (P2)
**Description**: System shall allow A/B testing of subject lines.

**Acceptance Criteria**:
- [ ] Enable A/B on sequence step
- [ ] Define Variant A and B (subject lines)
- [ ] Split: 50/50 default, adjustable (e.g., 70/30)
- [ ] Results report: Open rate (if CTD enabled), reply rate per variant
- [ ] Winner: Variant with higher reply rate after 100 sends

---

## 8. Deliverability (REQ-DELIVER)

### REQ-DELIVER-001: Managed Sending Domains (P0)
**Description**: System shall send emails from RoleFerry-owned domains, not user's personal email.

**Acceptance Criteria**:
- [ ] Outreach sends from mailboxes like auto1@rf-send-01.com
- [ ] Reply-to header set to user's email
- [ ] User never sees mailbox details (abstracted)
- [ ] Domain rotation: System selects healthy mailbox per send

---

### REQ-DELIVER-002: Health Monitoring (P0)
**Description**: System shall monitor deliverability health per mailbox.

**Acceptance Criteria**:
- [ ] Health score: 0-100 (calculated every 6 hours)
- [ ] Factors: Bounce rate, spam reports, send volume, warmup age
- [ ] Thresholds: >90 (Excellent), 70-89 (Good), 50-69 (Fair), <50 (Poor)
- [ ] Poor health (<50) auto-pauses mailbox
- [ ] Alert sent to ops team when health drops >10 points in 24 hours

---

### REQ-DELIVER-003: Throttling (P0)
**Description**: System shall enforce daily send caps per mailbox.

**Acceptance Criteria**:
- [ ] Default cap: 50 emails/day per mailbox
- [ ] Cap enforced: Sends beyond cap queued for next day
- [ ] Counter resets at midnight UTC
- [ ] Mailbox rotation: If Mailbox A hits cap, use Mailbox B
- [ ] User notification if all mailboxes capped: "Sending paused; will resume tomorrow"

---

### REQ-DELIVER-004: Warmup Protocol (P0)
**Description**: System shall gradually warm up new sending domains.

**Acceptance Criteria**:
- [ ] New mailbox: Status="warmup", daily cap=5
- [ ] Schedule: Day 1-3 (5/day), Day 4-7 (10/day), Day 8-14 (20/day), Day 15-30 (increase 10%/day to 50)
- [ ] Warmup sends to seed accounts (internal RoleFerry emails, auto-reply enabled)
- [ ] After 30 days: Status="active", joins production pool
- [ ] Ops dashboard shows warmup progress per domain

---

### REQ-DELIVER-005: Custom Tracking Domain (P1)
**Description**: System shall allow users to set up custom tracking domains for link safety.

**Acceptance Criteria**:
- [ ] Settings → Deliverability → "Custom Tracking Domain"
- [ ] Setup wizard: Enter domain (e.g., click.mycompany.com), add DNS records (CNAME), verify
- [ ] Verification: System checks DNS propagation (retry every 5 min, 24-hour timeout)
- [ ] Enabled: All links in sequences rewritten to CTD (e.g., linkedin.com/in/X → click.mycompany.com/abc → redirects)
- [ ] Analytics: Click tracking logged, visible in application detail

---

## 9. AI Features (REQ-AI)

### REQ-AI-001: Match Scoring (P0)
**Description**: System shall calculate job-to-user match score using ML.

**Acceptance Criteria**:
- [ ] Score: 0-100 (0-49 Low, 50-74 Fair, 75-89 Strong, 90+ Excellent)
- [ ] Breakdown: Experience %, Skills %, Industry %
- [ ] Model inputs: User IJP, resume extract, job title/JD, company metadata
- [ ] Scores cached (24-hour TTL)
- [ ] Re-scoring triggered on IJP change

---

### REQ-AI-002: Draft Generation (P0)
**Description**: System shall generate personalized email drafts using LLM.

**Acceptance Criteria**:
- [ ] Inputs: User resume (roles, metrics), job title/company, contact name/title
- [ ] Output: Subject (1 line) + Body (3-5 sentences) + LivePage link (optional)
- [ ] Tone: Professional but conversational (avoid overly formal)
- [ ] Variables pre-filled: {{first_name}}, {{company}}, {{role}}
- [ ] Regenerate button: New draft if user dislikes first version
- [ ] Generation time: <5 seconds (P95)

---

### REQ-AI-003: Copilot Q&A (P1)
**Description**: System shall provide context-aware AI assistant (Copilot).

**Acceptance Criteria**:
- [ ] Copilot panel (right rail, persistent)
- [ ] Context: Current page (job detail, application detail, tracker)
- [ ] Preset questions: "Why is this a fit?", "Write an email", "Show insiders"
- [ ] Custom questions: Free text input
- [ ] Responses: Streaming (real-time), <5s first token
- [ ] Citations: Copilot references user resume, job JD (e.g., "Based on your 5 years as PM...")

---

### REQ-AI-004: Resume Parsing (P0)
**Description**: System shall extract structured data from resume PDFs.

**Acceptance Criteria**:
- [ ] Upload PDF/DOCX → AI extraction
- [ ] Extracted fields: roles[], tenure[], key_metrics[], accomplishments[], skills[]
- [ ] Display extracted data for user review/edit
- [ ] Editable inline (click to edit)
- [ ] Re-parse button if extraction poor
- [ ] Parsing time: <10 seconds

---

## 10. Analytics & Reporting (REQ-ANALYTICS)

### REQ-ANALYTICS-001: Dashboard KPIs (P1)
**Description**: System shall display key metrics on dashboard.

**Acceptance Criteria**:
- [ ] Metrics: Total applications, Reply rate, Interviews scheduled, Offers received, Avg match score
- [ ] Time filters: Last 7 days, 30 days, 90 days, All time
- [ ] Comparison: vs. previous period (e.g., "+12% from last month")
- [ ] Visualizations: Line charts (trend), bar charts (status breakdown)

---

### REQ-ANALYTICS-002: Sequence Performance (P1)
**Description**: System shall report on sequence effectiveness.

**Acceptance Criteria**:
- [ ] Report: Sequence name, Sent, Delivered, Opened (if CTD), Clicked, Replied
- [ ] Reply rate % (Replied / Delivered)
- [ ] Sortable by reply rate
- [ ] Filter by date range
- [ ] Export to CSV

---

### REQ-ANALYTICS-003: Time-to-Interview (P2)
**Description**: System shall calculate average days from Apply to first interview.

**Acceptance Criteria**:
- [ ] Metric: Median days (Applied status → Interviewing status)
- [ ] Segmentation: By company size, industry, role level
- [ ] Benchmark: Platform average (anonymized)
- [ ] Display on dashboard ("Your avg: 12 days; Platform avg: 18 days")

---

## 11. Settings & Preferences (REQ-SETTINGS)

### REQ-SETTINGS-001: Edit Profile (P1)
**Description**: System shall allow users to update profile information.

**Acceptance Criteria**:
- [ ] Settings → Profile
- [ ] Editable: Name, email, password, resume
- [ ] Email change requires verification (send code to new email)
- [ ] Password change requires current password
- [ ] Avatar upload (optional, 5MB max, JPG/PNG)

---

### REQ-SETTINGS-002: Notification Preferences (P1)
**Description**: System shall allow users to control notifications.

**Acceptance Criteria**:
- [ ] Settings → Notifications
- [ ] Checkboxes: Reply received, Interview reminder, Health alert, Weekly digest
- [ ] Toggle: Email vs. Push (if mobile app)
- [ ] Unsubscribe link in emails honors preferences

---

### REQ-SETTINGS-003: Switch Mode (P1)
**Description**: System shall allow users to switch between Job Seeker and Recruiter modes.

**Acceptance Criteria**:
- [ ] Settings → Mode
- [ ] Radio buttons: Job Seeker / Recruiter
- [ ] Confirmation modal: "Switching will change UI labels and features. Continue?"
- [ ] Data preserved (applications, contacts, sequences)
- [ ] UI updates immediately (column names, terminology)

---

### REQ-SETTINGS-004: Delete Account (P1)
**Description**: System shall allow users to permanently delete accounts (GDPR).

**Acceptance Criteria**:
- [ ] Settings → Account → "Delete Account"
- [ ] Confirmation: "This is permanent. All data will be deleted within 30 days."
- [ ] Password re-entry required
- [ ] Deletion process: Stop sequences, anonymize data, delete PII
- [ ] Email confirmation: "Your account has been deleted"

---

## 12. Team Features (REQ-TEAM) - Recruiter Mode

### REQ-TEAM-001: Team Workspaces (P1)
**Description**: System shall support multiple users in shared workspace (Teams plan).

**Acceptance Criteria**:
- [ ] Workspace creation: Admin invites users (email)
- [ ] Roles: Admin (full access), Member (read/write), Viewer (read-only)
- [ ] Shared resources: Leads, sequences, personas, templates
- [ ] Activity log: Who did what (audit trail)

---

### REQ-TEAM-002: Lead Assignment (P1)
**Description**: System shall allow assigning leads to team members.

**Acceptance Criteria**:
- [ ] "Assign to" dropdown on lead card/detail
- [ ] Assignee receives notification
- [ ] Filter tracker by assignee
- [ ] Reassignment updates assignee, logs activity

---

## 13. Acceptance Testing

### 13.1 Test Coverage
- [ ] Unit tests: 80% code coverage (backend services)
- [ ] Integration tests: All API endpoints
- [ ] E2E tests: Critical flows (signup → apply → track)
- [ ] Performance tests: API P95 <500ms, enrichment <30s

### 13.2 User Acceptance Testing (UAT)
- [ ] Beta users test all P0 features
- [ ] Feedback collected via in-app surveys
- [ ] Bug reports triaged (P0 = blocker, P1 = fix pre-launch, P2 = backlog)

---

## 14. Non-Functional Requirements

### 14.1 Performance
- **REQ-NFR-001**: API response time P95 <500ms
- **REQ-NFR-002**: Enrichment completion P95 <30s
- **REQ-NFR-003**: Email send queuing <5 minutes

### 14.2 Scalability
- **REQ-NFR-004**: Support 10K concurrent users
- **REQ-NFR-005**: Handle 10K enrichments/day
- **REQ-NFR-006**: Send 100K emails/day

### 14.3 Security
- **REQ-NFR-007**: All traffic HTTPS (TLS 1.3)
- **REQ-NFR-008**: Passwords hashed (bcrypt)
- **REQ-NFR-009**: PII encrypted at rest (AES-256)

### 14.4 Availability
- **REQ-NFR-010**: 99.5% uptime SLA (paid users)
- **REQ-NFR-011**: <15-minute recovery time (database failover)

---

**Document Owner**: Product Management  
**Reviewed By**: Engineering, QA, Design  
**Version**: 1.0  
**Date**: October 2025  
**Status**: Approved for Development

