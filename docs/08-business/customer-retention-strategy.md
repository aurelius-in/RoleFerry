# Customer Retention Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, Customer Success, Leadership  
**Purpose**: Reduce churn, increase LTV

---

## 1. Retention Goals

| Metric | Current | Target (Month 12) |
|--------|---------|-------------------|
| **D1 retention** | TBD | 40% |
| **D7 retention** | TBD | 70% |
| **D30 retention** | TBD | 60% |
| **Monthly churn** (paid) | TBD | <5% |
| **Annual churn** | TBD | <40% |

**Economic Impact**: 5% monthly churn → 85% annual retention → LTV = $600 (vs. 40% churn → LTV = $350)

---

## 2. Churn Analysis

### 2.1 Reasons for Churn (Hypothesized)

| Reason | % of Churn | Addressable? |
|--------|------------|--------------|
| **Found job** | 40% | ✅ Partial (encourage passive use) |
| **Low reply rate** (<5%) | 25% | ✅ Yes (improve enrichment, coaching) |
| **Price sensitivity** | 15% | ✅ Partial (demonstrate ROI) |
| **Product not used** (never applied) | 10% | ✅ Yes (activation campaigns) |
| **Better alternative** (competitor) | 10% | ✅ Yes (differentiation, features) |

---

### 2.2 Churn Prediction Model

**Early Warning Signals** (30 days before churn):
- No login in 7 days
- No applications in 14 days
- Reply rate <5% (if they did apply)
- Support tickets (complaints about quality)

**Intervention**: Proactive outreach (email, in-app message)

---

## 3. Onboarding Optimization (D1-D7)

### 3.1 Day 1: Activation

**Goal**: User applies to first job within 24 hours

**Tactics**:
- Onboarding email (1 hour after signup): "Complete IJP wizard (5 min)"
- In-app prompts: "Apply to your first job to see how RoleFerry works"
- Product tour: Highlight Apply button, show example

**Metric**: 60% apply to 1+ job by D1

---

### 3.2 Day 3: Early Win

**Goal**: User gets first reply

**Tactics**:
- Email if no reply yet: "Replies usually come within 3-5 days. Hang tight!"
- Copilot reassurance: "Platform average: 15% reply rate, 3-day median"
- Encourage more applies: "Apply to 5-10 jobs for best results"

**Metric**: 20% get first reply by D7

---

### 3.3 Day 7: Habit Formation

**Goal**: User applies to 5+ jobs (engaged)

**Tactics**:
- Celebration email: "You've applied to 5 jobs this week! 🎉"
- Share stats: "Your reply rate: 12% (vs. platform avg: 15%)"
- Upgrade prompt (if free tier): "Upgrade for unlimited applications"

**Metric**: 30% apply to 5+ jobs by D7

---

## 4. Engagement Campaigns (D8-D30)

### 4.1 Week 2: First Reply Celebration

**Trigger**: User gets first reply

**Email**:
```
Subject: 🎉 You got a reply!

Hi [Name],

[Contact Name] at [Company] just replied to your outreach!

This is exactly why RoleFerry works. Direct email > blind applications.

Next steps:
- Reply within 24 hours (promptness matters)
- Suggest a quick call (15 min)
- Keep applying (build pipeline)

You're doing great!
```

**In-App**: Confetti animation, social share prompt

---

### 4.2 Week 3: Re-Engagement (If Inactive)

**Trigger**: No login in 7 days

**Email**:
```
Subject: We miss you! How's your search going?

Hi [Name],

Haven't seen you on RoleFerry lately. Everything okay?

If you're stuck:
- Try different roles/locations (refine IJP)
- Check reply quality (we can help optimize)
- Reply to this email—I'm here to help

If you found a job: Congrats! Let us know so we can celebrate 🎉

[Support Team]
```

---

### 4.3 Week 4: Upgrade Prompt (Free Users)

**Trigger**: Hit 10-application limit

**Modal**:
```
You've hit your Free tier limit (10 applications this month)

Upgrade to Pro for:
✓ Unlimited applications
✓ AI Copilot (get answers, optimize outreach)
✓ LivePages (personalized landing pages)

$49/month or $468/year (save 20%)

[Upgrade Now] [Maybe Later]
```

**Email** (if dismissed modal):
```
Subject: Unlock unlimited applications

Hi [Name],

You've been crushing it—10 applications this month!

Ready to level up? Pro gives you unlimited applications + AI features.

Early user special: Use code UPGRADE20 for 20% off first 3 months.

[Upgrade to Pro]
```

