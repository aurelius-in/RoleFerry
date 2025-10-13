# Quality Assurance Plan
## RoleFerry Platform

**Version**: 1.0  
**Audience**: QA Team, Engineering, Product  
**Purpose**: Comprehensive QA strategy and test planning

---

## 1. QA Mission

**"Ensure RoleFerry delivers reliable, secure, and delightful experiences through systematic testing and continuous quality improvement."**

---

## 2. Quality Gates

### 2.1 Code Quality Gates (PR Level)

**Before Merge**:
- [ ] All unit tests pass (80%+ coverage)
- [ ] Linters pass (no errors, warnings OK)
- [ ] Type checking passes (TypeScript, mypy)
- [ ] Code review approved (1+ reviewer)
- [ ] No security vulnerabilities (Snyk scan)

**Automated**: GitHub Actions blocks merge if gates fail

---

### 2.2 Release Quality Gates (Deployment)

**Before Staging Deploy**:
- [ ] All integration tests pass
- [ ] Performance regression tests pass (no >10% degradation)
- [ ] Database migrations tested

**Before Production Deploy**:
- [ ] E2E tests pass on staging (5 critical paths)
- [ ] Security scan clean (no critical vulnerabilities)
- [ ] Product Manager approval
- [ ] CTO approval (for major releases)

---

## 3. Test Types & Coverage

### 3.1 Unit Tests

**Scope**: Individual functions, pure logic

**Coverage Targets**:
- Services: 90% (business logic)
- API routes: 70% (some covered by integration tests)
- Utilities: 80%
- React components: 60%

**Tools**:
- Backend: pytest, pytest-cov
- Frontend: Jest, React Testing Library

**Example**:
```python
def test_calculate_match_score_perfect_match():
    service = JobMatchingService()
    score = service.calculate_match_score(user_id=1, job_id=1)
    assert score['score'] >= 90
    assert score['breakdown']['experience'] >= 85
```

---

### 3.2 Integration Tests

**Scope**: API + Database, Service + External APIs

**Coverage**: All API endpoints

**Example**:
```python
@pytest.mark.integration
async def test_apply_to_job_creates_application(client, db):
    response = await client.post('/api/applications', json={'job_id': 1})
    assert response.status_code == 201
    assert db.query(Application).count() == 1
```

---

### 3.3 End-to-End Tests

**Scope**: Critical user flows (browser automation)

**Tool**: Playwright

**5 Critical Paths**:
1. **Signup → Apply → Track**
2. **Recruiter Import → Enrich → Sequence**
3. **Reply Detection → Status Update → Notification**
4. **Upgrade to Paid → Subscription Active**
5. **CSV Export → Import (round-trip)**

**Example**:
```typescript
test('User can apply to job and see in tracker', async ({ page }) => {
  await page.goto('https://staging.roleferry.com/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button:has-text("Login")');
  
  await page.click('text=Senior Product Manager');
  await page.click('button:has-text("Apply")');
  
  await page.waitForSelector('text=Sequence started');
  await page.goto('/tracker');
  
  await expect(page.locator('text=Senior Product Manager')).toBeVisible();
});
```

---

### 3.4 Performance Tests

**Tool**: Locust (Python load testing)

**Scenarios**:
1. **Baseline**: 100 concurrent users, 10-minute duration
2. **Stress**: 1,000 concurrent users, find breaking point
3. **Spike**: 0 → 500 users in 1 minute (auto-scaling test)
4. **Endurance**: 100 users, 2 hours (memory leaks?)

**Example** (Locust):
```python
from locust import HttpUser, task, between

class RoleFerryUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login
        response = self.client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'password'
        })
        self.token = response.json()['access_token']
        self.client.headers['Authorization'] = f'Bearer {self.token}'
    
    @task(3)
    def browse_jobs(self):
        self.client.get('/api/jobs?limit=20')
    
    @task(1)
    def view_tracker(self):
        self.client.get('/api/applications')
    
    @task(1)
    def apply_to_job(self):
        self.client.post('/api/applications', json={'job_id': 1})
```

---

### 3.5 Security Tests

**SAST** (Static Analysis):
- Bandit (Python): Find security issues in code
- ESLint security plugin (JavaScript)
- Snyk (dependency vulnerabilities)

**DAST** (Dynamic Analysis):
- OWASP ZAP (penetration testing)
- Burp Suite (manual security testing)

**Penetration Testing**:
- Pre-launch: External firm (full audit)
- Quarterly: Automated scans
- Annually: External audit

