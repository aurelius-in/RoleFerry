# API Integration Guide
## Third-Party API Implementations

**Audience**: Backend Engineers  
**Purpose**: Code examples and best practices for external API integrations

---

## 1. Apollo.io Integration

### 1.1 Authentication
```python
# backend/app/clients/apollo.py
import requests
from app.config import settings

class ApolloClient:
    BASE_URL = "https://api.apollo.io/v1"
    
    def __init__(self):
        self.api_key = settings.APOLLO_API_KEY
        self.headers = {"Content-Type": "application/json"}
```

### 1.2 Search People
```python
def search_people(self, domain: str, titles: list, limit: int = 10):
    """Find people at company by title"""
    url = f"{self.BASE_URL}/mixed_people/search"
    
    payload = {
        "api_key": self.api_key,
        "organization_domains": [domain],
        "person_titles": titles,
        "page": 1,
        "per_page": limit
    }
    
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
    
    return response.json().get('people', [])
```

### 1.3 Rate Limiting
```python
from redis import Redis
from time import time, sleep

class RateLimiter:
    def __init__(self, redis_client, key, max_requests, window_seconds):
        self.redis = redis_client
        self.key = key
        self.max = max_requests
        self.window = window_seconds
    
    def allow(self):
        now = time()
        key = f"ratelimit:{self.key}:{int(now / self.window)}"
        
        current = self.redis.incr(key)
        if current == 1:
            self.redis.expire(key, self.window)
        
        return current <= self.max

# Usage
apollo_limiter = RateLimiter(redis, "apollo", max_requests=100, window_seconds=3600)

if apollo_limiter.allow():
    result = apollo.search_people(...)
else:
    raise Exception("Apollo rate limit exceeded")
```

---

## 2. SendGrid Integration

### 2.1 Send Email
```python
# backend/app/services/email_service.py
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

class SendGridAdapter:
    def __init__(self):
        self.client = SendGridAPIClient(settings.SENDGRID_API_KEY)
    
    def send(self, from_addr, to_addr, subject, body_html, reply_to):
        message = Mail(
            from_email=Email(from_addr),
            to_emails=To(to_addr),
            subject=subject,
            html_content=Content("text/html", body_html)
        )
        message.reply_to = Email(reply_to)
        
        # Custom headers for tracking
        message.add_header('X-Outreach-ID', str(outreach_id))
        
        try:
            response = self.client.send(message)
            return {"status": "sent", "message_id": response.headers.get('X-Message-Id')}
        except Exception as e:
            logging.error(f"SendGrid error: {e}")
            raise
```

### 2.2 Webhook Handler
```python
# backend/app/routers/webhooks.py
@router.post("/webhooks/sendgrid")
async def sendgrid_webhook(request: Request):
    events = await request.json()
    
    for event in events:
        event_type = event.get('event')
        outreach_id = extract_outreach_id(event.get('smtp-id'))
        
        if event_type == "delivered":
            update_outreach_status(outreach_id, "delivered")
        elif event_type == "bounce":
            handle_bounce(outreach_id)
        elif event_type == "spamreport":
            handle_spam_report(outreach_id)
```

---

## 3. Anthropic (Claude) Integration

### 3.1 Generate Draft
```python
# backend/app/services/ai_copilot.py
import anthropic

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

def generate_email_draft(user_context, job_context, contact_context):
    prompt = f"""You are helping a job seeker write an outreach email.

User: {user_context['current_role']}, {user_context['years_exp']} years
Job: {job_context['title']} at {job_context['company']}
Contact: {contact_context['name']} ({contact_context['title']})

Write a 3-sentence email asking for advice. Be professional but conversational.
Include the user's key metric: {user_context['top_metric']}
"""
    
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return message.content[0].text
```

### 3.2 Streaming (Copilot)
```python
async def copilot_ask(question, context):
    stream = client.messages.stream(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1000,
        messages=[{"role": "user", "content": question}]
    )
    
    async for chunk in stream:
        if chunk.type == "content_block_delta":
            yield chunk.delta.text
```

