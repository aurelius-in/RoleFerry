# Testing Strategy
## RoleFerry Platform

**Document Type**: QA & Testing  
**Audience**: Engineering, QA, Product  
**Purpose**: Define comprehensive testing approach for quality assurance

---

## 1. Testing Philosophy

### 1.1 Core Principles
- **Shift-left testing**: Write tests during development, not after
- **Pyramid model**: Many unit tests, fewer integration tests, minimal E2E tests
- **Automation first**: Manual testing only for exploratory/UX validation
- **Continuous testing**: Every commit triggers test suite (CI/CD)

### 1.2 Quality Goals
- **80%+ code coverage**: Unit tests for business logic
- **Zero critical bugs** in production (P0 issues)
- **P95 latency**: API <500ms, enrichment <30s
- **Availability**: 99.5% uptime (SLA for paid users)

---

## 2. Test Pyramid

```
           ┌─────────────────┐
           │   E2E Tests     │  5% (Critical paths)
           │   (Playwright)  │
           ├─────────────────┤
           │ Integration     │  15% (API + DB)
           │ Tests (Pytest)  │
           ├─────────────────┤
           │  Unit Tests     │  80% (Business logic)
           │  (Pytest, Jest) │
           └─────────────────┘
```

---

## 3. Unit Testing

### 3.1 Scope
Test individual functions/classes in isolation (mocked dependencies).

### 3.2 Tools
- **Backend**: Pytest (Python)
- **Frontend**: Jest + React Testing Library

### 3.3 Coverage Targets
| Component | Min Coverage | Critical Paths |
|-----------|--------------|----------------|
| Business logic (services) | 90% | Enrichment, sequencing, match scoring |
| API routes | 70% | All endpoints |
| Utilities | 80% | Auth, validation, formatting |
| UI components | 60% | Critical components (Tracker, Jobs List) |

### 3.4 Example: Match Scoring Unit Test

```python
# tests/unit/test_match_scoring.py
import pytest
from app.services.job_matching import calculate_match_score

def test_calculate_match_score_perfect_match():
    user = {
        "ijp": {
            "role_level": "senior",
            "skills": ["Python", "Product Strategy"],
            "industries": ["SaaS"]
        },
        "resume": {"years_experience": 7}
    }
    job = {
        "title": "Senior Product Manager",
        "description": "Looking for experienced PM with Python skills...",
        "company": {"industry": "SaaS"}
    }
    
    score, breakdown = calculate_match_score(user, job)
    
    assert score >= 90, "Perfect match should score 90+"
    assert breakdown["experience"] >= 85
    assert breakdown["skills"] >= 80
    assert breakdown["industry"] == 100

def test_calculate_match_score_no_match():
    user = {
        "ijp": {
            "role_level": "senior",
            "skills": ["JavaScript"],
            "industries": ["Healthcare"]
        }
    }
    job = {
        "title": "Junior Data Scientist",
        "description": "Python, ML, Finance domain...",
        "company": {"industry": "Finance"}
    }
    
    score, _ = calculate_match_score(user, job)
    
    assert score < 50, "Poor match should score <50"

def test_calculate_match_score_missing_data():
    user = {"ijp": {}}  # Incomplete profile
    job = {"title": "PM"}
    
    score, _ = calculate_match_score(user, job)
    
    assert score == 50, "Missing data defaults to 50 (neutral)"
```

### 3.5 Unit Test Guidelines
- **Fast**: Tests run in <5 seconds total
- **Isolated**: No database, API calls, or file I/O (use mocks)
- **Deterministic**: Same input → same output (no flaky tests)
- **Clear naming**: `test_<function>_<scenario>_<expected_result>`

---

## 4. Integration Testing

### 4.1 Scope
Test interactions between components (API + database, services + external APIs).

### 4.2 Tools
- **Backend**: Pytest with `pytest-asyncio`, `pytest-postgresql` (test DB)
- **Database**: Dockerized PostgreSQL (fresh instance per test run)
- **Mocks**: `responses` library for external APIs (Apollo, SendGrid)

