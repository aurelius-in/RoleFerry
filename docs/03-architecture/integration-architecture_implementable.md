# Integration Architecture: Implementable Level
## RoleFerry Platform

**RM-ODP Viewpoint**: Technical Implementation  
**Audience**: Engineers implementing integrations  
**Purpose**: Complete working code for all external integrations

---

## 1. Complete Apollo Client Implementation

```python
# backend/app/clients/apollo.py
import requests
from typing import List, Dict, Optional
from app.config import settings
from app.middleware.rate_limit import RateLimiter
from datadog import statsd
import logging
import time

class ApolloClient:
    BASE_URL = "https://api.apollo.io/v1"
    
    def __init__(self, redis_client):
        self.api_key = settings.APOLLO_API_KEY
        self.rate_limiter = RateLimiter(redis_client, "apollo", max_requests=100, window_seconds=3600)
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def search_people(
        self,
        domain: str,
        titles: List[str],
        seniorities: List[str] = None,
        locations: List[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        Search for people at company
        
        Args:
            domain: Company domain (e.g., 'acme.com')
            titles: Job titles to match
            seniorities: Optional seniority levels
            locations: Optional locations
            limit: Max results
            
        Returns:
            List of person dicts with name, title, email, linkedin
        """
        # Check rate limit
        if not self.rate_limiter.allow():
            raise Exception("Apollo rate limit exceeded")
        
        endpoint = f"{self.BASE_URL}/mixed_people/search"
        
        payload = {
            "api_key": self.api_key,
            "organization_domains": [domain],
            "person_titles": titles,
            "page": 1,
            "per_page": limit
        }
        
        if seniorities:
            payload["person_seniorities"] = seniorities
        
        if locations:
            payload["person_locations"] = locations
        
        start = time.time()
        
        try:
            response = self.session.post(endpoint, json=payload, timeout=10)
            latency_ms = (time.time() - start) * 1000
            
            response.raise_for_status()
            
            data = response.json()
            people = data.get('people', [])
            
            # Transform to standard format
            results = []
            for person in people:
                results.append({
                    'name': person.get('name'),
                    'first_name': person.get('first_name'),
                    'last_name': person.get('last_name'),
                    'title': person.get('title'),
                    'email': person.get('email'),
                    'linkedin': person.get('linkedin_url'),
                    'source': 'apollo',
                    'confidence': 0.90 if person.get('email') else 0.50
                })
            
            # Track success
            statsd.histogram('roleferry.apollo.latency', latency_ms, tags=['endpoint:search_people', 'status:success'])
            statsd.increment('roleferry.apollo.calls', tags=['endpoint:search_people', 'status:success'])
            
            logging.info(f"Apollo search returned {len(results)} people for {domain}")
            return results
        
        except requests.exceptions.Timeout:
            latency_ms = (time.time() - start) * 1000
            statsd.histogram('roleferry.apollo.latency', latency_ms, tags=['endpoint:search_people', 'status:timeout'])
            logging.error(f"Apollo API timeout for {domain}")
            raise
        
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                # Rate limit hit
                logging.warning("Apollo rate limit exceeded")
                raise
            elif e.response.status_code >= 500:
                # Server error, should retry
                logging.error(f"Apollo server error: {e.response.status_code}")
                raise
            else:
                # Client error (400, 404), don't retry
                logging.warning(f"Apollo client error: {e}")
                return []
        
        except Exception as e:
            logging.exception(f"Unexpected Apollo error: {e}")
            statsd.increment('roleferry.apollo.calls', tags=['endpoint:search_people', 'status:error'])
            raise
```

---

## 2. Complete NeverBounce Client

```python
# backend/app/services/email_verifier.py
import requests
from typing import List, Dict

class NeverBounceClient:
    BASE_URL = "https://api.neverbounce.com/v4"
    
    def __init__(self):
        self.api_key = settings.NEVERBOUNCE_API_KEY
    
    def verify_bulk(self, emails: List[str]) -> Dict[str, str]:
        """
        Bulk verify emails
        
        Returns:
            Dict mapping email → status (valid, invalid, risky, unknown)
        """
        endpoint = f"{self.BASE_URL}/jobs/create"
        
        # Create verification job
        response = requests.post(
            endpoint,
            json={
                "key": self.api_key,
                "input": [{"email": e} for e in emails],
                "auto_start": True
            },
            timeout=30
        )
        response.raise_for_status()
        
        job_id = response.json()['job_id']
        
        # Poll for results (max 60 seconds)
        for _ in range(12):  # 12 × 5s = 60s
            time.sleep(5)
            
            results_response = requests.get(
                f"{self.BASE_URL}/jobs/results",
                params={"key": self.api_key, "job_id": job_id},
                timeout=10
            )
            results_response.raise_for_status()
            
            data = results_response.json()
            
            if data['job_status'] == 'complete':
                # Parse results
                verification_map = {}
                for item in data['results']:
                    email = item['data']['email']
                    result = item['verification']['result']
                    
                    # Map to our statuses
                    status_map = {
                        'valid': 'valid',
                        'invalid': 'invalid',
                        'disposable': 'invalid',
                        'catchall': 'risky',
                        'unknown': 'unknown'
                    }
                    verification_map[email] = status_map.get(result, 'unknown')
                
                return verification_map
        
        # Timeout
        logging.error(f"NeverBounce job {job_id} timed out")
        return {}
```

