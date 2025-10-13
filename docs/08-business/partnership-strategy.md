# Partnership Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: CEO, Business Development  
**Purpose**: Strategic partnerships for growth and distribution

---

## 1. Partnership Goals

### Year 1 (2026)
- **10 Career Coach Partnerships**: 500 referrals
- **3 ATS Integrations**: Greenhouse, Lever, Workable
- **5 Community Partnerships**: Access to 50K job seekers

### Year 2 (2027)
- **100 Coach Partnerships**: 5K referrals
- **Outplacement Firms**: 2-3 partnerships (enterprise deals)
- **University Career Centers**: 10 partnerships

---

## 2. Partnership Types

### 2.1 Affiliate Partnerships (Career Coaches)

**Value Proposition** (for Coach):
- Passive income (20% commission on referrals)
- Better outcomes for clients (tool recommendation)
- Co-branded materials (white-label option)

**Value Proposition** (for RoleFerry):
- Low-CAC user acquisition (coach referrals trusted)
- Target market alignment (coaches serve job seekers)
- Scalable (1 coach = 50+ referrals/year)

**Commission Structure**:
- 20% recurring (coach earns $10/month per Pro user)
- 30-day cookie (track referrals)

**Onboarding**:
1. Coach signs up for affiliate program
2. Gets unique referral link (`roleferry.com/?ref=coach-name`)
3. Shares with clients (email, socials, website)
4. We pay commission monthly (Stripe Connect)

---

### 2.2 Integration Partnerships (ATS Vendors)

**Target Partners**:
- Greenhouse (20K customers)
- Lever (10K customers)
- Workable (15K customers)

**Integration Value**:
- **For ATS**: Enhance platform (outbound sourcing capability)
- **For RoleFerry**: Distribution (embedded in ATS = 10K+ potential customers)

**Integration Spec**:
```yaml
# RoleFerry <> Greenhouse Integration

Features:
  - Import candidates from Greenhouse → RoleFerry
  - Export sourced candidates from RoleFerry → Greenhouse
  - Sync application status bidirectionally

API Endpoints:
  - GET /api/greenhouse/candidates (fetch from Greenhouse)
  - POST /api/greenhouse/candidates (push to Greenhouse)
  - PATCH /api/greenhouse/candidates/:id/status (update status)

OAuth:
  - OAuth 2.0 authentication
  - Scopes: candidates.read, candidates.write
```

**Go-to-Market**:
- Listed in Greenhouse Marketplace
- Co-marketing (blog post, webinar)
- Sales referrals (Greenhouse AEs recommend us)

---

### 2.3 Community Partnerships (Job Search Groups)

**Target Communities**:
- Elpha (women in tech, 200K members)
- Blind (tech professionals, 5M+ users)
- Reddit r/cscareerquestions (900K members)
- Tech Ladies (community of 500K)

**Partnership Model**:
- RoleFerry sponsors community (e.g., $500/month)
- We get:
  - Logo on website
  - Monthly job search tip (content)
  - Exclusive discount code (20% off)

**ROI**:
- $500/month → 50 signups → 5 paid users → $245 MRR → $2,940/year
- Payback: 2 months

---

### 2.4 Outplacement Partnerships (Enterprise)

**Target Partners**:
- Careerminds (outplacement firm, 2K+ clients)
- RiseSmart (outplacement, acquired by Randstad)
- LHH (Lee Hecht Harrison, global outplacement)

**Use Case**: Company lays off 50 employees → pays outplacement firm → firm uses RoleFerry to help employees find jobs

**Value Proposition** (for Outplacement Firm):
- Better outcomes (employees find jobs faster)
- Cost savings (RoleFerry cheaper than coaching hours)
- Scalable (1 coach can manage 50 clients with RoleFerry)

