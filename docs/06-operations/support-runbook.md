# Customer Support Runbook
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Support Team, Customer Success  
**Purpose**: Standard procedures for common user issues

---

## 1. Support Tiers

| Tier | Response Time | Channels | Coverage |
|------|---------------|----------|----------|
| **Free** | 48 hours | Email only | Business hours |
| **Pro** | 24 hours | Email + chat | Business hours |
| **Teams** | 12 hours | Email + chat + phone | Business hours |
| **Enterprise** | 4 hours | Dedicated Slack + phone | 24/7 (SLA) |

---

## 2. Common Issues & Solutions

### ISSUE-001: "Enrichment Not Finding Contacts"

**Symptoms**: User applied to job, enrichment returned 0 contacts

**Diagnosis**:
1. Check company domain (is it valid?)
2. Check Apollo/Clay status (are APIs down?)
3. Check persona filters (too narrow?)

**Solutions**:
- **Invalid domain**: Help user manually add domain (Settings → Company)
- **Obscure company**: Suggest manual contact entry (LinkedIn URL)
- **API down**: "We're experiencing issues with our data provider. Try again in 1 hour."

**Escalation**: If 3+ users report same company, investigate (add to blocklist?).

---

### ISSUE-002: "Email Not Sending"

**Symptoms**: Sequence status stuck at "queued" for >10 minutes

**Diagnosis**:
1. Check mailbox health (Deliverability dashboard)
2. Check queue depth (Celery admin)
3. Check contact opt-out status

**Solutions**:
- **All mailboxes capped**: "Sending will resume tomorrow (daily limits)."
- **Contact opted out**: "This contact unsubscribed. Try another contact."
- **Queue backlog**: Escalate to engineering (workers may be down)

---

### ISSUE-003: "Low Reply Rate"

**Symptoms**: User sent 20 emails, 0 replies

**Diagnosis**:
1. Review email content (is it too generic? too long?)
2. Check deliverability (are emails landing in inbox?)
3. Check contacts (are they relevant titles?)

**Solutions**:
- **Poor messaging**: Suggest using Author (AI rewrite)
- **Spam folder**: Check deliverability health, suggest Custom Tracking Domain
- **Wrong contacts**: Refine persona (target hiring managers, not HR generalists)

**Tip**: "Platform average is 15%. Give it 2 weeks (some replies take 5-7 days)."

---

### ISSUE-004: "Can't Upload Resume"

**Symptoms**: PDF upload fails or parsing incorrect

**Solutions**:
- **File too large**: "Max 5MB. Try compressing PDF."
- **Unsupported format**: "We support PDF and DOCX only."
- **Parsing errors**: "Edit extracted data manually (click to edit fields)."

---

### ISSUE-005: "Subscription Charge Issue"

**Symptoms**: User confused about charge, wants refund

**Solutions**:
- **First charge**: "You signed up for Pro on [date]. Cancel anytime in Settings."
- **Unexpected charge**: Check Stripe (was it renewal? overage?)
- **Refund request**: "30-day money-back guarantee. Processing refund now."

**Escalation**: Refunds >$500 require manager approval.

---

## 3. Escalation Matrix

| Issue Type | First Response | Escalate To | Timeline |
|------------|----------------|-------------|----------|
| **Billing** | Support Agent | Finance | 24 hours |
| **Technical Bug** | Support → Engineering | CTO | 48 hours |
| **Feature Request** | Log in Linear | Product Manager | Weekly review |
| **Security Concern** | Support → CTO | CEO | Immediate |
| **Legal Threat** | Support → CEO | Legal Counsel | Immediate |

---

## 4. Support Macros (Templates)

### Macro: Enrichment Failed
```
Subject: Re: Enrichment Issue

Hi [Name],

I see enrichment didn't find contacts for [Company]. This can happen if:
1. Company is small/private (not in public databases)
2. Domain is incorrect

Can you try:
- Verify company website/domain
- Manually add contact (paste LinkedIn URL)

Let me know if you need help!

Best,
[Support Agent]
```

---

### Macro: Refund Request
```
Subject: Refund Processed

Hi [Name],

I've processed your refund for $[amount]. It should appear in your account within 5-7 business days.

Sorry RoleFerry didn't work out. If you have feedback on how we can improve, I'd love to hear it.

Best,
[Support Agent]
```

---

## 5. Knowledge Base Articles

**Top 10 FAQ**:
1. How does enrichment work?
2. Why aren't my emails sending?
3. How do I improve reply rates?
4. Can I import my existing applications?
5. How do I cancel my subscription?
6. Is my data secure?
7. How do I set up Custom Tracking Domain?
8. What's the difference between Free and Pro?
9. Can I switch between Job Seeker and Recruiter mode?
10. How do I delete my account?

---

**Document Owner**: Head of Support (future hire)  
**Version**: 1.0  
**Date**: October 2025

