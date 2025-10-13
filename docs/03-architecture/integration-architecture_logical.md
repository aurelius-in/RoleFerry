# Integration Architecture: Logical Level
## RoleFerry Platform

**RM-ODP Viewpoints**: Computational, Engineering (Logical)  
**Audience**: Integration Engineers, Architects  
**Purpose**: Integration patterns, service contracts, error handling

---

## 1. Integration Patterns

### 1.1 Synchronous Request-Response
**Use Case**: Real-time data needed immediately

**Flow**:
```
Client → API → External Service → API → Client
```

**Examples**:
- Apollo contact search (user waiting for results)
- Stripe payment processing (user checkout)

**Characteristics**:
- Latency: <5 seconds (timeout after 10s)
- Error handling: Retry 3x, fallback provider
- User experience: Loading indicator

---

### 1.2 Asynchronous Job Queue
**Use Case**: Long-running, non-blocking operations

**Flow**:
```
Client → API → Enqueue Job → 202 Accepted
Worker → Dequeue → External Service → Save Results → Notify Client
```

**Examples**:
- Bulk enrichment (100+ contacts)
- Email sending (sequences)

**Characteristics**:
- Latency: Seconds to minutes
- Error handling: Retry with exponential backoff (max 24 hours)
- User experience: "Job started, we'll notify you"

---

### 1.3 Webhook-Driven Events
**Use Case**: Third-party service pushes events to us

**Flow**:
```
External Service → POST /webhooks/[provider] → Process → Update DB
```

**Examples**:
- SendGrid delivery events (delivered, bounced)
- Stripe payment events (succeeded, failed)

**Characteristics**:
- Latency: <1 minute (event → processing)
- Security: Webhook signature verification
- Idempotency: Handle duplicate webhooks gracefully

---

## 2. Service Interface Contracts

### 2.1 Apollo.io

**Base URL**: `https://api.apollo.io/v1`

**Authentication**: API key in request body

**Endpoints Used**:
| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/mixed_people/search` | POST | Find people at company | 100/hour |
| `/email_finder` | POST | Find work email | 100/hour |
| `/companies/search` | POST | Enrich company data | 100/hour |

**Request Example**:
```json
POST /v1/mixed_people/search
{
  "api_key": "xxx",
  "organization_domains": ["acme.com"],
  "person_titles": ["VP", "Head", "Director"],
  "per_page": 10
}
```

**Response Example**:
```json
{
  "people": [
    {
      "id": "12345",
      "name": "John Doe",
      "title": "VP Engineering",
      "email": "john@acme.com",
      "linkedin_url": "https://linkedin.com/in/johndoe"
    }
  ],
  "pagination": {"total": 50}
}
```

**Error Codes**:
- `401`: Invalid API key
- `429`: Rate limit exceeded (retry after 60s)
- `500`: Server error (fallback to Clay)

---

### 2.2 SendGrid

**Base URL**: `https://api.sendgrid.com/v3`

**Authentication**: Bearer token (API key)

**Endpoints Used**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mail/send` | POST | Send email |
| `/suppression/bounces` | GET | List bounces |
| `/suppression/spam_reports` | GET | List spam reports |

**Request Example**:
```json
POST /v3/mail/send
{
  "personalizations": [{
    "to": [{"email": "recipient@acme.com"}]
  }],
  "from": {"email": "auto1@rf-send-01.com"},
  "reply_to": {"email": "user@example.com"},
  "subject": "Quick advice on PM role?",
  "content": [{
    "type": "text/html",
    "value": "<p>Hi John,...</p>"
  }],
  "custom_args": {
    "outreach_id": "12345"
  }
}
```

**Webhook Events**:
```json
[
  {
    "event": "delivered",
    "email": "recipient@acme.com",
    "smtp-id": "<outreach_12345@roleferry.com>",
    "timestamp": 1697200000
  }
]
```

---

### 2.3 Anthropic (Claude)

**Base URL**: `https://api.anthropic.com/v1`

**Authentication**: `x-api-key` header

**Endpoint**: `/messages`

**Request Example**:
```json
POST /v1/messages
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 1000,
  "messages": [
    {
      "role": "user",
      "content": "Write a 3-sentence email to a hiring manager..."
    }
  ]
}
```

**Streaming Response**:
```json
event: message_start
data: {"type":"message_start","message":{"id":"msg_123"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"text":"Hi"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"text":" John"}}
...
```

---

