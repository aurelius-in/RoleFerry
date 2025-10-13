# Product Roadmap
## RoleFerry Platform

**Version**: 1.0  
**Last Updated**: October 13, 2025  
**Planning Horizon**: 18 months (Q4 2025 - Q1 2027)

---

## Roadmap Overview

RoleFerry's roadmap is organized into **4 phases** over 18 months, focusing on:
1. **MVP Launch** (Q4 2025): Prove core value proposition
2. **Intelligence & Differentiation** (Q1-Q2 2026): Add AI features
3. **Recruiter Mode & B2B** (Q3 2026): Expand market
4. **Scale & Enterprise** (Q4 2026 - Q1 2027): Growth infrastructure

---

## Phase 1: MVP Launch (Q4 2025)

**Goal**: Launch functional product, prove Apply → Contact → Reply loop  
**Success Metrics**: 100 active users, 10% reply rate, 80% D7 retention

### Features

#### ✅ Jobs List & Matching (P0)
- Scrape/import jobs from Indeed, LinkedIn, Greenhouse
- Basic match scoring (keyword matching, no ML yet)
- Filters: role, location, remote, salary
- **Effort**: 3 weeks
- **Owner**: Backend team

#### ✅ Tracker (Kanban + Table) (P0)
- Board view: Saved, Applied, Interviewing, Offer, Rejected
- Table view: sortable, filterable
- CSV import/export
- **Effort**: 2 weeks
- **Owner**: Frontend team

#### ✅ Apply → Enrichment → Outreach (P0)
- One-click Apply creates application
- Enrichment: Company domain → Apollo/Clay → 1-3 contacts
- Email verification (NeverBounce)
- Pre-filled email draft (basic template, no AI)
- **Effort**: 4 weeks
- **Owner**: Backend + integration team

#### ✅ Sequences (Basic) (P0)
- 2-step sequence (intro → follow-up)
- No A/B testing, no conditional logic (Phase 2)
- Stop-on-reply automatic
- **Effort**: 2 weeks
- **Owner**: Backend team

#### ✅ Deliverability (P0)
- 1 sending domain (rf-send-01.com)
- Throttling: 50 emails/day per mailbox
- Health monitoring (bounce rate, spam reports)
- Auto-pause if health <50
- **Effort**: 2 weeks
- **Owner**: DevOps + backend

#### 🔄 Authentication & Onboarding (P0)
- Email/password + Google OAuth
- IJP wizard (5 steps)
- Resume upload (manual for MVP, AI parsing in Phase 2)
- **Effort**: 1 week
- **Owner**: Frontend + backend

#### 📅 **Timeline**: Oct 13 - Dec 31, 2025 (11 weeks)
#### 💰 **Investment**: 2 engineers × 11 weeks = $100K (loaded cost)

---

## Phase 2: Intelligence & Differentiation (Q1-Q2 2026)

**Goal**: Add AI features that differentiate from Simplify/Huntr  
**Success Metrics**: 1K users, 15% reply rate, 10% paid conversion

### Features

#### 🤖 AI Match Scoring (P1)
- ML model trained on user feedback (thumbs up/down)
- Breakdown: Experience %, Skills %, Industry %
- Re-score on IJP changes
- **Effort**: 3 weeks (ML eng)
- **Owner**: ML team

#### 🧠 AI Copilot (P1)
- Right-rail chat interface
- Preset questions: "Why fit?", "Write email", "Show insiders"
- LLM: Anthropic Claude Sonnet (primary), OpenAI GPT-4 (fallback)
- Context: Resume + JD + company data
- **Effort**: 4 weeks
- **Owner**: Full-stack team

#### ✍️ AI Draft Generation (P1)
- Resume extract → personalized email
- Mention specific user metrics, experience
- "Use Author" button to regenerate
- **Effort**: 2 weeks (after Copilot foundation)
- **Owner**: Backend team

#### 📄 Resume Parsing (AI) (P1)
- OCR + LLM extraction → structured data
- Fields: roles, tenure, metrics, accomplishments, skills
- Editable by user (inline editing)
- **Effort**: 2 weeks
- **Owner**: ML + backend

