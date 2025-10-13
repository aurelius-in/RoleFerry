# Monitoring & Observability Guide
## RoleFerry Platform

**Document Type**: Operations  
**Audience**: DevOps, SRE, On-Call Engineers  
**Purpose**: Comprehensive monitoring strategy and runbooks

---

## 1. Monitoring Philosophy

### 1.1 The Three Pillars
1. **Metrics**: Quantitative data (latency, throughput, error rate)
2. **Logs**: Event records (errors, warnings, debug info)
3. **Traces**: Request flows across services (distributed tracing)

### 1.2 Monitoring Goals
- **Detect issues** before users report them
- **Diagnose root causes** quickly (MTTD < 5 minutes)
- **Resolve incidents** fast (MTTR < 30 minutes for P1)
- **Prevent recurrence** via post-mortems and alerts

---

## 2. Key Metrics (Golden Signals)

### 2.1 Latency
**What**: Time to process requests

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API P95 latency | <500ms | >1s for 5 min |
| API P99 latency | <1s | >2s for 5 min |
| Enrichment P95 | <30s | >60s for 10 min |
| Email queue latency | <5 min | >15 min |

**Datadog Query**:
```
avg:roleferry.api.request_duration{env:prod}.as_rate()
```

---

### 2.2 Traffic
**What**: Request volume (QPS)

| Metric | Baseline | Alert Threshold |
|--------|----------|-----------------|
| API requests/sec | 100 | <10 (down) or >500 (spike) |
| Enrichment jobs/min | 10 | <1 (stuck queue) |
| Email sends/hour | 200 | >1K (abuse?) |

---

### 2.3 Errors
**What**: Failed requests

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API 5xx error rate | <0.1% | >1% for 5 min |
| API 4xx error rate | <5% | >20% (bad requests spike) |
| Celery task failure rate | <1% | >5% for 10 min |
| Email bounce rate | <3% | >10% (deliverability issue) |

**Alert Example (Datadog)**:
```
avg(last_5m):sum:roleferry.api.errors{status:5xx}.as_count() > 50
```

---

### 2.4 Saturation
**What**: Resource utilization

| Resource | Target | Alert Threshold |
|----------|--------|-----------------|
| RDS CPU | <70% | >85% for 10 min |
| RDS connections | <80% max | >90% |
| Redis memory | <80% max | >90% |
| ECS CPU | <70% | >85% (scale up) |
| Disk (PostgreSQL) | <80% | >90% |

---

## 3. Application Metrics

### 3.1 Business Metrics
| Metric | Dashboard | Alert |
|--------|-----------|-------|
| **Signups/day** | Trend chart | <10 (unusual drop) |
| **Applications created/day** | Trend chart | - |
| **Reply rate (%)** | Line chart | <10% (quality issue) |
| **Enrichment success rate** | Gauge | <75% |
| **Email deliverability rate** | Gauge | <95% |

### 3.2 Feature Usage
| Feature | Metric | Purpose |
|---------|--------|---------|
| Jobs List | Page views, time on page | Engagement |
| Apply button | Click-through rate | Conversion funnel |
| Copilot | Query count, response time | Adoption |
| CSV Import | Upload count, row count | Power user feature |

---

## 4. Infrastructure Metrics

### 4.1 AWS CloudWatch

#### ECS Fargate
- **CPUUtilization**: Avg, Max (per service)
- **MemoryUtilization**: Avg, Max
- **RunningTaskCount**: Current count vs. desired

#### RDS PostgreSQL
- **CPUUtilization**: Avg over 5 min
- **DatabaseConnections**: Current / max_connections
- **FreeableMemory**: Available RAM
- **WriteLatency**: Disk I/O latency
- **ReplicaLag**: Read replica delay (if applicable)

#### ElastiCache Redis
- **CPUUtilization**: Avg
- **DatabaseMemoryUsagePercentage**: Memory used
- **CurrConnections**: Active connections
- **Evictions**: Cache evictions (>0 = memory pressure)

#### ALB (Load Balancer)
- **TargetResponseTime**: P95 latency
- **HTTPCode_Target_5XX_Count**: Backend errors
- **HealthyHostCount**: Available targets
- **RequestCount**: Total traffic

---

## 5. Logging Strategy

### 5.1 Log Levels
| Level | Use Case | Example |
|-------|----------|---------|
| **DEBUG** | Development only | "Entering function calculate_match()" |
| **INFO** | Normal operation | "User 123 applied to job 456" |
| **WARNING** | Recoverable errors | "Enrichment provider timeout, retrying" |
| **ERROR** | Failed operations | "Failed to send email: SMTP error" |
| **CRITICAL** | System failure | "Database connection pool exhausted" |