**Pricing Model**:
- White-label: $25K/year (firm brands as their own tool)
- Per-seat: $50/user (firm pays for laid-off employees' accounts)

**Expected Deal Size**: $25K-$100K/year per firm

---

## 3. Partnership Priorities (Year 1)

| Partner Type | Priority | Effort | Impact | Timeline |
|--------------|----------|--------|--------|----------|
| **Career Coaches** | P0 | Low | High (referrals) | Q1 2026 |
| **ATS (Greenhouse)** | P0 | High | Very High (distribution) | Q2 2026 |
| **Communities (Elpha)** | P1 | Low | Medium (awareness) | Q1 2026 |
| **Outplacement** | P1 | Medium | High (enterprise deals) | Q3 2026 |
| **University Career Centers** | P2 | Medium | Low (students not ICP) | Q4 2026 |

---

## 4. Partnership Outreach

### 4.1 Career Coach Outreach Template

**Subject**: Partnership opportunity (help your clients land jobs faster)

```
Hi [Coach Name],

I'm [Your Name] from RoleFerry. We help job seekers get 3x more interviews through direct email outreach (vs. blind applications).

I noticed you work with [type of professionals]. We'd love to partner:

✓ 20% recurring commission (refer clients, earn passive income)
✓ Your clients get better outcomes (our avg: 15% reply rate)
✓ Co-branded materials (if you want)

Interested? Let's chat: [calendar link]

- [Your Name]
Founder, RoleFerry
```

---

### 4.2 ATS Partnership Pitch

**Deck** (10 slides):
1. **Problem**: Recruiters struggle with outbound sourcing
2. **Solution**: RoleFerry = outbound automation for talent teams
3. **Opportunity**: Your customers need this (survey data)
4. **Integration**: Bidirectional sync (candidates, status)
5. **GTM**: Co-marketing, marketplace listing, sales referrals
6. **Traction**: X customers, Y% reply rate, NPS Z
7. **Team**: Experienced founders, backed by [investors]
8. **Ask**: Let's build integration together (3-month timeline)

**Meeting Request**:
```
Subject: Greenhouse + RoleFerry Integration

Hi [BD Manager],

I'm [Name] from RoleFerry. We built outbound automation for recruiting teams—think Apollo, but for talent (not sales).

Our mutual customers ask if we integrate with Greenhouse. We'd love to build:
→ Import candidates from Greenhouse
→ Export sourced candidates back
→ Bidirectional status sync

Happy to show you (15 min): [calendar link]

- [Your Name]
CEO, RoleFerry
```

---

## 5. Partnership Agreements

### 5.1 Affiliate Agreement (Simple)

**Terms**:
- 20% recurring commission (paid monthly)
- 30-day cookie (if user signs up within 30 days of click)
- Payment via Stripe (automatic)
- Non-exclusive (coach can promote competitors)
- Terminable anytime (no lock-in)

**1-Page Agreement**: [Template in Google Drive]

---

### 5.2 Integration Partnership (More Complex)

**Terms**:
- Co-exclusive (not exclusive, but prioritized)
- Revenue share (optional: 10% of customers from their marketplace)
- IP ownership (each party owns their IP)
- Support (shared: we support RoleFerry, they support ATS)
- Term: 2 years (auto-renews)

**Multi-Page Agreement**: Legal review required

---

## 6. Partnership Success Metrics

### 6.1 Affiliate Program

| Metric | Target (Month 6) |
|--------|------------------|
| **Active Affiliates** | 50 coaches |
| **Referrals** | 200/month |
| **Conversions** | 20/month (10%) |
| **Commission Paid** | $1,200/month (20% × $49 × 20) |
| **ROI** | $980 ($49 × 20 paid users) - $1,200 commission = -$220 (LTV: $600 → net positive) |

---

### 6.2 ATS Integration

| Metric | Target (6 months post-launch) |
|--------|------------------------------|
| **Marketplace Impressions** | 10K/month |
| **Integration Installs** | 100 |
| **Active Users** (from integration) | 50 (50% activation) |
| **Paid Conversions** | 15 (30% conversion) |
| **ARR** | $26,820 (15 × $149/month × 12) |

**CAC**: $0 (organic via marketplace)

---

## 7. Case Study: Career Coach Partnership

**Partner**: Jane Doe Career Coaching

**Setup**:
- Jane signed up for affiliate program (Oct 2025)
- Shares RoleFerry with her 20 clients/month
- Adds referral link to website footer

**Results** (6 months):
- 60 referrals
- 12 paid conversions (20%)
- $3,528 ARR from Jane's referrals ($294/month × 12)
- Jane earns: $706/year ($10/month × 12 users × 6 months avg)

**Win-Win**: Jane's clients land jobs faster, Jane earns passive income, RoleFerry gets $0-CAC customers

---

## 8. Acceptance Criteria

- [ ] Partnership goals set (10 coaches, 3 ATS, 5 communities by Year 1)
- [ ] Partnership types defined (affiliate, integration, community, outplacement)
- [ ] Outreach templates (coaches, ATS, communities)
- [ ] Affiliate program live (commission structure, tracking)
- [ ] Partnership agreements drafted (legal review)
- [ ] Success metrics tracked (referrals, conversions, ROI)

---

**Document Owner**: CEO, BD Lead (future)  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (adjust based on results)