### 4.3 Example: Enrichment Integration Test

```python
# tests/integration/test_enrichment.py
import pytest
from app.services.enrichment import enrich_application
from app.db import SessionLocal
from app.models import Application, Contact

@pytest.mark.integration
@pytest.mark.asyncio
async def test_enrich_application_success(test_db, mock_apollo, mock_neverbounce):
    # Setup: Create application
    db = SessionLocal()
    application = Application(
        user_id=1,
        job_id=1,
        status="applied"
    )
    db.add(application)
    db.commit()
    
    # Mock external APIs
    mock_apollo.post("/v1/mixed_people/search", json={
        "people": [
            {"name": "John Doe", "title": "VP Engineering", "email": "john@acme.com"}
        ]
    })
    mock_neverbounce.post("/v1/verify/bulk", json={
        "results": [{"email": "john@acme.com", "status": "valid"}]
    })
    
    # Execute enrichment
    result = await enrich_application(application.id)
    
    # Verify contacts saved
    contacts = db.query(Contact).filter_by(company_id=application.job.company_id).all()
    assert len(contacts) == 1
    assert contacts[0].email == "john@acme.com"
    assert contacts[0].email_verified is True
    
    # Verify result
    assert result["status"] == "success"
    assert result["contacts_found"] == 1

@pytest.mark.integration
async def test_enrich_application_no_contacts_found(test_db, mock_apollo):
    # Mock Apollo returning empty results
    mock_apollo.post("/v1/mixed_people/search", json={"people": []})
    
    application = Application(user_id=1, job_id=1)
    db = SessionLocal()
    db.add(application)
    db.commit()
    
    result = await enrich_application(application.id)
    
    assert result["status"] == "error"
    assert result["contacts_found"] == 0
```

### 4.4 Integration Test Guidelines
- **Test database**: Spin up PostgreSQL in Docker, seed test data, tear down after
- **Mock external APIs**: Never hit real Apollo/SendGrid in tests (cost + reliability)
- **Test failure modes**: Network timeouts, API errors, invalid data
- **Runtime**: <60 seconds for full integration suite

---

## 5. End-to-End (E2E) Testing

### 5.1 Scope
Test critical user flows through full stack (browser → API → database → external services).

### 5.2 Tools
- **Framework**: Playwright (Python or TypeScript)
- **Environment**: Staging environment (prod-like, isolated data)
- **Test data**: Seeded test users, jobs, sequences

### 5.3 Critical Paths to Test

#### E2E-001: Job Seeker Signup → Apply → Track
```
1. Navigate to roleferry.com
2. Click "Sign Up" → enter email/password
3. Complete IJP wizard (5 steps)
4. See Jobs List (verify match scores displayed)
5. Click job card → view Job Detail
6. Click "Apply" → enrichment starts
7. Wait for notification ("2 contacts found")
8. Navigate to Tracker → verify application appears
9. Click application → verify contacts listed
10. Check email outreach sent (via test mailbox)
```

**Expected**: Application created, enrichment runs, email sent within 5 minutes.

#### E2E-002: Recruiter Import → Enrich → Sequence
```
1. Login as recruiter
2. Navigate to CRM
3. Click "Import CSV" → upload test CSV (10 leads)
4. Preview shows 10 rows → click "Import"
5. Enrichment starts (progress bar)
6. Enrichment completes → 8/10 emails found
7. Select 8 leads → click "Start Sequence"
8. Choose sequence template → launch
9. Verify outreach records created
10. Check test mailbox (mock SendGrid) → 8 emails queued
```

**Expected**: CSV import, enrichment, sequence launch all succeed within 2 minutes.

