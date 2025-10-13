# Pricing Model & Revenue Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Leadership, Finance, Sales  
**Purpose**: Pricing strategy and revenue projections

---

## 1. Pricing Philosophy

### Value-Based Pricing
Price based on value delivered, not cost-plus.
- **Job Seekers**: Save 10+ hours/week → Worth $200+/month
- **Recruiters**: Replace $8K LinkedIn Recruiter → Worth $500+/month

### Freemium Model
Free tier drives acquisition; paid tiers capture value from power users.
- **Free**: 10 applications/month (taste of product)
- **Pro**: Unlimited (removes friction, captures serious users)

### Usage-Based Components
Additional revenue from high-volume users.
- Enrichment credits: $0.10/contact
- Email sends: $0.02/email (beyond included)

---

## 2. Job Seeker Pricing

| Plan | Price | Applications | Enrichment | Sequences | Copilot | LivePages | Target |
|------|-------|--------------|------------|-----------|---------|-----------|--------|
| **Free** | $0 | 10/month | 30/month | Basic 2-step | Limited | ❌ | Acquisition |
| **Pro** | $49/mo | Unlimited | 500/month | Advanced | Unlimited | ✅ | Active seekers |
| **Teams** | $149/mo | Unlimited | 2,000/month | Advanced | Unlimited | ✅ | Career coaches |

### Upgrade Triggers
- **Free → Pro**: Hit 10-application limit (month 1)
- **Pro → Teams**: Coach with 5+ clients

### Annual Discounts
- Pro: $39/mo ($468/year, save 20%)
- Teams: $119/mo ($1,428/year, save 20%)

---

## 3. Recruiter Pricing

| Plan | Price | Seats | Contacts | Sequences | Personas | Team Features | Target |
|------|-------|-------|----------|-----------|----------|---------------|--------|
| **Pro** | $149/user/mo | 1 | 500/mo | Advanced | ✅ | ❌ | Solo recruiters |
| **Teams** | $99/user/mo | 5+ | 1,000/user/mo | Advanced | ✅ | ✅ | Recruiting teams |
| **Enterprise** | Custom | Unlimited | Custom | Advanced | ✅ | ✅ + SSO | 50+ employees |

### Volume Discounts (Teams)
- 5-10 seats: $99/user/mo
- 11-25 seats: $89/user/mo
- 26+ seats: $79/user/mo

### Enterprise Pricing
- Base: $50K/year (50 seats)
- Additional seats: $800/seat/year
- Includes: SSO, SLAs, API access, dedicated support

---

## 4. Usage-Based Pricing

### Enrichment Credits
- **Included**: 500/month (Pro Job Seeker), 1,000/month (Pro Recruiter)
- **Overage**: $0.10/contact
- **Bulk**: $50 for 1,000 credits, $200 for 5,000 credits

### Email Sending
- **Included**: 1,000 emails/month (all plans)
- **Overage**: $0.02/email
- **Bulk**: $15 for 1,000 emails, $50 for 5,000 emails

---

## 5. Revenue Projections

### Year 1 (MVP + Intelligence)
| Segment | Users | ARPU | MRR | ARR |
|---------|-------|------|-----|-----|
| Free Job Seekers | 4,000 | $0 | $0 | $0 |
| Pro Job Seekers | 400 | $49 | $19,600 | $235,200 |
| Pro Recruiters | 50 | $149 | $7,450 | $89,400 |
| **Total** | **4,450** | **$6.08** | **$27,050** | **$324,600** |

### Year 2 (Recruiter Mode + Scale)
| Segment | Users | ARPU | MRR | ARR |
|---------|-------|------|-----|-----|
| Free Job Seekers | 15,000 | $0 | $0 | $0 |
| Pro Job Seekers | 1,500 | $49 | $73,500 | $882,000 |
| Pro Recruiters | 200 | $149 | $29,800 | $357,600 |
| Teams Recruiters | 20 teams (100 seats) | $99 | $9,900 | $118,800 |
| Enterprise | 3 | $50K/year | $12,500 | $150,000 |
| **Total** | **16,700** | **$7.52** | **$125,700** | **$1,508,400** |

