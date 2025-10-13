# Log Management Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: DevOps, SRE, Backend Engineers  
**Purpose**: Logging best practices and centralized management

---

## 1. Logging Philosophy

### Principles
1. **Structured Logging**: JSON format (machine-readable)
2. **Context-Rich**: Include user_id, request_id, relevant metadata
3. **Appropriate Levels**: INFO for normal, ERROR for failures, DEBUG for development only
4. **No Secrets**: Never log passwords, API keys, tokens
5. **PII Minimization**: Avoid logging full emails, names (use IDs)

---

## 2. Log Levels

| Level | When to Use | Examples | Production Volume |
|-------|-------------|----------|-------------------|
| **DEBUG** | Development only | "Entering function X" | 0 (disabled) |
| **INFO** | Normal operations | "User 123 applied to job 456" | High |
| **WARNING** | Recoverable errors | "Apollo API timeout, retrying" | Medium |
| **ERROR** | Failed operations | "Email sending failed" | Low |
| **CRITICAL** | System failures | "Database unreachable" | Very low |

---

## 3. Structured Logging Format

### 3.1 Standard Format

```json
{
  "timestamp": "2025-10-13T14:30:00.123Z",
  "level": "INFO",
  "service": "api",
  "event": "application_created",
  "user_id": 1234,
  "application_id": 5678,
  "job_id": 910,
  "duration_ms": 250,
  "request_id": "req_abc123",
  "ip_address": "192.168.1.1"
}
```

---

### 3.2 Python Implementation

```python
# backend/app/logging_config.py
import logging
import json
from pythonjsonlogger import jsonlogger
import sys

def setup_logging():
    """Configure structured JSON logging"""
    
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Console handler (JSON format)
    handler = logging.StreamHandler(sys.stdout)
    
    formatter = jsonlogger.JsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s',
        rename_fields={"levelname": "level", "name": "logger"},
        timestamp=True
    )
    
    handler.setFormatter(formatter)
    logger.addHandler(handler)

# Usage
logging.info("Application created", extra={
    "event": "application_created",
    "user_id": 1234,
    "application_id": 5678,
    "duration_ms": 250
})
```

---

## 4. CloudWatch Logs Configuration

### 4.1 Log Groups

```
/ecs/roleferry-prod-api          # API server logs
/ecs/roleferry-prod-workers      # Celery worker logs
/aws/rds/instance/roleferry-prod # PostgreSQL logs
/aws/lambda/enrichment-trigger   # Lambda functions
```

### 4.2 Retention Policy

| Log Group | Retention | Storage Class | Cost |
|-----------|-----------|---------------|------|
| **API logs** | 30 days (hot), 1 year (archive) | Standard → Glacier | $50/month |
| **Worker logs** | 30 days | Standard | $30/month |
| **RDS logs** | 7 days | Standard | $10/month |

---

### 4.3 Log Insights Queries

**Find Errors (Last Hour)**:
```
fields @timestamp, level, event, user_id, @message
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

**Enrichment Success Rate**:
```
fields @timestamp
| filter event = "enrichment_completed" or event = "enrichment_failed"
| stats count(*) as total,
        count(*) filter(event = "enrichment_completed") as success
        by bin(5m)
| fields success / total * 100 as success_rate
```

---

## 5. Log Aggregation (Datadog)

### 5.1 Setup

```python
# backend/app/main.py
from ddtrace import patch_all, tracer
from ddtrace.contrib.logging import patch as patch_logging

# Enable Datadog tracing
patch_all()
patch_logging()

# Configure Datadog logging
import logging
from ddtrace.filters import FilterRequestsOnUrl

# Filter out health checks from logs
tracer.configure(
    settings={
        "FILTERS": [FilterRequestsOnUrl([r".*/health$"])]
    }
)
```

---

### 5.2 Log Pipelines

**Parse JSON**:
```
# Datadog log pipeline
# Extract fields from JSON logs
grok.parse("%{data::json}") 
```

**Add Tags**:
```
# Tag by service, environment
@service:api
@env:production
```

**Create Metrics**:
```
# Count errors by user
count(*) WHERE level:ERROR group by user_id
```

---

## 6. Sensitive Data Redaction

### 6.1 PII Scrubbing

```python
import re

def redact_pii(log_message: str) -> str:
    """Remove PII from log messages"""
    
    # Redact emails
    log_message = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        '[EMAIL_REDACTED]',
        log_message
    )
    
    # Redact phone numbers
    log_message = re.sub(
        r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        '[PHONE_REDACTED]',
        log_message
    )
    
    # Redact SSNs
    log_message = re.sub(
        r'\b\d{3}-\d{2}-\d{4}\b',
        '[SSN_REDACTED]',
        log_message
    )
    
    return log_message

# Apply before logging
safe_message = redact_pii(user_input)
logging.info(f"User input: {safe_message}")
```

---

## 7. Log Retention & Archival

### 7.1 Lifecycle Policy (S3)

```json
{
  "Rules": [{
    "Id": "ArchiveLogs",
    "Status": "Enabled",
    "Prefix": "logs/",
    "Transitions": [
      {
        "Days": 30,
        "StorageClass": "STANDARD_IA"
      },
      {
        "Days": 90,
        "StorageClass": "GLACIER"
      }
    ],
    "Expiration": {
      "Days": 365
    }
  }]
}
```

**Cost Savings**: 
- Standard: $0.023/GB/month
- Glacier: $0.004/GB/month (83% cheaper)

---

## 8. Debugging with Logs

### 8.1 Request ID Tracing

```python
import uuid
from fastapi import Request

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to all logs"""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Add to response headers (for debugging)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response

# Include in all logs
logging.info("Processing request", extra={"request_id": request.state.request_id})
```

**Usage**: If user reports issue, ask for X-Request-ID → search logs

---

### 8.2 Distributed Tracing (Datadog APM)

```python
from ddtrace import tracer

@tracer.wrap(service="enrichment", resource="enrich_application")
def enrich_application(application_id):
    with tracer.trace("apollo.search_people") as span:
        people = apollo_client.search_people(...)
        span.set_tag("people_found", len(people))
    
    with tracer.trace("neverbounce.verify") as span:
        verified = neverbounce_client.verify_bulk(...)
        span.set_tag("emails_verified", len(verified))
    
    return verified
```

**Result**: Full trace in Datadog APM (see which step is slow)

---

## 9. Acceptance Criteria

- [ ] Structured logging implemented (JSON format)
- [ ] Log levels used correctly (INFO, WARNING, ERROR)
- [ ] PII redaction (emails, phones scrubbed)
- [ ] Request ID tracing (unique ID per request)
- [ ] CloudWatch Logs configured (retention policies)
- [ ] Datadog integration (log forwarding, parsing)
- [ ] Log Insights queries documented (common debugging queries)

---

**Document Owner**: DevOps Lead, Backend Lead  
**Version**: 1.0  
**Date**: October 2025

