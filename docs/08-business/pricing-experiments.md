# Pricing Experiments & Optimization
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, Marketing, Finance  
**Purpose**: Data-driven pricing optimization

---

## 1. Pricing Hypotheses

### Hypothesis 1: $49/mo is Underpriced
**Rationale**: Users save 10+ hours/week (worth $200+), LTV:CAC is 34:1 (room to increase)

**Test**: Show $79/mo to 20% of new signups (A/B test)

**Metrics**:
- Conversion rate (Free → Paid)
- Churn rate (do more users cancel at $79?)
- Revenue (does higher price offset lower conversion?)

**Decision Criteria**:
- If conversion drops <30% but revenue up → increase to $79
- If conversion drops >50% → hold at $49

---

### Hypothesis 2: Annual Discount Drives Commitment
**Rationale**: Annual users have higher LTV (lower churn)

**Current**: 20% discount ($468/year vs. $588 monthly)

**Test**: 
- Variant A: 20% discount
- Variant B: 30% discount ($410/year)
- Variant C: 25% discount + bonus (e.g., 100 extra enrichment credits)

**Metrics**:
- % choosing annual vs. monthly
- 12-month retention (annual vs. monthly)
- Revenue impact

**Decision**: Maximize LTV (not just annual mix)

---

### Hypothesis 3: Usage-Based Pricing Captures Power Users
**Rationale**: Some users will exceed limits (500 enrichments/mo), willing to pay overages

**Current**: $0.10/enrichment beyond 500

**Test**:
- Variant A: $0.10/enrichment
- Variant B: $0.05/enrichment (lower barrier, higher volume)
- Variant C: Bulk packs ($50 for 1,000 = $0.05/ea)

**Metrics**:
- % users hitting overage
- Revenue from overages
- Upgrade rate (do overages drive plan upgrades?)

**Decision**: Optimize for total revenue (usage + subscriptions)

---

## 2. Pricing Page A/B Tests

### Test 1: Positioning (Value vs. Features)

**Variant A** (Feature List):
```
Pro Plan - $49/month
✓ Unlimited applications
✓ 500 enrichment credits
✓ AI Copilot
✓ LivePages
✓ Priority support
```

**Variant B** (Value Framing):
```
Pro Plan - $49/month
Get 3x more interviews

✓ Find hiring managers automatically
✓ AI writes your outreach emails
✓ We send from our warmed domains
✓ Track replies in one place

[Start Free Trial]
```

**Hypothesis**: Value framing converts better (focus on outcomes, not features)

---

### Test 2: Anchor Pricing

**Variant A** (No anchor):
```
Pro: $49/month
```

**Variant B** (Anchor to competitor):
```
Pro: $49/month
(vs. $79 for Huntr, $299 for Apollo)
```

**Variant C** (Anchor to time saved):
```
Pro: $49/month
Save 10+ hours/week
(Your time is worth way more than $49)
```

**Hypothesis**: Anchoring increases perceived value → higher conversion

---

## 3. Free Trial Experiments

### Current: 10 Applications/Month (Free Forever)

**Alternative 1**: 14-Day Full Access Trial
- Unlimited everything for 14 days
- Then downgrade to free tier OR upgrade to paid
- **Hypothesis**: Taste of full product drives upgrades

**Alternative 2**: Credit-Based Free Tier
- 100 credits (1 application = 10 credits, 1 enrichment = 1 credit)
- Forces strategic use
- **Hypothesis**: Scarcity drives perceived value

**Test**: Run for 1 month, measure conversion (Free → Paid)

---

## 4. Tiering Experiments

### Current: Free / Pro / Teams

**Alternative**: Add "Starter" Tier
- **Starter**: $29/month (50 applications, 200 enrichments, no AI Copilot)
- **Pro**: $59/month (unlimited, all features)

**Hypothesis**: 3 tiers captures more users (some won't pay $49 but will pay $29)

**Risk**: Cannibalization (Pro users downgrade to Starter)

**Test**: Show to 30% of users, measure tier distribution

---

## 5. Pricing for Recruiters

### Experiment 1: Seat Pricing vs. Usage Pricing

**Current**: $149/user/month (seat-based)

**Alternative**: $99/month + $0.50/lead (usage-based)

**Hypothesis**: Usage-based aligns with recruiter mental model (pay for what you use)

**Metrics**:
- Average bill (seat vs. usage model)
- Churn rate (which model has better retention?)

---

### Experiment 2: Volume Discounts

**Current**: Linear pricing ($149 × seats)

**Alternative**: Tiered discounts
- 1-5 seats: $149/seat
- 6-10 seats: $129/seat (13% off)
- 11-25 seats: $109/seat (27% off)
- 26+ seats: $89/seat (40% off)

**Hypothesis**: Volume discounts drive multi-seat purchases (increase ARPU per account)

---

## 6. Discounting Strategy

### When to Discount

**Acceptable**:
- First-time customer (30-day money-back = risk-free trial)
- Annual commitment (20% off = upfront cash)
- Early adopters (50% off Month 1 = EARLYBIRD code)

**Avoid**:
- Rescue discounts (user threatens to cancel → discount)
  - **Why**: Sets bad precedent, trains users to threaten churn
  - **Alternative**: "We'd love to keep you. Can we help improve your results instead?"

---

### Discount Codes (Launch)

**EARLYBIRD**: 50% off first month (limit: first 100 users)
**COACH100**: 20% off for career coaches
**ANNUAL20**: 20% off annual plans (always-on)

---

## 7. Pricing Psychology

### Anchoring
Present expensive option first (makes mid-tier seem reasonable)

```
Enterprise: $5,000/month (custom)
Teams: $149/month ← Seems reasonable
Pro: $49/month ← Great value!
```

---

### Decoy Pricing
Add tier that makes target tier look better

```
Pro Annual: $588/year (no discount) ← Decoy
Pro Annual Discounted: $468/year (save $120!) ← Target
```

---

### Charm Pricing
**$49** feels significantly less than $50 (even though it's $1 difference)

**Current**: $49, $149 (charm pricing)  
**Alternative**: $50, $150 (round numbers)  
**Test**: Measure conversion difference

---

## 8. Pricing Communication

### Value-Based Messaging

**Job Seekers**:
*"$49/month → If RoleFerry helps you get 1 interview, it paid for 6 months of your time savings (10 hours/week × $25/hour = $1,000/month value)."*

**Recruiters**:
*"$1,788/year vs. $8,000 for LinkedIn Recruiter. Break-even on 1 incremental hire (agency fees: $20K per placement)."*

---

## 9. Metrics to Track

| Metric | Current | Target | Action if Off-Target |
|--------|---------|--------|---------------------|
| **Free → Pro conversion** | TBD | 10% | Optimize onboarding, add upsell prompts |
| **Annual vs. monthly mix** | TBD | 30% annual | Increase discount (20% → 25%) |
| **Churn rate** | TBD | <5%/month | Improve product, reduce price sensitivity |
| **Upgrade rate** (Pro → Teams) | TBD | 5% | Better team features, coach outreach |
| **Downgrade rate** | TBD | <2% | Understand why (price? features?) |

---

## 10. Acceptance Criteria

- [ ] Pricing hypotheses documented (3-5 tests)
- [ ] A/B testing framework implemented (Stripe metadata, cohort tracking)
- [ ] Experiments prioritized (RICE scoring)
- [ ] Success metrics defined (conversion, revenue, LTV)
- [ ] Pricing experiments reviewed monthly (iterate based on data)

---

**Document Owner**: CEO, VP Product  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (pricing is never "done")

