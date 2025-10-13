# Unit Economics Deep Dive
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Finance, Leadership, Investors  
**Purpose**: Detailed financial modeling and projections

---

## 1. Job Seeker Pro Economics

### 1.1 Revenue
**ARPU**: $49/month × 12 months = **$588/year**

**Assumptions**:
- 70% monthly subscribers ($49/mo)
- 30% annual subscribers ($468/year, 20% discount)
- Blended ARPU: $588/year

### 1.2 Costs (Per User/Year)

| Cost Category | Amount | % of Revenue |
|---------------|--------|--------------|
| **AWS Infrastructure** | $36 | 6% |
| **Enrichment APIs** (Apollo, Clay, verification) | $45 | 8% |
| **Email Sending** (SendGrid) | $12 | 2% |
| **LLM APIs** (Anthropic, OpenAI) | $15 | 3% |
| **Payment Processing** (Stripe 2.9% + $0.30) | $20 | 3% |
| **Customer Support** (amortized) | $10 | 2% |
| **Total COGS** | **$138** | **23%** |

**Gross Margin**: ($588 - $138) / $588 = **77%** ✅

### 1.3 Customer Acquisition

**CAC by Channel**:
- Organic (SEO, content): $0 (long-term)
- Paid ads (Google, LinkedIn): $50
- Referral: $10 (referral credit cost)
- Partnerships (coaches): $0 (they drive acquisition)

**Blended CAC** (assuming 50% organic, 30% paid, 20% referral):
- 0.5 × $0 + 0.3 × $50 + 0.2 × $10 = **$17**

### 1.4 Lifetime Value (LTV)

**Retention Curve**:
- Month 1: 100%
- Month 3: 80% (active job search)
- Month 6: 40% (found job or paused search)
- Month 12: 20% (passive use, repeat search)
- Month 24: 10%

**Average Lifetime**: 12 months (1 job search cycle)

**LTV**: $588 × 1 year = **$588**

**LTV:CAC**: $588 / $17 = **34.6:1** (excellent) ✅

**Payback Period**: <1 month

---

## 2. Recruiter Pro Economics

### 2.1 Revenue
**ARPU**: $149/month × 12 months = **$1,788/year**

### 2.2 Costs (Per User/Year)

| Cost Category | Amount | % of Revenue |
|---------------|--------|--------------|
| **AWS Infrastructure** | $120 | 7% |
| **Enrichment APIs** (500 contacts/mo × $0.15) | $900 | 50% |
| **Email Sending** (1K emails/mo × $0.01) | $120 | 7% |
| **LLM APIs** (less usage than job seekers) | $10 | 1% |
| **Payment Processing** | $60 | 3% |
| **Customer Support** (higher touch) | $50 | 3% |
| **Sales Cost** (amortized over 24 months) | $150 | 8% |
| **Total COGS** | **$1,410** | **79%** |

**Gross Margin**: ($1,788 - $1,410) / $1,788 = **21%** ⚠️

**Note**: Lower margin due to high enrichment costs. Improve via:
- Volume discounts from Apollo/Clay (30% off at 100K API calls/mo)
- Upsell usage overages ($0.10/contact beyond 500/mo)

### 2.3 LTV Calculation

**Retention**: 85% annual (higher than job seekers, B2B stickiness)

**Average Lifetime**: 24 months

**LTV**: $1,788 × 2 years = **$3,576**

**CAC**: $300 (outbound sales, 6-week cycle)

**LTV:CAC**: $3,576 / $300 = **11.9:1** ✅

**Payback Period**: 2 months

---

## 3. Enterprise Economics

### 3.1 Revenue
**ACV** (Annual Contract Value): $75,000/year (average)

**Breakdown**:
- 50 seats × $1,200/seat = $60,000
- Usage overage (enrichment, emails) = $15,000

### 3.2 Costs

| Cost Category | Amount | % of ACV |
|---------------|--------|----------|
| **AWS Infrastructure** (dedicated) | $5,000 | 7% |
| **Enrichment APIs** (high volume) | $10,000 | 13% |
| **Email Sending** | $1,000 | 1% |
| **Payment Processing** | $2,250 | 3% |
| **Sales & Success** (amortized) | $10,000 | 13% |
| **Total COGS** | **$28,250** | **38%** |

