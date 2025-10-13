# Scaling Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: DevOps, Engineering Leadership  
**Purpose**: Plan for scaling from 10K → 100K → 1M users

---

## 1. Scaling Milestones

| Milestone | Users | Applications/Day | Emails/Day | Infrastructure Changes |
|-----------|-------|------------------|------------|------------------------|
| **MVP** | 100 | 50 | 100 | 1 API server, 1 worker, db.t4g.medium |
| **Traction** | 1,000 | 500 | 1,000 | 2 API, 3 workers, db.t4g.large |
| **Growth** | 10,000 | 5,000 | 10,000 | 5 API, 10 workers, db.m6g.xlarge |
| **Scale** | 100,000 | 50,000 | 100,000 | 20 API, 50 workers, db.m6g.4xlarge + replicas |
| **Massive** | 1,000,000 | 500,000 | 1,000,000 | Microservices, sharding, multi-region |

---

## 2. Horizontal Scaling (Compute)

### 2.1 ECS Auto-Scaling

**Metric**: CPU Utilization

```bash
# Create auto-scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/roleferry-prod/api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 3 \
  --max-capacity 20

# CPU-based scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name api-cpu-scaling \
  --service-namespace ecs \
  --resource-id service/roleferry-prod/api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

**Result**: API scales from 3 → 20 tasks as CPU increases

---

### 2.2 Celery Worker Auto-Scaling

**Metric**: Queue Depth

```python
# Monitor queue depth in CloudWatch
def get_celery_queue_depth():
    from celery import Celery
    app = Celery('roleferry')
    inspector = app.control.inspect()
    
    # Get queue lengths
    reserved = inspector.reserved()
    active = inspector.active()
    
    total = sum(len(tasks) for tasks in reserved.values()) + \
            sum(len(tasks) for tasks in active.values())
    
    return total

# Auto-scale logic (Lambda function, runs every 5 min)
queue_depth = get_celery_queue_depth()

if queue_depth > 500:
    # Scale up workers (increase desired count)
    current_count = get_ecs_service_count('workers')
    new_count = min(current_count + 5, 50)  # Max 50 workers
    update_ecs_service('workers', new_count)
elif queue_depth < 50:
    # Scale down
    new_count = max(current_count - 2, 5)  # Min 5 workers
    update_ecs_service('workers', new_count)
```

---

## 3. Vertical Scaling (Database)

### 3.1 RDS Instance Size Progression

| Users | Instance Class | vCPU | RAM | Storage | IOPS | Cost/Mo |
|-------|----------------|------|-----|---------|------|---------|
| 1K | db.t4g.medium | 2 | 4 GB | 100 GB | 3,000 | $60 |
| 10K | db.t4g.large | 2 | 8 GB | 500 GB | 3,000 | $150 |
| 100K | db.m6g.xlarge | 4 | 16 GB | 1 TB | 12,000 | $400 |
| 1M | db.m6g.4xlarge | 16 | 64 GB | 5 TB | 48,000 | $1,600 |

**Upgrade Procedure** (requires downtime):
```bash
# Upgrade during maintenance window
aws rds modify-db-instance \
  --db-instance-identifier roleferry-prod-db \
  --db-instance-class db.m6g.xlarge \
  --apply-immediately

# Downtime: 5-15 minutes (RDS restarts)
```

---

### 3.2 Read Replicas (Horizontal Database Scaling)

**Use Case**: Offload read-heavy queries (job browsing, analytics)

```bash
# Create read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier roleferry-prod-db-replica-1 \
  --source-db-instance-identifier roleferry-prod-db \
  --db-instance-class db.t4g.large
```

**Application Changes**:
```python
# Route read queries to replica
if operation == 'read':
    db_url = settings.DATABASE_READ_URL  # Replica endpoint
else:
    db_url = settings.DATABASE_URL  # Primary
```

**Replication Lag**: Monitor, alert if >15 seconds

---

## 4. Caching Strategy

### 4.1 Redis Scaling

**Single Instance** (MVP):
```
cache.t4g.medium (2 vCPU, 3.09 GB RAM)
Cost: $60/month
Capacity: ~2.5 GB usable
```

**Redis Cluster** (10K users):
```
cache.m6g.large × 3 nodes (cluster mode)
Cost: $300/month
Capacity: ~15 GB (5 GB × 3 shards)
```

**Configuration**:
```bash
aws elasticache create-replication-group \
  --replication-group-id roleferry-redis-cluster \
  --replication-group-description "RoleFerry Redis Cluster" \
  --cache-node-type cache.m6g.large \
  --num-node-groups 3 \
  --replicas-per-node-group 1 \
  --automatic-failover-enabled
```

---

## 5. Database Sharding (1M+ Users)

### 5.1 Shard by User ID (Hash-Based)

**Strategy**: Route users to shards based on `user_id % 10`

**Setup** (Citus extension):
```sql
-- Enable Citus
CREATE EXTENSION citus;

-- Distribute applications table
SELECT create_distributed_table('applications', 'user_id');

-- All queries MUST include user_id in WHERE clause
SELECT * FROM applications WHERE user_id = 123;  -- Routes to correct shard
```

**Benefit**: 10x database capacity (10 shards × current capacity)

---

## 6. Microservices Extraction (Future)

### 6.1 When to Extract

**Triggers**:
- Single service >10K requests/sec
- Team >20 engineers (coordination overhead)
- Different scaling needs (enrichment vs. API)

### 6.2 Extraction Order

**Phase 1**: Enrichment Service
- High volume, CPU-intensive
- Independent scaling (can run 50 workers without scaling API)

**Phase 2**: Analytics Service
- Read-heavy, can use separate database
- Non-critical path (OK if slower)

**Phase 3**: Sequencer Service
- Complex state machine
- Scales independently of core API

---

## 7. Content Delivery (CDN)

### 7.1 CloudFront for Static Assets

**Setup**:
```bash
aws cloudfront create-distribution \
  --origin-domain-name roleferry-static.s3.amazonaws.com \
  --default-cache-behavior '{"ViewerProtocolPolicy":"redirect-to-https","AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"]},"Compress":true,"DefaultTTL":86400}'
```

**Benefits**:
- 10x faster asset delivery (edge caching)
- Reduced S3 costs (fewer requests)
- Global availability

---

## 8. Cost Optimization at Scale

### 8.1 Reserved Instances (40% savings)

**For**: Predictable baseline load

```bash
# Purchase 1-year reserved instance (RDS)
aws rds purchase-reserved-db-instances-offering \
  --reserved-db-instances-offering-id xxx \
  --db-instance-count 1
```

**Savings**: $150/mo → $90/mo (40% off)

---

### 8.2 API Bulk Pricing

**Negotiate at Volume**:
- Apollo: $99/mo (10K credits) → $299/mo (50K credits, 50% discount)
- SendGrid: $20/mo (40K emails) → $200/mo (1M emails, 50% discount)

---

## 9. Scaling Checklist (10K → 100K)

- [ ] Database: Upgrade to db.m6g.xlarge + 2 read replicas
- [ ] Redis: Cluster mode (3 shards)
- [ ] ECS API: Auto-scaling (3-20 tasks)
- [ ] ECS Workers: Auto-scaling (10-50 tasks)
- [ ] CDN: CloudFront for static assets
- [ ] Monitoring: Scale Datadog plan (more hosts)
- [ ] Negotiate: API volume discounts (Apollo, SendGrid)
- [ ] Load test: 10K concurrent users (verify capacity)

---

**Document Owner**: CTO, DevOps Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (update as we hit milestones)