#### 👤 Persona Builder (P1)
- Save filters: titles, departments, seniority, location
- Apply persona to enrichment
- Reusable across applications
- **Effort**: 1 week
- **Owner**: Frontend + backend

#### 🌐 LivePages v1 (P1)
- Personalized landing pages (name, role, company)
- Fields: video/GIF, calendar link, proof bullets
- Analytics: page views, clicks, scroll depth
- Link rewriting via Custom Tracking Domain
- **Effort**: 3 weeks
- **Owner**: Full-stack team

#### 📅 **Timeline**: Jan - June 2026 (24 weeks)
#### 💰 **Investment**: 3 engineers × 24 weeks = $350K

---

## Phase 3: Recruiter Mode & B2B (Q3 2026)

**Goal**: Unlock B2B revenue stream, expand TAM  
**Success Metrics**: 5K users (80% JS, 20% Rec), $50K MRR, 5 enterprise pilots

### Features

#### 💼 Recruiter Mode UI (P1)
- Switch mode in Settings
- Labels: Leads → Contacted → Appointments → Offers → Won/Lost
- Bulk import (CSV, 100+ rows)
- Bulk actions (multi-select, launch sequence)
- **Effort**: 2 weeks
- **Owner**: Frontend team

#### 🔗 ATS Integrations (P1)
- Greenhouse API (import jobs, push candidates)
- Lever API
- Bidirectional sync (status updates)
- **Effort**: 4 weeks (2 weeks per ATS)
- **Owner**: Backend + integrations

#### 👥 Team Workspaces (P1)
- Multi-user accounts (Teams plan)
- Roles: Admin, Member, Viewer
- Shared personas, templates, leads
- Activity log (audit trail)
- **Effort**: 3 weeks
- **Owner**: Backend + frontend

#### 🎯 Advanced Sequences (P1)
- A/B testing (subject lines)
- Conditional logic (if opened → send variant B)
- Dynamic variables ({{my_metric}}, custom fields)
- **Effort**: 2 weeks
- **Owner**: Backend team

#### 📊 Advanced Analytics (P1)
- Cohort analysis (reply rate by source, week)
- Funnel visualization (applied → replied → interviewed)
- Export reports (CSV, PDF)
- **Effort**: 2 weeks
- **Owner**: Full-stack team

#### 📅 **Timeline**: July - Sept 2026 (12 weeks)
#### 💰 **Investment**: 4 engineers × 12 weeks = $280K

---

## Phase 4: Scale & Enterprise (Q4 2026 - Q1 2027)

**Goal**: Product-led growth, enterprise readiness  
**Success Metrics**: 25K users, $250K MRR, break-even on paid CAC

### Features

#### 🚀 Referral Program (P1)
- "Invite 3 friends, get 1 month free"
- Referral tracking dashboard
- Viral loop: share success on LinkedIn
- **Effort**: 1 week
- **Owner**: Full-stack + marketing

#### 📱 Mobile App (P2)
- React Native (iOS + Android)
- Read-only Tracker + reply management
- Push notifications (replies, interviews)
- **Effort**: 8 weeks
- **Owner**: Mobile team (hire 1 engineer)

#### 🎨 White-Label Platform (P2)
- Career coaches, outplacement firms
- Custom branding (logo, colors, domain)
- Client workspaces (1 coach, 50 clients)
- **Effort**: 6 weeks
- **Owner**: Backend + DevOps

#### 🔌 API for Partners (P2)
- Public API (REST + webhooks)
- Use cases: ATS vendors, recruiting platforms
- Rate-limited, usage-based pricing
- **Effort**: 4 weeks
- **Owner**: Backend + DevOps

#### 🌍 International Expansion (P2)
- EU region (AWS eu-west-1)
- GDPR data residency
- Multi-language support (Spanish, French, German)
- **Effort**: 6 weeks
- **Owner**: Full team

