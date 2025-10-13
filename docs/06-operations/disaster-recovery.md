# Disaster Recovery & Business Continuity Plan
## RoleFerry Platform

**Document Type**: Operations / Business Continuity  
**Audience**: Leadership, DevOps, SRE  
**Purpose**: Ensure rapid recovery from catastrophic failures

---

## 1. Executive Summary

### 1.1 Business Impact
**Downtime Cost**:
- 1 hour outage = ~$4,000 lost MRR (based on $1M ARR, 24/7 usage)
- Reputation damage: Churn risk increases 5-10% per hour down
- Compliance: SLA credits owed to enterprise customers

### 1.2 Recovery Targets
| Metric | Target | Notes |
|--------|--------|-------|
| **RTO** (Recovery Time Objective) | 1 hour | System operational |
| **RPO** (Recovery Point Objective) | 15 minutes | Max data loss |
| **MTTR** (Mean Time To Recovery) | 30 minutes | Average incident |

---

## 2. Disaster Scenarios

### 2.1 Scenario Matrix

| Scenario | Probability | Impact | Recovery Time | Priority |
|----------|-------------|--------|---------------|----------|
| **Single EC2/ECS failure** | High | Low | 5 min (auto) | P3 |
| **Database failure** | Medium | Critical | 15-30 min | P0 |
| **AWS region outage** | Low | Critical | 1-4 hours | P0 |
| **Data breach** | Low | Severe | Days (forensics) | P0 |
| **Complete data loss** | Very Low | Catastrophic | 2-8 hours | P0 |
| **DDoS attack** | Medium | Medium | 30 min-2 hours | P1 |
| **Key personnel loss** | Medium | Medium | Weeks (hire) | P2 |

---

## 3. High Availability Architecture

### 3.1 Current Setup (Production)

```
┌──────────────────────────────────────────────────────────┐
│                  Route 53 (DNS)                           │
│          Health checks + failover routing                 │
└────────────────┬─────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
  PRIMARY                 SECONDARY
  (us-east-1)             (us-west-2)
    │                         │
┌───▼────────────┐    ┌───────▼──────────┐
│   CloudFront   │    │   CloudFront     │
│      (CDN)     │    │    (failover)    │
└───┬────────────┘    └──────────────────┘
    │
┌───▼────────────┐
│      ALB       │  (Multi-AZ)
│  (us-east-1a,b)│
└───┬────────────┘
    │
┌───▼────────────┐
│ ECS Fargate    │  (3+ tasks across 2 AZs)
│  API Servers   │
└───┬────────────┘
    │
┌───▼────────────┐
│ RDS PostgreSQL │  (Multi-AZ, read replicas)
│  (Primary +    │
│   Standby)     │
└────────────────┘
```

**Key Resilience Features**:
- **Multi-AZ**: Database auto-fails to standby (RTO: 1-2 min)
- **Auto-scaling**: ECS scales on CPU/memory (min: 3, max: 20)
- **Health checks**: ALB removes unhealthy targets (30s interval)

---

## 4. Backup Strategy

### 4.1 Database Backups

#### Automated Snapshots (RDS)
- **Frequency**: Daily at 3:00 AM UTC
- **Retention**: 30 days
- **Storage**: AWS-managed, encrypted (AES-256)
- **RTO**: 2 hours (restore + warm cache)
- **RPO**: 24 hours (worst case)

#### Continuous WAL Archiving
- **Frequency**: Real-time (Write-Ahead Log streaming)
- **Retention**: 7 days
- **Storage**: S3 (encrypted)
- **RTO**: 15 minutes (point-in-time recovery)
- **RPO**: <1 minute

**Test Restore** (monthly):
```bash
# Create test instance from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier roleferry-test-restore \
  --db-snapshot-identifier roleferry-prod-snapshot-2025-10-13

# Verify data integrity
psql -h roleferry-test-restore.xxxx.rds.amazonaws.com -U admin -d roleferry \
  -c "SELECT COUNT(*) FROM users;"

# Clean up
aws rds delete-db-instance --db-instance-identifier roleferry-test-restore --skip-final-snapshot
```

