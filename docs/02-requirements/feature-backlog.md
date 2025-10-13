# Feature Backlog & Prioritization
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, Engineering  
**Purpose**: Prioritized feature backlog with effort estimates

---

## 1. Backlog Prioritization Framework

### MoSCoW Method
- **Must Have** (P0): Blocks launch
- **Should Have** (P1): Important for differentiation
- **Could Have** (P2): Nice to have, future
- **Won't Have** (P3): Out of scope

### RICE Scoring
**Score = (Reach × Impact × Confidence) / Effort**

---

## 2. P0 Features (MVP - Must Launch)

| Feature | Reach | Impact | Confidence | Effort | RICE | Status |
|---------|-------|--------|------------|--------|------|--------|
| Jobs List + Filters | 100% | 3 | 100% | 3 | 100 | ⚪ Planned |
| Match Scoring (Basic) | 100% | 2 | 80% | 2 | 80 | ⚪ Planned |
| Tracker (Kanban) | 100% | 3 | 100% | 2 | 150 | ⚪ Planned |
| One-Click Apply | 100% | 3 | 90% | 5 | 54 | ⚪ Planned |
| Enrichment (Apollo) | 80% | 3 | 70% | 5 | 33.6 | ⚪ Planned |
| Email Sequences (2-step) | 80% | 3 | 80% | 3 | 64 | ⚪ Planned |
| Deliverability (1 domain) | 100% | 3 | 80% | 3 | 80 | ⚪ Planned |
| Auth (Email + OAuth) | 100% | 2 | 100% | 2 | 100 | ⚪ Planned |
| IJP Wizard | 100% | 2 | 100% | 2 | 100 | ⚪ Planned |

**Total Effort**: 27 engineering weeks

---

## 3. P1 Features (Post-MVP - Differentiation)

| Feature | Reach | Impact | Confidence | Effort | RICE | Target |
|---------|-------|--------|------------|--------|------|--------|
| AI Match Scoring (ML) | 100% | 3 | 70% | 3 | 70 | Month 4 |
| AI Copilot | 40% | 3 | 60% | 4 | 18 | Month 5 |
| AI Draft Generation | 80% | 3 | 80% | 2 | 96 | Month 4 |
| Resume Parsing (AI) | 100% | 2 | 70% | 2 | 70 | Month 4 |
| Persona Builder | 30% | 2 | 80% | 1 | 48 | Month 5 |
| LivePages | 30% | 3 | 60% | 3 | 18 | Month 6 |
| CSV Import/Export | 50% | 2 | 100% | 1 | 100 | Month 3 |
| Advanced Sequences (A/B) | 20% | 2 | 50% | 2 | 10 | Month 8 |
| Recruiter Mode UI | 20% | 3 | 90% | 2 | 27 | Month 7 |

**Total Effort**: 20 engineering weeks

---

## 4. P2 Features (Future - Scale)

| Feature | Target Quarter | Effort (weeks) |
|---------|----------------|----------------|
| Mobile App (React Native) | Q4 2026 | 8 |
| ATS Integrations (Greenhouse) | Q3 2026 | 4 |
| White-Label Platform | Q4 2026 | 6 |
| Team Workspaces | Q3 2026 | 3 |
| Advanced Analytics | Q4 2026 | 3 |
| API for Partners | Q1 2027 | 4 |
| LinkedIn Integration | Q2 2027 | 3 |
| Multi-Language (i18n) | Q2 2027 | 4 |

---

## 5. Feature Requests (User-Submitted)

### From Beta Users
1. **Calendar sync** (Google, Outlook) - 8 votes
2. **Browser extension** (save jobs from any site) - 12 votes
3. **Salary negotiation tips** (Copilot feature) - 5 votes
4. **Interview prep** (AI mock interviews) - 7 votes
5. **Referral tracking** ("Who do I know at this company?") - 9 votes

**Evaluation**: Prioritize in backlog (calendar sync = P1, browser extension = P2)

---

## 6. Technical Debt

| Item | Impact | Effort | Priority |
|------|--------|--------|----------|
| Refactor enrichment service (too complex) | Medium | 2 weeks | Q1 2026 |
| Add E2E test coverage (currently 20%) | High | 3 weeks | Q4 2025 |
| Database query optimization (slow queries) | Low | 1 week | Q1 2026 |
| Migrate to microservices (if needed) | High | 8 weeks | Q3 2026+ |

---

**Document Owner**: VP Product  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Bi-weekly (sprint planning)

