# CAN-SPAM Compliance Guide
## RoleFerry Platform

**Regulation**: CAN-SPAM Act of 2003 (US)  
**Scope**: All commercial emails sent from RoleFerry domains  
**Penalties**: Up to $46,517 per violation

---

## 1. CAN-SPAM Requirements

### 1.1 Seven Core Requirements

| Requirement | RoleFerry Implementation | Status |
|-------------|--------------------------|--------|
| **1. Accurate Header Info** | From/Reply-To must be valid | ✅ Automated |
| **2. Non-Deceptive Subject Lines** | Subject must reflect email content | ✅ User draft review |
| **3. Identify as Advertisement** | Mark commercial emails | ⚠️ B2B exempt (see 2.1) |
| **4. Physical Address** | Include sender's postal address | ✅ Footer auto-added |
| **5. Opt-Out Mechanism** | Provide unsubscribe link | ✅ Footer + reply detection |
| **6. Honor Opt-Outs Promptly** | Process within 10 business days | ✅ Within 1 hour |
| **7. Monitor Third Parties** | Ensure vendors comply | ✅ SendGrid/Mailgun compliant |

---

## 2. B2B Email Exemptions

### 2.1 Business-to-Business Exception
CAN-SPAM's "advertisement" label requirement does NOT apply to:
- Emails sent to **business email addresses** (e.g., john@acme.com)
- Emails about **business-related matters** (job opportunities, recruiting)

**RoleFerry's Use Case**:
- **Job Seekers** → Emailing hiring managers, recruiters (B2B context)
- **Recruiters** → Emailing candidates about job opportunities (B2B context)

**Conclusion**: Our emails qualify for B2B exemption; no "Advertisement" label required.

**However**: We still comply with ALL other CAN-SPAM requirements (opt-out, address, header accuracy).

---

## 3. Implementation Details

### 3.1 Header Accuracy (Requirement #1)

#### From Address
- **Format**: `auto1@rf-send-01.com` (RoleFerry-owned domain)
- **Must**: Be valid, functioning mailbox that receives replies
- **Must NOT**: Use fake/misleading sender names

#### Reply-To Address
- **Set to**: User's personal email (e.g., jane@example.com)
- **Ensures**: Replies go to actual sender, not generic mailbox

#### Implementation:
```python
# Email headers
from_addr = mailbox.email  # auto1@rf-send-01.com
reply_to = user.email       # jane@example.com

email = {
    "from": from_addr,
    "reply_to": reply_to,
    "to": contact.email,
    "subject": subject,
    "body": body
}
```

---

### 3.2 Non-Deceptive Subject Lines (Requirement #2)