---

### 4.2 File Storage Backups (S3)

#### Resumes & Uploads
- **Versioning**: Enabled (keep last 30 versions)
- **Replication**: Cross-region (us-east-1 → us-west-2)
- **Lifecycle**: Archive to Glacier after 90 days
- **RTO**: Immediate (versioning), 1 hour (Glacier restore)

#### Database Exports (Compliance)
- **Frequency**: Weekly (full CSV export)
- **Retention**: 2 years (compliance requirement)
- **Storage**: S3 Glacier Deep Archive
- **Purpose**: Regulatory, legal discovery

---

### 4.3 Configuration Backups

#### Infrastructure as Code (IaC)
- **Terraform state**: S3 backend with versioning
- **Secrets**: AWS Secrets Manager (automatic rotation, versioning)
- **Application config**: Git repository (version-controlled)

#### Docker Images
- **Registry**: AWS ECR (3 latest versions retained)
- **Backup**: S3 (monthly snapshots of critical images)

---

## 5. Disaster Recovery Procedures

### 5.1 Procedure: Database Failure (Primary)

**Scenario**: RDS primary instance fails (hardware failure, corruption)

**Detection**:
- CloudWatch Alarm: `DatabaseConnections = 0` for 2 minutes
- Health check failures in API logs

**Automatic Response** (Multi-AZ):
1. AWS detects failure (1-2 minutes)
2. Automatic failover to standby (in different AZ)
3. DNS updated to point to new primary (30-60 seconds)
4. **Total RTO**: 2-3 minutes (minimal intervention)

**Manual Response** (if auto-failover fails):
```bash
# 1. Promote read replica to primary
aws rds promote-read-replica \
  --db-instance-identifier roleferry-prod-replica

# 2. Update application DATABASE_URL in Secrets Manager
aws secretsmanager update-secret \
  --secret-id roleferry/prod/database_url \
  --secret-string "postgresql://user:pass@NEW-ENDPOINT/roleferry"

# 3. Force redeploy API services (pick up new secret)
aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment

# 4. Verify connectivity
curl https://api.roleferry.com/health
```

**Post-Recovery**:
- [ ] Investigate root cause (AWS support ticket)
- [ ] Create new read replica
- [ ] Update runbook with learnings

**Estimated Downtime**: 5-10 minutes (manual), 2-3 minutes (automatic)

---

### 5.2 Procedure: AWS Region Outage (us-east-1)

**Scenario**: Entire us-east-1 region unavailable (rare but happened: Dec 2021)

**Detection**:
- All health checks fail across services
- AWS Status Dashboard confirms region issue

**Failover to us-west-2** (DR Region):

**Prerequisites** (setup in advance):
- [ ] RDS read replica in us-west-2 (async replication, ~5-min lag)
- [ ] ECS cluster pre-configured (but scaled to 0 normally)
- [ ] S3 bucket replication active
- [ ] Route 53 health checks configured (automatic failover)

**Steps**:
```bash
# 1. Promote us-west-2 read replica
aws rds promote-read-replica \
  --db-instance-identifier roleferry-prod-dr \
  --region us-west-2

# 2. Scale up ECS services in us-west-2
aws ecs update-service \
  --cluster roleferry-dr \
  --service api \
  --desired-count 3 \
  --region us-west-2

aws ecs update-service \
  --cluster roleferry-dr \
  --service workers \
  --desired-count 5 \
  --region us-west-2

# 3. Update Secrets Manager (us-west-2) with promoted DB endpoint
aws secretsmanager update-secret \
  --secret-id roleferry/dr/database_url \
  --secret-string "postgresql://user:pass@roleferry-prod-dr.xxxx.us-west-2.rds.amazonaws.com/roleferry" \
  --region us-west-2

# 4. Route 53 automatically fails over (health checks detect us-east-1 down)
# No manual DNS change needed (health check-based failover pre-configured)

# 5. Verify DR region is serving traffic
curl https://api.roleferry.com/health
```