**Test Cases**:
- [ ] SQL injection (all input fields)
- [ ] XSS (user-generated content)
- [ ] CSRF (state-changing operations)
- [ ] Authentication bypass
- [ ] Authorization escalation (access other user's data)
- [ ] Session fixation/hijacking
- [ ] Rate limit bypass

---

## 4. Test Data Management

### 4.1 Test Users

**Staging Environment**:
- 10 job seeker accounts (varied profiles)
- 5 recruiter accounts
- 2 admin accounts

**Credentials**: Stored in 1Password (shared vault)

---

### 4.2 Test Jobs & Companies

**Seed Data**:
- 100 real jobs (scraped, anonymized)
- 50 companies (with enriched data)
- 200 contacts (synthetic, not real emails)

**Reset Script**:
```bash
# Reset staging database to clean state
psql -h staging-db -U admin -d roleferry < seed_data.sql
```

---

## 5. Bug Tracking & Prioritization

### 5.1 Bug Severity

| Severity | Description | SLA | Examples |
|----------|-------------|-----|----------|
| **P0 (Blocker)** | Prevents core functionality | Fix in 24 hours | Can't apply to jobs, auth broken |
| **P1 (Critical)** | Major feature broken | Fix in 3 days | Enrichment failing 50%+ |
| **P2 (Major)** | Feature degraded | Fix in 1 week | Slow queries, UI glitches |
| **P3 (Minor)** | Cosmetic, edge case | Fix in 1 month | Typo, minor alignment issue |

---

### 5.2 Bug Workflow

```
1. BUG REPORTED (user, QA, or automated)
   ↓
2. TRIAGE (assign severity P0-P3)
   ↓
3. ASSIGN (to engineer)
   ↓
4. FIX (develop, test, code review)
   ↓
5. VERIFY (QA re-tests)
   ↓
6. DEPLOY (merge to develop → staging → production)
   ↓
7. CLOSE (notify reporter)
```

---

## 6. Regression Testing

### 6.1 Regression Suite

**Trigger**: Every production deployment

**Tests Included**:
- All P0 features (Jobs, Apply, Tracker, Sequences)
- Critical bug fixes (ensure they stay fixed)
- API smoke tests (health check, auth, key endpoints)

**Duration**: <15 minutes (automated)

**Execution**: CI/CD pipeline (GitHub Actions)

---

## 7. Test Environment Strategy

### 7.1 Environment Matrix

| Environment | Purpose | Data | Refresh Frequency |
|-------------|---------|------|-------------------|
| **Local** | Development | Synthetic (Docker seed) | Per developer |
| **CI** | Automated tests | Ephemeral (created/destroyed per run) | Per commit |
| **Staging** | Pre-production validation | Anonymized production copy | Weekly |
| **Production** | Live users | Real data | N/A |

---

### 7.2 Staging Data Refresh

**Weekly Process** (Sunday 2 AM UTC):
```bash
#!/bin/bash
# scripts/refresh-staging-data.sh

# 1. Create snapshot of production (non-PII tables only)
pg_dump -h prod-db -U admin \
  -t jobs -t companies \
  --data-only > staging_jobs.sql

# 2. Anonymize user data
pg_dump -h prod-db -U admin \
  -t users -t applications \
  --data-only | \
  sed 's/user@company\.com/user_123@test\.com/g' > staging_users.sql

# 3. Restore to staging
psql -h staging-db -U admin -d roleferry < staging_jobs.sql
psql -h staging-db -U admin -d roleferry < staging_users.sql

# 4. Reset sequences, IDs
psql -h staging-db -c "SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));"
```

---

## 8. Quality Metrics

### 8.1 Defect Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Bug Escape Rate** | <10% | Bugs found in prod / Total bugs |
| **Mean Time to Detect (MTTD)** | <1 hour | Alert → Discovery |
| **Mean Time to Fix (MTTF)** | <24 hours (P0) | Discovery → Fix deployed |
| **Test Coverage** | 80%+ | pytest --cov, Jest --coverage |
| **Flake Rate** | <5% | E2E tests failing inconsistently |

---

### 8.2 Release Quality

| Metric | Target |
|--------|--------|
| **Hotfixes per release** | <1 (ideally 0) |
| **Rollback rate** | <5% of deployments |
| **Customer-reported bugs** | <10/month |

---

## 9. User Acceptance Testing (UAT)

### 9.1 Beta Testing Program

**Participants**: 20-50 users (mix of job seekers and recruiters)

**Duration**: 2 weeks (pre-launch)

**Process**:
1. **Recruit**: Invite via email (existing waitlist)
2. **Onboard**: Provide instructions, test scenarios
3. **Test**: Users complete tasks, log feedback
4. **Feedback**: Daily Slack channel, weekly surveys
5. **Iterate**: Fix P0/P1 bugs, incorporate feedback
6. **Launch**: Beta users become advocates

**Scenarios for Beta Users**:
- [ ] Sign up, complete onboarding
- [ ] Apply to 5 jobs
- [ ] Review draft emails (quality check)
- [ ] Track applications in Tracker
- [ ] Import CSV (if recruiter)
- [ ] Report any bugs or confusion

---

## 10. Acceptance Criteria

- [ ] QA plan documented (test types, coverage targets)
- [ ] Quality gates enforced (PR, release)
- [ ] Test environments configured (local, CI, staging)
- [ ] Regression suite automated (runs on every deploy)
- [ ] Bug tracking process established (severity, SLA)
- [ ] UAT program defined (beta testers recruited)
- [ ] Quality metrics tracked (defect rate, MTTF, coverage)

---

**Document Owner**: QA Lead, Engineering Manager  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (refine based on defect trends)

