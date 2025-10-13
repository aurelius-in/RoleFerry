# Key Metrics & KPIs
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Leadership, Product, Engineering  
**Purpose**: Define and track critical success metrics

---

## 1. North Star Metric

**Applications that generate human conversations within 7 days**

**Why this metric?**
- Captures core value prop (Apply → Contact → Reply)
- Aligns job seeker and platform goals
- Leading indicator of retention and revenue

**Target**: 20% of applications → conversation (Month 1) → 35% (Month 12)

---

## 2. Product Metrics (AARRR Framework)

### 2.1 Acquisition
| Metric | Definition | Target | Tracking |
|--------|------------|--------|----------|
| **Signups/week** | New user registrations | 50 (Month 1) → 500 (Month 12) | Mixpanel, GA |
| **Traffic sources** | % from organic, paid, referral | 50% organic by Month 6 | GA |
| **CAC** | Cost per acquired user | $50 (paid) → $5 (organic) | Stripe + ad spend |

### 2.2 Activation
| Metric | Definition | Target | Tracking |
|--------|------------|--------|----------|
| **Onboarding completion** | % who finish IJP wizard | 70% | Product analytics |
| **First application** | % who apply within 7 days | 60% | Product analytics |
| **Time to value** | Hours from signup to first reply | <168 hours (7 days) | Custom tracking |

**Activation Definition**: User who applies to 3+ jobs within 7 days.

### 2.3 Retention
| Metric | Definition | Target | Tracking |
|--------|------------|--------|----------|
| **D1 retention** | % who return next day | 40% | Cohort analysis |
| **D7 retention** | % who return within 7 days | 70% | Cohort analysis |
| **D30 retention** | % who return within 30 days | 60% | Cohort analysis |
| **Churn rate** | % who cancel subscription | <5%/month | Stripe |

### 2.4 Revenue
| Metric | Definition | Target | Tracking |
|--------|------------|--------|----------|
| **MRR** | Monthly Recurring Revenue | $27K (Month 12) | Stripe |
| **ARR** | Annual Recurring Revenue | $324K (Year 1) | Stripe |
| **ARPU** | Avg Revenue Per User | $6 (Year 1) → $10 (Year 2) | Stripe |
| **Paid conversion** | % Free → Paid | 10% | Stripe |

### 2.5 Referral
| Metric | Definition | Target | Tracking |
|--------|------------|--------|----------|
| **K-factor** | Viral coefficient | 0.3 (30% invite 1 friend) | Referral links |
| **NPS** | Net Promoter Score | 50+ | In-app surveys |
| **Testimonials** | User success stories | 10/month | Manual collection |

---

## 3. Engagement Metrics

### 3.1 Platform Usage
| Metric | Definition | Target |
|--------|------------|--------|
| **DAU** | Daily Active Users | 20% of MAU |
| **MAU** | Monthly Active Users | 3,000 (Month 12) |
| **Sessions/user** | Avg sessions per user/week | 3 (active search) |
| **Session duration** | Avg time on platform | 15 minutes |

### 3.2 Feature Adoption
| Feature | Adoption Target | Measurement |
|---------|-----------------|-------------|
| **Apply button** | 80% of users | Click-through rate |
| **Copilot** | 40% of users | Query count |
| **CSV Import** | 20% of users (power users) | Upload count |
| **LivePages** | 30% of Pro users | Created count |

---

## 4. Quality Metrics

### 4.1 Reply Rate
**Definition**: % of delivered emails that get replies

**Target**:
- Platform average: 15%
- Top performers: 25%+
- Minimum acceptable: 8%

**Segmentation**:
- By persona (job seeker vs. recruiter)
- By sequence template
- By industry (tech vs. non-tech)

**Tracking**: `(Outreach.replied / Outreach.delivered) × 100`

---

### 4.2 Enrichment Quality
| Metric | Definition | Target |
|--------|------------|--------|
| **Contact discovery rate** | % applications with 1+ contact | 80% |
| **Email verification rate** | % contacts with verified email | 85% |
| **Bounce rate** | % emails that bounce | <3% |

---

### 4.3 Deliverability Health
| Metric | Definition | Target |
|--------|------------|--------|
| **Inbox placement** | % emails reaching inbox (not spam) | 95% |
| **Spam complaint rate** | % recipients marking as spam | <0.05% |
| **Avg mailbox health** | Mean health score across all mailboxes | 85/100 |

---

## 5. Operational Metrics

### 5.1 System Performance
| Metric | Definition | Target |
|--------|------------|--------|
| **API P95 latency** | 95th percentile response time | <500ms |
| **Uptime** | % time system available | 99.5% |
| **Error rate** | % requests returning 5xx | <0.1% |

### 5.2 Support & Satisfaction
| Metric | Definition | Target |
|--------|------------|--------|
| **Support ticket volume** | Tickets/week | <50 (self-service emphasis) |
| **Time to resolution** | Avg hours to close ticket | <24 hours |
| **CSAT** | Customer Satisfaction Score | 4.5/5 |

---

## 6. Business Health Metrics

### 6.1 Unit Economics
| Metric | Job Seeker | Recruiter | Target |
|--------|------------|-----------|--------|
| **CAC** | $50 → $0 | $300 | Decrease over time |
| **LTV** | $600 | $3,576 | Increase via retention |
| **LTV:CAC** | 12:1 (organic) | 11.9:1 | >3:1 minimum |
| **Payback period** | 1 month | 2 months | <6 months |
| **Gross margin** | 85% | 80% | >70% |

### 6.2 Growth Metrics
| Metric | Month 3 | Month 6 | Month 12 | Year 2 |
|--------|---------|---------|----------|--------|
| **Total users** | 500 | 2,000 | 10,000 | 50,000 |
| **Paid users** | 50 | 200 | 1,000 | 5,000 |
| **MRR** | $2,450 | $9,800 | $27,050 | $125,700 |
| **MoM growth** | 20% | 15% | 10% | 8% |

---

## 7. Dashboard Views

### Executive Dashboard (Weekly Review)
**Metrics**:
1. MRR + growth rate
2. User signups (graph)
3. Reply rate (platform avg)
4. NPS score
5. Critical alerts (P0 incidents)

### Product Dashboard (Daily Review)
**Metrics**:
1. DAU/MAU ratio
2. Activation rate (onboarding completion)
3. Feature adoption (Copilot usage, Apply clicks)
4. Top drop-off points (funnel analysis)

### Engineering Dashboard (Real-Time)
**Metrics**:
1. API latency (P95, P99)
2. Error rate (5xx)
3. Queue depth (Celery)
4. Database connections
5. Uptime (rolling 7 days)

---

## 8. Reporting Cadence

| Report | Frequency | Audience | Format |
|--------|-----------|----------|--------|
| **Metrics Review** | Weekly | Leadership | Slides (10 slides) |
| **Board Report** | Quarterly | Board of Directors | PDF (20 pages) |
| **Investor Update** | Monthly | Investors | Email (2 pages) |
| **All-Hands** | Monthly | Entire team | Presentation (15 min) |

---

## 9. Metric Ownership

| Metric | Owner | Reviewed By |
|--------|-------|-------------|
| MRR, ARR, LTV:CAC | CFO | CEO, Board |
| Activation, Retention | Product | CEO |
| Reply rate, Quality | Product + Eng | CTO |
| Uptime, Latency | DevOps | CTO |
| NPS, CSAT | Customer Success | CEO |

---

**Document Owner**: CEO, VP Product  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (metrics evolve with product maturity)

