# Incident Response Plan
## RoleFerry Platform

**Version**: 1.0  
**Audience**: On-Call Engineers, Leadership, Support  
**Purpose**: Standard procedures for handling production incidents

---

## 1. Incident Severity Levels

| Level | Description | Examples | SLA |
|-------|-------------|----------|-----|
| **P0 (Critical)** | Total service outage | Database down, API 100% errors | <15 min |
| **P1 (High)** | Major functionality broken | Enrichment failing, 5xx >5% | <1 hour |
| **P2 (Medium)** | Partial degradation | Slow queries, single mailbox down | <4 hours |
| **P3 (Low)** | Minor issues, no user impact | Low disk space warning | <24 hours |

---

## 2. Incident Lifecycle

```
1. DETECTION → 2. TRIAGE → 3. RESPONSE → 4. RESOLUTION → 5. POST-MORTEM
```

---

## 3. Phase 1: Detection

### 3.1 Detection Methods
- **Automated alerts** (Datadog, CloudWatch): Error rates, latency spikes
- **User reports**: Support tickets, Twitter mentions
- **Manual discovery**: Engineer notices issue during development
- **Vendor notifications**: AWS outage, SendGrid degradation

### 3.2 Alert Channels
- **P0**: PagerDuty (phone call) + Slack #incidents
- **P1**: PagerDuty (push notification) + Slack #incidents
- **P2**: Slack #engineering
- **P3**: Email to engineering@roleferry.com

---

## 4. Phase 2: Triage

### 4.1 Incident Commander
**On-Call Engineer** becomes Incident Commander (IC):
- Coordinates response
- Makes decisions (rollback, scale up, contact vendor)
- Communicates status updates

**If IC unavailable**: Secondary on-call → Engineering Manager → CTO

