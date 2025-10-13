# Caching Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, DevOps  
**Purpose**: Optimize performance through strategic caching

---

## 1. Cache Layers

```
┌─────────────────────────────────────┐
│   Browser Cache (Static Assets)     │  ← CloudFront CDN (1 week)
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   API Response Cache (Varnish)      │  ← Future (Phase 2)
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Application Cache (Redis)         │  ← Match scores, IJP (hours-days)
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Database Query Cache               │  ← PostgreSQL (automatic)
└─────────────────────────────────────┘
```

---

## 2. Redis Cache Patterns

### 2.1 Cache Keys Naming Convention

```
{entity}:{identifier}:{field}
```

**Examples**:
- `user:1234:session`
- `match:1234:5678` (user 1234, job 5678)
- `ijp:1234` (user 1234's job preferences)
- `company:101:enrichment` (company 101's enriched data)

---

### 2.2 Match Score Caching

```python
# backend/app/services/cache.py
from redis import Redis
import json

class CacheService:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    def get_match_score(self, user_id: int, job_id: int):
        """Get cached match score"""
        key = f"match:{user_id}:{job_id}"
        cached = self.redis.get(key)
        
        if cached:
            return json.loads(cached)
        return None
    
    def set_match_score(self, user_id: int, job_id: int, score_data: dict):
        """Cache match score (24-hour TTL)"""
        key = f"match:{user_id}:{job_id}"
        self.redis.setex(
            key,
            86400,  # 24 hours
            json.dumps(score_data)
        )
    
    def invalidate_user_matches(self, user_id: int):
        """Clear all match scores for user (when IJP changes)"""
        pattern = f"match:{user_id}:*"
        keys = self.redis.keys(pattern)
        
        if keys:
            self.redis.delete(*keys)
            logging.info(f"Invalidated {len(keys)} match scores for user {user_id}")
```

**Usage**:
```python
# Check cache first
cached_score = cache.get_match_score(user_id, job_id)
if cached_score:
    return cached_score

# Cache miss → calculate and store
score = calculate_match_score(user_id, job_id)
cache.set_match_score(user_id, job_id, score)
return score
```

---

### 2.3 Company Enrichment Caching

```python
def get_company_enrichment(company_id: int):
    """Get enriched company data (30-day cache)"""
    key = f"company:{company_id}:enrichment"
    cached = redis_client.get(key)
    
    if cached:
        data = json.loads(cached)
        # Check if stale (>30 days)
        cached_at = datetime.fromisoformat(data['cached_at'])
        if datetime.utcnow() - cached_at < timedelta(days=30):
            return data
    
    # Cache miss or stale → fetch fresh
    enrichment = fetch_company_from_clearbit(company.domain)
    
    enrichment['cached_at'] = datetime.utcnow().isoformat()
    
    redis_client.setex(
        key,
        30 * 24 * 60 * 60,  # 30 days
        json.dumps(enrichment)
    )
    
    return enrichment
```

**Benefit**: 40% reduction in Clearbit API calls (saves $500/month at scale)

---

## 3. Cache Invalidation Strategy

### 3.1 When to Invalidate

| Event | Cache to Invalidate | TTL Alternative |
|-------|---------------------|-----------------|
| **User updates IJP** | All match scores for user | N/A (must recalculate) |
| **Job updated** | Match scores for that job | 24h TTL (acceptable staleness) |
| **Company enriched** | Company data cache | 30-day TTL (re-enrich monthly) |
| **User logs out** | Session data | 15-min TTL (token expiry) |

### 3.2 Cache Stampede Prevention

**Problem**: Cache expires → 100 concurrent requests all recalculate

**Solution**: Lock pattern

```python
def get_with_lock(key, calculate_func, ttl):
    """Get from cache with lock to prevent stampede"""
    
    # Try cache
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    
    # Acquire lock
    lock_key = f"lock:{key}"
    lock_acquired = redis_client.setnx(lock_key, "1")
    
    if lock_acquired:
        redis_client.expire(lock_key, 10)  # Lock expires in 10s
        
        try:
            # Calculate
            value = calculate_func()
            
            # Cache
            redis_client.setex(key, ttl, json.dumps(value))
            
            return value
        finally:
            redis_client.delete(lock_key)
    else:
        # Another request is calculating, wait briefly then retry
        time.sleep(0.1)
        return get_with_lock(key, calculate_func, ttl)
```

---

## 4. Cache Warming Strategies

### 4.1 Proactive Warming (Popular Jobs)

**Strategy**: Pre-calculate match scores for top 100 jobs (all users)

```python
# Cron job (runs hourly)
def warm_popular_jobs():
    """Pre-calculate match scores for trending jobs"""
    
    # Get top 100 jobs (most viewed in last 24h)
    popular_jobs = db.query(Job)\
        .order_by(Job.view_count.desc())\
        .limit(100).all()
    
    # Get all active users
    active_users = db.query(User)\
        .filter(User.last_login > datetime.utcnow() - timedelta(days=7))\
        .all()
    
    # Calculate match scores (background)
    for user in active_users:
        for job in popular_jobs:
            score = calculate_match_score(user.id, job.id)
            cache.set_match_score(user.id, job.id, score)
    
    logging.info(f"Warmed cache: {len(active_users)} users × {len(popular_jobs)} jobs")
```

**Benefit**: Jobs List loads instantly (90% cache hit rate)

---

## 5. Cache Monitoring

### 5.1 Metrics

```python
# Track cache performance
@app.middleware("http")
async def track_cache_metrics(request, call_next):
    cache_status = "miss"
    
    # Check if response came from cache (custom header)
    response = await call_next(request)
    
    if response.headers.get('X-Cache-Hit'):
        cache_status = "hit"
    
    statsd.increment(
        'roleferry.cache.requests',
        tags=[f'status:{cache_status}', f'endpoint:{request.url.path}']
    )
    
    return response
```

---

### 5.2 Cache Hit Rate Targets

| Cache Type | Target Hit Rate | Current |
|------------|-----------------|---------|
| **Match scores** | 80% | 📊 TBD |
| **Company enrichment** | 90% | 📊 TBD |
| **IJP data** | 95% | 📊 TBD |
| **Session data** | 99% | 📊 TBD |

**Alert**: If hit rate drops >10%, investigate (cache not warming? TTL too short?)

---

## 6. Cache Size Planning

### 6.1 Estimated Redis Usage (10K Users)

| Data Type | Size per Item | Count | Total |
|-----------|---------------|-------|-------|
| **Match scores** | 100 bytes | 10K users × 100 jobs | 100 MB |
| **Company data** | 5 KB | 5K companies | 25 MB |
| **IJP data** | 2 KB | 10K users | 20 MB |
| **Sessions** | 1 KB | 10K users | 10 MB |
| **Total** | | | **155 MB** |

**Redis Instance**: cache.t4g.medium (3.09 GB) → 5% utilization ✅

**At 100K users**: ~1.5 GB → cache.m6g.large (6.38 GB)

---

## 7. Acceptance Criteria

- [ ] Redis caching implemented (match scores, company data, IJP)
- [ ] Cache keys follow naming convention
- [ ] TTL appropriate (24h for match scores, 30d for companies)
- [ ] Invalidation logic correct (IJP change → clear match scores)
- [ ] Stampede prevention (lock pattern)
- [ ] Cache warming (popular jobs pre-calculated)
- [ ] Monitoring (hit rate, size, evictions)

---

**Document Owner**: Backend Lead, DevOps  
**Version**: 1.0  
**Date**: October 2025

