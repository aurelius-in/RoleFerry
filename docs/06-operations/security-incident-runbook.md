# Security Incident Runbook
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Security Team, On-Call Engineers, Leadership  
**Purpose**: Step-by-step procedures for security incidents

---

## 1. Incident Classification

| Severity | Description | Examples | Response Time |
|----------|-------------|----------|---------------|
| **P0 (Critical)** | Data breach, ongoing attack | Database exposed, active DDoS | 15 minutes |
| **P1 (High)** | Potential breach, vulnerability | SQL injection found, leaked API key | 1 hour |
| **P2 (Medium)** | Security degradation | Failed login spike, suspicious activity | 4 hours |
| **P3 (Low)** | Minor vulnerability | Outdated dependency (low severity) | 24 hours |

---

## 2. Runbook: Data Breach Response

### 2.1 Detection Signals
- Unusual database queries (mass SELECT of user table)
- AWS GuardDuty alert (compromised credentials)
- Spike in failed authentications
- User reports unauthorized access

### 2.2 Immediate Response (0-1 Hour)

**Step 1: Contain** (5 minutes)
```bash
# Revoke suspected compromised credentials
aws iam delete-access-key --access-key-id AKIA...

# Rotate all secrets
aws secretsmanager rotate-secret --secret-id roleferry/prod/database_url

# Block attacker IP (if identified)
aws ec2 authorize-security-group-ingress \
  --group-id sg-alb \
  --ip-permissions IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=ATTACKER_IP/32,Description=Blocked}] \
  --revoke
```

**Step 2: Assess Scope** (15 minutes)
```sql
-- Check audit logs (what was accessed?)
SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND (action LIKE '%SELECT%users%' OR action LIKE '%SELECT%contacts%')
ORDER BY created_at DESC;

-- Count affected users
SELECT COUNT(DISTINCT user_id) FROM audit_logs
WHERE ip_address = 'ATTACKER_IP';
```

**Step 3: Notify Leadership** (30 minutes)
- Slack: @CEO, @CTO, @Legal
- Email: security@roleferry.com
- Create incident channel: #incident-data-breach-001

**Step 4: Preserve Evidence** (1 hour)
```bash
# Export audit logs (for forensics)
psql -h prod-db -c "COPY (SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '48 hours') TO STDOUT CSV HEADER" > incident_logs.csv

# Export CloudTrail (AWS activity)
aws cloudtrail lookup-events \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --max-results 1000 > cloudtrail_incident.json

# Upload to secure location
aws s3 cp incident_logs.csv s3://roleferry-security-incidents/2025-10-13/ --sse AES256
```

---

### 2.3 Investigation (1-4 Hours)

**Questions to Answer**:
- How did attacker gain access? (leaked key? SQL injection? social engineering?)
- What data was accessed? (PII? credentials? all users or subset?)
- When did breach start? (first unauthorized access timestamp)
- Is attacker still active? (check for current connections)

**Tools**:
- AWS CloudTrail (API activity logs)
- Database audit logs (query history)
- Application logs (unusual patterns)
- Datadog APM (traces showing data access)

---

### 2.4 Notification (24-72 Hours)

**GDPR Requirement**: Notify supervisory authority within 72 hours

**Notify Users** (if PII exposed):
```
Subject: Important Security Notice - RoleFerry

Hi [Name],

We're writing to inform you of a security incident that may have affected your account.

What happened: On October 13, 2025, we detected unauthorized access to our database.

What was accessed: Email addresses and names for approximately 500 users. 
No passwords, resumes, or payment information was exposed.

What we've done:
- Immediately revoked access and blocked the attacker
- Rotated all credentials
- Patched the vulnerability
- Notified authorities (as required by law)

What you should do:
- Change your password (as a precaution)
- Monitor for unusual account activity
- Contact us with questions: security@roleferry.com

We sincerely apologize. Data security is our highest priority.

- RoleFerry Security Team
```

---

## 3. Runbook: Leaked API Key

### 3.1 Detection
- GitHub Secret Scanning alert
- Unusual API usage spike (Datadog)
- Vendor notification (SendGrid, Apollo)

### 3.2 Response (Immediate)

