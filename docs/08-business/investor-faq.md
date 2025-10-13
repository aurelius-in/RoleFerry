# Investor FAQ
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Investors, Board Members  
**Purpose**: Common questions and answers for due diligence

---

## 1. Business Model

### Q: How do you make money?
**A**: Freemium SaaS model with three revenue streams:

1. **Subscription Revenue** (70% of revenue):
   - Job Seekers: $0 (free) → $49/mo (Pro) → $149/mo (Teams for coaches)
   - Recruiters: $149/mo (Pro) → $99/mo (Teams, volume discount) → Custom (Enterprise)

2. **Usage-Based Revenue** (20%):
   - Enrichment credits: $0.10/contact beyond included allowance
   - Email sends: $0.02/email beyond 1K/month

3. **Enterprise Contracts** (10%):
   - White-label for outplacement firms: $25K-$100K/year
   - API access for ATS vendors: $10K+/year

**Unit Economics (Job Seeker Pro)**:
- ARPU: $49/mo ($588/year)
- CAC: $50 (paid) → $0 (organic)
- LTV: $600 (12-month retention)
- LTV:CAC: 12:1 (organic), 3:1 (paid)
- Gross Margin: 85%

---

### Q: What's your TAM/SAM/SOM?
**A**: 
- **TAM**: $45B (job search tools $8B + recruiting software $15B + sales engagement $22B)
- **SAM**: $12B (English-speaking markets, white-collar jobs)
- **SOM** (Year 5): $500M (1% market share)
  - 500K job seeker seats × $600/year = $300M
  - 20K recruiter seats × $2K/year = $40M
  - 200 enterprise contracts × $50K/year = $10M
  - Usage revenue = $150M

---

### Q: Why will you win vs. incumbents?
**A**: 
1. **Unique combination**: No competitor has tracking + intelligence + outreach + deliverability
2. **Deliverability moat**: We own sending infrastructure; users can't DIY this safely
3. **Speed to market**: Incumbents (LinkedIn, Simplify) move slowly; we're nimble
4. **Better mousestrap**: Email beats LinkedIn InMail (3x response rate), we automate the hard parts

**vs. Simplify/Huntr**: They track; we act. We find contacts and send emails for you.  
**vs. LinkedIn**: 95% cheaper ($1,788/year vs. $8K), email-first (not InMail-only).  
**vs. Apollo/Instantly**: Sales tools adapted for recruiting; we're recruiting-native from day 1.

---

## 2. Market & Growth

### Q: How big is the market really?
**A**: 
- **11M** job openings monthly (US, BLS data)
- **40%** white-collar (addressable) = 4.4M jobs/month
- **27M** applications/month (4.5 applicants per hire)
- **30%** would use automation = 8M potential job seeker users
- **200K** companies with dedicated recruiting teams → 600K recruiter seats

Our SAM ($12B) is conservative; assumes 10% penetration of white-collar job search/recruiting.

---

### Q: What's your growth strategy?
**A**: **Product-led growth** (PLG) with organic as primary channel:

**Phase 1 (Months 1-6)**: Job Seekers via SEO + Community
- Target: 5,000 users, 500 paid
- Channels: Content marketing ("how to reach hiring managers"), Reddit/Blind, career coach partnerships
- CAC: $50 (paid ads) → $0 (organic, long-term)

**Phase 2 (Months 7-12)**: Recruiters via Outbound Sales
- Target: 500 recruiter seats, 10 enterprise pilots
- Channels: Outbound (SDRs), ATS partnerships, HR Tech events
- CAC: $300 (outbound)

**Phase 3 (Year 2+)**: Viral Loops
- Referral program ("Invite 3 friends, get 1 month free")
- Success sharing (LinkedIn/Twitter integrations)
- White-label (career coaches drive user acquisition)

---

