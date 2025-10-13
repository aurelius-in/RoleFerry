# Third-Party Integrations Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers  
**Purpose**: Integration patterns for external services

---

## 1. Integration Overview

### 1.1 Current Integrations

| Service | Purpose | Status | Cost |
|---------|---------|--------|------|
| **Apollo** | Contact enrichment | ✅ Live | $99-$499/month |
| **Clay** | Company + contact enrichment | ✅ Live | $349/month |
| **SendGrid** | Email delivery | ✅ Live | $20-$200/month |
| **Stripe** | Payments, subscriptions | ✅ Live | 2.9% + $0.30 |
| **Anthropic** | AI (Claude) | ✅ Live | $500-$2K/month |
| **Datadog** | Monitoring, APM | ✅ Live | $310/month |

### 1.2 Planned Integrations (Phase 2)

| Service | Purpose | Timeline |
|---------|---------|----------|
| **Greenhouse** | ATS integration | Q2 2026 |
| **Lever** | ATS integration | Q2 2026 |
| **Zapier** | No-code automation | Q3 2026 |
| **Segment** | Customer data platform | Q4 2026 |

---

## 2. Integration Patterns

### 2.1 API Client Pattern

```python
# backend/app/services/apollo_client.py
import requests
from typing import List, Dict
import logging

class ApolloClient:
    """Apollo API client (contact enrichment)"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.apollo.io/v1"
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
        })
    
    def search_people(
        self,
        organization_domains: List[str],
        person_titles: List[str],
        page: int = 1
    ) -> Dict:
        """Search for people at organizations"""
        
        payload = {
            "api_key": self.api_key,
            "q_organization_domains": ",".join(organization_domains),
            "person_titles": person_titles,
            "page": page,
            "per_page": 10
        }
        
        try:
            response = self.session.post(
                f"{self.base_url}/mixed_people/search",
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.Timeout:
            logging.error(f"Apollo API timeout (organization: {organization_domains})")
            raise
        
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                # Rate limit exceeded
                logging.warning("Apollo rate limit exceeded")
                raise RateLimitError("Apollo rate limit exceeded")
            else:
                logging.error(f"Apollo API error: {e}")
                raise
    
    def get_person(self, person_id: str) -> Dict:
        """Get person details by ID"""
        
        params = {"api_key": self.api_key, "id": person_id}
        
        response = self.session.get(
            f"{self.base_url}/people/{person_id}",
            params=params,
            timeout=10
        )
        response.raise_for_status()
        return response.json()

# Usage
apollo = ApolloClient(api_key=settings.APOLLO_API_KEY)
people = apollo.search_people(
    organization_domains=["acme.com"],
    person_titles=["VP Engineering", "Head of Engineering"]
)
```

---

### 2.2 Retry Logic

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class ApolloClient:
    @retry(
        stop=stop_after_attempt(3),  # Max 3 retries
        wait=wait_exponential(multiplier=1, min=2, max=10),  # 2s, 4s, 8s
        retry=retry_if_exception_type(requests.exceptions.Timeout)
    )
    def search_people_with_retry(self, **kwargs):
        """Search people with automatic retries on timeout"""
        return self.search_people(**kwargs)
```

---

### 2.3 Circuit Breaker

```python
from pybreaker import CircuitBreaker

# If Apollo fails 5 times in 60 seconds, open circuit (stop calling)
apollo_breaker = CircuitBreaker(
    fail_max=5,
    timeout_duration=60,
    name="apollo"
)

@apollo_breaker
def enrich_with_apollo(company_domain):
    """Enrich with circuit breaker"""
    apollo = ApolloClient(settings.APOLLO_API_KEY)
    return apollo.search_people(organization_domains=[company_domain])

# If circuit open, raises CircuitBreakerError (catch and fallback)
try:
    people = enrich_with_apollo("acme.com")
except CircuitBreakerError:
    logging.warning("Apollo circuit breaker open, skipping enrichment")
    people = []  # Fallback: empty list
```

---

## 3. Integration-Specific Details

### 3.1 Apollo API

**Authentication**: API key in request body

**Rate Limits**:
- Growth plan: 1,000 credits/month (1 credit = 1 search)
- Professional: 10,000 credits/month

**Error Codes**:
- 429: Rate limit exceeded (wait 60 seconds)
- 402: Payment required (out of credits)

**Webhook**: None (we poll)

---

### 3.2 SendGrid API

**Authentication**: API key in `Authorization: Bearer` header

**Rate Limits**: 600 requests/second (rarely hit)

**Error Codes**:
- 401: Invalid API key
- 429: Rate limit (very rare)

**Webhook**: Inbound email events (see [Webhooks Guide](webhooks-guide.md))

**Example**:
```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

sg = SendGridAPIClient(settings.SENDGRID_API_KEY)

message = Mail(
    from_email='noreply@roleferry.com',
    to_emails='candidate@example.com',
    subject='Welcome to RoleFerry',
    html_content='<strong>Welcome!</strong>'
)

response = sg.send(message)
# response.status_code == 202 (Accepted)
```

---

### 3.3 Stripe API

**Authentication**: Secret key in `Authorization: Bearer` header

**Idempotency**: Use `Idempotency-Key` header (prevent duplicate charges)

**Webhooks**: Payment events (see [Webhooks Guide](webhooks-guide.md))

**Example** (Create Subscription):
```python
import stripe

