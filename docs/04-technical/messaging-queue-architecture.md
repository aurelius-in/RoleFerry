# Messaging & Queue Architecture
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, DevOps  
**Purpose**: Celery + Redis queue implementation details

---

## 1. Queue Overview

**Technology**: Celery 5.3 + Redis 7.2

**Why Celery?**:
- Mature (10+ years), battle-tested
- Python-native (integrates seamlessly)
- Rich feature set (retries, chaining, scheduling)
- Better than AWS Lambda for our use case (long-running jobs, no cold starts)

---

## 2. Queue Architecture

```
┌─────────────────────────────────────────┐
│          Task Producers                  │
│   (FastAPI routes, cron jobs)            │
└────────────┬────────────────────────────┘
             │ enqueue
             ▼
┌─────────────────────────────────────────┐
│       Redis (Message Broker)             │
│  Queues: enrichment, sequences, default  │
└────────────┬────────────────────────────┘
             │ dequeue
             ▼
┌─────────────────────────────────────────┐
│       Celery Workers (1-50)              │
│    (ECS Fargate tasks, auto-scaled)      │
└────────────┬────────────────────────────┘
             │ results
             ▼
┌─────────────────────────────────────────┐
│    Redis (Result Backend)                │
│   Results expire after 1 hour            │
└─────────────────────────────────────────┘
```

---

## 3. Queue Configuration

### 3.1 Queue Definitions

```python
# backend/app/celery_config.py
from kombu import Exchange, Queue

celery_app.conf.task_queues = (
    Queue(
        'enrichment',
        Exchange('enrichment'),
        routing_key='enrichment',
        queue_arguments={'x-max-priority': 10}  # Priority queue
    ),
    Queue(
        'sequences',
        Exchange('sequences'),
        routing_key='sequences'
    ),
    Queue(
        'analytics',
        Exchange('analytics'),
        routing_key='analytics',
        queue_arguments={'x-message-ttl': 300000}  # 5-min TTL
    ),
    Queue(
        'default',
        Exchange('default'),
        routing_key='default'
    )
)
```

---

### 3.2 Task Routing

```python
# Route tasks to specific queues
celery_app.conf.task_routes = {
    'app.services.enrichment.*': {'queue': 'enrichment', 'priority': 5},
    'app.services.outreach.*': {'queue': 'sequences', 'priority': 3},
    'app.services.analytics.*': {'queue': 'analytics', 'priority': 1}
}
```

**Priority** (0-10):
- 10: Critical (user waiting, interactive)
- 5: High (enrichment, user expects results soon)
- 3: Normal (email sending, background)
- 1: Low (analytics, batch processing)

---

## 4. Task Definitions

### 4.1 Basic Task

```python
@celery_app.task(bind=True, name='app.services.enrichment.enrich_application')
def enrich_application(self, application_id: int):
    """Enrich application with contacts"""
    try:
        result = perform_enrichment(application_id)
        return result
    except Exception as e:
        logging.error(f"Enrichment failed: {e}")
        raise
```

---

### 4.2 Task with Retry Logic

```python
@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,  # Exponential backoff: 2s, 4s, 8s
    retry_backoff_max=600,  # Max 10 minutes
    retry_jitter=True  # Add randomness to prevent thundering herd
)
def enrich_with_retry(self, application_id):
    try:
        return perform_enrichment(application_id)
    except EnrichmentError as e:
        # Retry
        raise self.retry(exc=e)
    except Exception as e:
        # Don't retry on unexpected errors (log and fail)
        logging.exception(f"Unexpected error: {e}")
        raise
```

---

### 4.3 Task with Timeout

```python
@celery_app.task(
    time_limit=60,  # Hard limit: kill task after 60s
    soft_time_limit=50  # Soft limit: raise exception at 50s (graceful cleanup)
)
def enrich_with_timeout(application_id):
    try:
        return perform_enrichment(application_id)
    except SoftTimeLimitExceeded:
        logging.warning(f"Enrichment timed out for {application_id}")
        # Cleanup, return partial results
        return {"status": "timeout", "partial_results": [...]}
```

---

## 5. Task Chains & Workflows

### 5.1 Sequential Tasks (Chain)

```python
from celery import chain

# Enrich → Generate Draft → Send Email (sequential)
workflow = chain(
    enrich_application.s(application_id),
    generate_draft.s(),  # Receives enrichment result
    send_email.s()       # Receives draft
)

workflow.apply_async()
```

