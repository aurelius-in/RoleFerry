# Feature Specifications
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, Design, Engineering  
**Purpose**: Detailed specs for key features

---

## 1. Feature: One-Click Apply

### 1.1 User Story
**As a** job seeker  
**I want** to apply with one click  
**So that** I save time and instantly reach hiring managers

### 1.2 UI Flow
```
Jobs List → Click "Apply" on Job Card
  ↓
Loading Modal (5 seconds)
  - "Finding contacts at Acme Corp..."
  - Progress spinner
  ↓
"Connect via Email" Modal
  - To: Sarah Smith (VP Product), John Doe (HR Manager)
  - Subject: [Pre-filled]
  - Body: [AI-generated draft]
  - [Use Author] [Send] [Cancel]
  ↓
Confirmation Toast
  - "Sequence started! Emails will send within 5 minutes."
  ↓
Tracker Updated
  - New card appears in "Applied" column
  - Badge: "Step 1 queued"
```

### 1.3 Technical Implementation
- Frontend: React component (`ApplyButton.tsx`)
- API: `POST /api/applications` (synchronous) + Celery job (async enrichment)
- Database: Insert Application record, queue enrichment job
- Background: Enrichment worker runs waterfall (Apollo → Clay → verify → save contacts)

### 1.4 Edge Cases
- **Duplicate apply**: Show warning, don't create duplicate
- **No contacts found**: Show "Add manually" option
- **Enrichment timeout**: Retry, show "Try again later"

### 1.5 Success Metrics
- 90% of applies successfully find 1+ contacts
- <60s from click to "sequence started" notification
- 80% of users don't edit draft (quality is high)

---

## 2. Feature: AI Copilot

### 2.1 User Story
**As a** job seeker  
**I want** to ask AI questions about jobs  
**So that** I make informed decisions

### 2.2 UI Design
**Right Rail Panel** (320px width, fixed position):
```
┌─────────────────────────┐
│ 🤖 Copilot              │
│ ───────────────────────│
│ Quick actions:          │
│ • Why is this a fit?   │
│ • Write an email       │
│ • Show insiders        │
│ ───────────────────────│
│ Ask anything...         │
│ [Input field]          │
│ [Send →]               │
│ ───────────────────────│
│ [Streaming response]   │
│ Based on your 5 years  │
│ as a PM at SaaS...     │
└─────────────────────────┘
```

### 2.3 Context Assembly
**Inputs to LLM**:
- User resume (roles, metrics, skills)
- Current job (title, JD, company)
- Current page (job detail, tracker, settings)

**Prompt Template**:
```
You are a helpful career assistant for RoleFerry.

User Profile:
- Current role: {user.current_role}
- Experience: {user.years_exp} years
- Key metrics: {user.top_3_metrics}

Context:
- Viewing: {current_page}
- Job: {job.title} at {job.company}

Question: {user_question}

Provide a concise, actionable answer (3-5 sentences).
```

### 2.4 Technical Implementation
- Frontend: WebSocket connection for streaming
- Backend: FastAPI + Server-Sent Events (SSE)
- LLM: Anthropic Claude Sonnet (primary), GPT-4 (fallback)
- Caching: Frequent questions cached (Redis, 1-hour TTL)

### 2.5 Success Metrics
- 40% adoption (users ask 1+ question)
- <5s response time (first token <2s)
- 80% positive feedback ("Helpful" rating)

---

## 3. Feature: Deliverability Dashboard

### 3.1 User Story
**As a** recruiter  
**I want** to monitor email health  
**So that** I know my outreach is landing in inboxes

### 3.2 UI Design
**Grid View** (Mailbox rows):
```
Domain          | Health | Status  | Cap   | Sent Today | Bounce Rate
----------------|--------|---------|-------|------------|------------
rf-send-01.com  | 87 🟢  | Active  | 50    | 23         | 2.1%
rf-send-02.com  | 92 🟢  | Active  | 50    | 18         | 1.5%
rf-send-03.com  | 45 🔴  | Paused  | 50    | 0          | 12.3%
```

**Detail View** (click row):
- SPF/DKIM/DMARC status (✓ configured)
- Send history (last 100 emails, line chart)
- Bounce log (recent bounces with reasons)
- Actions: [Enable Warmup] [Rotate Domain] [Test Send]

### 3.3 Health Score Algorithm
```python
health = 100
health -= (bounce_rate * 500)  # -50 for 10% bounce
health -= (spam_reports * 20)  # -20 per spam report
health += 10 if warmup_complete else 0
health = max(0, min(100, health))
```

**Color Coding**:
- 90-100: Green (Excellent)
- 70-89: Yellow (Good)
- 50-69: Orange (Fair)
- <50: Red (Poor, auto-pause)

### 3.4 Success Metrics
- <3% bounce rate (platform average)
- <0.05% spam complaint rate
- 95%+ inbox placement

---

**Document Owner**: Product Manager  
**Version**: 1.0  
**Date**: October 2025

