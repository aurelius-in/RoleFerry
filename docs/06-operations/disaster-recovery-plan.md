# Disaster Recovery Plan (DRP)
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Leadership, DevOps, SRE  
**Purpose**: Ensure business continuity during catastrophic failures

---

## 1. Disaster Scenarios

### 1.1 Severity Classification

| Level | Scenario | Impact | RTO | RPO |
|-------|----------|--------|-----|-----|
| **D1 (Critical)** | Region-wide AWS outage | Complete service down | 4 hours | 5 minutes |
| **D2 (Major)** | Database corruption | Data loss, read-only mode | 2 hours | 15 minutes |
| **D3 (Significant)** | Security breach (data exfiltration) | Trust loss, legal risk | 1 hour (contain) | N/A |
| **D4 (Moderate)** | Key vendor failure (SendGrid down) | Email sending down | 30 minutes | 0 (queue) |

**RTO** (Recovery Time Objective): Max downtime tolerable  
**RPO** (Recovery Point Objective): Max data loss tolerable

---

## 2. AWS Region Failure (D1)

### 2.1 Current Architecture (Single-Region)

**Primary**: us-east-1 (N. Virginia)

**Risk**: If us-east-1 fails, entire service down

---

### 2.2 Multi-Region Strategy (Phase 2 - Q4 2026)

**Architecture**:
```
┌──────────────────────────────────────────┐
│   Route 53 (Health Check)                 │
│   Directs traffic to healthy region       │
└────────────┬─────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
┌─────▼─────┐ ┌────▼──────┐
│ us-east-1  │ │ us-west-2 │
│ (Primary)  │ │ (Standby) │
│            │ │           │
│ ECS        │ │ ECS       │
│ RDS Master │ │ RDS Replica (read)
│ ElastiCache│ │ ElastiCache│
└────────────┘ └───────────┘
       │              │
       └──────┬───────┘
              │
      ┌───────▼────────┐
      │  S3 (global)   │
      │  Cross-region  │
      │  replication   │
      └────────────────┘
```

**Failover Process** (Manual, 4 hours):
1. **Detect**: Route 53 health check fails (us-east-1 unreachable)
2. **Promote**: RDS replica in us-west-2 → master
3. **Scale**: ECS desired count: 0 → 10 (us-west-2)
4. **Update**: Route 53 DNS → us-west-2 ALB
5. **Verify**: Test logins, apply to job, sequence send
6. **Announce**: Status page, email customers

**Cost**: $5K/month (standby infrastructure)

---

## 3. Database Disaster Recovery

### 3.1 RDS Backup Strategy

**Automated Backups**:
- Daily snapshots (retained 30 days)
- 5-minute transaction logs (PITR - Point-in-Time Recovery)

**Manual Snapshots**:
- Before major releases
- Retained indefinitely (until deleted)

---

### 3.2 Database Corruption Recovery

**Scenario**: Production database corrupted (bad migration, SQL injection)

**Recovery Steps**:
1. **Immediate**: Switch to read-only mode
   ```sql
   ALTER DATABASE roleferry SET default_transaction_read_only = true;
   ```

2. **Assess**: Determine corruption extent (which tables?)
   ```sql
   SELECT * FROM pg_stat_database WHERE datname = 'roleferry';
   -- Check for anomalies (sudden size change, connection spikes)
   ```

3. **Restore**: Launch new RDS from snapshot
   ```bash
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier roleferry-restore-2025-10-13 \
     --db-snapshot-identifier roleferry-prod-snapshot-2025-10-13-06-00
   ```

4. **Verify**: Test restored database (sample queries, user login)

5. **Cutover**: Update application DATABASE_URL → restored instance

6. **Post-Mortem**: How did corruption occur? Add safeguards.

**Downtime**: 2 hours (restore + cutover)  
**Data Loss**: Up to 5 minutes (since last transaction log)

---

## 4. Vendor Failure Scenarios

### 4.1 SendGrid Outage

**Impact**: Cannot send emails (sequences, notifications)

**Mitigation**:
- **Primary**: SendGrid
- **Fallback**: AWS SES (pre-configured, ready to activate)

**Failover**:
```python
def send_email(to, subject, body):
    try:
        # Try SendGrid first
        sendgrid_client.send(...)
    except Exception as e:
        logging.warning(f"SendGrid failed: {e}, falling back to SES")
        # Automatically fall back to SES
        ses_client.send_email(
            Source='noreply@roleferry.com',
            Destination={'ToAddresses': [to]},
            Message={'Subject': {'Data': subject}, 'Body': {'Text': {'Data': body}}}
        )
```