## 3. Error Handling Strategies

### 3.1 Retry Logic (Exponential Backoff)

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(requests.exceptions.Timeout)
)
async def call_apollo_api(endpoint, payload):
    """Retry Apollo API calls with exponential backoff"""
    response = requests.post(
        f"{APOLLO_BASE_URL}{endpoint}",
        json=payload,
        timeout=10
    )
    response.raise_for_status()
    return response.json()
```

---

### 3.2 Circuit Breaker Pattern

```python
from pybreaker import CircuitBreaker

apollo_breaker = CircuitBreaker(
    fail_max=5,  # Open circuit after 5 consecutive failures
    timeout_duration=60  # Stay open for 60 seconds before trying again
)

@apollo_breaker
def search_people(domain, titles):
    """Call Apollo with circuit breaker protection"""
    try:
        return apollo_client.search_people(domain, titles)
    except Exception as e:
        logging.error(f"Apollo API failed: {e}")
        raise

# Usage
try:
    result = search_people("acme.com", ["VP"])
except CircuitBreakerError:
    # Circuit is open, fallback immediately
    result = clay_client.find_people("acme.com", ["VP"])
```

---

### 3.3 Fallback Waterfall

```python
async def enrich_contacts_with_fallback(company_domain, titles):
    """Try multiple providers in sequence"""
    providers = [
        ("Apollo", lambda: apollo_client.search_people(domain, titles)),
        ("Clay", lambda: clay_client.find_people(domain, titles)),
        ("Hunter", lambda: hunter_client.find_emails(domain))
    ]
    
    for provider_name, provider_func in providers:
        try:
            result = await provider_func()
            if result and len(result) > 0:
                logging.info(f"Enrichment succeeded via {provider_name}")
                return result, provider_name
        except Exception as e:
            logging.warning(f"{provider_name} failed: {e}, trying next provider")
            continue
    
    # All providers failed
    logging.error("All enrichment providers failed")
    return [], "none"
```

---

## 4. Webhook Security

### 4.1 Signature Verification (SendGrid)
```python
import hmac
import hashlib
import base64

def verify_sendgrid_webhook(request: Request):
    """Verify webhook came from SendGrid"""
    payload = await request.body()
    signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature')
    timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp')
    
    # Construct verification string
    verification_string = timestamp + payload.decode()
    
    # Generate expected signature
    expected_signature = base64.b64encode(
        hmac.new(
            settings.SENDGRID_WEBHOOK_VERIFICATION_KEY.encode(),
            verification_string.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    return True
```

---

### 4.2 Idempotency (Prevent Duplicate Processing)

```python
@router.post("/webhooks/sendgrid")
async def sendgrid_webhook(request: Request):
    events = await request.json()
    
    for event in events:
        event_id = event.get('sg_event_id')  # Unique ID from SendGrid
        
        # Check if already processed
        if redis_client.exists(f"webhook:processed:{event_id}"):
            logging.info(f"Webhook {event_id} already processed, skipping")
            continue
        
        # Process event
        process_sendgrid_event(event)
        
        # Mark as processed (24-hour TTL)
        redis_client.setex(f"webhook:processed:{event_id}", 86400, "1")
    
    return {"status": "ok"}
```

---

## 5. Monitoring Integration Health

### 5.1 Metrics to Track
```python
from datadog import statsd

def track_integration_call(provider: str, endpoint: str, success: bool, latency_ms: float):
    """Track external API calls in Datadog"""
    tags = [
        f'provider:{provider}',
        f'endpoint:{endpoint}',
        f'status:{"success" if success else "error"}'
    ]
    
    statsd.histogram('roleferry.integration.latency', latency_ms, tags=tags)
    
    if success:
        statsd.increment('roleferry.integration.calls.success', tags=tags)
    else:
        statsd.increment('roleferry.integration.calls.error', tags=tags)
```

---

## 6. Acceptance Criteria

- [ ] All integration patterns documented (sync, async, webhook)
- [ ] Service contracts specified (endpoints, auth, rate limits)
- [ ] Error handling implemented (retry, circuit breaker, fallback)
- [ ] Webhook security verified (signature validation)
- [ ] Idempotency ensured (duplicate webhooks handled)
- [ ] Monitoring integrated (track latency, errors per provider)
- [ ] Fallback providers configured (Apollo → Clay → Hunter)

---

**Document Owner**: Integration Engineer, Backend Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (as integrations evolve)

