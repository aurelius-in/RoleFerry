# Customer Support Playbook
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Support Team, Customer Success  
**Purpose**: Deliver excellent customer support at scale

---

## 1. Support Philosophy

**"Fast, empathetic, and solution-oriented support."**

### Principles
1. **Respond Fast**: <2 hours (weekdays), <24 hours (weekends)
2. **Empathize**: Job search is stressful—be kind
3. **Solve Proactively**: Don't just answer, anticipate next question
4. **Escalate Smartly**: Know when to loop in Engineering

---

## 2. Support Channels

| Channel | Use Case | Response Time | Volume |
|---------|----------|---------------|--------|
| **Email** (support@roleferry.com) | General questions, bug reports | <2 hours | 80% |
| **In-App Chat** (Intercom) | Quick questions, logged-in users | <15 min | 15% |
| **Slack** (Enterprise customers) | Dedicated channel for >10 seats | <1 hour | 5% |
| **Phone** (Enterprise only) | Critical issues, white-glove support | <30 min | <1% |

---

## 3. Support Tiers

### Tier 1: Self-Service (Goal: 50% Deflection)

**Help Center** (help.roleferry.com):
- FAQs (40+ articles)
- Video tutorials (Apply flow, Tracker, Sequences)
- Troubleshooting guides

**Top Articles** (by traffic):
1. "How to apply to a job" (2,000 views/month)
2. "Why didn't RoleFerry find contacts?" (1,500 views)
3. "How to track email replies" (1,200 views)
4. "Upgrade to Pro" (1,000 views)

**Goal**: 50% of users find answers without contacting support

---

### Tier 2: Support Team (Human Response)

**Who**: Support agents (2-3 people by Year 2)

**Tools**: Intercom (ticketing), Notion (knowledge base)

**Handles**:
- Common questions (How do I...?)
- Bug reports (triage, log to Linear)
- Account issues (password reset, billing)

---

### Tier 3: Engineering Escalation

**When**: Complex bugs, feature requests, data issues

**Process**:
1. Support triages, gathers details
2. Creates Linear ticket (label: `support-escalation`)
3. Engineering investigates (P0: same day, P1: 3 days)
4. Support follows up with customer

---

## 4. Common Support Scenarios

### 4.1 "I didn't get any contacts for my application"

**Troubleshooting Steps**:
1. Check application details (company name correct?)
2. Check enrichment logs (did job run? did it fail?)
3. Explain:
   - Small/private companies: Harder to find contacts
   - Startup (<50 employees): Limited data availability
   - Nonprofit: Often not in databases

**Response Template**:
```
Hi [Name],

I see we couldn't find contacts at [Company]. This can happen for a few reasons:
• Small or private company (limited data)
• Startup with <50 employees
• Not in our data providers' databases

You have two options:
1. Manually add a contact (paste LinkedIn URL, we'll find email)
2. Skip this application and apply to another job

Let me know if you need help!

[Support Agent]
```

**Escalation**: If company is large (100+ employees), escalate to Engineering (possible provider issue)

---

### 4.2 "My email bounced"

**Root Causes**:
- Invalid email (wrong format, typo)
- Contact left company (outdated data)
- Mailbox full (rare)

**Response Template**:
```
Hi [Name],

Your email to [Contact] at [Company] bounced. This usually means:
• Email address is invalid or outdated
• Contact no longer works there

We've automatically suppressed this email to protect your sender reputation.

Want to try another contact at [Company]? I can help you find one.

[Support Agent]
```

**Note**: Don't retry bounced emails (damages sender reputation)

---

### 4.3 "I'm not getting replies"

**Troubleshooting**:
1. Check reply rate (is it <5%? below platform avg?)
2. Review draft quality (too generic? too long?)
3. Check targeting (applying to relevant roles?)

**Response Template**:
```
Hi [Name],

I see your reply rate is [X]%. Platform average is 15%.

Let's improve your results:
• Better targeting: Apply to roles matching your background
• Personalize drafts: Edit AI drafts before sending (mention specific projects)
• Follow up: Our 3-step sequence works best

Want me to review your drafts? Happy to give feedback.

[Support Agent]
```

**Escalation**: If reply rate <5% and drafts look good, escalate (possible deliverability issue)

---

### 4.4 "I want to cancel"

**Goal**: Understand why (churn reason), offer help before canceling

**Response Template**:
```
Hi [Name],

Sorry to hear you're thinking about canceling!

Before you go, can I ask why? I'd love to help fix any issues:
• Not getting results? (Let's optimize your approach)
• Too expensive? (We have a 30-day money-back guarantee)
• Found a job? (Congrats! 🎉 Come back if you're ever looking again)

If you still want to cancel, here's how: [Settings → Billing → Cancel]

Let me know if there's anything I can do.

[Support Agent]
```

