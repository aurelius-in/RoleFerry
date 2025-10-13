# Release Process
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Engineering, QA  
**Purpose**: Standard procedures for deploying to production

---

## 1. Release Philosophy

**"Ship early, ship often, ship safely."**

### Principles
- **Weekly releases** (every Friday, 2 PM PT)
- **Small batches** (5-10 features/fixes per release)
- **Automated testing** (no manual QA bottleneck)
- **Rollback ready** (revert in <5 minutes if issues)

---

## 2. Release Types

### 2.1 Regular Release (Weekly)

**Cadence**: Every Friday, 2 PM PT  
**Contents**: Features, bug fixes, improvements  
**Approval**: Engineering Manager  
**Downtime**: None (zero-downtime deployment)

---

### 2.2 Hotfix (As Needed)

**When**: P0 bug in production (e.g., auth broken, emails not sending)  
**Cadence**: ASAP (within 2 hours of discovery)  
**Approval**: CTO or on-call engineer  
**Process**: Fast-track (skip some steps for speed)

---

### 2.3 Major Release (Quarterly)

**When**: Breaking changes, major features (e.g., v2 API)  
**Cadence**: Quarterly (Q1, Q2, Q3, Q4)  
**Approval**: CTO + Product  
**Communication**: Blog post, email customers, changelog

---

## 3. Release Workflow

### 3.1 Development (Monday-Thursday)

**Branches**:
- `main`: Production (always deployable)
- `develop`: Integration branch (all features merge here)
- `feature/xyz`: Feature branches (one per feature)

**Process**:
1. Engineer creates `feature/xyz` from `develop`
2. Develops, commits, pushes
3. Opens PR (Pull Request) to `develop`
4. Code review (1+ approvals required)
5. Merges to `develop`

---

### 3.2 Staging Deployment (Thursday)

**Automatic**: Every merge to `develop` deploys to staging

**URL**: https://staging.roleferry.com

**Purpose**: Test in production-like environment

---

### 3.3 Smoke Testing (Thursday Afternoon)

**Who**: QA team or on-call engineer

**Test Cases** (5 critical paths):
1. ✅ Login works
2. ✅ Apply to job (end-to-end)
3. ✅ Tracker loads
4. ✅ Email sent (check SendGrid logs)
5. ✅ Upgrade to Pro (Stripe test mode)

**Duration**: 30 minutes

**If Pass**: Ready for production  
**If Fail**: Fix bugs, redeploy staging, retest

---

### 3.4 Release Candidate (Friday Morning)

**Create RC**:
```bash
git checkout develop
git pull
git checkout -b release/2025-10-13
git push origin release/2025-10-13
```

**Tag**:
```bash
git tag v1.4.0
git push origin v1.4.0
```

**CI/CD**: Builds Docker image, pushes to ECR

---

### 3.5 Production Deployment (Friday 2 PM PT)

**Why Friday?**: Low traffic (users job searching less on weekends), team available if issues

**Process**:
1. **Announce**: Slack #engineering ("Deploying v1.4.0 to prod")
2. **Deploy**: Trigger CI/CD pipeline (GitHub Actions)
3. **Monitor**: Watch Datadog (error rates, latency) for 30 minutes
4. **Verify**: Smoke test in prod (same 5 tests as staging)
5. **Announce**: Slack #general ("v1.4.0 deployed successfully")

**Duration**: 15 minutes (actual deployment)

**Downtime**: 0 (rolling deployment, blue-green)

---

### 3.6 Post-Release Monitoring (Friday Afternoon)

**Watch** (2-4 hours post-deploy):
- Error rates (should stay <1%)
- API latency (should stay <500ms P95)
- Celery queue depth (should stay <100)
- User reports (Intercom, Slack)

**If Issues**: Rollback (see below)

---

## 4. Rollback Procedure

### 4.1 When to Rollback

**Criteria**:
- Error rate >5% (vs. <1% baseline)
- P95 latency >2s (vs. <500ms baseline)
- Critical feature broken (e.g., auth, email sending)
- Multiple user reports of same issue

