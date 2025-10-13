# Use Cases: RoleFerry

## Document Overview
This document catalogs the primary use cases for RoleFerry across both Job Seeker and Recruiter modes. Each use case includes actors, preconditions, main flow, alternate flows, and success criteria.

---

## Job Seeker Use Cases

### UC-JS-001: Discover Matched Jobs

**Actor**: Job Seeker (active or passive)

**Preconditions**:
- User has completed IJP (Intent & Job Preferences) wizard
- User profile includes resume data

**Main Flow**:
1. User navigates to Jobs List screen
2. System displays jobs filtered by IJP criteria
3. Each job card shows: logo, title, company, location, comp band, match score
4. User applies filters (role, location, visa, company size, industry)
5. User clicks on a job card to view Job Detail
6. System displays JD, company info, match breakdown

**Alternate Flows**:
- **3a**: If no matches found, system prompts user to refine IJP
- **4a**: User saves job to Tracker without applying
- **6a**: User asks Copilot "Why is this a fit for me?"

**Success Criteria**:
- Match score accurately reflects user profile (validated via user feedback)
- Job list loads <2 seconds
- Filters update results instantly

---

### UC-JS-002: One-Click Apply with Insider Outreach

**Actor**: Job Seeker

**Preconditions**:
- User is viewing Job Detail
- Job has associated company domain

**Main Flow**:
1. User clicks **Apply** button on Job Detail
2. System creates Application record in Tracker (status: Applied)
3. System triggers enrichment job:
   - Fetches company domain via Clearbit/Google
   - Queries Apollo/Clay for people at company matching persona (hiring manager, HR, dept head)
   - Runs email waterfall (Apollo → Hunter → Snov.io)
   - Verifies emails via NeverBounce/ZeroBounce
4. System returns 1-3 verified contacts
5. System displays "Connect via Email" modal with pre-filled message:
   - **To**: Top contact(s)
   - **Subject**: Personalized ask
   - **Body**: Generated from resume + JD + LivePage link
6. User reviews, optionally edits, clicks **Send**
7. System queues sequence from RoleFerry domain pool
8. User sees confirmation; Tracker row updated with sequence status

**Alternate Flows**:
- **4a**: No contacts found → User manually adds LinkedIn URL → System re-enriches
- **4b**: Low-confidence emails → System prompts to "Find Connections" manually
- **6a**: User clicks "Use Author" to regenerate draft
- **6b**: User selects alternate sequence template
- **7a**: Domain pool exhausted → System queues send for next available slot

