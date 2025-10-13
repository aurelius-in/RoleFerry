# Vision, Mission & Values
## RoleFerry Platform

**Version**: 1.0  
**Audience**: All Stakeholders (Team, Investors, Partners, Customers)  
**Purpose**: Define company purpose and guiding principles

---

## 1. Vision Statement

**"A world where every job seeker has insider access and every hiring manager connects with the right talent—no gatekeepers, no black holes."**

### What Success Looks Like (10 Years)
- 10M+ job seekers use RoleFerry as primary application tool
- 100K+ recruiters rely on RoleFerry for outbound sourcing
- 50% of professional hires start with direct email (vs. ATS applications)
- RoleFerry is synonymous with "job search automation" (like "Google" for search)

---

## 2. Mission Statement

**"Transform job applications from black-hole submissions into direct conversations with decision-makers through intelligent automation and managed infrastructure."**

### How We Achieve This
1. **Intelligence**: AI match scoring, contact discovery, draft generation
2. **Automation**: One-click Apply → contacts found → emails sent
3. **Infrastructure**: Managed deliverability (we own the risk, not users)
4. **Transparency**: Show sources, explain how we work, respect privacy

---

## 3. Core Values

### 3.1 User Success First
**What it means**: We win when users get jobs/hires, not when they click ads.

**Examples**:
- No dark patterns (no hiding unsubscribe, no fake urgency)
- Honest reply rate expectations (15%, not "guaranteed interviews")
- Refund if not satisfied (30-day money-back)

**Hiring for this**: "Tell me about a time you put user needs over company metrics."

---

### 3.2 Transparency & Trust
**What it means**: Be honest about how we work, even if imperfect.

**Examples**:
- Source attribution ("Found via Apollo") on contacts
- Admit when enrichment fails ("We couldn't find contacts")
- Privacy-first (90-day data deletion, self-service export)

**Anti-pattern**: Hiding that we use AI, claiming contacts are proprietary when they're from public sources

---

### 3.3 Build > Buy
**What it means**: Invest in hard problems (deliverability), integrate for commodity features (auth).

**Examples**:
- Build: Custom deliverability infrastructure (our moat)
- Buy: Stripe (payments), Anthropic (LLM), Apollo (contact data)

**Decision framework**: If it's differentiating and defensible, build. If it's commodity, buy.

---

### 3.4 Velocity with Quality
**What it means**: Ship fast, but don't break things.

**Examples**:
- Weekly releases (not quarterly)
- 80% test coverage (not 100% paralysis)
- Rollback in 5 minutes (deploy confidently)

**Anti-pattern**: "Move fast and break things" (we serve job seekers—breaking trust is fatal)

---

### 3.5 Bias for Action
**What it means**: Experiment, learn, iterate (don't wait for perfect).

**Examples**:
- Launch MVP in 3 months (not 12)
- A/B test pricing (don't debate for weeks)
- Try partnerships (don't wait for Series A)

**Hiring for this**: "Tell me about a project you shipped in 30 days that normally takes 90."

---

## 4. Operating Principles

### 4.1 Product Principles

1. **Invisible Complexity**: User clicks "Apply"; we orchestrate enrichment, drafting, sending behind the scenes.
2. **Context-Aware Help**: Copilot appears when useful, not as persistent nag.
3. **Optimize for Dopamine**: Fast feedback (reply notification = dopamine hit → retention).
4. **Data Liberation**: Users can export/delete data anytime (no lock-in by withholding data).

---

### 4.2 Engineering Principles

1. **Boring Technology**: Use proven tools (PostgreSQL, Redis) over bleeding-edge.
2. **Monolith First**: Don't prematurely optimize for scale (microservices when needed, not before).
3. **Automate Toil**: If you do it 3x, script it. If you script it 3x, build it into platform.
4. **Blameless Post-Mortems**: Incidents happen; learn and improve (no finger-pointing).

---

### 4.3 Business Principles

1. **Sustainable Growth**: Prioritize organic (CAC → $0) over paid ads that don't scale.
2. **Unit Economics First**: Don't scale unprofitable unit economics (fix LTV:CAC before Series A).
3. **Customer Success = Revenue**: Help users win → they upgrade and stay.
4. **Pricing = Value**: Charge for outcomes (reply rate, interviews), not features.

---

## 5. Cultural Norms

### 5.1 Communication

**Asynchronous-First**:
- Default: Slack, Linear, Notion (read/respond on your time)
- Synchronous: Standups (15 min), critical incidents only

**Direct & Kind**:
- Feedback is a gift (give it generously, receive it graciously)
- Disagree openly, commit fully (no passive-aggressive)

**Remote-First**:
- All meetings recorded (timezones, async viewing)
- Written > verbal (document decisions)

---

### 5.2 Work-Life Integration

**Flexible Hours**: Results matter, not 9-5 attendance

**Unlimited PTO**: Take time off (we trust you, no approval needed)

**Burnout Prevention**: On-call rotations max 1 week/month, paid overtime

---

## 6. Decision-Making Framework

### 6.1 Types of Decisions

**Type 1** (Reversible, low-cost):
- **Owner**: Individual contributor (engineer, designer)
- **Process**: Make decision, inform team (no approval needed)
- **Examples**: UI copy, button color, library choice

**Type 2** (Reversible, high-cost):
- **Owner**: Manager (Engineering Lead, Product Manager)
- **Process**: Propose, get feedback, decide within 48 hours
- **Examples**: Add new feature, change API contract, hire contractor

**Type 3** (Irreversible or very high-cost):
- **Owner**: CEO or CTO
- **Process**: Written proposal, team feedback, leadership decision
- **Examples**: Raise funding, acquire company, pivot product, shut down feature

---

## 7. Hiring Values Fit

### Interview Questions

**User Success First**:
- "Tell me about a time you advocated for a customer over your team's preference."

**Transparency**:
- "Describe a situation where you admitted a mistake publicly."

**Bias for Action**:
- "Tell me about a project you shipped in half the expected time."

**Velocity with Quality**:
- "How do you balance speed and quality? Give an example."

---

## 8. Living the Values (Examples)

### Good Example: User Success First
**Situation**: User reports low reply rate (5%, below 15% avg).  
**Response**: Product team investigates, discovers poor contact quality from one provider. Switches default provider, refunds user's credits.  
**Result**: User's next batch gets 18% reply rate, upgrades to Pro.

### Bad Example: Violates Transparency
**Situation**: Enrichment provider down, users see "No contacts found."  
**Response**: Generic error message, no explanation.  
**Better**: "Our data provider is experiencing issues. We're working on it. Try again in 1 hour or add contacts manually."

---

## 9. Acceptance Criteria

- [ ] Vision and mission statements published (website, handbook)
- [ ] Core values defined (5 values, clear examples)
- [ ] Operating principles documented (product, engineering, business)
- [ ] Cultural norms established (communication, work-life, remote)
- [ ] Values integrated into hiring (interview questions)
- [ ] Team aligned (all-hands discussion, feedback incorporated)

---

**Document Owner**: CEO, Head of People (future)  
**Reviewed By**: Founding Team, Board  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Annually (values evolve with team growth)