stripe.api_key = settings.STRIPE_SECRET_KEY

# Create customer
customer = stripe.Customer.create(
    email='user@example.com',
    payment_method='pm_card_visa',
    invoice_settings={'default_payment_method': 'pm_card_visa'}
)

# Create subscription
subscription = stripe.Subscription.create(
    customer=customer.id,
    items=[{'price': settings.STRIPE_PRICE_PRO}],  # $49/month
    expand=['latest_invoice.payment_intent']
)

# subscription.status == 'active'
```

---

## 4. API Credential Management

### 4.1 Secrets Storage

**DO**: Store in AWS Secrets Manager

```python
from app.config import get_secret

apollo_key = get_secret('roleferry/prod/apollo_api_key')['key']
```

**DON'T**: Hardcode in code, commit to Git

---

### 4.2 Environment Variables (Local Dev)

```bash
# backend/.env (gitignored)
APOLLO_API_KEY=your_apollo_key
SENDGRID_API_KEY=SG.your_sendgrid_key
STRIPE_SECRET_KEY=sk_test_your_stripe_key
```

---

## 5. Error Handling

### 5.1 Graceful Degradation

```python
def enrich_application(application_id):
    """Enrich application with contacts (gracefully degrade on failure)"""
    
    try:
        # Try Apollo first
        people = apollo.search_people(...)
    except Exception as e:
        logging.error(f"Apollo failed: {e}")
        
        # Fallback to Clay
        try:
            people = clay.find_people(...)
        except Exception as e2:
            logging.error(f"Clay also failed: {e2}")
            
            # Ultimate fallback: manual entry
            people = []
            notify_user(
                application_id,
                "We couldn't find contacts automatically. Add manually?"
            )
    
    return people
```

---

## 6. Rate Limit Handling

### 6.1 Exponential Backoff

```python
def search_with_backoff(apollo, **kwargs):
    """Search with exponential backoff on rate limit"""
    
    for attempt in range(3):
        try:
            return apollo.search_people(**kwargs)
        except RateLimitError:
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            logging.warning(f"Rate limited, waiting {wait_time}s")
            time.sleep(wait_time)
    
    # After 3 attempts, give up
    raise Exception("Apollo rate limit exceeded after 3 retries")
```

---

## 7. Monitoring Integrations

### 7.1 Track API Calls

```python
@statsd.timed('roleferry.integrations.apollo.search_people')
def search_people(self, **kwargs):
    statsd.increment(
        'roleferry.integrations.apollo.calls',
        tags=['method:search_people']
    )
    
    try:
        result = self.session.post(...)
        statsd.increment('roleferry.integrations.apollo.success')
        return result
    except Exception as e:
        statsd.increment('roleferry.integrations.apollo.error', tags=[f'error:{type(e).__name__}'])
        raise
```

---

### 7.2 Alert on High Error Rates

**Datadog Monitor**:
```yaml
name: "Apollo API Error Rate High"
query: "avg(last_10m):sum:roleferry.integrations.apollo.error{} / sum:roleferry.integrations.apollo.calls{} > 0.1"
message: |
  @slack-engineering
  Apollo API error rate >10% in last 10 min.
  Check if Apollo is down or we hit rate limits.
```

---

## 8. Testing Integrations

### 8.1 Mock External APIs

```python
# tests/test_apollo.py
from unittest.mock import patch, MagicMock

@patch('app.services.apollo_client.requests.Session.post')
def test_search_people_success(mock_post):
    """Test Apollo search_people returns expected data"""
    
    # Mock API response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "people": [
            {"id": "123", "name": "John Doe", "email": "john@acme.com"}
        ]
    }
    mock_post.return_value = mock_response
    
    # Call method
    apollo = ApolloClient(api_key="test_key")
    result = apollo.search_people(organization_domains=["acme.com"])
    
    # Assert
    assert len(result["people"]) == 1
    assert result["people"][0]["name"] == "John Doe"
```

---

## 9. Integration Documentation

### 9.1 Internal Runbook

**Document**:
- API endpoint URLs
- Authentication method
- Rate limits
- Error codes
- Contact (vendor support email)
- Escalation path (if vendor down)

**Example** (Apollo Runbook):
```markdown
## Apollo API

**Base URL**: https://api.apollo.io/v1

**Auth**: API key in request body (`api_key` field)

**Rate Limit**: 1,000 credits/month (Growth plan)

**Error Codes**:
- 429: Rate limit (wait 60s, then retry)
- 402: Out of credits (upgrade plan or wait for reset)

**Vendor Support**: support@apollo.io

**Escalation**: If Apollo down >1 hour, switch to Clay fallback
```

---

## 10. Acceptance Criteria

- [ ] All integrations documented (authentication, rate limits, errors)
- [ ] API clients implemented (Apollo, SendGrid, Stripe, Anthropic)
- [ ] Retry logic (exponential backoff)
- [ ] Circuit breaker (prevent cascade failures)
- [ ] Graceful degradation (fallbacks)
- [ ] Error handling (log, alert, fallback)
- [ ] Monitoring (track API calls, error rates)
- [ ] Testing (mock external APIs in unit tests)

---

**Document Owner**: Backend Lead, Integration Engineer  
**Version**: 1.0  
**Date**: October 2025

