# Acceptance Criteria & Test Scenarios
## RoleFerry Platform

**Document Type**: QA Requirements  
**Audience**: QA Engineers, Product Managers  
**Purpose**: Detailed acceptance criteria for feature validation

---

## 1. Feature Acceptance Template

Each feature must meet:
- **Functional**: Does it work as specified?
- **Performance**: Does it meet speed requirements?
- **Usability**: Can users complete tasks without confusion?
- **Accessibility**: WCAG 2.1 AA compliant?
- **Security**: No vulnerabilities introduced?

---

## 2. Job Discovery & Matching

### AC-JOBS-001: Display Matched Jobs
**Given** a user has completed IJP wizard  
**When** they navigate to Jobs List  
**Then** they should see:
- [ ] 20 jobs per page
- [ ] Each card shows: logo, title, company, location, comp range, match score
- [ ] Match scores range 0-100 with color coding (red <50, yellow 50-74, green 75+)
- [ ] Jobs sorted by match score descending (default)
- [ ] Page loads in <2 seconds

**Test Scenarios**:
1. **Happy path**: User with complete IJP sees 20 relevant jobs
2. **No matches**: User with narrow criteria sees "No jobs found" message
3. **Empty IJP**: User without IJP preferences sees default job list
4. **Performance**: Load 1,000 jobs database → page still loads <2s

---

### AC-JOBS-002: Filter Jobs
**Given** user is on Jobs List  
**When** they apply filters (role, location, remote, salary)  
**Then** results should update without page reload in <500ms

**Test Scenarios**:
1. **Single filter**: Remote = true → only remote jobs shown
2. **Multiple filters**: Remote + Location = SF → remote OR SF jobs
3. **No results**: Salary >$500K → "No matches" message
4. **Clear filters**: Reset button → back to default IJP matches

---

## 3. Application & Outreach

### AC-APP-001: One-Click Apply
**Given** user is viewing Job Detail  
**When** they click "Apply" button  
**Then**:
- [ ] Application record created (status: "applied")
- [ ] Application appears in Tracker immediately
- [ ] Enrichment job queued (background)
- [ ] User sees confirmation: "Application created! Finding contacts..."
- [ ] Total time <2 seconds (synchronous part)

**Test Scenarios**:
1. **First apply**: Creates application, queues enrichment
2. **Duplicate apply**: Warning: "You already applied to this job"
3. **Enrichment success**: 2 contacts found within 30 seconds
4. **Enrichment failure**: "No contacts found" after 30 seconds

---

### AC-APP-002: Enrichment Finds Contacts
**Given** user has applied to job  
**When** enrichment job runs  
**Then**:
- [ ] Company domain found (Clearbit → Google fallback)
- [ ] 1-3 contacts discovered (Apollo → Clay waterfall)
- [ ] Emails verified (NeverBounce: valid or risky only)
- [ ] Contacts saved with source attribution
- [ ] User notification: "2 contacts found"
- [ ] Total time <30 seconds (P95)

**Test Scenarios**:
1. **Known company** (e.g., "Google"): Domain found in <2s
2. **Obscure company**: Falls back to Google search
3. **No domain found**: Error: "Could not find company website"
4. **Contacts found**: 2-3 hiring managers, HR, dept heads
5. **No contacts**: Returns empty (user can manually add)
6. **Email verification**: Invalid emails excluded, risky emails flagged

---

### AC-APP-003: Send Email Sequence
**Given** contacts found via enrichment  
**When** user reviews draft and clicks "Send"  
**Then**:
- [ ] Sequence queued (status: "queued")
- [ ] Email sent within 5 minutes
- [ ] User sees confirmation: "Sequence started"
- [ ] Tracker shows sequence status badge ("Step 1 sent")
- [ ] Email footer includes unsubscribe link + physical address

**Test Scenarios**:
1. **Immediate send**: Step 1 sent within 5 minutes
2. **Delayed send**: Step 2 queued for +2 days
3. **Variable substitution**: {{first_name}} → actual name
4. **Stop on reply**: Reply received → Step 2 canceled
5. **Mailbox selection**: Healthy mailbox chosen (health >70, under cap)

---

## 4. Tracker & Pipeline

### AC-TRACKER-001: Kanban Board Display
**Given** user has 10 applications  
**When** they navigate to Tracker  
**Then**:
- [ ] Board view shows 5 columns (Saved, Applied, Interviewing, Offer, Rejected)
- [ ] Cards distributed by status
- [ ] Each card shows: logo, title, company, last contact date, sequence status
- [ ] Drag & drop updates status (optimistic UI, <500ms server update)
- [ ] Empty columns show "No applications" placeholder

**Test Scenarios**:
1. **Drag to new status**: Applied → Interviewing updates DB
2. **Empty board**: New user sees all columns empty
3. **Many applications**: 100+ applications, pagination works
4. **Real-time updates**: Other device/tab sees changes (WebSocket)

---

### AC-TRACKER-002: CSV Import/Export
**Given** user has CSV file with 25 applications  
**When** they click "Import CSV" and upload  
**Then**:
- [ ] File parsed, preview shown
- [ ] Required columns validated (Company, Title)
- [ ] Duplicate detection (skip or update, user choice)
- [ ] Applications created in DB
- [ ] Summary: "25 imported, 3 duplicates skipped, 2 errors"
- [ ] Import completes in <10 seconds

