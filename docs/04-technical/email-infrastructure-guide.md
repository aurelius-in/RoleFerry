# Email Infrastructure Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: DevOps, Email Operations  
**Purpose**: Setup and management of sending domains

---

## 1. Domain Setup

### 1.1 Purchase Domains
**Naming Convention**: `rf-send-01.com`, `rf-send-02.com`, etc.

**Provider**: Namecheap, GoDaddy (separate from main domain)

**Quantity**: Start with 5 domains, scale to 100+ over 12 months

---

## 2. DNS Configuration

### 2.1 SPF Record
**Purpose**: Authorize SendGrid to send from our domain

```dns
TXT @ "v=spf1 include:sendgrid.net ~all"
```

### 2.2 DKIM Record
**Purpose**: Cryptographic signature for email authentication

SendGrid provides 3 CNAME records:
```dns
CNAME s1._domainkey.rf-send-01.com s1.domainkey.u12345.wl.sendgrid.net
CNAME s2._domainkey.rf-send-01.com s2.domainkey.u12345.wl.sendgrid.net
CNAME em123.rf-send-01.com u12345.wl.sendgrid.net
```

### 2.3 DMARC Record
**Purpose**: Email authentication policy

```dns
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@roleferry.com; ruf=mailto:dmarc@roleferry.com; fo=1"
```

**Policy Options**:
- `p=none`: Monitor only (start here)
- `p=quarantine`: Suspicious emails to spam
- `p=reject`: Reject unauthenticated emails (after 30 days)

---

## 3. SendGrid Setup

### 3.1 Domain Authentication
1. Log into SendGrid
2. Settings → Sender Authentication → Authenticate Domain
3. Enter: `rf-send-01.com`
4. Copy DNS records → Add to DNS provider
5. Verify (click "Verify" button)

### 3.2 Create Mailboxes
```bash
# Add sender identity for each mailbox
curl -X POST https://api.sendgrid.com/v3/senders \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "RoleFerry Auto 1",
    "from": {
      "email": "auto1@rf-send-01.com",
      "name": "RoleFerry"
    },
    "reply_to": {
      "email": "support@roleferry.com",
      "name": "RoleFerry Support"
    },
    "address": "123 Market St, San Francisco, CA 94103",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94103",
    "country": "United States"
  }'
```

### 3.3 Configure Webhooks
```bash
curl -X POST https://api.sendgrid.com/v3/user/webhooks/event/settings \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -d '{
    "enabled": true,
    "url": "https://api.roleferry.com/webhooks/sendgrid",
    "group_resubscribe": false,
    "delivered": true,
    "bounce": true,
    "spam_report": true,
    "click": true
  }'
```

---

## 4. Warmup Protocol

### 4.1 Day 1-30 Schedule
```
Day 1-3:   5 emails/day
Day 4-7:   10 emails/day
Day 8-14:  20 emails/day
Day 15-21: 30 emails/day
Day 22-30: 40 emails/day, then 50/day (production)
```

### 4.2 Warmup Email Strategy
**Seed Accounts**: Internal RoleFerry emails that auto-reply

**Sample Warmup Email**:
```
From: auto1@rf-send-01.com
To: seed01@roleferry.com
Subject: Test email 001
Body: This is a warmup email. Please reply.

---
Auto-Reply (from seed01):
Subject: Re: Test email 001
Body: Thanks for your email!
```

**Automation**: Celery task sends warmup emails daily, rotates seed accounts

---

## 5. Health Monitoring

### 5.1 Daily Health Check Script
```python
# scripts/check_mailbox_health.py
import psycopg2
from datetime import datetime, timedelta

def check_all_mailboxes():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Get mailboxes with health <70
    cursor.execute("""
        SELECT email, health_score, bounce_count_7d, spam_reports_7d
        FROM mailboxes
        WHERE health_score < 70
    """)
    
    unhealthy = cursor.fetchall()
    
    if unhealthy:
        # Alert ops team
        send_slack_alert(
            channel="#deliverability",
            message=f"{len(unhealthy)} mailboxes have health <70. Review needed."
        )
    
    conn.close()

# Run via cron (daily at 9 AM UTC)
```

---

## 6. Troubleshooting

### Problem: Domain Blacklisted
**Symptoms**: 100% bounce rate, emails rejected

**Diagnosis**:
1. Check blacklist status: mxtoolbox.com/blacklists.aspx
2. Check spam complaint rate (>0.1%?)

**Solution**:
1. **Pause domain immediately**
2. **Request delisting** (blacklist-specific process)
3. **Investigate**: Why were we listed? (spam complaints, high bounce rate)
4. **Fix root cause**: Content moderation, better verification
5. **Gradual re-warmup**: Start at 5/day again

---

## 7. Scaling Plan

### Month 1-3: 5 domains (250 emails/day)
### Month 4-6: 20 domains (1,000 emails/day)
### Month 7-12: 50 domains (2,500 emails/day)
### Year 2: 100+ domains (5,000+ emails/day)

**Cost**: $50/domain/year (DNS) + $0.01/email (SendGrid) = $5K/year + usage

---

**Document Owner**: Email Operations Lead  
**Version**: 1.0  
**Date**: October 2025