---

## 5. Retention Features (Product)

### 5.1 Progress Tracking

**Dashboard Widget**: "Your Journey"
```
Applications: 15
Replies: 3 (20% reply rate—above average!)
Interviews: 1
Days active: 12

Keep going! Users who apply to 20+ jobs have 80% success rate.
```

**Gamification** (subtle, not gimmicky):
- Milestones (5 apps, 10 apps, first reply, first interview)
- Streak counter ("7-day apply streak!")
- Leaderboard (opt-in, top reply rates)

---

### 5.2 Smart Notifications

**Push Notifications** (mobile, future):
- Reply received (instant)
- Interview reminder (1 hour before)
- Weekly digest (Sundays: "You applied to 5 jobs, got 1 reply")

**Email Notifications** (current):
- Daily digest (if 3+ new matched jobs)
- Weekly summary (stats, encouragement)
- Monthly report ("Your October: 20 apps, 3 interviews")

---

## 6. Customer Success Touchpoints

### 6.1 Human Outreach (High-Value Users)

**Triggers**:
- Pro user for 3+ months (LTV >$150)
- Enterprise prospect (requested demo)
- Churned user (exit interview)

**Outreach**:
- Personal email from CEO or Customer Success
- "How can we help you succeed?"
- Offer 1:1 coaching call (optimize their approach)

---

### 6.2 Exit Interviews

**When**: User cancels subscription

**Survey** (email, 3 questions):
1. Why are you leaving? (dropdown: Found job, Too expensive, Not working, Found alternative)
2. What could we improve? (text area)
3. Would you recommend RoleFerry to a friend? (NPS)

**Follow-Up**: If "Not working" → offer to help (maybe they just need coaching?)

---

## 7. Win-Back Campaigns

### 7.1 Churned Users (Found Job)

**Wait**: 6 months

**Email**:
```
Subject: Congrats on your new role! (And welcome back if you're looking again)

Hi [Name],

Congrats on landing your last role! We're proud to have been part of your journey.

If you're ever looking again (or know someone who is), RoleFerry is here.

New since you left:
- AI Copilot (ask questions, get answers)
- Better match scoring (90% accurate)
- 2x more jobs (expanded coverage)

Welcome back anytime: roleferry.com

- RoleFerry Team
```

---

### 7.2 Churned Users (Price Sensitivity)

**Wait**: 3 months

**Offer**: Discount (30% off for 3 months)

**Email**:
```
Subject: Come back to RoleFerry (30% off)

Hi [Name],

We'd love to have you back. Here's a special offer:

30% off Pro for 3 months ($34/month instead of $49)
Code: COMEBACK30

We've also improved:
- 20% faster enrichment
- Better AI drafts
- New recruiter mode

Give us another shot: roleferry.com/comeback

```

---

## 8. Retention Metrics Dashboard

### 8.1 Cohort Retention Table

| Signup Month | Month 0 | Month 1 | Month 2 | Month 3 | Month 6 | Month 12 |
|--------------|---------|---------|---------|---------|---------|----------|
| **Jan 2026** | 100% | 85% | 75% | 65% | 50% | 40% |
| **Feb 2026** | 100% | 87% | 78% | 68% | - | - |
| **Mar 2026** | 100% | 90% | 80% | - | - | - |

**Analysis**: Feb/Mar cohorts have better retention (product improvements working)

---

### 8.2 Retention Drivers Analysis

**Correlate** retention with:
- Number of applications (5+ → 80% retain vs. 1-2 → 40%)
- Reply rate (15%+ → 90% retain vs. <5% → 30%)
- Feature usage (Copilot users → 85% retain vs. non-users → 55%)

**Action**: Double down on what drives retention (encourage 5+ applications, improve reply rates)

---

## 9. Acceptance Criteria

- [ ] Retention goals defined (D1, D7, D30, monthly churn)
- [ ] Churn reasons identified (via exit surveys)
- [ ] Onboarding optimized (activation campaigns D1-D7)
- [ ] Engagement campaigns (re-engagement, upgrade prompts)
- [ ] Retention features (progress tracking, smart notifications)
- [ ] Win-back campaigns (churned users, targeted offers)
- [ ] Cohort retention tracked (monthly dashboard review)

---

**Document Owner**: VP Product, Head of Customer Success  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (churn is critical to economics)