### Year 3 (Enterprise + International)
| Segment | Users | ARPU | MRR | ARR |
|---------|-------|------|-----|-----|
| Free Job Seekers | 40,000 | $0 | $0 | $0 |
| Pro Job Seekers | 4,000 | $49 | $196,000 | $2,352,000 |
| Pro Recruiters | 500 | $149 | $74,500 | $894,000 |
| Teams Recruiters | 100 teams (500 seats) | $99 | $49,500 | $594,000 |
| Enterprise | 15 | $75K/year | $93,750 | $1,125,000 |
| **Total** | **45,000** | **$9.20** | **$413,750** | **$4,965,000** |

---

## 6. Unit Economics

### Job Seeker (Pro Plan)
- **ARPU**: $49/month ($588/year)
- **CAC**: $50 (paid ads) → $0 (organic, long-term)
- **Gross Margin**: 85% ($500/year after infra/API costs)
- **LTV**: $600 (12-month retention, assumes 2 search cycles)
- **LTV:CAC**: 12:1 (organic), 3:1 (paid)
- **Payback**: 1 month (paid), instant (organic)

### Recruiter (Pro Plan)
- **ARPU**: $149/month ($1,788/year)
- **CAC**: $300 (outbound sales)
- **Gross Margin**: 80% ($1,430/year)
- **LTV**: $3,576 (24-month retention)
- **LTV:CAC**: 11.9:1
- **Payback**: 2 months

### Enterprise
- **ACV**: $75,000/year
- **CAC**: $10,000 (field sales, 6-month cycle)
- **Gross Margin**: 75% ($56,250)
- **LTV**: $225,000 (36-month retention)
- **LTV:CAC**: 22.5:1
- **Payback**: 2 months

---

## 7. Pricing Experiments (A/B Tests)

### Experiment 1: Pro Plan Price
- **Hypothesis**: $49/mo is underpriced; users would pay $79/mo
- **Test**: Show $79 to 20% of signups
- **Metrics**: Conversion rate, churn rate
- **Decision**: If conversion drops <30% but revenue up, increase price

### Experiment 2: Annual Discount
- **Hypothesis**: 20% discount drives annual purchases
- **Test**: 20% vs. 30% discount
- **Metrics**: Annual vs. monthly mix, LTV
- **Decision**: Optimize discount to maximize LTV

### Experiment 3: Usage-Based Add-Ons
- **Hypothesis**: Power users will pay for overages
- **Test**: $0.10/contact vs. $0.05/contact
- **Metrics**: Overage revenue, upgrade rate
- **Decision**: Find price that maximizes revenue without driving upgrades

---

## 8. Competitive Pricing

| Competitor | Plan | Price | RoleFerry Advantage |
|------------|------|-------|---------------------|
| **Simplify** | Pro | $15/mo | We charge 3x but deliver outreach (not just tracking) |
| **Huntr** | Pro | $40/mo | Price parity but add AI + deliverability |
| **Teal** | Pro | $79/mo | We undercut by 40% |
| **LinkedIn Recruiter** | - | $8,000/year | We're 95% cheaper ($1,788/year) |
| **Apollo** | Pro | $2,400/year | Price parity but recruiting-native UX |
| **Instantly** | Pro | $360/year | We bundle enrichment + sequences |

**Positioning**: Premium pricing for job seekers (vs. trackers), value pricing for recruiters (vs. LinkedIn).

---

## 9. Revenue Optimization

### Upsell Opportunities
- **Free → Pro**: "You've hit your limit. Upgrade for unlimited applications."
- **Pro → Teams**: "Managing clients? Teams plan has multi-user workspaces."
- **Job Seeker → Recruiter**: "Hiring? Switch to Recruiter mode."

### Cross-Sell
- **White-label**: Sell to career coaches ($2K/month for 50 clients)
- **API**: Sell to ATS vendors ($10K+ annual contracts)

### Expansion Revenue
- **Seat expansion**: Teams plan grows from 5 → 20 seats
- **Usage expansion**: Power users exceed enrichment/email caps

---

## 10. Pricing Decision Framework

### When to Increase Prices
- **Trigger**: Demand >capacity (waitlist forming)
- **Trigger**: Competitor raises prices
- **Trigger**: New features add 30%+ value (e.g., AI Copilot launch)

### When to Decrease Prices
- **Trigger**: Conversion rate <5% (Free → Paid)
- **Trigger**: Competitor undercuts by >30%
- **Trigger**: Retention <60% (price sensitivity)

### Grandfathering Policy
- Existing users keep current price for 12 months
- Annual subscribers locked in for contract duration
- Enterprise: renegotiate at renewal

---

**Document Owner**: CEO, CFO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (adjust based on market feedback)