**Downtime**: <5 minutes (automatic fallback)

---

### 4.2 Apollo API Outage

**Impact**: Cannot enrich applications (find contacts)

**Mitigation**:
- Queue enrichment jobs (retry when Apollo recovers)
- Fall back to Clay API (secondary provider)
- Manual contact addition (user can paste LinkedIn URL)

**Action**: No immediate failover (enrichment not time-critical)

---

## 5. Security Breach Response

### 5.1 Data Breach (D3)

**See**: [Security Incident Runbook](security-incident-runbook.md) for detailed steps

**Key Actions** (first 24 hours):
1. **Contain**: Revoke credentials, block IPs (15 minutes)
2. **Assess**: Scope of breach (which data exfiltrated?) (1 hour)
3. **Notify**: Leadership, legal, affected users (4 hours)
4. **Remediate**: Patch vulnerability, rotate secrets (24 hours)
5. **Report**: Regulators (72 hours per GDPR)

---

## 6. Communication Plan

### 6.1 Status Page (status.roleferry.com)

**Powered by**: Statuspage.io (Atlassian)

**Components**:
- API
- Email Sending
- Enrichment
- Authentication

**Incident Levels**:
- 🟢 Operational
- 🟡 Degraded Performance
- 🟠 Partial Outage
- 🔴 Major Outage

**Example Update**:
```
Oct 13, 14:30 UTC - Investigating
We're investigating issues with email sending. Sequences are queued and will send once resolved.

Oct 13, 15:00 UTC - Identified
SendGrid is experiencing an outage. We've switched to our backup provider (AWS SES). Emails are sending normally.

Oct 13, 15:30 UTC - Resolved
All systems operational. Queued emails have been sent.
```

---

### 6.2 Customer Notifications

**Email Template** (Major Outage):
```
Subject: RoleFerry Service Update - [Status]

Hi [Name],

We're experiencing [issue]. Here's what's happening:

• What: [Brief description]
• Impact: [What you can/can't do]
• ETA: [Expected resolution time]

We're working to resolve this ASAP. Check status.roleferry.com for updates.

Apologies for the inconvenience.

- RoleFerry Team
```

---

## 7. Testing DR Plan

### 7.1 Quarterly DR Drill

**Scenario**: Simulate RDS failure

**Process**:
1. **Announce**: "DR drill starting at 10 AM Saturday (low traffic)"
2. **Execute**: Restore from snapshot to new RDS instance
3. **Cutover**: Point staging environment to restored DB
4. **Verify**: Run test suite, manual smoke tests
5. **Debrief**: What went well? What didn't?

**Success Criteria**: Restore completes in <2 hours

---

### 7.2 Annual Full Failover Test

**Scenario**: Simulate full us-east-1 outage (multi-region)

**Process**:
1. Promote us-west-2 RDS replica to master
2. Scale up ECS in us-west-2
3. Update Route 53 → us-west-2
4. Test with real user traffic (beta customers)
5. Fail back to us-east-1

**Success Criteria**: Failover in <4 hours, no data loss

---

## 8. DR Roles & Responsibilities

| Role | Responsibility | On-Call? |
|------|----------------|----------|
| **Incident Commander** | Coordinates response, makes decisions | Yes (CTO or VP Eng) |
| **Technical Lead** | Executes recovery steps | Yes (Senior DevOps) |
| **Communications Lead** | Updates status page, emails customers | Yes (CEO or Product) |
| **Legal/Compliance** | Regulatory notifications, breach response | On-demand |

**PagerDuty**: Escalation policy (DevOps → CTO → CEO)

---

## 9. Data Recovery Priorities

### 9.1 Recovery Sequence

**Priority 1** (Recover First):
- Users table (authentication)
- Applications table (user data)
- Outreach table (sequences)

**Priority 2**:
- Jobs, Companies (can re-scrape)
- Contacts (can re-enrich)

**Priority 3**:
- Audit logs (compliance, not critical for service)
- Analytics (nice-to-have)

---

## 10. Acceptance Criteria

- [ ] Disaster scenarios identified and classified (D1-D4)
- [ ] RTO/RPO defined per scenario
- [ ] Multi-region architecture planned (Phase 2)
- [ ] Database recovery procedures documented
- [ ] Vendor failover strategies (SendGrid → SES)
- [ ] Communication plan (status page, customer emails)
- [ ] DR drills scheduled (quarterly)
- [ ] Roles & responsibilities assigned (Incident Commander, etc.)

---

**Document Owner**: CTO, DevOps Lead  
**Reviewed By**: CEO, Board (annually)  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (update after each DR drill)

