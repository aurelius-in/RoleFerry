# Webhooks Implementation Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers  
**Purpose**: Handle inbound webhooks from external services

---

## 1. Webhooks Overview

**Purpose**: External services notify us of events (email delivered, payment succeeded, etc.)

**Security**: Signature verification prevents spoofing

---

## 2. SendGrid Email Events

### 2.1 Webhook Configuration

**SendGrid Dashboard**:
- Settings → Mail Settings → Event Webhook
- URL: `https://api.roleferry.com/webhooks/sendgrid`
- Events: Delivered, Bounce, Spam Report, Click

**Verification Key**: Store in Secrets Manager

---

### 2.2 Implementation

```python
# backend/app/routers/webhooks.py
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from app.services.webhook_verifier import verify_sendgrid_signature
from app.models import Outreach, Contact
import logging

router = APIRouter()

@router.post("/webhooks/sendgrid")
async def sendgrid_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Handle SendGrid event webhooks
    Docs: https://docs.sendgrid.com/for-developers/tracking-events/event
    """
    # Verify signature
    verify_sendgrid_signature(request)
    
    events = await request.json()
    
    # Process in background (return 200 immediately)
    background_tasks.add_task(process_sendgrid_events, events)
    
    return {"status": "ok"}

async def process_sendgrid_events(events: list):
    """Process events asynchronously"""
    db = SessionLocal()
    
    try:
        for event in events:
            event_type = event.get('event')
            
            # Extract outreach_id from custom args
            outreach_id = event.get('outreach_id')
            if not outreach_id:
                # Try to extract from smtp-id
                smtp_id = event.get('smtp-id', '')
                outreach_id = extract_outreach_id_from_smtp(smtp_id)
            
            if not outreach_id:
                logging.warning(f"Could not find outreach_id for event: {event}")
                continue
            
            outreach = db.query(Outreach).get(outreach_id)
            if not outreach:
                logging.warning(f"Outreach {outreach_id} not found")
                continue
            
            # Update based on event type
            if event_type == "delivered":
                outreach.status = "delivered"
                outreach.delivered_at = datetime.fromtimestamp(event.get('timestamp'))
                
                # Update contact last_contacted
                contact = outreach.contact
                contact.last_contacted_at = outreach.delivered_at
            
            elif event_type == "bounce":
                outreach.status = "bounced"
                
                # Increment contact bounce count
                contact = outreach.contact
                contact.bounce_count += 1
                
                # Hard suppress after 3 bounces
                if contact.bounce_count >= 3:
                    contact.opted_out = True
                    logging.warning(f"Contact {contact.id} auto-suppressed (3+ bounces)")
                
                # Update mailbox health (deduct points)
                mailbox = db.query(Mailbox).filter_by(email=outreach.from_mailbox).first()
                if mailbox:
                    mailbox.bounce_count_7d += 1
            
            elif event_type == "spamreport":
                outreach.status = "spam"
                
                # Immediately opt out
                contact = outreach.contact
                contact.opted_out = True
                contact.spam_reports += 1
                
                # Critical alert
                logging.critical(f"SPAM REPORT: Outreach {outreach_id}, Contact {contact.id}")
                send_slack_alert(
                    channel="#deliverability",
                    message=f"🚨 Spam report for outreach {outreach_id}. User: {outreach.application.user.email}"
                )
                
                # Update mailbox health (major penalty)
                mailbox = db.query(Mailbox).filter_by(email=outreach.from_mailbox).first()
                if mailbox:
                    mailbox.spam_reports_7d += 1
            
            elif event_type == "click":
                outreach.link_clicks += 1
                if not outreach.clicked_at:
                    outreach.clicked_at = datetime.fromtimestamp(event.get('timestamp'))
            
            db.commit()
    
    except Exception as e:
        logging.exception(f"Error processing SendGrid events: {e}")
        db.rollback()
    
    finally:
        db.close()
```

---

## 3. Stripe Payment Events

### 3.1 Webhook Configuration

**Stripe Dashboard**:
- Developers → Webhooks → Add endpoint
- URL: `https://api.roleferry.com/webhooks/stripe`
- Events: `customer.subscription.created`, `invoice.payment_succeeded`, `invoice.payment_failed`

---

### 3.2 Implementation

```python
@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle event
    if event['type'] == 'customer.subscription.created':
        subscription = event['data']['object']
        handle_subscription_created(subscription)
    
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        handle_payment_succeeded(invoice)
    
    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        handle_payment_failed(invoice)
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_canceled(subscription)
    
    return {"status": "ok"}

def handle_subscription_created(subscription):
    """User upgraded to paid"""
    customer_id = subscription['customer']
    user = db.query(User).filter_by(stripe_customer_id=customer_id).first()
    
    if user:
        # Update subscription tier
        if subscription['items']['data'][0]['price']['id'] == settings.STRIPE_PRICE_PRO:
            user.subscription_tier = 'pro'
        elif subscription['items']['data'][0]['price']['id'] == settings.STRIPE_PRICE_TEAMS:
            user.subscription_tier = 'teams'
        
        # Reset credits
        user.credits_remaining = 500 if user.subscription_tier == 'pro' else 2000
        
        db.commit()
        
        # Send welcome email
        send_email(user.email, "Welcome to RoleFerry Pro!")
```

---

## 4. Mailgun Inbound Email (Reply Detection)