---

### 5.2 Parallel Tasks (Group)

```python
from celery import group

# Enrich multiple applications in parallel
job = group(
    enrich_application.s(app_id)
    for app_id in application_ids
)

result = job.apply_async()
result.get()  # Wait for all to complete
```

---

### 5.3 Callback Pattern (Chord)

```python
from celery import chord

# Enrich 10 applications, then generate summary report
callback = chord(
    [enrich_application.s(app_id) for app_id in range(1, 11)]
)(generate_summary_report.s())
```

---

## 6. Monitoring

### 6.1 Flower (Celery Web UI)

**Install**:
```bash
pip install flower
```

**Run**:
```bash
celery -A app.celery_app flower --port=5555
```

**Access**: http://localhost:5555

**Metrics**:
- Active workers
- Task success/failure rates
- Queue depths
- Task runtime distribution

---

### 6.2 Datadog Integration

```python
# backend/app/celery_config.py
from celery.signals import task_prerun, task_postrun, task_failure
from datadog import statsd
import time

@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, **kwargs):
    """Track task start"""
    task.start_time = time.time()

@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, **kwargs):
    """Track task completion"""
    duration = (time.time() - task.start_time) * 1000
    
    statsd.histogram(
        'roleferry.celery.task.duration',
        duration,
        tags=[f'task:{task.name}', 'status:success']
    )
    
    statsd.increment(
        'roleferry.celery.task.completed',
        tags=[f'task:{task.name}']
    )

@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, **kwargs):
    """Track task failures"""
    statsd.increment(
        'roleferry.celery.task.failed',
        tags=[f'task:{sender.name}', f'exception:{type(exception).__name__}']
    )
```

---

## 7. Scaling Workers

### 7.1 Auto-Scaling Based on Queue Depth

```python
# Lambda function (runs every 5 minutes)
def scale_workers(event, context):
    """Scale Celery workers based on queue depth"""
    
    # Get queue depth
    redis_client = redis.Redis(host=REDIS_HOST)
    enrichment_depth = redis_client.llen('enrichment')
    
    # Get current worker count
    ecs_client = boto3.client('ecs')
    service = ecs_client.describe_services(
        cluster='roleferry-prod',
        services=['workers']
    )['services'][0]
    
    current_count = service['desiredCount']
    
    # Scale up if queue >200
    if enrichment_depth > 200:
        new_count = min(current_count + 5, 50)  # Max 50 workers
        ecs_client.update_service(
            cluster='roleferry-prod',
            service='workers',
            desiredCount=new_count
        )
        logging.info(f"Scaled workers: {current_count} → {new_count}")
    
    # Scale down if queue <20
    elif enrichment_depth < 20 and current_count > 5:
        new_count = max(current_count - 2, 5)  # Min 5 workers
        ecs_client.update_service(
            cluster='roleferry-prod',
            service='workers',
            desiredCount=new_count
        )
```

---

## 8. Dead Letter Queue (DLQ)

### 8.1 Failed Task Handling

```python
# After 3 retries, send to DLQ
@celery_app.task(
    max_retries=3,
    default_retry_delay=60
)
def enrich_application(self, application_id):
    try:
        return perform_enrichment(application_id)
    except Exception as e:
        if self.request.retries >= self.max_retries:
            # Send to DLQ for manual review
            send_to_dlq(task_name=self.name, args=[application_id], exception=str(e))
        raise self.retry(exc=e)

def send_to_dlq(task_name, args, exception):
    """Log failed task for manual intervention"""
    redis_client.lpush('dlq:enrichment', json.dumps({
        'task': task_name,
        'args': args,
        'exception': exception,
        'timestamp': datetime.utcnow().isoformat()
    }))
    
    # Alert ops team
    send_slack_alert(f"Task {task_name} sent to DLQ after max retries")
```

---

## 9. Acceptance Criteria

- [ ] Celery configured with multiple queues (enrichment, sequences, analytics)
- [ ] Task routing based on type and priority
- [ ] Retry logic with exponential backoff
- [ ] Task timeouts (hard and soft limits)
- [ ] Worker auto-scaling (queue depth-based)
- [ ] Monitoring (Flower + Datadog metrics)
- [ ] Dead letter queue for failed tasks

---

**Document Owner**: Backend Lead, DevOps  
**Version**: 1.0  
**Date**: October 2025