**Communication**:
- [ ] Post status update: "We're experiencing issues due to AWS outage. Failing over to backup region."
- [ ] ETA: "Expect 30-60 minutes for full recovery."

**Post-Recovery** (when us-east-1 restored):
```bash
# 1. Replicate data back to us-east-1
# 2. Restore services in us-east-1
# 3. Fail back (reverse DNS to us-east-1)
# 4. Scale down us-west-2 to standby mode
```

**Estimated Downtime**: 30-60 minutes (manual failover)  
**Data Loss**: <15 minutes (replication lag)

---

### 5.3 Procedure: Complete Data Loss (Catastrophic)

**Scenario**: Database deleted, backups corrupted (malicious actor, bug)

**Detection**:
- All API requests return 500 errors
- Database connection fails
- RDS console shows instance deleted

**Recovery** (Worst Case):
```bash
# 1. Restore from most recent snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier roleferry-prod-restored \
  --db-snapshot-identifier roleferry-prod-snapshot-2025-10-13

# 2. Wait for restore (15-30 minutes for 500GB DB)
aws rds describe-db-instances \
  --db-instance-identifier roleferry-prod-restored \
  --query 'DBInstances[0].DBInstanceStatus'

# 3. Perform point-in-time recovery (if WAL available)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier roleferry-prod-restored \
  --target-db-instance-identifier roleferry-prod-final \
  --restore-time 2025-10-13T10:30:00Z

# 4. Update application secrets
aws secretsmanager update-secret \
  --secret-id roleferry/prod/database_url \
  --secret-string "postgresql://user:pass@roleferry-prod-final.xxxx.rds.amazonaws.com/roleferry"

# 5. Redeploy services
aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment
aws ecs update-service --cluster roleferry-prod --service workers --force-new-deployment

# 6. Verify data integrity
psql -h roleferry-prod-final.xxxx.rds.amazonaws.com -U admin -d roleferry \
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM applications;"
```

**Data Loss**:
- Snapshot: Up to 24 hours (if WAL unavailable)
- WAL: <15 minutes (best case)

**Estimated Downtime**: 2-4 hours

**Post-Incident**:
- [ ] Forensic investigation (how did this happen?)
- [ ] Implement additional safeguards (MFA on AWS console, deletion protection)
- [ ] Notify affected users (if data loss >1 hour)

---

## 6. Data Breach Response

### 6.1 Incident Response Plan

**Phase 1: Detection & Containment** (0-4 hours)
1. **Detect**: Unusual access patterns, security alert
2. **Isolate**: Revoke compromised credentials, block attacker IP
3. **Assess**: What data was accessed?
4. **Contain**: Shut down vulnerable service if needed

**Phase 2: Investigation** (4-24 hours)
1. **Forensics**: AWS CloudTrail logs, application logs
2. **Scope**: Which users affected? What PII exposed?
3. **Root cause**: How did breach occur?

**Phase 3: Notification** (24-72 hours)
1. **Legal**: Consult lawyer (GDPR 72-hour notification requirement)
2. **Users**: Email affected users (if PII exposed)
3. **Authorities**: Report to FTC, state AGs (if >500 users)

**Phase 4: Remediation** (Ongoing)
1. **Patch**: Fix vulnerability
2. **Strengthen**: Add MFA, rotate all secrets
3. **Monitor**: Enhanced logging for 90 days

---

## 7. Business Continuity

### 7.1 Critical Personnel

| Role | Primary | Backup | Escalation |
|------|---------|--------|------------|
| **On-Call Engineer** | Rotating | Secondary on-call | CTO |
| **Database Admin** | DevOps Lead | Senior Backend Eng | CTO |
| **Security Officer** | CTO | External Consultant | CEO |
| **Communications** | CEO | VP Product | Board |