**Decision**: Engineering Manager or CTO

---

### 4.2 Rollback Steps

```bash
# 1. Find previous version
git log --oneline --decorate

# 2. Revert to previous tag
git checkout v1.3.0

# 3. Redeploy
# (Trigger CI/CD pipeline with previous version)

# 4. Verify
# Smoke test in prod (5 critical paths)

# 5. Announce
# Slack: "Rolled back to v1.3.0 due to [issue]"
```

**Duration**: 5 minutes

**Downtime**: 0 (same blue-green deployment)

---

## 5. Release Checklist

### Pre-Release (Thursday)

- [ ] All PRs merged to `develop`
- [ ] CI/CD tests pass (unit, integration)
- [ ] Staging deployed, smoke tested
- [ ] Release notes drafted (changelog)
- [ ] Database migrations tested (if any)

### Release Day (Friday)

- [ ] Create release branch (`release/YYYY-MM-DD`)
- [ ] Tag version (`v1.4.0`)
- [ ] Deploy to production (2 PM PT)
- [ ] Smoke test in prod
- [ ] Monitor for 2-4 hours
- [ ] Announce in Slack, email (if major release)

### Post-Release (Friday Evening)

- [ ] No critical issues (error rate normal)
- [ ] Release notes published (changelog.roleferry.com)
- [ ] Merge release branch → `main`

---

## 6. Release Notes Template

```markdown
# v1.4.0 (October 13, 2025)

## New Features
- ✨ AI Copilot (beta): Ask questions, get answers
- ✨ LivePages: Personalized landing pages for emails

## Improvements
- ⚡ 30% faster API response times (optimized queries)
- 📧 Better email drafts (improved AI prompts)

## Bug Fixes
- 🐛 Fixed: Tracker not loading for users with 100+ applications
- 🐛 Fixed: Match score calculation error for remote jobs

## Breaking Changes
- None

## Deprecations
- None

---

[Full Changelog](https://github.com/roleferry/roleferry/compare/v1.3.0...v1.4.0)
```

**Published**: changelog.roleferry.com, email to Pro users (if major changes)

---

## 7. Database Migrations

### 7.1 Migration Process

**Generate Migration** (Alembic):
```bash
alembic revision --autogenerate -m "Add LivePages table"
```

**Test Migration** (Staging):
```bash
# Run on staging DB first
alembic upgrade head
```

**Verify**: Check schema, test queries

**Production**: Apply during deployment (automatic via CI/CD)

---

### 7.2 Zero-Downtime Migrations

**Pattern**: Additive changes only (don't delete columns)

**Example** (Rename Column):
```python
# Step 1 (Release 1): Add new column
op.add_column('users', sa.Column('email_address', sa.String(255)))

# Step 2 (Release 1): Backfill data
op.execute('UPDATE users SET email_address = email')

# Step 3 (Release 2, after verification): Drop old column
op.drop_column('users', 'email')
```

**Rationale**: Allows rollback without data loss

---

## 8. Feature Flags (Release Toggles)

**Use Case**: Ship code without releasing feature

**Example**:
```python
if feature_flags.is_enabled('ai-copilot', user):
    return render_copilot_panel()
```

**Release Process**:
1. Deploy code (feature OFF for 100%)
2. Enable for team (internal testing)
3. Enable for 10% of users (canary)
4. Enable for 100% (if no issues)

**Benefit**: Decouple deploy from release, safe rollout

---

## 9. Acceptance Criteria

- [ ] Release process documented (weekly, hotfix, major)
- [ ] Release workflow defined (develop → staging → prod)
- [ ] Smoke tests automated (5 critical paths)
- [ ] Rollback procedure tested (can revert in <5 min)
- [ ] Release checklist (pre, during, post)
- [ ] Release notes template
- [ ] Database migration strategy (zero-downtime)

---

**Document Owner**: Engineering Manager, DevOps Lead  
**Version**: 1.0  
**Date**: October 2025