### Q: What's your customer acquisition cost?
**A**:
- **Job Seekers**: $50 (paid ads) at launch → $5 (organic) by Year 2
- **Recruiters**: $300 (outbound sales, 6-week cycle)
- **Enterprise**: $10,000 (field sales, 6-month cycle)

**Payback Period**:
- Job Seekers: 1 month (paid), instant (organic)
- Recruiters: 2 months
- Enterprise: 2 months

---

### Q: How do you retain users?
**A**:
- **Job Seekers**: Average 6-month active search → 12-month retention (passive use + 2 search cycles)
- **Recruiters**: 85% annual retention (switching cost = re-training + integration)
- **Enterprise**: 90% retention (multi-year contracts, deep integration)

**Retention Drivers**:
1. **Habit formation**: Daily/weekly Tracker usage
2. **Data lock-in**: Historical applications, contacts, sequences
3. **Results**: 15%+ reply rate keeps users coming back
4. **Network effects**: More users → better benchmarks → stickier product

---

## 3. Product & Technology

### Q: What's your tech stack?
**A**:
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind
- **Backend**: FastAPI (Python 3.11), PostgreSQL 15, Redis 7
- **Infrastructure**: AWS (ECS Fargate, RDS, ElastiCache, S3)
- **External APIs**: Apollo/Clay (enrichment), SendGrid/Mailgun (email), Anthropic/OpenAI (AI)

**Why this stack?**:
- Fast development (MVP in 3-4 months)
- Scalable (10K → 500K users without major rewrites)
- Cost-efficient ($50K/month at 10K users)

---

### Q: How do you ensure deliverability?
**A**: **Multi-pronged approach**:

1. **Infrastructure**: Pre-warmed RoleFerry domains (not user email)
2. **Health Monitoring**: Bounce rate, spam reports tracked real-time
3. **Throttling**: 50 emails/day per mailbox (ISP best practice)
4. **Warmup Protocol**: New domains start at 5/day, increase 5%/day for 30 days
5. **Content Moderation**: AI flags spam patterns, profanity
6. **Rotation**: 100+ domains at scale (distribute risk)

**Result**: >95% inbox placement, <0.05% spam complaint rate.

---