**Knowledge Transfer**:
- [ ] Runbooks up-to-date (monthly review)
- [ ] Access credentials shared (1Password team vault)
- [ ] On-call rotation training (shadow week)

---

### 7.2 Vendor Dependencies

| Vendor | Service | Criticality | Backup Plan |
|--------|---------|-------------|-------------|
| **AWS** | Infrastructure | Critical | Multi-region, consider GCP (Phase 3) |
| **SendGrid** | Email sending | Critical | Mailgun fallback (active) |
| **Apollo** | Contact enrichment | High | Clay fallback (active) |
| **Stripe** | Payments | High | Manual invoicing (emergency) |
| **Datadog** | Monitoring | Medium | CloudWatch (native fallback) |

**SLA Review**: Quarterly check vendor SLAs, uptime history

---

## 8. Testing & Drills

### 8.1 DR Test Schedule

| Test Type | Frequency | Scope | Duration |
|-----------|-----------|-------|----------|
| **Failover test** | Quarterly | Database multi-AZ | 30 min |
| **Backup restore** | Monthly | RDS snapshot → test instance | 1 hour |
| **Region failover** | Annually | Full us-east-1 → us-west-2 | 4 hours |
| **Security drill** | Bi-annually | Simulated breach | 2 hours |
| **Tabletop exercise** | Quarterly | Walk through scenarios | 1 hour |

### 8.2 Tabletop Exercise Template

**Scenario**: "At 2 PM on Tuesday, us-east-1 goes offline. Walk through failover."

**Participants**: CTO, DevOps Lead, 2 engineers, CEO (observer)

**Steps**:
1. **Detection**: Who notices? How long to confirm?
2. **Decision**: Who authorizes failover? (CTO)
3. **Execution**: Who runs commands? (On-call engineer)
4. **Communication**: Who notifies users? (CEO/Product)
5. **Debrief**: What went well? What needs improvement?

**Output**: Update runbook with gaps identified

---

## 9. Communication Plan

### 9.1 Internal Communication (Incident)

**Slack Channels**:
- `#incidents`: Real-time updates during outage
- `#general`: Status updates for entire team

**Update Frequency**:
- Every 15 minutes during P0 incident
- Every hour during P1 incident

**Template**:
```
[UPDATE 14:30] RoleFerry Incident #123
Status: INVESTIGATING
Impact: API down, users cannot apply to jobs
ETA: Working on failover, 30 min
Next update: 14:45
Incident lead: @john
```

---

### 9.2 External Communication (Users)

**Status Page**: status.roleferry.com (powered by StatusPage.io)

**Template**:
```
[INVESTIGATING] API Degradation
Posted: Oct 13, 2025 14:15 UTC

We're aware of issues affecting job applications.
Our team is investigating and will provide updates every 15 minutes.

Next update: 14:30 UTC
```

**Email to Affected Users** (post-incident):
```
Subject: RoleFerry Service Disruption [Oct 13] - Resolved

Hi [Name],

We experienced a service disruption today (Oct 13, 2:00-3:30 PM UTC)
that prevented job applications from being created.

What happened: [Brief explanation]
Impact: Your applications during this window were not saved.
Resolution: Service is now fully restored.

We apologize for the inconvenience. As a thank you for your patience,
we've credited your account with [compensation].

- RoleFerry Team
```

---

## 10. Acceptance Criteria

- [ ] RTO/RPO targets defined (1 hour, 15 minutes)
- [ ] Multi-AZ database configured
- [ ] DR region (us-west-2) set up with read replica
- [ ] Backup strategy documented (snapshots, WAL, S3)
- [ ] Recovery procedures written (database, region, data loss)
- [ ] DR tests scheduled (quarterly failover, monthly restore)
- [ ] Communication plan defined (internal, external)
- [ ] Runbooks tested (simulated outage drills)

---

**Document Owner**: CTO, DevOps Lead  
**Reviewed By**: CEO, Legal, Board (annually)  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (update after incidents, annually for compliance)