#### E2E-003: Reply Detection → Sequence Stop
```
1. User has active sequence (Step 1 sent, Step 2 queued)
2. Simulate inbound reply (POST to /webhooks/email-reply)
3. Verify webhook processed (<1 min)
4. Check application status → "interviewing"
5. Check outreach → Step 2 status = "canceled"
6. Check Tracker → reply badge appears
7. User receives notification ("Reply from John at Acme Corp")
```

**Expected**: Reply detected, sequence stopped, user notified within 1 minute.

### 5.4 E2E Test Guidelines
- **Run on staging**: Never test on production
- **Flake tolerance**: Retry failed tests 2x before marking failure
- **Runtime**: <15 minutes for critical path suite
- **Schedule**: Run before every deployment + nightly

---

## 6. Performance Testing

### 6.1 Scope
Validate system meets performance requirements under load.

### 6.2 Tools
- **Load testing**: Locust (Python) or k6
- **APM**: Datadog (real-time latency monitoring)

### 6.3 Performance Tests

#### PERF-001: API Latency (Baseline)
**Test**: Send 1,000 GET /jobs requests over 1 minute  
**Expected**: P95 <500ms, P99 <1s, 0% errors

#### PERF-002: Enrichment Throughput
**Test**: Queue 100 enrichment jobs simultaneously  
**Expected**: 90% complete <30s, 100% complete <60s

#### PERF-003: Email Sending Capacity
**Test**: Queue 1,000 emails (distributed across 20 mailboxes)  
**Expected**: All sent within 30 minutes, respecting 50/day caps

#### PERF-004: Database Query Performance
**Test**: Query /applications with 10,000 applications in DB  
**Expected**: Response <500ms (indexed queries)

### 6.4 Performance Test Schedule
- **Pre-launch**: Full suite (establish baselines)
- **Monthly**: Regression testing (detect performance degradation)
- **Pre-scale**: Before major user growth (10K → 50K users)

---

## 7. Security Testing

### 7.1 Scope
Identify vulnerabilities (injection, auth bypass, data leaks).

### 7.2 Tools
- **SAST (Static)**: Bandit (Python), ESLint security plugins
- **DAST (Dynamic)**: OWASP ZAP (penetration testing)
- **Dependency scanning**: Snyk (detects vulnerable packages)

### 7.3 Security Test Cases

#### SEC-001: SQL Injection
**Test**: Send malicious input in API params (`email=' OR 1=1 --`)  
**Expected**: Query parameterization prevents injection

#### SEC-002: JWT Token Validation
**Test**: Send expired/invalid JWT to protected endpoint  
**Expected**: 401 Unauthorized

#### SEC-003: PII Exposure
**Test**: Query /users/{other_user_id} as unauthorized user  
**Expected**: 403 Forbidden (can't access other users' data)

#### SEC-004: Rate Limit Bypass
**Test**: Send 100 requests/minute (above 60 limit)  
**Expected**: 429 Too Many Requests after 60

### 7.4 Security Test Schedule
- **Pre-launch**: Full penetration test (external firm)
- **Quarterly**: Automated SAST/DAST scans
- **Post-incident**: Regression tests for any discovered vulnerabilities

---

## 8. User Acceptance Testing (UAT)

### 8.1 Scope
Beta users validate features meet real-world needs.

### 8.2 Participants
- 20 job seekers (diverse: new grads, mid-career, career pivoters)
- 10 recruiters (5 in-house, 5 agency)

### 8.3 UAT Process
1. **Onboarding**: Invite beta users, provide instructions
2. **Task scenarios**: "Apply to 5 jobs and track them"
3. **Feedback collection**: In-app surveys, weekly interviews
4. **Bug reporting**: Dedicated Slack channel, priority triage
5. **Iteration**: Fix P0 bugs, incorporate P1 feedback

### 8.4 UAT Acceptance Criteria
- [ ] 80% of users complete onboarding without support
- [ ] 70% say they'd recommend RoleFerry (NPS >40)
- [ ] 90% of P0 bugs fixed before launch
- [ ] <5% of users encounter critical errors

