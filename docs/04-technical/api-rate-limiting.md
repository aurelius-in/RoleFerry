# API Rate Limiting Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, DevOps  
**Purpose**: Prevent abuse, ensure fair usage

---

## 1. Rate Limit Tiers

### 1.1 By Subscription Tier

| Tier | Requests/Minute | Enrichments/Month | Emails/Month | Burst Allowance |
|------|-----------------|-------------------|--------------|-----------------|
| **Free** | 30 | 30 | 100 | 50 req (1 min) |
| **Pro** | 60 | 500 | 1,000 | 120 req |
| **Teams** | 120 | 2,000 | 5,000 | 200 req |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom |

### 1.2 By Endpoint Type

| Endpoint Type | Limit | Rationale |
|---------------|-------|-----------|
| **Read** (GET /jobs) | 60/min | Browsing is frequent |
| **Write** (POST /applications) | 30/min | Less frequent, more expensive |
| **Enrichment** (POST /enrich) | 10/min | Expensive (costs $0.15/call) |
| **Auth** (POST /login) | 5/min | Prevent brute force |

---

## 2. Implementation

### 2.1 Redis Token Bucket

```python
# backend/app/middleware/rate_limit.py
from redis import Redis
from fastapi import Request, HTTPException
import time

class TokenBucketRateLimiter:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client
    
    def check_limit(
        self,
        identifier: str,
        capacity: int,
        refill_rate: float,
        cost: int = 1
    ) -> bool:
        """
        Token bucket algorithm
        
        Args:
            identifier: User ID or IP
            capacity: Max tokens (burst allowance)
            refill_rate: Tokens per second
            cost: Tokens consumed by this request
        
        Returns:
            True if allowed
        
        Raises:
            HTTPException(429) if exceeded
        """
        key = f"ratelimit:bucket:{identifier}"
        now = time.time()
        
        # Get current state
        bucket_data = self.redis.hgetall(key)
        
        if not bucket_data:
            # Initialize bucket
            tokens = capacity
            last_refill = now
        else:
            tokens = float(bucket_data.get(b'tokens', capacity))
            last_refill = float(bucket_data.get(b'last_refill', now))
        
        # Refill tokens based on time passed
        time_passed = now - last_refill
        tokens = min(capacity, tokens + (time_passed * refill_rate))
        
        # Try to consume
        if tokens >= cost:
            tokens -= cost
            
            # Update bucket
            self.redis.hset(key, mapping={
                'tokens': str(tokens),
                'last_refill': str(now)
            })
            self.redis.expire(key, 3600)  # Expire after 1 hour of inactivity
            
            return True
        else:
            # Rate limit exceeded
            retry_after = int((cost - tokens) / refill_rate)
            
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry after {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )

# Usage
rate_limiter = TokenBucketRateLimiter(redis_client)

async def check_rate_limit(request: Request):
    user_id = request.state.user['user_id']
    tier = request.state.user['subscription_tier']
    
    limits = {
        'free': {'capacity': 50, 'refill_rate': 0.5},  # 30/min
        'pro': {'capacity': 120, 'refill_rate': 1.0},  # 60/min
        'teams': {'capacity': 200, 'refill_rate': 2.0}  # 120/min
    }
    
    config = limits.get(tier, limits['free'])
    rate_limiter.check_limit(user_id, **config)
    
    return True
```

---

## 3. Enrichment Credits System

### 3.1 Credit Allocation

```python
# backend/app/models.py
class User(Base):
    credits_remaining = Column(Integer, default=0)
    credits_reset_date = Column(DateTime)  # Monthly reset

# Deduct credit on enrichment
@celery_app.task
def enrich_application(application_id):
    user = get_user_from_application(application_id)
    
    # Check credits
    if user.credits_remaining <= 0:
        return {"status": "error", "message": "No credits remaining"}
    
    # Deduct credit
    user.credits_remaining -= 1
    db.commit()
    
    # Perform enrichment
    contacts = apollo.search_people(...)
    
    # Refund if enrichment failed
    if not contacts:
        user.credits_remaining += 1
        db.commit()
```

---

### 3.2 Monthly Credit Reset

```python
# Cron job (runs 1st of each month)
def reset_user_credits():
    """Reset credits based on subscription tier"""
    tiers = {
        'free': 30,
        'pro': 500,
        'teams': 2000
    }
    
    for tier, credits in tiers.items():
        db.query(User).filter(User.subscription_tier == tier)\
          .update({"credits_remaining": credits})
    
    db.commit()
```

---

## 4. IP-Based Rate Limiting (Anonymous Users)

### 4.1 Unauthenticated Endpoints

```python
# For endpoints like /health, /api/jobs (if public)
async def check_ip_rate_limit(request: Request):
    ip = request.client.host
    key = f"ratelimit:ip:{ip}"
    
    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, 60)  # 1-minute window
    
    if current > 100:  # 100 requests/minute per IP
        raise HTTPException(status_code=429, detail="Too many requests")
    
    return True
```

---

## 5. Monitoring & Alerts

### 5.1 Rate Limit Metrics

```python
# Track when users hit limits
@app.middleware("http")
async def track_rate_limits(request, call_next):
    try:
        response = await call_next(request)
        return response
    except HTTPException as e:
        if e.status_code == 429:
            # Track rate limit hits
            user_id = getattr(request.state, 'user', {}).get('user_id')
            statsd.increment('roleferry.ratelimit.exceeded', tags=[f'user:{user_id}'])
        raise
```

---

### 5.2 Alerts

**Datadog Monitor**:
```yaml
name: "High Rate Limit Rejections"
query: "avg(last_10m):sum:roleferry.ratelimit.exceeded{} > 50"
message: |
  @slack-engineering
  Many users hitting rate limits. Investigate:
  - Legitimate traffic spike? (scale up limits)
  - Abuse/bot activity? (block IPs)
  - Bug causing request loop? (fix code)
```

---

## 6. Acceptance Criteria

- [ ] Rate limits enforced per subscription tier
- [ ] Token bucket algorithm implemented (smooth rate limiting)
- [ ] Enrichment credits system functional (deduct, refund, monthly reset)
- [ ] IP-based limits for unauthenticated requests
- [ ] 429 responses return Retry-After header
- [ ] Monitoring tracks rate limit hits
- [ ] Alerts configured (unusual rate limit patterns)

---

**Document Owner**: Backend Lead, API Team  
**Version**: 1.0  
**Date**: October 2025

