# Release Process
## RoleFerry Platform

**Audience**: Engineering, DevOps, Product  
**Purpose**: Standard operating procedure for releases

---

## 1. Release Types

| Type | Frequency | Risk | Approval | Example |
|------|-----------|------|----------|---------|
| **Hotfix** | As needed | High | CTO | Critical bug fix |
| **Minor** | Weekly | Medium | Eng Lead | New features, improvements |
| **Major** | Quarterly | High | CEO + CTO | Breaking changes, major features |

---

## 2. Release Workflow

### Step 1: Code Complete
- [ ] All features merged to `develop` branch
- [ ] Code review completed (1+ approval)
- [ ] All tests passing (unit, integration)
- [ ] No linter errors
- [ ] Documentation updated

### Step 2: Staging Deployment
```bash
git checkout develop
git pull origin develop
git push origin develop  # Triggers auto-deploy to staging
```

- [ ] Staging deployment successful
- [ ] Smoke tests pass (manual or automated)
- [ ] QA approval (test cases executed)

### Step 3: Release Branch
```bash
git checkout -b release/v0.2.0
git push origin release/v0.2.0
```

- [ ] Version bump (package.json, __version__)
- [ ] CHANGELOG.md updated
- [ ] Release notes drafted

### Step 4: Production Deployment
```bash
git checkout main
git merge release/v0.2.0 --no-ff
git tag -a v0.2.0 -m "Release v0.2.0: MVP Launch"
git push origin main --tags
```

- [ ] Production deployment (requires manual approval)
- [ ] Health checks pass
- [ ] Monitor for 1 hour (error rates, latency)

### Step 5: Post-Release
- [ ] Merge `main` back to `develop`
- [ ] Close release ticket
- [ ] Announce in Slack (#releases)
- [ ] Update status page (status.roleferry.com)

---

## 3. Rollback Procedure

### Immediate Rollback (P0 Issue)
```bash
# Revert to previous ECS task definition
aws ecs update-service \
  --cluster roleferry-prod \
  --service api \
  --task-definition roleferry-api:N-1  # Previous version
```

### Database Rollback (if migration ran)
```bash
alembic downgrade -1
```

---

## 4. Release Checklist

### Pre-Release
- [ ] All tests passing
- [ ] Performance regression tests
- [ ] Security scan (Snyk)
- [ ] Database migration tested (staging)
- [ ] Rollback plan documented
- [ ] On-call engineer notified

### During Release
- [ ] Deploy during off-peak hours (3-5 AM UTC)
- [ ] Status page updated ("Maintenance in progress")
- [ ] Monitor error rates (Datadog)
- [ ] Verify critical paths (API health, jobs list, apply)

### Post-Release
- [ ] Verify key metrics (signups, applications, reply rate)
- [ ] Monitor for 1 hour
- [ ] Close release ticket
- [ ] Post-mortem if issues occurred

---

## 5. Version Numbering

**Format**: MAJOR.MINOR.PATCH (e.g., 1.2.3)

- **MAJOR**: Breaking changes, major features (0 → 1)
- **MINOR**: New features, backward-compatible (0.1 → 0.2)
- **PATCH**: Bug fixes, hotfixes (0.1.0 → 0.1.1)

---

## 6. Communication

### Internal (Slack #releases)
```
🚀 Release v0.2.0 deployed to production

Features:
- AI Copilot (beta)
- Match scoring improvements
- 2-step sequences

Fixes:
- Enrichment timeout issue (#234)
- CSV import UTF-8 encoding (#245)

Deployed: 2025-10-13 03:15 UTC
Rollback: aws ecs update-service --task-definition roleferry-api:42
```

### External (Email to users, optional)
```
Subject: New RoleFerry Features: AI Copilot + Improved Match Scoring

Hi [Name],

We've just released new features to make your job search even more effective:

✨ AI Copilot: Ask questions like "Why is this a fit?" and get instant answers
📊 Better Match Scoring: More accurate job-to-profile matching
⚡ Faster Sequences: 2-step outreach for quicker replies

Try them out: https://roleferry.com

- RoleFerry Team
```

---

**Document Owner**: Engineering Manager  
**Version**: 1.0  
**Date**: October 2025