#### Rules
- Subject must **accurately reflect** email content
- No bait-and-switch (e.g., "RE: Your order" when there's no prior order)

#### RoleFerry Safeguards
- **User-generated subjects**: User reviews subject before send
- **AI-generated subjects**: Prompts emphasize accuracy ("Write a truthful subject line about...")
- **Monitoring**: Automated checks flag suspicious patterns (e.g., "RE:" without prior thread)

#### Example Compliant Subjects:
✅ "Quick advice on PM role at Acme?"  
✅ "Exploring Senior Engineer opportunities"  
✅ "Following up on your application to Beta Inc"

#### Example Non-Compliant:
❌ "RE: Your interview" (when no interview scheduled)  
❌ "Urgent: Account suspended" (false urgency)

---

### 3.3 Physical Address (Requirement #4)

#### Implementation
Every email footer includes RoleFerry's physical address:

```html
<footer style="font-size:12px; color:#666; margin-top:20px; border-top:1px solid #ccc; padding-top:10px;">
  <p>
    Sent via RoleFerry | 
    <a href="https://roleferry.com/unsubscribe?token={{unsubscribe_token}}">Unsubscribe</a>
  </p>
  <p>
    RoleFerry Inc.<br>
    123 Market Street, Suite 400<br>
    San Francisco, CA 94103<br>
    United States
  </p>
</footer>
```

**Auto-Appended**: System adds footer to every outreach email (user cannot disable).

---

### 3.4 Opt-Out Mechanism (Requirement #5)

#### Three Opt-Out Methods

**Method 1: Unsubscribe Link**
- Footer link: `https://roleferry.com/unsubscribe?token={{unique_token}}`
- One-click opt-out (no login required)
- Confirmation page: "You've been unsubscribed. You won't receive further emails from this sender."

**Method 2: Reply-Based Opt-Out**
- Recipient replies with "unsubscribe," "stop," "remove me"
- System detects keywords → marks contact as opted out
- Auto-reply confirmation: "You've been unsubscribed."

**Method 3: Email to Privacy Team**
- Contact emails privacy@roleferry.com
- Manual processing (backup method)

#### Implementation:
```python
# Detect opt-out in reply webhook
def process_reply(from_email, body):
    opt_out_keywords = ["unsubscribe", "stop", "remove", "opt out", "opt-out"]
    
    if any(keyword in body.lower() for keyword in opt_out_keywords):
        contact = Contact.query.filter_by(email=from_email).first()
        contact.opted_out = True
        contact.opted_out_at = datetime.utcnow()
        db.commit()
        
        # Stop all sequences
        stop_all_sequences_for_contact(contact.id)
        
        # Send confirmation
        send_opt_out_confirmation(contact.email)
```

---

### 3.5 Honor Opt-Outs Promptly (Requirement #6)

#### Legal Requirement
- Process opt-out within **10 business days**

#### RoleFerry Standard
- Process within **1 hour** (99%+ of cases)
- System checks opt-out status before every send
- Opted-out contacts excluded from all future sequences (global suppression)

#### Verification:
```python
# Pre-send check
def can_send_to_contact(contact_id):
    contact = Contact.query.filter_by(id=contact_id).first()
    
    if contact.opted_out:
        log.info(f"Skipping send: Contact {contact_id} opted out at {contact.opted_out_at}")
        return False
    
    if contact.bounce_count >= 3:
        log.info(f"Skipping send: Contact {contact_id} has {contact.bounce_count} bounces")
        return False
    
    return True
```

---

### 3.6 Monitoring Third Parties (Requirement #7)

#### Vendors We Use
- **SendGrid**: SOC 2 Type II, CAN-SPAM compliant
- **Mailgun**: SOC 2 Type II, CAN-SPAM compliant
- **Apollo/Clay**: Data providers (not email senders; exempt)

#### Due Diligence
- Annual compliance audits of email service providers
- Review vendor privacy policies, ToS
- Contractual clauses requiring CAN-SPAM compliance

---

## 4. User Responsibilities

### 4.1 User-Generated Content
Users are responsible for:
- **Truthful subject lines**: Don't mislead recipients
- **Appropriate tone**: No harassment, threats, or offensive language
- **Respecting opt-outs**: Don't manually email contacts who opt out

### 4.2 Platform Safeguards
RoleFerry enforces:
- **Automated footer**: Can't be removed
- **Opt-out detection**: System stops sequences automatically
- **Rate limiting**: Prevents spam-like volume (50/day per mailbox)
- **Content moderation**: AI flags inappropriate language (profanity, threats)

### 4.3 Violations
If a user violates CAN-SPAM:
1. **Warning**: First offense → account warning
2. **Suspension**: Second offense → account suspended (30 days)
3. **Termination**: Third offense → account permanently banned

**Reporting**: Recipients can report abuse to abuse@roleferry.com

---

## 5. Spam Complaints & Handling

### 5.1 Complaint Threshold
- **Industry standard**: <0.1% spam complaint rate
- **RoleFerry target**: <0.05%

### 5.2 Monitoring
- SendGrid/Mailgun report spam complaints via webhooks
- Real-time alerts if mailbox exceeds 0.1%

### 5.3 Response Protocol
**When spam complaint received**:
1. **Immediate**: Mark contact as opted out (no future emails)
2. **Investigate**: Review email content (was it inappropriate?)
3. **User notification**: Alert user ("Your email was marked as spam; please review your messaging")
4. **Health impact**: Mailbox health score reduced

**If pattern detected** (3+ complaints in 7 days for same user):
- **Account review**: Manual review by compliance team
- **Possible suspension**: If user is sending spammy content

---

## 6. Transactional Email Exception

### 6.1 What Qualifies as Transactional
CAN-SPAM exempts **transactional/relationship emails**:
- Account notifications (password reset, verification)
- Service updates (sequence started, reply received)
- Billing/payment confirmations

**Key**: Primary purpose is facilitating transaction, NOT advertisement.

### 6.2 RoleFerry Transactional Emails
✅ **Exempt** (no opt-out required, no address needed):
- Email verification ("Confirm your email")
- Password reset
- "Reply received from John at Acme Corp"
- "Sequence started for Application #1234"
- Payment receipt

❌ **NOT Exempt** (full CAN-SPAM compliance required):
- Marketing emails ("New features in RoleFerry!")
- Promotional offers ("Upgrade to Pro for 20% off")
- Weekly digests (contains marketing content)

---

## 7. Record-Keeping & Audits

### 7.1 Required Records
- **Opt-out log**: Who opted out, when, method
- **Send log**: Every email sent (to, from, subject, timestamp)
- **Complaint log**: Spam complaints, investigation notes

### 7.2 Retention
- **3 years** (FTC audit requirement)

### 7.3 Audit Readiness
**Quarterly internal audit**:
- [ ] Verify footer on all outreach emails
- [ ] Test opt-out mechanisms (link, reply detection)
- [ ] Check opt-out processing time (avg <1 hour?)
- [ ] Review complaint rate (<0.05%?)
- [ ] Spot-check user emails for compliance

---

## 8. Training & Awareness

### 8.1 Employee Training
- **Onboarding**: All employees trained on CAN-SPAM basics
- **Annual refresh**: Compliance team conducts yearly training
- **Engineers**: Specific training on footer implementation, opt-out logic

### 8.2 User Education
- **Help docs**: "How to write compliant outreach emails"
- **In-app tips**: "Make sure your subject line accurately describes your email"
- **Copilot guardrails**: AI refuses to generate misleading subjects

---

## 9. Penalties & Liability

### 9.1 Financial Penalties
- **Per violation**: Up to $46,517 (adjusted annually for inflation)
- **Multiple violations**: Each email = separate violation

### 9.2 Who is Liable?
- **Primary**: Company sending email (RoleFerry)
- **Secondary**: Individual user (if acting independently)

**RoleFerry's Approach**:
- We assume liability for platform failures (e.g., footer not added)
- Users assume liability for content they write (e.g., deceptive subject lines)

---

## 10. Checklist: Pre-Launch Compliance

- [ ] Email footer template created with physical address
- [ ] Unsubscribe link functional (tested end-to-end)
- [ ] Reply-based opt-out detection implemented
- [ ] Opt-out processing <1 hour verified
- [ ] From/Reply-To headers accurate
- [ ] Transactional vs. marketing emails classified
- [ ] Spam complaint monitoring configured
- [ ] User content moderation (AI flagging) enabled
- [ ] Terms of Service includes CAN-SPAM user obligations
- [ ] Legal counsel reviewed implementation

---

## 11. Contact Information

**Compliance Questions**: compliance@roleferry.com  
**Abuse Reports**: abuse@roleferry.com  
**Opt-Out Requests**: privacy@roleferry.com (or use unsubscribe link)

**FTC CAN-SPAM Resources**: https://www.ftc.gov/tips-advice/business-center/guidance/can-spam-act-compliance-guide-business

---

**Document Owner**: Legal & Compliance Team  
**Reviewed By**: External Counsel (Email Law Specialist)  
**Version**: 1.0  
**Date**: October 13, 2025  
**Next Review**: Annually or upon regulation changes