### Q: What's your AI strategy?
**A**: **AI as feature, not product** (we're not an AI company):

1. **Match Scoring**: ML model (XGBoost) trained on user feedback (thumbs up/down)
2. **Draft Generation**: LLM (Anthropic Claude) personalizes emails from resume + JD
3. **Copilot**: Q&A assistant ("Why is this a fit?", "Write an email")

**Why this works**:
- AI improves core value prop (better matches, faster drafts)
- Human-in-the-loop (user reviews before sending)
- Cost-manageable ($0.02/draft, $0.005/match score)

**Moat**: Data compounds over time (match accuracy improves with usage).

---

## 4. Competition

### Q: What if LinkedIn builds this?
**A**: **Unlikely for 3 reasons**:

1. **Deliverability risk**: LinkedIn can't risk their core email reputation by adding bulk sending
2. **Strategic focus**: They monetize via ads + Recruiter seats, not automation
3. **Speed**: We can iterate 10x faster (startup vs. MSFT bureaucracy)

**If they do**: We have 18-24 month head start on deliverability infrastructure + brand.

---

### Q: What if Simplify adds outreach?
**A**: **We have moat they can't replicate quickly**:

1. **Deliverability**: Requires 100+ warmed domains, 6+ months setup, $500K+ investment
2. **Enrichment**: Multi-provider integrations (Apollo, Clay, Hunter) take 6+ months
3. **AI**: Draft generation, match scoring require ML expertise

**Timeline**: 12-18 months to reach feature parity. By then, we're at scale (50K users, data advantage).

---

## 5. Financials

### Q: What's your burn rate?
**A**:
- **Pre-MVP**: $150K/month (2 FT engineers, 1 contractor, infra, APIs)
- **Post-MVP**: $250K/month (5 engineers, marketing, infra)
- **Runway**: 18 months on $2M seed round

**Path to Profitability**:
- Break-even: $300K MRR (Month 18-24)
- Profitable: Month 24+ (assume 70% gross margin)

---

### Q: What are you raising and why?
**A**: **$2M seed round**

**Use of Funds**:
- 40% Engineering ($800K): Hire 3 engineers (2 full-stack, 1 ML)
- 30% GTM ($600K): Growth marketing, content, partnerships
- 20% Infrastructure ($400K): Deliverability domains, APIs, hosting
- 10% Operations ($200K): Legal, compliance, admin

**Target Metrics (18 months)**:
- 50K registered users
- 5K paying subscribers
- $1.5M ARR
- 85% gross retention

---

### Q: What's your exit strategy?
**A**: **M&A or IPO (long-term)**

**Comparable Exits**:
- **Lever**: Acquired by Employ Inc. (2022, $100M+ valuation)
- **Hired**: Acquired by Adecco (2021, $100M)
- **Jobvite**: Acquired by Employ Inc. (2021, ~$200M)

**IPO Path**: $100M+ ARR, grow-into-multiple markets (recruiting → sales → partnerships).

**Ideal Acquirers**:
- **LinkedIn** (MSFT): Bolt-on to Recruiter offering
- **Indeed**: Expand beyond job board
- **Workday/ADP**: Add to HCM suite
- **Apollo/ZoomInfo**: Expand into recruiting vertical

---

## 6. Risks

### Q: What keeps you up at night?
**A**: **Top 3 risks**:

1. **Deliverability failure**: If domains blacklisted, core value prop fails
   - *Mitigation*: Multi-domain pool, health monitoring, slow ramp

2. **Regulatory (CAN-SPAM, GDPR)**: Non-compliance = fines, injunctions
   - *Mitigation*: Legal review, privacy-by-design, lawyer-approved templates

3. **Competition from incumbents**: LinkedIn/Simplify add similar features
   - *Mitigation*: Speed, deliverability moat, niche depth

---

### Q: What's your moat long-term?
**A**: **3 compounding advantages**:

1. **Data Moat**: Match accuracy improves with usage (feedback loop)
2. **Infrastructure Moat**: 100+ warmed domains = 18+ months, $1M+ to replicate
3. **Network Effects**: More users → better benchmarks (reply rates, time-to-interview) → stickier product

---

## 7. Team

### Q: Who's on the founding team?
**A**: (This would be customized with actual team details)

**CEO/Founder**: 10+ years recruiting tech, scaled SaaS to $50M ARR  
**CTO**: Ex-FAANG, led email infra at scale (1B+ sends/month)  
**Head of Product**: Built job matching ML at major job board  

**Why we'll win**: Domain expertise (recruiting) + technical depth (email infra) + product sense (ML).

---

### Q: What are you hiring for?
**A**: **Next 6 months**:
- 2 Full-Stack Engineers (Next.js + FastAPI)
- 1 ML Engineer (match scoring, LLM integration)
- 1 Growth Marketer (SEO, content, community)

**Next 12 months**:
- 1 Sales Lead (recruiter segment)
- 1 Designer (UX/UI)
- 1 DevOps Engineer (scale infrastructure)

---

## 8. Next Steps

### Q: What do you need from investors?
**A**:
1. **Capital**: $2M seed round
2. **Intros**: HR Tech buyers, ATS partnerships, career coach networks
3. **Expertise**: Scaling SaaS, recruiting industry insights

### Q: What's your timeline?
**A**:
- **Now**: Fundraising ($2M seed)
- **Q4 2025**: MVP launch (100 users)
- **Q2 2026**: 1K users, $10K MRR
- **Q4 2026**: 10K users, $100K MRR
- **2027**: 50K users, $500K+ MRR, Series A ($10M)

---

**Contact**: founders@roleferry.com  
**Deck**: [Link to pitch deck]  
**Demo**: [Link to product demo video]

---

**Document Owner**: CEO, CFO  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (update with traction)