**Export**:
- [ ] "Export CSV" downloads file instantly
- [ ] UTF-8 encoded (handles international chars)
- [ ] All applications included (or filtered subset)

**Test Scenarios**:
1. **Valid CSV**: 25 rows imported successfully
2. **Missing columns**: Error highlights missing "Company" column
3. **Duplicate**: Same company + title → prompt: "Skip or Update?"
4. **Large file**: 1,000 rows imports in <30 seconds
5. **Round-trip**: Export → Edit → Import preserves data

---

## 5. Deliverability

### AC-DELIVER-001: Health Monitoring
**Given** mailbox has sent 100 emails in 7 days  
**When** bounce rate reaches 8% (threshold: 5%)  
**Then**:
- [ ] Health score drops below 70
- [ ] Mailbox status → "paused"
- [ ] Alert sent to ops team
- [ ] New sends routed to different mailbox
- [ ] Ops dashboard shows degraded health (red indicator)

**Test Scenarios**:
1. **High bounce rate**: 10 bounces / 100 sends → health drops
2. **Spam report**: 1 spam report → -20 health points
3. **Recovery**: Bounce rate improves → health score recovers
4. **Auto-pause**: Health <50 → status = paused automatically

---

### AC-DELIVER-002: Throttling
**Given** mailbox has daily cap of 50 emails  
**When** 50th email sent today  
**Then**:
- [ ] 51st email queued for tomorrow
- [ ] Mailbox.sent_today = 50
- [ ] Next send routed to different mailbox
- [ ] Counter resets at midnight UTC

**Test Scenarios**:
1. **Cap reached**: 50 sent → 51st queued
2. **Daily reset**: Midnight UTC → sent_today = 0
3. **Multi-mailbox**: Mailbox A full → uses Mailbox B
4. **All full**: All mailboxes capped → notification to user

---

## 6. AI Features

### AC-AI-001: Match Scoring
**Given** user with 7 years PM experience, skills = ["Product Strategy", "SQL"]  
**When** scored against "Senior PM" job at B2B SaaS company  
**Then**:
- [ ] Match score 75-90 (Strong)
- [ ] Breakdown: Experience 90%, Skills 80%, Industry 100%
- [ ] Score caches for 24 hours
- [ ] Re-scores on IJP change

**Test Scenarios**:
1. **Perfect match**: Senior PM, SaaS → 85+ score
2. **Poor match**: Junior role, different industry → <50 score
3. **Missing data**: Job without industry → defaults to 50
4. **Edge case**: New grad (0 YOE) → matches entry-level roles

---

### AC-AI-002: Copilot Q&A
**Given** user asks "Why is this a fit for me?" on Job Detail  
**When** Copilot processes question  
**Then**:
- [ ] Response streams in <5 seconds (first token <2s)
- [ ] Answer references user resume ("Your 5 years as PM...")
- [ ] Answer cites job details ("Acme is Series B SaaS...")
- [ ] Citations shown (hover to expand)
- [ ] Regenerate button available

**Test Scenarios**:
1. **Common question**: "Why fit?" → relevant answer
2. **Custom question**: "How should I position my pivot?" → helpful answer
3. **No context**: User without resume → generic answer
4. **Timeout**: LLM takes >10s → fallback to secondary model

---

## 7. Edge Cases & Error Conditions

### AC-EDGE-001: Enrichment Failures
**Scenarios**:
1. **Apollo rate limit**: Fallback to Clay automatically
2. **Both providers down**: Return partial results OR "Try again later"
3. **Invalid domain**: Company name doesn't resolve → allow manual domain entry
4. **No people found**: Return empty, suggest manual contact add

### AC-EDGE-002: Email Delivery Failures
**Scenarios**:
1. **Hard bounce**: Mark contact invalid, don't retry
2. **Soft bounce**: Retry 2x, then mark failed
3. **Spam report**: Immediately opt out contact, alert ops
4. **Provider down** (SendGrid): Failover to Mailgun, retry

### AC-EDGE-003: User Edge Cases
**Scenarios**:
1. **Resume without work history**: Match scoring uses IJP only
2. **IJP with contradictory prefs**: System handles (e.g., "Remote" + "On-site only NYC")
3. **User deletes account mid-sequence**: Stop all sequences immediately
4. **Subscription expires**: Downgrade to free tier, pause sequences

---

## 8. Acceptance Sign-Off

### Definition of Done (Feature)
- [ ] Functional requirements met (all AC checkboxes ticked)
- [ ] Unit tests written (80%+ coverage)
- [ ] Integration tests pass
- [ ] E2E test (happy path) passes
- [ ] Performance targets met (latency, throughput)
- [ ] Accessibility validated (WCAG 2.1 AA)
- [ ] Documentation updated (API spec, user guide)
- [ ] Product Manager approval
- [ ] QA sign-off

### Definition of Done (Release)
- [ ] All features DOD
- [ ] Staging testing complete (QA team)
- [ ] Security scan pass (Snyk, Bandit)
- [ ] Performance regression tests pass
- [ ] Rollback plan documented
- [ ] Release notes written
- [ ] CTO approval

---

**Document Owner**: QA Lead, Product Manager  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Weekly during active development