```bash
# 1. Revoke compromised key
aws secretsmanager update-secret \
  --secret-id roleferry/prod/sendgrid_api_key \
  --secret-string '{"key": "NEW_KEY_HERE"}'

# 2. Rotate immediately
# Login to SendGrid → API Keys → Delete old, Create new

# 3. Update Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id roleferry/prod/sendgrid_api_key \
  --secret-string "{\"key\": \"NEW_SENDGRID_KEY\"}"

# 4. Force redeploy (pick up new secret)
aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment

# 5. Check for unauthorized usage
# Review SendGrid activity logs (past 24 hours)
# Any emails sent that we didn't authorize?
```

**Downtime**: <5 minutes (during redeploy)

---

## 4. Runbook: DDoS Attack

### 4.1 Detection
- Traffic spike (10x normal)
- High latency (API >5s response time)
- AWS WAF blocks (rate limit triggers)

### 4.2 Response

**Step 1: Verify Attack** (5 minutes)
```bash
# Check traffic patterns
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name RequestCount \
  --dimensions Name=LoadBalancer,Value=app/roleferry-alb/xxx \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# If spike >10x normal → likely DDoS
```

**Step 2: Activate AWS Shield** (10 minutes)
```bash
# Enable AWS Shield Advanced (if P0, $3K/month but includes DDoS response team)
aws shield create-protection \
  --name roleferry-alb-protection \
  --resource-arn arn:aws:elasticloadbalancing:us-east-1:123456789:loadbalancer/app/roleferry-alb/xxx

# AWS DDoS Response Team (DRT) helps mitigate
```

**Step 3: WAF Tuning** (30 minutes)
```bash
# Lower rate limit threshold (2,000 → 500 req/5min per IP)
# Add geo-blocking (if attack from specific country)
# Enable CAPTCHA challenge
```

---

## 5. Post-Incident Procedures

### 5.1 Post-Mortem (Within 48 Hours)

**Template**:
```markdown
# Security Incident Post-Mortem

## Incident
[Title, Date, Duration]

## Impact
- Users affected: X
- Data exposed: Y
- Downtime: Z minutes

## Root Cause
[Technical explanation: How did this happen?]

## Timeline
- 14:30: Incident detected
- 14:35: Containment started
- 15:00: Vulnerability patched
- 15:30: Services restored

## What Went Well
- Fast detection (5 minutes)
- Effective containment

## What Went Poorly
- Should have caught in code review
- Monitoring didn't alert early enough

## Action Items
- [ ] Add input validation to X endpoint (@alice, Oct 15)
- [ ] Implement rate limiting on Y (@bob, Oct 16)
- [ ] Add integration test for Z (@charlie, Oct 17)
- [ ] Update runbook with learnings (@dave, Oct 18)
```

---

### 5.2 Lessons Learned Database

**Track All Incidents**:
- Post-mortem documents (Google Drive)
- Action items (Linear tickets)
- Metrics (MTTR, affected users)

**Quarterly Review**: Identify patterns, systemic improvements.

---

## 6. Communication Templates

### Internal (Slack #security-incidents)
```
[P0] Data Breach Detected - 14:30 UTC
Status: CONTAINING
Scope: ~500 users, PII exposed (names, emails)
Root cause: SQL injection (fixed)
Lead: @john
Next update: 15:00 UTC
```

### External (Status Page)
```
[SECURITY NOTICE] Service Temporarily Unavailable
We detected unusual activity and are investigating.
Your data security is our priority.
Next update: 30 minutes
```

### Regulatory (GDPR Notification)
```
To: Irish Data Protection Commission

Personal Data Breach Notification (GDPR Article 33)

Controller: RoleFerry Inc.
DPO: dpo@roleferry.com

Breach discovered: 2025-10-13 14:30 UTC
Nature: Unauthorized database access
Categories: Names, email addresses
Data subjects: ~500 EU residents
Consequences: Low risk (no passwords, payment data)
Measures: Access revoked, vulnerability patched, users notified

[Full details attached]
```

---

## 7. Acceptance Criteria

- [ ] Runbooks documented (data breach, leaked key, DDoS)
- [ ] Response times defined (P0: 15 min, P1: 1 hour)
- [ ] Containment procedures tested (tabletop exercise)
- [ ] Communication templates ready (internal, external, regulatory)
- [ ] Post-mortem process established
- [ ] Incident tracking system (Linear, Google Docs)
- [ ] Quarterly reviews scheduled (identify systemic issues)

---

**Document Owner**: CISO (future hire), CTO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: After each incident (update runbook)

