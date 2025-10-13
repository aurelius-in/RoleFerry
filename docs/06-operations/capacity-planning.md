# Capacity Planning
## RoleFerry Platform

**Version**: 1.0  
**Audience**: DevOps, Engineering Leadership, Finance  
**Purpose**: Forecast infrastructure needs and costs

---

## 1. Growth Projections

| Quarter | Users | Paid Users | Applications/Day | Emails/Day | Enrichments/Day |
|---------|-------|------------|------------------|------------|-----------------|
| **Q4 2025** (MVP) | 500 | 50 | 250 | 500 | 100 |
| **Q1 2026** | 2,000 | 200 | 1,000 | 2,000 | 400 |
| **Q2 2026** | 5,000 | 500 | 2,500 | 5,000 | 1,000 |
| **Q3 2026** | 10,000 | 1,000 | 5,000 | 10,000 | 2,000 |
| **Q4 2026** | 25,000 | 2,500 | 12,500 | 25,000 | 5,000 |
| **Q1 2027** | 50,000 | 5,000 | 25,000 | 50,000 | 10,000 |

---

## 2. Infrastructure Sizing

### 2.1 API Servers (ECS Fargate)

| Users | Concurrent | Requests/Sec | Tasks Needed | vCPU | Memory | Cost/Mo |
|-------|------------|--------------|--------------|------|--------|---------|
| 500 | 25 | 10 | 2 | 2 | 4 GB | $120 |
| 5,000 | 250 | 100 | 5 | 5 | 10 GB | $300 |
| 25,000 | 1,250 | 500 | 15 | 15 | 30 GB | $900 |
| 50,000 | 2,500 | 1,000 | 25 | 25 | 50 GB | $1,500 |

**Formula**: Tasks = (Concurrent Users / 100) × 2 (for headroom)

---

### 2.2 Celery Workers (Background Jobs)

| Enrichments/Day | Workers Needed | vCPU | Cost/Mo |
|-----------------|----------------|------|---------|
| 100 | 2 | 2 | $60 |
| 1,000 | 5 | 5 | $150 |
| 5,000 | 15 | 15 | $450 |
| 10,000 | 25 | 25 | $750 |

**Formula**: Workers = (Enrichments/Day / 200) + 2 (buffer)

---

### 2.3 PostgreSQL (RDS)

| Users | DB Size | Instance Class | vCPU | RAM | IOPS | Cost/Mo |
|-------|---------|----------------|------|-----|------|---------|
| 500 | 10 GB | db.t4g.medium | 2 | 4 GB | 3,000 | $60 |
| 5,000 | 100 GB | db.t4g.large | 2 | 8 GB | 3,000 | $150 |
| 25,000 | 500 GB | db.m6g.xlarge | 4 | 16 GB | 12,000 | $400 |
| 50,000 | 1 TB | db.m6g.2xlarge | 8 | 32 GB | 24,000 | $800 |

**Formula**: DB Size (GB) = Users × 20 MB (avg per user: apps, contacts, outreach)

---

### 2.4 Redis (ElastiCache)

| Users | Cache Size | Node Type | Cost/Mo |
|-------|------------|-----------|---------|
| 500 | 1 GB | cache.t4g.micro | $15 |
| 5,000 | 5 GB | cache.t4g.medium | $60 |
| 25,000 | 20 GB | cache.m6g.large | $150 |
| 50,000 | 50 GB | cache.m6g.xlarge | $300 |

**Formula**: Cache Size (GB) = Users × 10 KB (sessions + match scores)

---

## 3. External API Costs

### 3.1 Apollo (Enrichment)

| Enrichments/Day | Credits/Month | Plan | Cost/Mo |
|-----------------|---------------|------|---------|
| 100 | 3,000 | Basic | $99 |
| 1,000 | 30,000 | Growth | $499 |
| 5,000 | 150,000 | Enterprise | Negotiate ($1,500?) |

**Formula**: Credits = Enrichments × 30 days

---

### 3.2 SendGrid (Email)

| Emails/Day | Emails/Month | Plan | Cost/Mo |
|------------|--------------|------|---------|
| 500 | 15,000 | Essentials | $20 |
| 5,000 | 150,000 | Pro 100K | $90 |
| 25,000 | 750,000 | Premier 1M | $450 |

---

## 4. Total Infrastructure Cost Forecast

| Quarter | Users | AWS | APIs | Total | Cost/User/Mo |
|---------|-------|-----|------|-------|--------------|
| **Q4 2025** | 500 | $375 | $250 | $625 | $1.25 |
| **Q1 2026** | 2,000 | $900 | $750 | $1,650 | $0.83 |
| **Q2 2026** | 5,000 | $1,800 | $1,500 | $3,300 | $0.66 |
| **Q3 2026** | 10,000 | $3,500 | $3,000 | $6,500 | $0.65 |
| **Q4 2026** | 25,000 | $7,500 | $6,000 | $13,500 | $0.54 |
| **Q1 2027** | 50,000 | $12,000 | $10,000 | $22,000 | $0.44 |

**Key Insight**: Cost/user decreases as we scale (economies of scale).

---

## 5. Capacity Thresholds (When to Scale)

### Trigger 1: API CPU >70% (Scale Up)
**Current**: 5 ECS tasks, 70% CPU  
**Action**: Increase desired count to 7 (+40%)  
**Timeline**: Auto-scaling (within 5 minutes)

### Trigger 2: Database Connections >80%
**Current**: 80/100 connections used  
**Action**: 
- Short-term: Increase max_connections (100 → 150)
- Long-term: Add read replica, implement connection pooling

### Trigger 3: Queue Depth >500
**Current**: 500 enrichment jobs queued  
**Action**: Scale workers (10 → 15)  
**Timeline**: Manual (via Terraform or console)

### Trigger 4: Redis Memory >80%
**Current**: 4 GB / 5 GB used  
**Action**: Upgrade node type (cache.t4g.medium → cache.m6g.large)

---

## 6. Cost Optimization Strategies

### 6.1 Reserved Instances (Year 2+)
**For**: Predictable baseline (RDS, Redis)  
**Savings**: 40% vs. on-demand  
**Commitment**: 1 year

### 6.2 Spot Instances (Workers)
**For**: Fault-tolerant workloads (Celery workers)  
**Savings**: 70% vs. on-demand  
**Risk**: Can be interrupted (acceptable for background jobs)

### 6.3 API Caching
**Mechanism**: Cache enrichment results (company domain: 30 days, emails: 7 days)  
**Savings**: 40% reduction in API calls  
**Implementation**: Redis cache with TTL

---

## 7. Monitoring Capacity Metrics

```yaml
# Datadog monitors
- name: "ECS CPU High"
  query: "avg(last_10m):avg:ecs.cpu.utilization{cluster:roleferry-prod} > 70"
  
- name: "RDS Connections High"
  query: "avg(last_5m):aws.rds.database_connections{} > 80"
  
- name: "Redis Memory High"
  query: "avg(last_10m):aws.elasticache.database_memory_usage_percentage{} > 80"
  
- name: "Queue Backlog"
  query: "avg(last_10m):celery.queue.messages{queue:enrichment} > 500"
```

---

## 8. Acceptance Criteria

- [ ] Growth projections documented (6 quarters)
- [ ] Infrastructure sizing formulas defined
- [ ] Capacity thresholds established (when to scale)
- [ ] Cost forecast by quarter (AWS + APIs)
- [ ] Monitoring alerts configured (CPU, memory, connections, queue)
- [ ] Scaling procedures documented (manual steps, auto-scaling config)

---

**Document Owner**: DevOps Lead, CTO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (adjust based on actual growth)

