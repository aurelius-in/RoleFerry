# Product Analytics Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, Engineering, Growth  
**Purpose**: Track and analyze user behavior for product decisions

---

## 1. Analytics Stack

### Tools
- **Amplitude**: Event tracking, funnels, cohorts
- **Datadog**: Performance metrics (API latency, errors)
- **PostHog** (Alternative): Open-source, self-hosted option

**Why Amplitude?**:
- Purpose-built for product analytics
- Best-in-class funnel analysis
- Cohort analysis (retention curves)
- $49/month (10M events)

---

## 2. Event Tracking Framework

### 2.1 Event Naming Convention

```
[Object] [Action]
```

**Examples**:
- `user_signed_up`
- `application_created`
- `email_sent`
- `job_viewed`
- `profile_updated`

**DON'T**: `clicked_button`, `page_view` (too generic)

---

### 2.2 Event Properties

**Standard Properties** (all events):
```json
{
  "user_id": "12345",
  "session_id": "abc-def-ghi",
  "timestamp": "2025-10-13T14:30:00Z",
  "platform": "web",  // or "mobile", "api"
  "user_tier": "pro",  // free, pro, teams
  "cohort": "2025-10"  // signup month
}
```

**Event-Specific Properties**:
```json
{
  "event": "application_created",
  "properties": {
    "job_id": 5678,
    "company_name": "Acme Corp",
    "match_score": 85,
    "contacts_found": 2,
    "draft_edited": false,  // Did user edit AI draft?
    "source": "jobs_list"  // or "copilot", "tracker"
  }
}
```

---

## 3. Core Events to Track

### 3.1 Acquisition & Signup

| Event | When | Properties |
|-------|------|------------|
| `user_visited` | Landing page load | `utm_source`, `utm_campaign`, `referrer` |
| `signup_started` | Click "Sign Up" | `source` (homepage, blog, pricing) |
| `user_signed_up` | Account created | `method` (email, Google, LinkedIn), `tier` |

---

### 3.2 Activation

| Event | When | Properties |
|-------|------|------------|
| `profile_completed` | IJP wizard finished | `time_to_complete` (seconds) |
| `job_viewed` | Job detail page opened | `job_id`, `match_score`, `source` |
| `application_created` | User clicked Apply | `job_id`, `contacts_found`, `draft_edited` |
| `email_sent` | Outreach sent | `recipient_count`, `sequence_id` |

---

### 3.3 Engagement

| Event | When | Properties |
|-------|------|------------|
| `tracker_viewed` | Tracker page opened | `view` (board, table), `applications_count` |
| `copilot_query` | User asked Copilot | `query_length`, `response_time` |
| `draft_edited` | User edited AI draft | `original_length`, `edited_length`, `time_spent` |
| `csv_imported` | User imported CSV | `row_count` |

---

### 3.4 Revenue

| Event | When | Properties |
|-------|------|------------|
| `upgrade_viewed` | Pricing page viewed | `current_tier`, `source` (modal, settings) |
| `subscription_created` | User upgraded | `tier` (pro, teams), `billing_cycle` (monthly, annual), `amount` |
| `subscription_canceled` | User downgraded/canceled | `tier`, `reason`, `lifetime_value` |

---

### 3.5 Retention

| Event | When | Properties |
|-------|------|------------|
| `reply_received` | Contact replied | `days_since_sent`, `application_id` |
| `interview_logged` | User logged interview | `company`, `stage` (phone, on-site) |
| `job_offer` | User got offer | `company`, `salary` |

---

## 4. Funnels

### 4.1 Activation Funnel

```
Landing Page (100%)
  ↓ 40%
Sign Up (40%)
  ↓ 80%
Profile Complete (32%)
  ↓ 60%
First Apply (19%)
  ↓ 40%
5+ Applies (8%)
```

**Goal**: Increase each step conversion by 10% (19% → 29% first-apply)

**Tracked in Amplitude**: Funnel analysis (visualize drop-offs)

---

### 4.2 Revenue Funnel

```
Free User (100%)
  ↓ 20%
Hit Free Tier Limit (20%)
  ↓ 30%
Viewed Pricing (6%)
  ↓ 50%
Started Checkout (3%)
  ↓ 90%
Paid User (2.7%)
```

**Goal**: Increase free → paid conversion from 2.7% → 5%

---

## 5. Cohort Analysis

### 5.1 Retention Cohorts

**Question**: What % of users return after signup?

| Signup Month | Day 1 | Day 7 | Day 30 | Day 90 |
|--------------|-------|-------|--------|--------|
| **Sep 2025** | 60% | 40% | 25% | 15% |
| **Oct 2025** | 62% | 45% | 30% | - |
| **Nov 2025** | 65% | 50% | - | - |

**Insight**: Oct/Nov cohorts have better retention (product improvements working)

---

### 5.2 Revenue Cohorts

**Question**: How much revenue do cohorts generate over time?