### 5.2 Structured Logging (JSON)
```python
import logging
import json

logger = logging.getLogger(__name__)

logger.info(json.dumps({
    "event": "application_created",
    "user_id": 123,
    "job_id": 456,
    "application_id": 789,
    "timestamp": "2025-10-13T14:30:00Z",
    "duration_ms": 250
}))
```

**Benefits**:
- Easily searchable in CloudWatch Insights
- Parse-able for analytics
- Context-rich (no guessing)

### 5.3 Log Aggregation (CloudWatch Logs)

**Log Groups**:
- `/ecs/roleferry-api`
- `/ecs/roleferry-workers`
- `/aws/rds/instance/roleferry-prod-db/error`
- `/aws/lambda/enrichment-trigger`

**Retention**: 30 days (hot), archive to S3 (1 year)

---

## 6. Distributed Tracing (Datadog APM)

### 6.1 Traced Operations
- **API requests**: Client → API Gateway → Service → Database
- **Enrichment jobs**: Celery task → Apollo API → NeverBounce → Save contacts
- **Email sending**: Sequencer → Mailbox selection → SendGrid API

### 6.2 Trace Example (Enrichment)
```
[REQUEST] POST /api/applications (250ms)
  └─ [SQL] INSERT INTO applications (5ms)
  └─ [CELERY] enrich_application.delay() (1ms)
      └─ [HTTP] Apollo API: search_people (800ms)
      └─ [HTTP] NeverBounce: verify_emails (600ms)
      └─ [SQL] INSERT INTO contacts (10ms)
      └─ [CELERY] start_sequence.delay() (2ms)
```

**Benefit**: Identify slow dependencies (e.g., Apollo API = bottleneck).

---

## 7. Alerting Strategy

### 7.1 Alert Severity Levels

| Severity | SLA | Notification | Example |
|----------|-----|--------------|---------|
| **P0 (Critical)** | Immediate response | PagerDuty (phone call) | Database down, API 100% error rate |
| **P1 (High)** | Response <30 min | PagerDuty + Slack | 5xx errors >1%, enrichment queue stuck |
| **P2 (Medium)** | Response <4 hours | Slack only | Slow query (>1s), high CPU (>85%) |
| **P3 (Low)** | Response <24 hours | Email | Disk usage >80%, stale cache |

### 7.2 Alert Examples (Datadog)

#### API Error Rate Spike
```yaml
name: "API 5xx Error Rate High"
query: "avg(last_5m):sum:roleferry.api.errors{status:5xx}.as_count() > 50"
message: |
  @pagerduty-roleferry
  API is returning 5xx errors at an elevated rate.
  Check Datadog APM for traces: https://app.datadoghq.com/apm/traces
  Runbook: https://docs.roleferry.com/runbooks/api-errors
```

#### Database Connection Pool Exhausted
```yaml
name: "RDS Connection Pool >90%"
query: "avg(last_5m):aws.rds.database_connections{dbinstanceidentifier:roleferry-prod-db} > 90"
message: |
  @slack-ops
  Database connections are at 90%+ of max_connections.
  Check for connection leaks or scale read replicas.
  Runbook: https://docs.roleferry.com/runbooks/db-connections
```

#### Enrichment Queue Backlog
```yaml
name: "Celery Queue Depth >500"
query: "avg(last_10m):celery.queue.messages{queue:enrichment} > 500"
message: |
  @slack-eng
  Enrichment queue is backed up (>500 jobs pending).
  Consider scaling workers or investigating stuck jobs.
  Runbook: https://docs.roleferry.com/runbooks/queue-backlog
```

---

## 8. Dashboards

### 8.1 Primary Dashboard (Overview)

**Widgets**:
1. **API Health**
   - P95 latency (line chart)
   - Request rate (line chart)
   - Error rate (bar chart, stacked by status code)

2. **Business Metrics**
   - Active users (gauge)
   - Applications created today (number)
   - Reply rate (gauge with target line)

3. **Infrastructure**
   - ECS CPU/Memory (heat map per service)
   - RDS connections (line chart)
   - Redis memory usage (gauge)

4. **Alerts**
   - Active alerts (table)
   - Alert history (timeline)

**Link**: https://app.datadoghq.com/dashboard/roleferry-overview

---

### 8.2 Enrichment Dashboard

**Widgets**:
1. **Throughput**
   - Jobs started/completed (line chart)
   - Queue depth (area chart)

2. **Success Rate**
   - Enrichment success % (gauge)
   - Contacts found per job (histogram)
   - Email verification rate (gauge)