### 4.2 Triage Checklist
- [ ] **Acknowledge alert** (PagerDuty) → stops paging
- [ ] **Assess severity** (how many users affected?)
- [ ] **Create incident channel** (#incident-[ID] in Slack)
- [ ] **Notify stakeholders** (tag @engineering, @leadership)
- [ ] **Start war room** (Zoom call for P0/P1)

---

## 5. Phase 3: Response

### 5.1 Investigation
**Gather data**:
- Datadog APM traces (identify slow/failing service)
- CloudWatch Logs (filter by ERROR, last 30 min)
- Database metrics (RDS CPU, connections)
- External vendor status (AWS, SendGrid status pages)

**Hypothesis**:
- Recent deployment? → Likely code bug
- Spike in traffic? → DDoS or viral growth
- Provider down? → External dependency

---

### 5.2 Containment
**P0 Incidents**:
- **Rollback**: Revert to previous version (ECS task definition)
- **Isolate**: Disable failing feature (feature flag)
- **Scale**: Add more resources (ECS tasks, RDS instance size)

**Examples**:
```bash
# Rollback API service
aws ecs update-service --cluster roleferry-prod --service api --task-definition roleferry-api:N-1

# Disable feature
aws secretsmanager update-secret --secret-id roleferry/prod/feature_flags --secret-string '{"ENABLE_COPILOT": false}'

# Scale up workers
aws ecs update-service --cluster roleferry-prod --service workers --desired-count 15
```

---

### 5.3 Communication

**Internal** (Slack #incidents):
```
[P0] Database Connection Failure - 14:30 UTC
Status: INVESTIGATING
Impact: API down, users cannot apply
Root cause: Unknown (checking RDS metrics)
ETA: 15 minutes
Next update: 14:45
IC: @john
```

**External** (Status page):
```
[INVESTIGATING] Service Disruption
We're investigating issues affecting job applications.
Next update: 14:45 UTC
```

**Update Frequency**:
- **P0**: Every 15 minutes
- **P1**: Every 30 minutes
- **P2**: Every 2 hours

---

## 6. Phase 4: Resolution

### 6.1 Resolution Actions
- **Deploy fix**: Merge hotfix, deploy to production
- **Restore service**: Restart crashed services, promote DB failover
- **Vendor escalation**: Contact Apollo, SendGrid support (if external issue)

### 6.2 Verification
- [ ] Health checks passing
- [ ] Error rate back to baseline (<0.1%)
- [ ] Latency normal (<500ms P95)
- [ ] Key features working (Apply, Tracker, Copilot)
- [ ] Monitor for 30 minutes (ensure stable)

### 6.3 Incident Closure
**Slack update**:
```
[RESOLVED] Database Connection Failure - 15:15 UTC
Duration: 45 minutes
Root cause: RDS max_connections exhausted (killed idle connections)
Impact: ~500 users unable to apply during outage
Fix: Increased max_connections from 100 → 200, deployed connection pooling fix
Post-mortem: Scheduled for tomorrow 10 AM
IC: @john
```

**Status page**:
```
[RESOLVED] Service Disruption
Resolved at 15:15 UTC. All systems operational.
Post-mortem will be published within 48 hours.
```

---

## 7. Phase 5: Post-Mortem

### 7.1 Blameless Post-Mortem
**Timeline**: Within 48 hours of resolution

**Attendees**: IC, affected team members, CTO, CEO (for P0)

**Agenda**:
1. **Timeline**: What happened, when (chronological)
2. **Root cause**: Why it happened (5 whys analysis)
3. **Impact**: Users affected, revenue lost, reputation
4. **What went well**: Effective response actions
5. **What went poorly**: Gaps, mistakes
6. **Action items**: Preventive measures, owner, deadline

**Template**:
```markdown
# Post-Mortem: Database Connection Failure (Oct 13, 2025)

## Summary
45-minute outage due to connection pool exhaustion.

## Timeline
- 14:30: Alert triggered (database connections = 100)
- 14:35: On-call acknowledged, started investigation
- 14:40: Identified root cause (idle connections not closing)
- 14:50: Killed idle connections, service restored
- 15:00: Deployed connection pooling fix
- 15:15: Verified stable, incident closed

## Root Cause
Application code not using context managers → connections leaked.

## Impact
- Users affected: ~500
- Revenue loss: ~$150 (45 min downtime)
- Applications missed: ~25

## Action Items
- [ ] Fix connection leaks in user service (@alice, Oct 15)
- [ ] Add connection pool monitoring alert (@bob, Oct 14)
- [ ] Increase max_connections to 200 (@bob, Completed)
- [ ] Add integration test for connection cleanup (@charlie, Oct 16)

## Lessons Learned
- **Good**: Fast detection (5 min), effective containment
- **Bad**: Should have caught in staging (better load testing needed)
```

---

## 8. Incident Metrics

### 8.1 Tracking
| Metric | Target | Measurement |
|--------|--------|-------------|
| **MTTD** (Mean Time To Detect) | <5 min | Alert → Acknowledgment |
| **MTTR** (Mean Time To Resolve) | <30 min (P0) | Detection → Resolution |
| **Incident frequency** | <2 P0/quarter | Count in tracking sheet |

### 8.2 Trends
**Monthly review**:
- Incident count by severity
- Most common root causes
- Effectiveness of mitigations

**Goal**: Decrease incidents over time (better monitoring, code quality).

---

## 9. War Room Procedures (P0 Incidents)

### 9.1 Who Joins
- **Incident Commander** (on-call)
- **CTO** (decision-making authority)
- **Relevant engineers** (based on affected service)
- **CEO** (if user-facing, reputation risk)
- **Support Lead** (manage user communication)

### 9.2 Zoom Call Etiquette
- **Mute when not speaking**
- **IC drives**: Others contribute when asked
- **Decisions**: IC makes calls; CTO can override
- **Updates**: IC gives updates every 15 min (even if "no progress")

---

## 10. Runbooks

### 10.1 Runbook Template
Each common incident has runbook:

**Title**: [Incident Type]  
**Symptoms**: [How to detect]  
**Triage Steps**: [What to check]  
**Resolution**: [Commands to run]  
**Escalation**: [Who to contact]

**Example**: See [Monitoring & Observability Guide](monitoring-observability.md) for runbooks.

---

## 11. Communication Templates

### Internal (Slack #incidents)
```
[P0/P1/P2] [Title] - [Time]
Status: INVESTIGATING | FIXING | MONITORING | RESOLVED
Impact: [User-facing description]
Root cause: [Known/Unknown]
ETA: [Estimate or "Unknown"]
Next update: [Time]
IC: [@person]
```

### External (Status Page)
```
[INVESTIGATING] [Title]
Posted: [Time UTC]

[Brief description of issue]
[Impact on users]
[What we're doing]

Next update: [Time UTC]
```

### User Email (Post-Incident)
```
Subject: Service Disruption [Date] - Resolved

Hi [Name],

We experienced a service disruption on [Date] from [Start Time] to [End Time] ([Duration]).

What happened: [1-sentence explanation]
Impact: [What you couldn't do]
Resolution: [How we fixed it]

We apologize for the inconvenience. [Compensation if applicable]

- RoleFerry Team
```

---

## 12. Acceptance Criteria

- [ ] Incident severity levels defined (P0-P3)
- [ ] Response procedures documented (detection → post-mortem)
- [ ] Runbooks created for top 5 incidents
- [ ] Communication templates ready (internal, external, user email)
- [ ] On-call rotation established (PagerDuty)
- [ ] Post-mortem process practiced (tabletop exercise)
- [ ] All engineers trained on incident response

---

**Document Owner**: SRE / DevOps Lead  
**Reviewed By**: Engineering Team, CTO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (refine based on actual incidents)