---

## 3. Complete Email Service Adapter

```python
# backend/app/services/email_service.py
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import requests  # For Mailgun

class EmailServiceAdapter:
    """Multi-provider email sending with automatic failover"""
    
    def __init__(self):
        self.sendgrid_client = SendGridAPIClient(settings.SENDGRID_API_KEY)
        self.mailgun_api_key = settings.MAILGUN_API_KEY
        self.mailgun_domain = settings.MAILGUN_DOMAIN
    
    def send(
        self,
        from_addr: str,
        to_addr: str,
        subject: str,
        body_html: str,
        reply_to: str,
        custom_args: dict = None
    ) -> dict:
        """
        Send email with failover (SendGrid → Mailgun)
        
        Returns:
            {"status": "sent", "message_id": "...", "provider": "sendgrid"}
        """
        # Try SendGrid first
        try:
            result = self._send_sendgrid(from_addr, to_addr, subject, body_html, reply_to, custom_args)
            logging.info(f"Email sent via SendGrid: {result['message_id']}")
            return {**result, "provider": "sendgrid"}
        
        except Exception as e:
            logging.warning(f"SendGrid failed: {e}, trying Mailgun")
            statsd.increment('roleferry.email.sendgrid.error')
            
            # Failover to Mailgun
            try:
                result = self._send_mailgun(from_addr, to_addr, subject, body_html, reply_to, custom_args)
                logging.info(f"Email sent via Mailgun: {result['message_id']}")
                return {**result, "provider": "mailgun"}
            
            except Exception as e2:
                logging.error(f"Both email providers failed: SendGrid={e}, Mailgun={e2}")
                statsd.increment('roleferry.email.all_providers.error')
                raise Exception("Email sending failed (all providers)")
    
    def _send_sendgrid(self, from_addr, to_addr, subject, body_html, reply_to, custom_args):
        """Send via SendGrid"""
        message = Mail(
            from_email=Email(from_addr),
            to_emails=To(to_addr),
            subject=subject,
            html_content=Content("text/html", body_html)
        )
        message.reply_to = Email(reply_to)
        
        if custom_args:
            for key, value in custom_args.items():
                message.add_custom_arg(key, value)
        
        response = self.sendgrid_client.send(message)
        
        return {
            "status": "sent",
            "message_id": response.headers.get('X-Message-Id')
        }
    
    def _send_mailgun(self, from_addr, to_addr, subject, body_html, reply_to, custom_args):
        """Send via Mailgun"""
        response = requests.post(
            f"https://api.mailgun.net/v3/{self.mailgun_domain}/messages",
            auth=("api", self.mailgun_api_key),
            data={
                "from": from_addr,
                "to": to_addr,
                "subject": subject,
                "html": body_html,
                "h:Reply-To": reply_to
            },
            timeout=10
        )
        response.raise_for_status()
        
        return {
            "status": "sent",
            "message_id": response.json()['id']
        }
```

---

## 4. Complete Celery Configuration

```python
# backend/app/celery_config.py
from celery import Celery
from kombu import Exchange, Queue

celery_app = Celery(
    'roleferry',
    broker=f'redis://{settings.REDIS_HOST}:6379/0',
    backend=f'redis://{settings.REDIS_HOST}:6379/0'
)

# Configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task routing
    task_routes={
        'app.services.enrichment.*': {'queue': 'enrichment'},
        'app.services.sequencer.*': {'queue': 'sequences'},
        'app.services.analytics.*': {'queue': 'analytics'}
    },
    
    # Queue definitions
    task_queues=(
        Queue('enrichment', Exchange('enrichment'), routing_key='enrichment', max_priority=10),
        Queue('sequences', Exchange('sequences'), routing_key='sequences'),
        Queue('analytics', Exchange('analytics'), routing_key='analytics')
    ),
    
    # Retry config
    task_acks_late=True,  # Acknowledge after task completes (not on receipt)
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=4,  # Workers fetch 4 tasks at a time
    
    # Result backend
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={'master_name': 'roleferry'}
)

# Auto-discover tasks
celery_app.autodiscover_tasks(['app.services'])
```

---

## 5. Acceptance Criteria

- [ ] Apollo client with rate limiting, circuit breaker, fallback
- [ ] NeverBounce client with bulk verification
- [ ] Email service adapter with SendGrid → Mailgun failover
- [ ] Webhook signature verification (SendGrid, Stripe)
- [ ] Idempotency for webhook processing
- [ ] Celery configured with queues, routing, retry logic
- [ ] Datadog metrics tracking integration health
- [ ] All integrations tested (unit tests with mocked responses)

---

**Document Owner**: Integration Engineer  
**Version**: 1.0  
**Date**: October 2025