**Success Criteria**:
- Contact discovery completes <30 seconds
- Email verification accuracy >90%
- Draft quality passes manual review 80% of time (user doesn't heavily edit)
- Sequence starts within 5 minutes of Send click

---

### UC-JS-003: Track Application Pipeline

**Actor**: Job Seeker

**Preconditions**:
- User has applied to 1+ jobs

**Main Flow**:
1. User navigates to Tracker screen
2. System displays applications in Board view (columns: Saved, Applied, Interviewing, Offer, Rejected)
3. User drags application card to new column (e.g., Applied → Interviewing)
4. System updates status, logs timestamp
5. User clicks card to view details:
   - Job info
   - Contacts reached
   - Outreach history (sent, opened, clicked, replied)
   - Notes
6. User switches to Table view
7. System displays sortable/filterable table

**Alternate Flows**:
- **2a**: User selects Recruiter mode → columns change to Leads, Contacted, Appointments, Offers, Won/Lost
- **3a**: User adds notes, interview dates, or uploads offer letter
- **5a**: User clicks **Add Manual Application** → imports from CSV or manual entry
- **6a**: User clicks **Insights** → views analytics (reply rate, time-to-interview)

**Success Criteria**:
- Drag-and-drop updates status without page reload
- Table view supports sorting by any column
- Notes/dates persist across sessions

---

### UC-JS-004: Manage Replies and Follow-Ups

**Actor**: Job Seeker

**Preconditions**:
- User has sent outreach sequences
- At least one recipient replied

**Main Flow**:
1. System detects inbound reply via webhook (Mailgun, SendGrid)
2. System:
   - Stops sequence for that contact
   - Parses reply sentiment (positive/neutral/negative)
   - Updates Application status (e.g., Applied → Interviewing if positive)
3. User receives push notification / email alert
4. User navigates to Tracker, sees "Reply" badge on application
5. User clicks to view reply thread
6. User responds via RoleFerry interface or external email client
7. System logs response in outreach history

**Alternate Flows**:
- **2a**: Reply is out-of-office → System does NOT stop sequence
- **2b**: Reply is "not interested" → System moves to Rejected, suppresses future sends
- **6a**: User schedules follow-up task (e.g., "Call on Friday")

**Success Criteria**:
- Reply detection latency <5 minutes
- Sentiment classification accuracy >80%
- Sequence stops within 1 hour of reply receipt

---

### UC-JS-005: Export/Import Applications (CSV)

**Actor**: Job Seeker

**Preconditions**:
- User has existing applications OR external spreadsheet

**Main Flow (Export)**:
1. User navigates to Tracker
2. User clicks **Export CSV** button
3. System generates CSV with columns: Company, Title, Status, Date Applied, Last Contact, Reply Status, Notes
4. Browser downloads file (UTF-8 encoded)

**Main Flow (Import)**:
1. User clicks **Import CSV** button
2. User selects CSV file (required columns: Company, Title)
3. System:
   - Parses file
   - Validates required fields
   - Creates Application records
   - Queues enrichment for new companies
4. System displays summary: "25 applications imported, 3 duplicates skipped"

**Alternate Flows**:
- **Import-3a**: CSV has errors (missing columns, invalid dates) → System shows error report
- **Export-3a**: User selects subset of applications (filtered by status) → Exports only those

**Success Criteria**:
- Export completes <5 seconds for 500 applications
- Import handles 1,000 rows without timeout
- Round-trip (export → edit → import) preserves data integrity

---

### UC-JS-006: Refine Job Preferences (IJP)

**Actor**: Job Seeker

**Preconditions**:
- User has completed initial onboarding

**Main Flow**:
1. User navigates to Settings → Job Preferences
2. System displays current IJP settings in wizard format
3. User edits:
   - Values (pick 3)
   - Role Type (full-time, contract, etc.)
   - Location (multi-select + Remote toggle)
   - Role Level (IC, manager, director, VP, C-suite)
   - Company Size (startup, mid-market, enterprise)
   - Industries
   - Skills (optional tags)
   - Hidden Companies (block list)
   - Minimum Salary
4. User clicks **Save**
5. System re-scores all jobs in database against new preferences
6. User returns to Jobs List; sees updated matches

**Alternate Flows**:
- **3a**: User marks "Open to any location" → disables location filter
- **4a**: User clicks **Reset to Defaults**
- **5a**: Re-scoring takes >10 seconds → System shows progress indicator

**Success Criteria**:
- Changes reflect immediately in Jobs List
- Match scores recalculated within 30 seconds
- Settings persist across devices (cloud-synced)

---

### UC-JS-007: Use AI Copilot for Insights

**Actor**: Job Seeker

**Preconditions**:
- User is viewing Job Detail or Tracker

**Main Flow**:
1. User clicks **Ask Copilot** in right rail
2. User types or selects preset question:
   - "Why is this a fit for me?"
   - "Write a 1-paragraph email to a hiring manager"
   - "Show potential insiders to email"
3. System:
   - Retrieves context (resume, JD, company info)
   - Calls LLM API (Anthropic, OpenAI)
   - Streams response in real-time
4. Copilot displays answer with citations (e.g., "Based on your experience with [X]")
5. User clicks **Use This** (if Copilot generated draft)
6. System inserts draft into email modal

**Alternate Flows**:
- **2a**: Copilot suggests related questions ("Would you like me to...")
- **3a**: LLM API timeout → System retries with fallback model
- **5a**: User asks follow-up question → Maintains conversation context

**Success Criteria**:
- Response latency <5 seconds (first token <2s)
- Draft quality meets "human-written" bar (90% approval in user testing)
- Context window includes last 3 Q&A exchanges

---

## Recruiter Use Cases

### UC-REC-001: Import and Enrich Candidate List

**Actor**: Recruiter

**Preconditions**:
- Recruiter mode enabled
- CSV file with leads (names, titles, companies, LinkedIn URLs)

**Main Flow**:
1. Recruiter navigates to CRM screen
2. Recruiter clicks **Import Leads**
3. Recruiter uploads CSV (up to 1,000 rows)
4. System:
   - Parses file
   - Validates columns
   - Triggers enrichment for each row:
     - Company domain lookup
     - Work email waterfall
     - LinkedIn profile enrichment (title, location, tenure)
5. System displays progress: "Enriching 250/500 contacts..."
6. Enrichment completes; Recruiter sees grid with verified emails

**Alternate Flows**:
- **4a**: Email verification fails for contact → Status shows "No email found"
- **5a**: Recruiter pauses enrichment → Resumes later
- **6a**: Recruiter exports enriched data to new CSV

**Success Criteria**:
- Import handles 1,000 rows <2 minutes
- Email verification accuracy >85%
- Enrichment cost displayed upfront (credits deducted transparently)

---

### UC-REC-002: Launch Multi-Step Outreach Sequence

**Actor**: Recruiter

**Preconditions**:
- Recruiter has 1+ enriched contacts in CRM
- Recruiter has created or selected sequence template

**Main Flow**:
1. Recruiter selects contacts (multi-select checkboxes)
2. Recruiter clicks **Start Sequence**
3. System displays sequence picker modal:
   - Pre-built templates (e.g., "Passive Candidate Outreach," "Agency Cold Intro")
   - Custom sequences created by recruiter
4. Recruiter selects sequence, reviews steps:
   - Step 1: Subject + Body + Delay (2 days)
   - Step 2: Follow-up + Delay (3 days)
   - Step 3: Breakup email
5. Recruiter maps variables:
   - `{{first_name}}` → Contact.FirstName
   - `{{role}}` → Job.Title
   - `{{company}}` → Contact.Company
6. Recruiter clicks **Launch**
7. System:
   - Queues emails in schedule table
   - Rotates sending domains
   - Respects throttling limits (e.g., 50/day per mailbox)
8. Recruiter sees "Sequence started for 25 contacts"

**Alternate Flows**:
- **4a**: Recruiter clicks **Edit Template** → modifies sequence inline
- **5a**: Missing variable → System prompts to fill or use default
- **7a**: Daily send cap reached → System queues for next day

**Success Criteria**:
- Sequence launches <30 seconds after click
- Variable substitution 100% accurate
- Throttling prevents domain blacklisting

---

### UC-REC-003: Track Candidate Pipeline

**Actor**: Recruiter

**Preconditions**:
- Recruiter has contacted candidates

**Main Flow**:
1. Recruiter navigates to Tracker (Recruiter mode)
2. System displays Board view: Leads → Contacted → Appointments → Offers → Won/Lost
3. Recruiter drags candidate card (e.g., Contacted → Appointments)
4. System prompts for appointment details (date, time, stage)
5. Recruiter logs notes ("Great culture fit, scheduling final round")
6. Recruiter switches to Table view
7. Recruiter filters by job requisition, status, date range
8. Recruiter exports filtered view to CSV (for ATS import)

**Alternate Flows**:
- **3a**: Candidate replies → System auto-moves to Appointments
- **5a**: Recruiter @mentions teammate → Notification sent
- **7a**: Recruiter generates report (reply rate, time-to-appointment by source)

**Success Criteria**:
- Pipeline updates sync across team in real-time
- Notes support rich text, attachments
- Filters save as "views" (e.g., "My Candidates," "This Week")

---

### UC-REC-004: Manage Personas for Targeting

**Actor**: Recruiter

**Preconditions**:
- Recruiter wants to define reusable search criteria

**Main Flow**:
1. Recruiter navigates to Settings → Personas
2. Recruiter clicks **Create Persona**
3. Recruiter fills form:
   - **Name**: "VP Engineering, Series B SaaS"
   - **Job Titles**: VP Engineering, Head of Engineering, Director of Engineering
   - **Departments**: Engineering, R&D
   - **Management Level**: VP, Head, Director
   - **Location**: San Francisco Bay Area, Remote US
   - **Employee Count**: 50-500
   - **Industries**: SaaS, B2B Software
4. Recruiter clicks **Save**
5. System validates, saves persona
6. Recruiter uses persona in:
   - **Find Connections** (job detail)
   - **Enrichment filters** (CRM import)
   - **Sequence targeting** (auto-apply persona)

**Alternate Flows**:
- **3a**: Recruiter duplicates existing persona, edits
- **4a**: Recruiter previews "Expected match count" (e.g., "~1,200 profiles in Apollo")
- **5a**: Persona name conflicts → System prompts rename

**Success Criteria**:
- Persona saves in <2 seconds
- Reusable across all enrichment workflows
- Changes to persona retroactively update saved searches

---

### UC-REC-005: Monitor Deliverability Health

**Actor**: Recruiter (or Admin)

**Preconditions**:
- Account has 1+ email sending domains configured

**Main Flow**:
1. Recruiter navigates to Deliverability screen
2. System displays grid:
   - **Domain**: rf-sender-01.com
   - **Mailbox**: recruiter1@rf-sender-01.com
   - **Health Score**: 87/100 (Good)
   - **Warmup Status**: Active
   - **Daily Cap**: 50 emails
   - **Last Bounce**: 2 days ago
   - **Spam Reports**: 0
3. Recruiter clicks domain row to expand details:
   - SPF, DKIM, DMARC status
   - Recent send history (last 100 emails)
   - Bounce rate chart (7-day)
4. Recruiter adjusts settings:
   - Toggles **Enable Warmup** (sends auto-replies to seed accounts)
   - Sets **Daily Cap** to 30 (reduces volume to improve health)
   - Clicks **Rotate Domain** (switches to backup pool)
5. System saves, applies changes immediately

**Alternate Flows**:
- **2a**: Health score <50 (Poor) → System alerts, suggests pause/rotate
- **3a**: High bounce rate (>5%) → System auto-throttles, triggers investigation
- **4a**: Recruiter clicks **Test Send** → Sends test email, shows delivery report

**Success Criteria**:
- Health score updates every 6 hours
- Warmup emails blend naturally (no detectable pattern)
- Auto-throttling prevents blacklisting

---

## Shared Use Cases (Both Modes)

### UC-SHARED-001: Set Up Custom Tracking Domain

**Actor**: Admin user (job seeker on paid plan or recruiter)

**Preconditions**:
- User owns domain (e.g., `track.mycompany.com`)

**Main Flow**:
1. User navigates to Settings → Deliverability → Custom Tracking Domain
2. System displays setup wizard:
   - **Step 1**: Enter domain (e.g., `click.roleferry.io`)
   - **Step 2**: Add DNS records (CNAME to RoleFerry CDN)
   - **Step 3**: Verify DNS propagation
   - **Step 4**: Enable link rewriting
3. User adds DNS records via domain registrar
4. User clicks **Verify** in RoleFerry
5. System checks DNS, confirms CNAME
6. System enables CTD globally (all links in sequences rewritten)
7. User sees "Custom Tracking Domain active ✓"

**Alternate Flows**:
- **5a**: DNS not propagated → System retries in 5 minutes, notifies user
- **6a**: User disables CTD → Links revert to direct URLs (less safe)

**Success Criteria**:
- Setup completes in <10 minutes (assuming DNS cooperation)
- Link rewriting preserves original URL as redirect
- Click tracking logs within 1 second of click

---

### UC-SHARED-002: Generate LivePage for Outreach

**Actor**: Job seeker or recruiter

**Preconditions**:
- User is drafting email in sequence editor

**Main Flow**:
1. User clicks **Insert LivePage** in email body editor
2. System displays LivePage builder modal:
   - **CompanyName**: Auto-filled from contact
   - **Role**: Auto-filled from job/requisition
   - **FirstName**: Auto-filled from contact
   - **Video/GIF**: User uploads or pastes URL
   - **Calendar Link**: User enters Calendly/Google Calendar link
   - **Proof Bullets**: User lists 3 key metrics/accomplishments
3. User clicks **Generate**
4. System:
   - Creates unique LivePage URL (e.g., `lp.roleferry.io/abc123`)
   - Renders preview
5. User clicks **Insert**
6. System adds LivePage link to email body (rewritten via CTD)
7. When recipient clicks link:
   - System logs page view (timestamp, location, device)
   - Renders personalized page with contact's name, role, company
   - CTA button ("Schedule a Chat") tracked on click

**Alternate Flows**:
- **2a**: User selects template (pre-built layouts)
- **3a**: User enables **Password protection** → Recipient must enter code
- **7a**: Recipient views page multiple times → System logs each view

**Success Criteria**:
- LivePage loads <1 second (global CDN)
- Analytics update in real-time (visible in Tracker)
- Design responsive (mobile, tablet, desktop)

---

### UC-SHARED-003: Integrate with External Tools

**Actor**: Power user

**Preconditions**:
- User has API access (Pro or Teams plan)

**Main Flow**:
1. User navigates to Settings → Integrations
2. User selects integration:
   - **ATS** (Greenhouse, Lever, Workable)
   - **CRM** (HubSpot, Salesforce)
   - **Calendar** (Google, Outlook)
   - **Zapier** (custom workflows)
3. User clicks **Connect**
4. System redirects to OAuth flow
5. User authorizes RoleFerry
6. System receives access token, saves
7. System syncs data:
   - **ATS**: Import job requisitions, sync candidate status
   - **CRM**: Push contacts, log activities
   - **Calendar**: Create events from interview scheduling
8. User sees "Integration active ✓"

**Alternate Flows**:
- **6a**: OAuth fails → System shows error, support contact
- **7a**: Sync conflicts (e.g., duplicate candidates) → System prompts resolution

**Success Criteria**:
- OAuth completes <60 seconds
- Initial sync (100 records) <5 minutes
- Incremental sync runs every 15 minutes (webhook-driven)

---

## Summary

This document defines **18 core use cases** spanning:
- **Job Seeker**: 7 use cases (discovery, apply, track, manage replies, import/export, preferences, copilot)
- **Recruiter**: 5 use cases (import/enrich, sequences, pipeline, personas, deliverability)
- **Shared**: 3 use cases (CTD setup, LivePages, integrations)

Each use case maps to one or more functional requirements and informs UI/UX design, API contracts, and test scenarios.

---
**Owner**: Product & Engineering  
**Version**: 1.0  
**Last Updated**: October 2025  
**Next Review**: Monthly during development