**Gross Margin**: 62% (lower due to sales/success overhead)

### 3.3 LTV
**Retention**: 90% (multi-year contracts, deep integration)

**Average Lifetime**: 36 months

**LTV**: $75,000 × 3 years = **$225,000**

**CAC**: $10,000 (field sales, 6-month cycle)

**LTV:CAC**: $225,000 / $10,000 = **22.5:1** ✅

**Payback Period**: 2 months

---

## 4. Blended Economics (Year 2)

**Assumptions**:
- 70% job seekers (Pro)
- 25% recruiters (Pro + Teams)
- 5% enterprise

| Segment | Users | ARPU | Revenue | COGS | Margin |
|---------|-------|------|---------|------|--------|
| **Job Seekers** | 3,500 | $588 | $2,058,000 | $483,000 | 77% |
| **Recruiters** | 1,250 | $1,788 | $2,235,000 | $1,765,000 | 21% |
| **Enterprise** | 10 | $75,000 | $750,000 | $282,500 | 62% |
| **Total** | **4,760** | **$1,059** | **$5,043,000** | **$2,530,500** | **50%** |

**Blended Gross Margin**: 50% ⚠️ (target: 70%)

**Improvement Path**:
- Increase job seeker mix (higher margin segment)
- Negotiate API volume discounts (Apollo/Clay)
- Usage-based pricing captures overage revenue

---

## 5. Sensitivity Analysis

### 5.1 CAC Sensitivity

| CAC | LTV | LTV:CAC | Payback | Viable? |
|-----|-----|---------|---------|---------|
| $10 | $588 | 58.8:1 | <1 month | ✅ Excellent |
| $50 | $588 | 11.8:1 | 1 month | ✅ Good |
| $100 | $588 | 5.9:1 | 2 months | ✅ Acceptable |
| $200 | $588 | 2.9:1 | 4 months | ⚠️ Marginal |

**Conclusion**: Maintain CAC <$100 via organic channels.

---

### 5.2 Retention Sensitivity

| Retention (12mo) | LTV | LTV:CAC | Impact |
|------------------|-----|---------|--------|
| 80% | $940 | 55:1 | +60% LTV |
| 60% | $588 | 35:1 | Baseline |
| 40% | $353 | 21:1 | -40% LTV |
| 20% | $176 | 10:1 | -70% LTV |

**Conclusion**: Retention is critical. Invest in product quality, engagement features.

---

## 6. Path to Profitability

### 6.1 Break-Even Analysis

**Fixed Costs** (Monthly):
- Team salaries (8 people): $120,000
- Office/admin: $5,000
- SaaS tools: $5,000
- **Total Fixed**: $130,000/month

**Variable Costs**: 50% of revenue (blended COGS)

**Break-Even MRR**:
```
Revenue - Variable Costs = Fixed Costs
R - 0.5R = $130,000
0.5R = $130,000
R = $260,000
```

**Break-Even**: $260K MRR = $3.1M ARR

**At Blended ARPU** ($1,059):
- $260K / $1,059 = **2,455 paid users** to break even

**Timeline**: Month 18-24 (assumes 10% monthly growth from Month 12)

---

## 7. Scenario Planning

### 7.1 Base Case (50% probability)
- Year 1 ARR: $324K (500 paid users)
- Year 2 ARR: $1.5M (2,500 paid users)
- Year 3 ARR: $5M (6,000 paid users)
- Break-even: Month 22

### 7.2 Bull Case (25% probability)
- Viral growth (K-factor 0.5)
- Year 1 ARR: $600K
- Year 2 ARR: $3M
- Year 3 ARR: $10M
- Break-even: Month 16

### 7.3 Bear Case (25% probability)
- Slow growth, high churn
- Year 1 ARR: $150K
- Year 2 ARR: $600K
- Year 3 ARR: $1.5M
- Break-even: Month 30+ (requires additional funding)

---

**Document Owner**: CFO, CEO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (update actuals vs. projections)