**If They Found a Job**:
```
Congrats on landing your new role! 🎉

We'd love to hear about your experience. Mind filling out this 2-min survey? [Survey Link]

(And come back if you're ever job hunting again!)

[Support Agent]
```

---

## 5. Response Time SLAs

| Priority | Response Time | Resolution Time |
|----------|---------------|-----------------|
| **P0** (Service down) | 15 minutes | 2 hours |
| **P1** (Critical feature broken) | 1 hour | 4 hours |
| **P2** (General question) | 2 hours | 24 hours |
| **P3** (Enhancement request) | 24 hours | N/A (log to backlog) |

**Tracking**: Intercom automatically tracks response/resolution times

---

## 6. Tone & Voice (Support)

### Do's
✅ Friendly, conversational ("Hi [Name]!" not "Dear Sir/Madam")  
✅ Empathetic ("I understand job searching is stressful")  
✅ Specific ("Your email to Sarah at Acme bounced" not "There was an error")  
✅ Actionable ("Here's what to do next:")

### Don'ts
❌ Robotic ("Your ticket has been received")  
❌ Dismissive ("That's just how it works")  
❌ Jargon ("HTTP 422 validation error")  
❌ Overpromising ("We'll fix this immediately" if unsure)

---

## 7. Escalation Matrix

| Issue | Escalate To | When |
|-------|-------------|------|
| **Bug (P0)** | Engineering (Slack #incidents) | Immediately |
| **Bug (P1)** | Engineering (Linear ticket) | Same day |
| **Refund Request** | Finance (CEO) | Within 24 hours |
| **Legal Threat** | Legal (CEO) | Immediately |
| **Security Concern** | Security (CTO) | Immediately |
| **Feature Request** | Product (Linear backlog) | Weekly batch |

---

## 8. Macros (Canned Responses)

### 8.1 Password Reset

**Macro**: `password-reset`

```
Hi [Name],

You can reset your password here: [Reset Link]

If you didn't receive the email, check your spam folder. Still having trouble? Let me know!

[Support Agent]
```

---

### 8.2 Billing Question

**Macro**: `billing-question`

```
Hi [Name],

You're currently on the [Free/Pro/Teams] plan.

To upgrade: Settings → Billing → Upgrade
To cancel: Settings → Billing → Cancel Subscription

Need help with something specific? Let me know!

[Support Agent]
```

---

### 8.3 Bug Report Confirmation

**Macro**: `bug-logged`

```
Hi [Name],

Thanks for reporting this! I've logged it with our engineering team (ticket #[Linear ID]).

We'll investigate and follow up within [timeframe].

In the meantime, here's a workaround: [if applicable]

[Support Agent]
```

---

## 9. Support Metrics

### 9.1 Key Metrics

| Metric | Target | Current |
|--------|--------|---------|
| **First Response Time** | <2 hours | 📊 TBD |
| **Resolution Time** | <24 hours (P2) | 📊 TBD |
| **Customer Satisfaction** (CSAT) | 90%+ | 📊 TBD |
| **Self-Service Deflection** | 50% | 📊 TBD |
| **Ticket Volume** | <100/week (at 1K users) | 📊 TBD |

**CSAT Survey** (post-resolution):
```
How would you rate this support experience?
😞 😐 😊 😄

[Optional comment]
```

---

## 10. Support Team Training

### 10.1 Onboarding (Week 1)

**Day 1-2**: Product deep dive
- Use RoleFerry as job seeker (apply to 5 jobs)
- Use RoleFerry as recruiter (import leads, send sequence)

**Day 3-4**: Support systems
- Intercom training (tickets, macros, SLAs)
- Notion knowledge base (internal docs)
- Linear (how to escalate bugs)

**Day 5**: Shadow existing support agent

**Week 2**: Start handling tickets (with supervision)

---

### 10.2 Ongoing Training

**Weekly**: Product updates (new features, bug fixes)

**Monthly**: Support retrospective (what went well? what confused users?)

**Quarterly**: Customer empathy exercise (listen to 5 user interviews)

---

## 11. Acceptance Criteria

- [ ] Support channels defined (email, chat, Slack for enterprise)
- [ ] Help Center published (40+ articles)
- [ ] Response time SLAs established (<2 hours P2, <1 hour P1)
- [ ] Common scenarios documented (troubleshooting steps)
- [ ] Escalation matrix (when to escalate to Engineering)
- [ ] Macros created (password reset, billing, bug report)
- [ ] Support metrics tracked (CSAT, response time, deflection)

---

**Document Owner**: Head of Customer Success, Support Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (refine based on ticket trends)