---

## 4. Stripe Integration

### 4.1 Create Subscription
```python
import stripe

stripe.api_key = settings.STRIPE_SECRET_KEY

def create_subscription(user_id, price_id):
    # Create customer
    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": user_id}
    )
    
    # Create subscription
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{"price": price_id}],  # price_pro_monthly
        payment_behavior='default_incomplete',
        expand=['latest_invoice.payment_intent']
    )
    
    return subscription
```

### 4.2 Webhook Handler
```python
@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
    
    if event.type == "customer.subscription.created":
        handle_subscription_created(event.data.object)
    elif event.type == "invoice.payment_succeeded":
        handle_payment_succeeded(event.data.object)
    elif event.type == "customer.subscription.deleted":
        handle_subscription_canceled(event.data.object)
```

---

## 5. Integration Patterns

### Pattern 1: Synchronous Request-Response
**Use Case**: Immediate data needed (Apollo contact search)

```python
result = apollo_client.search_people(domain="acme.com", titles=["VP"])
# Wait for response, return to user
```

**Pros**: Simple, immediate feedback  
**Cons**: Blocks request, timeout risk

---

### Pattern 2: Asynchronous Job Queue
**Use Case**: Long-running operations (bulk enrichment)

```python
@celery_app.task
def enrich_application(application_id):
    # Runs in background worker
    contacts = apollo_client.search_people(...)
    verified = neverbounce.verify_bulk([c['email'] for c in contacts])
    save_contacts(verified)
```

**Pros**: Non-blocking, scalable, retry logic  
**Cons**: Complexity, eventual consistency

---

### Pattern 3: Webhook-Driven Events
**Use Case**: Delivery confirmation (SendGrid → RoleFerry)

```python
# SendGrid sends POST to /webhooks/sendgrid when email delivered
# RoleFerry processes, updates status
```

**Pros**: Real-time updates, no polling  
**Cons**: Requires public endpoint, webhook verification

---

## 6. Error Handling

### Retry Strategy (Exponential Backoff)
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
def call_apollo_api():
    response = requests.post(...)
    response.raise_for_status()
    return response.json()
```

### Circuit Breaker (Prevent Cascading Failures)
```python
from pybreaker import CircuitBreaker

apollo_breaker = CircuitBreaker(
    fail_max=5,  # Open circuit after 5 failures
    timeout_duration=60  # Stay open for 60 seconds
)

@apollo_breaker
def search_people_safe(domain, titles):
    return apollo_client.search_people(domain, titles)
```

---

## 7. Monitoring Integrations

### Track API Latency
```python
import time
from datadog import statsd

def track_api_call(provider, endpoint):
    start = time.time()
    
    try:
        result = make_api_call(endpoint)
        duration = (time.time() - start) * 1000
        
        statsd.histogram(
            f'roleferry.integration.{provider}.latency',
            duration,
            tags=[f'endpoint:{endpoint}', 'status:success']
        )
        
        return result
    except Exception as e:
        duration = (time.time() - start) * 1000
        statsd.histogram(
            f'roleferry.integration.{provider}.latency',
            duration,
            tags=[f'endpoint:{endpoint}', 'status:error']
        )
        raise
```

---

## 8. Integration Testing

### Mock External APIs
```python
import responses

@responses.activate
def test_apollo_search_people():
    # Mock Apollo API response
    responses.post(
        "https://api.apollo.io/v1/mixed_people/search",
        json={"people": [{"name": "John Doe", "email": "john@acme.com"}]},
        status=200
    )
    
    client = ApolloClient()
    result = client.search_people("acme.com", ["VP"])
    
    assert len(result) == 1
    assert result[0]['name'] == "John Doe"
```

---

**Document Owner**: Backend Lead, Integrations Engineer  
**Version**: 1.0  
**Date**: October 2025