---

## 9. Regression Testing

### 9.1 Purpose
Ensure new code doesn't break existing functionality.

### 9.2 Approach
- **Automated regression suite**: Run all unit, integration, E2E tests on every PR
- **Manual smoke tests**: QA team validates critical flows after deployment
- **Monitoring**: Datadog alerts on error rate spikes post-deployment

### 9.3 Regression Test Triggers
- **Every PR**: Unit + integration tests (via GitHub Actions)
- **Pre-deployment**: Full E2E suite (staging environment)
- **Post-deployment**: Smoke tests (production, non-destructive)

---

## 10. Test Data Management

### 10.1 Test Users
- **Seed data**: Create 100 test users (50 job seekers, 50 recruiters) with varied profiles
- **Credentials**: Store in password manager (1Password, AWS Secrets Manager)
- **Isolation**: Test data never touches production DB

### 10.2 Test Jobs & Companies
- **Scrape sample**: 1,000 real jobs (anonymized) for realistic testing
- **Synthetic data**: Generate fake companies/jobs for edge cases

### 10.3 Test Mailboxes
- **Dedicated test domains**: test-rf-01.com (not production domains)
- **Mock email service**: Use Mailhog (local) or Mailtrap (staging) to capture outbound emails

---

## 11. CI/CD Integration

### 11.1 Pipeline Stages

```
┌───────────────┐
│  Code Commit  │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Lint & SAST  │  (ESLint, Bandit, Snyk)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Unit Tests   │  (Pytest, Jest) - 80% coverage required
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Integration   │  (API + DB tests)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Build Image  │  (Docker)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Deploy Staging│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  E2E Tests    │  (Playwright on staging)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│Deploy Production│ (Manual approval required)
└───────────────┘
```

### 11.2 Failure Handling
- **Unit test failure**: Block merge (PR cannot merge)
- **Integration test failure**: Block deployment
- **E2E test failure**: Alert team, manual review (may be flake)
- **Performance regression**: Alert (non-blocking, but investigate)

---

## 12. Test Metrics & Reporting

### 12.1 Key Metrics
- **Code coverage**: Track weekly (target: 80%+ overall)
- **Test execution time**: Monitor for slowness (unit <5s, integration <60s, E2E <15min)
- **Flakiness rate**: E2E tests fail <5% due to non-code issues
- **Bug escape rate**: Bugs found in prod / Total bugs (target <10%)

### 12.2 Reporting
- **Dashboard**: Datadog + GitHub (test results, coverage trends)
- **Weekly report**: QA lead shares metrics with engineering team
- **Post-mortems**: Root cause analysis for production bugs

---

## 13. Test Environment Strategy

### 13.1 Environments

| Environment | Purpose | Data | Deployment |
|-------------|---------|------|------------|
| **Local** | Dev testing | Synthetic | Manual |
| **CI** | Automated tests | Synthetic (ephemeral) | Per commit |
| **Staging** | Pre-prod validation | Anonymized prod-like | Post-merge |
| **Production** | Live users | Real | Post-approval |

### 13.2 Staging Environment
- **Infrastructure**: Mirror of production (same AWS setup, smaller instances)
- **Data**: Anonymized copy of production DB (weekly refresh)
- **External services**: Sandbox APIs (Apollo test account, SendGrid test domain)

---

## 14. Acceptance Criteria (Testing Strategy)

- [ ] 80%+ code coverage achieved (unit + integration)
- [ ] E2E test suite covers 5 critical paths
- [ ] CI/CD pipeline integrated (tests block bad code)
- [ ] Performance baselines established (API <500ms, enrichment <30s)
- [ ] Security tests pass (no critical vulnerabilities)
- [ ] UAT completed with 20+ beta users
- [ ] Zero P0 bugs in production (3 months post-launch)

---

**Document Owner**: QA Lead  
**Reviewed By**: Engineering Manager, CTO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (evolve as product scales)

