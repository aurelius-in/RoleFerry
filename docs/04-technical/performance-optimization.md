# Performance Optimization Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, Frontend Engineers  
**Purpose**: Systematic approach to performance optimization

---

## 1. Performance Budget

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **API P95 latency** | <500ms | 📊 TBD | 📊 |
| **Jobs List load** | <2s | 📊 TBD | 📊 |
| **Tracker load** | <2s | 📊 TBD | 📊 |
| **Enrichment** | <30s | 📊 TBD | 📊 |
| **Email send (queue)** | <5min | 📊 TBD | 📊 |

---

## 2. Backend Optimization

### 2.1 Database Query Optimization

**Before** (Slow Query):
```sql
-- N+1 query problem
SELECT * FROM applications WHERE user_id = 123;  -- 1 query
-- Then for each application:
SELECT * FROM jobs WHERE id = app.job_id;        -- N queries
SELECT * FROM companies WHERE id = job.company_id;  -- N more queries
```

**After** (Optimized with JOIN):
```sql
-- Single query with joins
SELECT 
    a.*,
    j.title, j.location,
    c.name AS company_name, c.logo_url
FROM applications a
JOIN jobs j ON a.job_id = j.id
JOIN companies c ON j.company_id = c.id
WHERE a.user_id = 123;
```

**Result**: 300ms → 50ms (6x faster)

---

### 2.2 Add Missing Indexes

**Identify Slow Queries**:
```sql
-- Enable slow query log (RDS parameter group)
-- log_min_duration_statement = 1000  (log queries >1s)

-- Find slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Add Index**:
```sql
-- If query filters by status frequently
CREATE INDEX idx_applications_status ON applications(status, last_action_at DESC);

-- Verify improvement with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM applications WHERE status = 'applied' ORDER BY last_action_at DESC;
```

---

### 2.3 Pagination (Avoid OFFSET)

**Slow** (OFFSET scans all rows):
```sql
SELECT * FROM jobs
ORDER BY posted_date DESC
LIMIT 20 OFFSET 1000;  -- Must scan 1,020 rows
```

**Fast** (Cursor-based):
```sql
SELECT * FROM jobs
WHERE posted_date < '2025-10-13 14:00:00'  -- Cursor
ORDER BY posted_date DESC
LIMIT 20;
```

---

## 3. Caching Implementation

### 3.1 Redis Caching (See caching-strategy.md)

**Quick Wins**:
- Cache match scores (24h TTL): 80% hit rate → 200ms → 20ms
- Cache company enrichment (30d TTL): 90% hit rate → API call avoided
- Cache IJP (6h TTL): 95% hit rate → 0 DB queries

---

### 3.2 HTTP Caching (CDN)

**Static Assets** (CloudFront):
```typescript
// Next.js image optimization
<Image 
  src="/logo.png"
  width={200}
  height={50}
  priority={true}  // Preload
  quality={85}     // Compress
/>

// Set cache headers
export async function GET() {
  return new Response(data, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'  // 1 year
    }
  });
}
```

**API Responses** (selective):
```python
@app.get("/api/jobs")
async def get_jobs():
    response = JSONResponse(content=jobs)
    
    # Cache for 5 minutes (jobs don't change often)
    response.headers["Cache-Control"] = "public, max-age=300"
    
    return response
```

---

## 4. Frontend Optimization

### 4.1 Code Splitting

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const Copilot = dynamic(() => import('@/components/Copilot'), {
  loading: () => <Skeleton />,
  ssr: false  // Don't render server-side
});

const Analytics = dynamic(() => import('@/components/Analytics'), {
  ssr: false
});
```

**Result**: Initial JS bundle: 450 KB → 250 KB (45% smaller)

---

### 4.2 Image Optimization

```typescript
// Use Next.js Image component (auto-optimization)
import Image from 'next/image';

<Image 
  src={job.company.logo_url}
  alt={job.company.name}
  width={48}
  height={48}
  loading="lazy"  // Lazy load below fold
  placeholder="blur"  // Show blur while loading
/>
```

**Result**: 2 MB logo → 50 KB WebP (97% smaller)

---

### 4.3 React Query Optimization