3. **Provider Performance**
   - Apollo API latency (line chart)
   - Clay API latency (line chart)
   - Error rate by provider (bar chart)

---

### 8.3 Deliverability Dashboard

**Widgets**:
1. **Send Volume**
   - Emails sent/hour (line chart)
   - Sends by mailbox (stacked area)

2. **Health**
   - Avg health score (gauge)
   - Mailboxes by status (pie chart: active/paused/warmup)

3. **Engagement**
   - Delivery rate (gauge)
   - Bounce rate (line chart)
   - Reply rate (line chart)

---

## 9. Runbooks (Quick Reference)

### 9.1 API 5xx Errors Spike

**Symptoms**: Error rate >1%, users reporting failures

**Diagnosis**:
1. Check Datadog APM traces (identify failing endpoint)
2. Check CloudWatch Logs (filter by ERROR level)
3. Check RDS connections (are we exhausted?)

**Common Causes**:
- Database connection leak → Restart API service
- Downstream API timeout (Apollo, SendGrid) → Check provider status
- Code bug (recent deployment) → Rollback

**Resolution**:
1. If DB connections exhausted:
   ```bash
   aws ecs update-service --cluster roleferry-prod --service api --force-new-deployment
   ```
2. If provider issue: Enable fallback providers
3. If recent deploy: Rollback to previous task definition

**Post-Incident**:
- Write post-mortem (what, why, how to prevent)
- Add test coverage for root cause

---

### 9.2 Enrichment Queue Stuck

**Symptoms**: Queue depth >500, enrichment jobs not completing

**Diagnosis**:
1. Check Celery Flower dashboard (worker status)
2. Check CloudWatch Logs (worker errors)
3. Check API rate limits (Apollo, Clay)

**Common Causes**:
- Worker pod crashed → Scale up workers
- API rate limit hit → Throttle job rate or upgrade plan
- Infinite retry loop → Fix bug, purge queue

**Resolution**:
1. Scale workers:
   ```bash
   aws ecs update-service --cluster roleferry-prod --service workers --desired-count 15
   ```
2. Purge stuck jobs (if buggy):
   ```python
   from celery import Celery
   app = Celery('roleferry')
   app.control.purge()  # Caution: deletes all queued tasks
   ```

---

### 9.3 Database Connection Pool Exhausted

**Symptoms**: API slow, "too many connections" errors

**Diagnosis**:
1. Check RDS connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';
   ```
2. Check for connection leaks (unclosed sessions)

**Resolution**:
1. Kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND state_change < NOW() - INTERVAL '10 minutes';
   ```
2. Increase max_connections (temporary):
   ```bash
   aws rds modify-db-parameter-group --db-parameter-group-name roleferry-prod \
     --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=immediate"
   ```
3. Fix connection leak in code (use context managers)

---

## 10. On-Call Procedures

### 10.1 On-Call Schedule
- **Primary**: Week-long rotation (Mon-Sun)
- **Secondary**: Backup if primary unavailable
- **Escalation**: CTO if both unavailable

### 10.2 Response SLAs
| Severity | Acknowledge | Resolution |
|----------|-------------|------------|
| P0 | 5 min | 1 hour |
| P1 | 15 min | 4 hours |
| P2 | 1 hour | 24 hours |
| P3 | 24 hours | 1 week |

### 10.3 Incident Response Workflow
1. **Acknowledge** alert in PagerDuty (stops paging)
2. **Triage** severity (upgrade/downgrade as needed)
3. **Diagnose** root cause (dashboards, logs, traces)
4. **Communicate** status (Slack #incidents, status page if user-facing)
5. **Resolve** issue (deploy fix, scale resources, etc.)
6. **Post-mortem** (within 48 hours, blameless)

---

## 11. Post-Mortem Template

**Incident**: [Title]  
**Date**: YYYY-MM-DD  
**Duration**: X hours  
**Severity**: P0/P1/P2

### What Happened
[Timeline of events]

### Root Cause
[Technical explanation]

### Impact
- Users affected: X
- Revenue impact: $Y
- Downtime: Z minutes

### Resolution
[What fixed it]

### Action Items
- [ ] Fix X (owner: @person, deadline: date)
- [ ] Add monitoring for Y (owner: @person)
- [ ] Update runbook Z

---

## 12. Acceptance Criteria

- [ ] All golden signals (latency, traffic, errors, saturation) monitored
- [ ] Alerts configured for P0, P1, P2 scenarios
- [ ] Dashboards created (Overview, Enrichment, Deliverability)
- [ ] Runbooks written for top 3 failure modes
- [ ] On-call rotation established
- [ ] Post-mortem process documented

---

**Document Owner**: SRE / DevOps Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (refine based on incidents)