#### 🔒 Enterprise Features (P2)
- SSO (SAML, Okta, Azure AD)
- Audit logs (SOC 2 Type II requirement)
- SLAs (99.9% uptime guarantee)
- Dedicated support (Slack channel)
- **Effort**: 4 weeks
- **Owner**: Backend + DevOps

#### 📅 **Timeline**: Oct 2026 - March 2027 (24 weeks)
#### 💰 **Investment**: 5 engineers × 24 weeks = $600K

---

## Feature Prioritization Framework

### P0: Must-Have (Blocks Launch)
- Jobs list, Tracker, Apply, Enrichment, Sequences, Deliverability

### P1: Differentiation (Unlock PMF)
- Match scoring, Copilot, AI drafts, Personas, LivePages, Recruiter mode

### P2: Scale (10x Growth)
- A/B testing, Team features, ATS integrations, Advanced analytics

### P3: Moat (Defensibility)
- White-label, API, International, Enterprise (SSO, audit logs)

---

## Success Metrics by Phase

| Phase | Users | MRR | Reply Rate | Retention (D30) |
|-------|-------|-----|------------|-----------------|
| **MVP (Q4 2025)** | 100 | $500 | 10% | 60% |
| **Intelligence (Q1-Q2 2026)** | 1,000 | $10K | 15% | 70% |
| **Recruiter (Q3 2026)** | 5,000 | $50K | 15% | 75% |
| **Scale (Q4 2026 - Q1 2027)** | 25,000 | $250K | 18% | 80% |

---

## Investment Summary (18 Months)

| Phase | Duration | Engineers | Cost | Revenue |
|-------|----------|-----------|------|---------|
| MVP | 11 weeks | 2 | $100K | $500 |
| Intelligence | 24 weeks | 3 | $350K | $10K |
| Recruiter | 12 weeks | 4 | $280K | $50K |
| Scale | 24 weeks | 5 | $600K | $250K |
| **Total** | **71 weeks** | **Avg 3.5** | **$1.33M** | **$310K** |

**Note**: Revenue is MRR at end of phase, not cumulative. ARR trajectory: $500 → $10K → $50K → $250K.

---

## Risks & Dependencies

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Deliverability failure | Existential | Multi-domain pool, gradual warmup, health monitoring |
| LLM accuracy (drafts) | User trust | Human review, "Use Author" regenerate, feedback loop |
| Enrichment accuracy | Reply rate | Multi-provider waterfall, verification, user feedback |

### Market Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Simplify adds outreach | Competitive threat | Speed to market, deliverability moat, AI differentiation |
| LinkedIn blocks enrichment | Data access | Pivot to self-reported contacts, email-first positioning |
| Recession (hiring freeze) | Demand drop | Target recruiters (countercyclical), passive job seekers |

---

## Decision Points (Pivot or Persevere)

### After MVP (Month 3)
**Criteria**:
- 100 users achieved? (Yes/No)
- Reply rate >8%? (Yes/No)
- D7 retention >50%? (Yes/No)

**Decision**:
- **3 Yes** → Proceed to Phase 2
- **2 Yes** → Iterate on weakest metric
- **<2 Yes** → Pivot (reassess product-market fit)

### After Intelligence (Month 9)
**Criteria**:
- 1K users achieved? (Yes/No)
- 10% paid conversion? (Yes/No)
- Reply rate >12%? (Yes/No)

**Decision**:
- **3 Yes** → Proceed to Phase 3 (Recruiter mode)
- **2 Yes** → Double down on job seeker PMF
- **<2 Yes** → Consider shutdown or major pivot

---

## Future Considerations (Beyond 18 Months)

- **Adjacent Use Cases**: Sales prospecting, partnerships, fundraising outreach
- **Marketplace**: Templates, personas, coaches (two-sided marketplace)
- **Data Moat**: Proprietary contact graph, reply prediction model
- **Acquisitions**: Buy competitors (Simplify, Huntr) for user base consolidation

---

**Document Owner**: CEO, VP Product  
**Reviewed By**: Engineering, Board  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (adjust based on learnings)