### 4.1 Configuration

**Mailgun Dashboard**:
- Receiving → Routes → Create Route
- Filter: `match_recipient(".*@rf-send-01.com")`
- Action: `forward("https://api.roleferry.com/webhooks/mailgun-inbound")`

---

### 4.2 Implementation

```python
@router.post("/webhooks/mailgun-inbound")
async def mailgun_inbound(request: Request):
    """Detect replies to outreach emails"""
    form_data = await request.form()
    
    from_email = form_data.get('from')  # Who replied
    to_email = form_data.get('recipient')  # Our mailbox
    subject = form_data.get('subject')
    body_plain = form_data.get('body-plain')
    
    # Find outreach record
    db = SessionLocal()
    
    outreach = db.query(Outreach).filter(
        Outreach.from_mailbox == to_email,
        Outreach.status.in_(['sent', 'delivered'])
    ).order_by(Outreach.sent_at.desc()).first()
    
    if outreach:
        # Mark as replied
        outreach.status = 'replied'
        outreach.replied_at = datetime.utcnow()
        
        # Stop sequence
        from app.services.outreach_service import stop_sequence_on_reply
        stop_sequence_on_reply(outreach.id)
        
        # Update application status
        application = outreach.application
        if application.status == 'applied':
            application.status = 'interviewing'
            application.reply_status = 'replied'
        
        db.commit()
        
        # Send push notification to user
        from app.services.notifications import send_push
        send_push(
            user_id=application.user_id,
            title="Reply received!",
            body=f"{outreach.contact.first_name} at {application.job.company.name} replied"
        )
        
        logging.info(f"Reply detected for outreach {outreach.id}")
    
    db.close()
    
    return {"status": "ok"}
```

---

## 5. Webhook Security

### 5.1 Signature Verification (SendGrid)

```python
# backend/app/services/webhook_verifier.py
import hmac
import hashlib
import base64
from fastapi import Request, HTTPException

def verify_sendgrid_signature(request: Request):
    """Verify webhook came from SendGrid"""
    signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature')
    timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp')
    
    if not signature or not timestamp:
        raise HTTPException(status_code=401, detail="Missing signature headers")
    
    # Reconstruct signed payload
    payload = await request.body()
    signed_payload = timestamp + payload.decode()
    
    # Calculate expected signature
    expected = base64.b64encode(
        hmac.new(
            settings.SENDGRID_WEBHOOK_KEY.encode(),
            signed_payload.encode(),
            hashlib.sha256
        ).digest()
    ).decode()
    
    # Compare (timing-safe)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    return True
```

---

### 5.2 Idempotency (Prevent Duplicate Processing)

```python
def process_webhook_event(event_id: str, event_data: dict):
    """Process webhook event idempotently"""
    
    # Check if already processed
    if redis_client.exists(f"webhook:processed:{event_id}"):
        logging.info(f"Event {event_id} already processed, skipping")
        return {"status": "duplicate", "processed_at": redis_client.get(f"webhook:processed:{event_id}")}
    
    # Process event
    result = handle_event(event_data)
    
    # Mark as processed (24-hour TTL)
    redis_client.setex(
        f"webhook:processed:{event_id}",
        86400,
        datetime.utcnow().isoformat()
    )
    
    return result
```

---

## 6. Webhook Monitoring

### 6.1 Metrics

```python
# Track webhook processing
from datadog import statsd

def track_webhook(provider: str, event_type: str, success: bool):
    tags = [
        f'provider:{provider}',
        f'event_type:{event_type}',
        f'status:{"success" if success else "error"}'
    ]
    
    statsd.increment('roleferry.webhooks.received', tags=tags)
    
    if not success:
        statsd.increment('roleferry.webhooks.errors', tags=tags)
```

---

### 6.2 Alerts

**Datadog Monitor**:
```yaml
name: "Webhook Processing Errors High"
query: "avg(last_10m):sum:roleferry.webhooks.errors{} > 10"
message: |
  @slack-engineering
  Webhook processing errors >10 in last 10 minutes.
  Check logs: https://app.datadoghq.com/logs?query=webhooks
```

---

## 7. Testing Webhooks

### 7.1 Mock Webhook Payloads

```python
# tests/webhooks/test_sendgrid.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_sendgrid_webhook_delivered(client: AsyncClient):
    payload = [{
        "event": "delivered",
        "email": "recipient@acme.com",
        "smtp-id": "<outreach_123@roleferry.com>",
        "timestamp": 1697200000,
        "outreach_id": "123"
    }]
    
    response = await client.post('/webhooks/sendgrid', json=payload)
    
    assert response.status_code == 200
    
    # Verify database updated
    outreach = db.query(Outreach).get(123)
    assert outreach.status == "delivered"
    assert outreach.delivered_at is not None
```

---

## 8. Acceptance Criteria

- [ ] Webhooks configured (SendGrid, Stripe, Mailgun)
- [ ] Signature verification implemented (prevent spoofing)
- [ ] Idempotency ensured (duplicate webhooks handled)
- [ ] Background processing (return 200 quickly, process async)
- [ ] Error handling (log failures, don't crash)
- [ ] Monitoring (track success/error rates)
- [ ] Testing (mock webhook payloads, unit tests)

---

**Document Owner**: Backend Lead  
**Version**: 1.0  
**Date**: October 2025