```typescript
// Prefetch data (reduce perceived latency)
import { useQueryClient } from '@tanstack/react-query';

function JobCard({ job }) {
  const queryClient = useQueryClient();
  
  // Prefetch job detail on hover
  const prefetchJobDetail = () => {
    queryClient.prefetchQuery({
      queryKey: ['job', job.id],
      queryFn: () => api.get(`/api/jobs/${job.id}`)
    });
  };
  
  return (
    <Card onMouseEnter={prefetchJobDetail}>
      {/* When user clicks, data already loaded */}
    </Card>
  );
}
```

---

## 5. Background Job Optimization

### 5.1 Parallel API Calls

**Before** (Sequential, 3 seconds total):
```python
people_apollo = apollo.search_people(...)  # 1.5s
people_clay = clay.find_people(...)         # 1.5s
```

**After** (Parallel, 1.5 seconds total):
```python
import asyncio

async def enrich_parallel():
    results = await asyncio.gather(
        apollo.search_people_async(...),
        clay.find_people_async(...)
    )
    people_apollo, people_clay = results
```

**Result**: 3s → 1.5s (2x faster)

---

### 5.2 Batch Processing

**Before** (100 individual API calls):
```python
for email in emails:
    verify_email(email)  # 100 API calls, 10 seconds
```

**After** (1 bulk API call):
```python
verify_bulk_emails(emails)  # 1 API call, 2 seconds
```

**Result**: 10s → 2s (5x faster)

---

## 6. Profiling & Monitoring

### 6.1 Python Profiling

```python
# Profile slow endpoint
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# Run slow function
result = calculate_match_scores(user_id)

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(10)  # Top 10 slowest functions
```

---

### 6.2 Database Query Analysis

```sql
-- Find slow queries in production
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries averaging >100ms
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## 7. Performance Testing

### 7.1 Load Test Script (Locust)

```python
from locust import HttpUser, task, between
import random

class RoleFerryLoadTest(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        # Login
        self.client.post('/api/auth/login', json={
            'email': f'test{random.randint(1,100)}@example.com',
            'password': 'password'
        })
    
    @task(5)
    def browse_jobs(self):
        self.client.get('/api/jobs?limit=20')
    
    @task(3)
    def view_application(self):
        app_id = random.randint(1, 1000)
        self.client.get(f'/api/applications/{app_id}')
    
    @task(1)
    def apply_to_job(self):
        job_id = random.randint(1, 100)
        self.client.post('/api/applications', json={'job_id': job_id})
```

**Run**:
```bash
locust -f load_test.py --host=https://staging.roleferry.com --users=100 --spawn-rate=10 --run-time=10m
```

---

### 7.2 Performance Regression Testing

```yaml
# .github/workflows/performance.yml
- name: Run performance tests
  run: |
    locust -f tests/performance/load_test.py \
      --headless \
      --users 100 \
      --spawn-rate 10 \
      --run-time 5m \
      --html performance-report.html

- name: Check performance budget
  run: |
    # Fail if P95 latency >500ms
    if [ $(jq '.p95_latency' performance-results.json) -gt 500 ]; then
      echo "Performance regression detected"
      exit 1
    fi
```

---

## 8. Optimization Checklist

### Quick Wins (Do First)
- [ ] Add indexes on frequently filtered columns
- [ ] Enable Redis caching (match scores, enrichment)
- [ ] Use JOINs instead of N+1 queries
- [ ] Enable CloudFront CDN (static assets)
- [ ] Lazy load images (below fold)

### Medium Effort
- [ ] Database connection pooling (PgBouncer)
- [ ] Read replicas (offload analytics queries)
- [ ] Code splitting (reduce initial JS bundle)
- [ ] Prefetching (React Query, hover intents)

### High Effort (Scale Phase)
- [ ] Database sharding (>1TB data)
- [ ] Microservices extraction (independent scaling)
- [ ] Multi-region deployment (global latency)

---

## 9. Acceptance Criteria

- [ ] Performance budget defined (<500ms API, <2s page load)
- [ ] Baseline metrics established (before optimization)
- [ ] Optimizations prioritized (quick wins first)
- [ ] Load testing automated (regression tests on every release)
- [ ] Monitoring tracks performance (Datadog, CloudWatch)
- [ ] P95 latency improves 30% within 3 months

---

**Document Owner**: Engineering Manager, Performance Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (continuous optimization)