| Signup Month | Month 0 | Month 1 | Month 2 | Month 3 | Cumulative |
|--------------|---------|---------|---------|---------|------------|
| **Sep 2025** | $2,450 | $3,920 | $4,900 | $5,880 | $17,150 |
| **Oct 2025** | $3,500 | $5,600 | $7,000 | - | $16,100 |

**Insight**: Oct cohort monetizes faster (better onboarding → faster upgrades)

---

## 6. Key Metrics Dashboard

### 6.1 North Star Metric

**"Applications Sent per Week"**

**Why**: Measures core value (users actively applying via RoleFerry)

**Target**: 10 applications/user/week (engaged users)

---

### 6.2 Weekly Metrics (Product Review)

| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| **Active Users** | 1,200 | 1,100 | +9% 📈 |
| **Applications Sent** | 3,500 | 3,200 | +9% 📈 |
| **Reply Rate** | 16% | 15% | +1pp 📈 |
| **Free → Pro** | 15 | 12 | +25% 📈 |
| **Churn** | 4% | 5% | -1pp 📈 |

**Review**: Every Monday (Product, Eng, Growth)

---

## 7. Implementation

### 7.1 Frontend (Amplitude)

```typescript
// src/lib/analytics.ts
import * as amplitude from '@amplitude/analytics-browser';

amplitude.init('YOUR_API_KEY', {
  defaultTracking: {
    pageViews: true,
    sessions: true
  }
});

export function track Event(event: string, properties?: Record<string, any>) {
  amplitude.track(event, {
    ...properties,
    timestamp: new Date().toISOString()
  });
}

// Usage
import { trackEvent } from '@/lib/analytics';

function applyToJob(jobId: number) {
  trackEvent('application_created', {
    job_id: jobId,
    match_score: job.matchScore,
    source: 'jobs_list'
  });
  
  // ... rest of logic
}
```

---

### 7.2 Backend (Amplitude)

```python
# backend/app/analytics.py
from amplitude import Amplitude
import logging

amplitude_client = Amplitude(settings.AMPLITUDE_API_KEY)

def track_event(user_id: str, event: str, properties: dict = None):
    """Track event to Amplitude"""
    
    event_properties = properties or {}
    event_properties['timestamp'] = datetime.utcnow().isoformat()
    
    try:
        amplitude_client.track({
            'user_id': user_id,
            'event_type': event,
            'event_properties': event_properties
        })
    except Exception as e:
        logging.error(f"Failed to track event {event}: {e}")
        # Don't crash if analytics fails

# Usage
from app.analytics import track_event

@app.post("/api/applications")
async def create_application(request: Request):
    user_id = request.state.user['id']
    
    # ... create application logic
    
    track_event(user_id, 'application_created', {
        'job_id': job_id,
        'contacts_found': len(contacts)
    })
```

---

## 8. Privacy & Compliance

### 8.1 PII in Events

**DO Track**:
- User IDs (hashed or pseudonymous)
- Aggregate data (counts, averages)
- Product usage (clicks, page views)

**DON'T Track**:
- Full names, emails (use user_id instead)
- Passwords (obviously)
- Resume content (PII)
- Contact emails found (privacy risk)

---

### 8.2 User Consent

**EU/UK Users**: Require consent before tracking

**Cookie Banner**:
```
We use cookies to improve your experience.

[Accept] [Decline] [Customize]
```

**If Declined**: Disable Amplitude (respect choice)

---

## 9. Experimentation (A/B Tests)

### 9.1 Experiment Setup

**Hypothesis**: Showing match score increases apply rate

**Setup**:
- **Control**: No match score shown
- **Treatment**: Match score pill (e.g., "85% Match")
- **Split**: 50/50
- **Duration**: 2 weeks (500+ applies for statistical significance)

**Amplitude Setup**:
```typescript
import { Experiment } from '@amplitude/experiment-js-client';

const experiment = Experiment.initialize('YOUR_EXP_KEY');

// Get variant
const variant = await experiment.fetch({ user_id: userId });

if (variant['match-score-pill'] === 'treatment') {
  return <MatchScorePill score={job.matchScore} />;
}
```

---

### 9.2 Analyze Results

**Metrics**:
- Apply rate (control vs. treatment)
- Time to first apply (did match score speed decision?)
- Reply rate (does match score correlate with quality?)

**Decision**:
- If treatment >10% lift → ship to 100%
- If <5% lift → abandon
- If 5-10% lift → run longer (ambiguous)

---

## 10. Acceptance Criteria

- [ ] Analytics tool integrated (Amplitude)
- [ ] Core events tracked (signup, apply, upgrade, churn)
- [ ] Event naming convention documented
- [ ] Funnels configured (activation, revenue)
- [ ] Cohort analysis (retention, revenue)
- [ ] Weekly metrics dashboard
- [ ] Privacy compliance (no PII in events, consent for EU)

---

**Document Owner**: VP Product, Growth Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (add/remove events as product evolves)

