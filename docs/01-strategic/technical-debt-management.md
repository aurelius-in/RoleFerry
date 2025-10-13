# Technical Debt Management
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Engineering, Product, Leadership  
**Purpose**: Balance speed with maintainability

---

## 1. Definition of Technical Debt

**"Code or architecture decisions that prioritize short-term delivery over long-term maintainability."**

### Types of Debt

**Intentional Debt** (Strategic):
- Hardcode values to ship MVP faster (will refactor later)
- Skip tests for prototype (add before production)
- Use monolith (will extract microservices at scale)

**Unintentional Debt** (Accidental):
- Poor code quality (rushed, no review)
- Lack of documentation (future devs confused)
- Outdated dependencies (security risks)

---

## 2. Technical Debt Quadrant

```
                    Reckless
                       │
   "We don't have     │    "We need to ship
    time for design"  │     now, will fix later"
                       │
────────────────────────┼────────────────────────
   Inadvertent         │        Deliberate
                       │
   "Now we know       │    "We know what to do
    what we should    │     but don't have time"
    have done"        │
                       │
                    Prudent
```

**Goal**: Stay in "Deliberate + Prudent" quadrant (strategic trade-offs)

---

## 3. Identifying Technical Debt

### 3.1 Code Smells

**Indicators**:
- Long functions (>100 lines)
- Deep nesting (>3 levels)
- Duplicated code (copy-paste)
- Magic numbers (`if status == 3`)
- Commented-out code (dead code)
- God classes (>1K lines, does everything)

**Tool**: SonarQube (static analysis)

---

### 3.2 Architectural Smells

**Indicators**:
- Circular dependencies (Module A → B → A)
- Tight coupling (changing A breaks B)
- No tests (changing code = fear)
- Slow CI/CD (tests take >30 min)
- Manual deployment (error-prone)

---

## 4. Tracking Technical Debt

### 4.1 Debt Register (Notion)

| ID | Description | Impact | Effort | Priority | Created | Owner |
|----|-------------|--------|--------|----------|---------|-------|
| TD-001 | No unit tests for enrichment service | High | Medium | P1 | Oct 2025 | Alice |
| TD-002 | Hardcoded API URLs (should be config) | Low | Low | P3 | Oct 2025 | Bob |
| TD-003 | N+1 queries in Jobs API | High | High | P2 | Oct 2025 | Charlie |

**Priority**:
- **P0**: Blocking (ship-stopper, fix now)
- **P1**: High (fix within 1 sprint)
- **P2**: Medium (fix within 3 months)
- **P3**: Low (fix when convenient, or never)

---

### 4.2 Debt as Linear Tickets

**Label**: `tech-debt`

**Template**:
```markdown
## Problem
Enrichment service has no unit tests. Changes risk breaking prod.

## Impact
- High (hard to refactor safely)
- Slows development (no confidence in changes)

## Proposed Solution
Add pytest unit tests (target: 80% coverage)

## Effort
2-3 days (20 tests, mocks for Apollo/Clay)

## Priority
P1 (fix before adding new enrichment providers)
```

---

## 5. Paying Down Debt

### 5.1 Debt Allocation (20% Rule)

**Guideline**: 20% of engineering time = tech debt / refactoring

**Example** (10-person team, 2-week sprint):
- 8 people × 10 days = 80 person-days
- 20% = 16 person-days for tech debt

**In Practice**:
- 2 engineers dedicated to debt every sprint
- OR 1 "cleanup week" every 5 sprints

---

### 5.2 Boy Scout Rule

**"Leave code better than you found it."**

**Examples**:
- Refactor function while adding feature
- Add missing tests while fixing bug
- Update docs while reading code

**Limit**: Small improvements only (don't derail feature work)

---

## 6. Preventing Technical Debt

### 6.1 Code Review Standards

**Checklist**:
- [ ] Code is readable (clear variable names, comments for complex logic)
- [ ] Tests added (unit tests for new functions)
- [ ] No obvious code smells (long functions, duplication)
- [ ] Documentation updated (if API changed)

**Reviewer Responsibility**: Flag debt ("This works, but let's refactor before shipping")

---

### 6.2 Definition of Done

**Feature isn't "done" until**:
- [ ] Code merged
- [ ] Tests pass (80%+ coverage)
- [ ] Documentation updated
- [ ] No linter errors
- [ ] Deployed to staging (smoke tested)

**NOT Done**: "Works on my machine" ❌

---

## 7. Debt Decision Framework

### When to Take on Debt

**Good Reasons**:
- Ship MVP to validate market (can refactor if successful)
- Meet critical deadline (customer demo, launch)
- Experiment (throw-away code, not production)

**Bad Reasons**:
- "We don't have time for tests" (always have time)
- "We'll fix it later" (you won't, debt accumulates)
- "Only I understand this code" (bus factor = 1)

---

### When to Pay Down Debt

**Criteria**:
- High impact (slows development, frequent bugs)
- Medium effort (fixable in 1 sprint)
- Blocks future work (can't add feature without refactor)

**Examples**:
- Refactor authentication (before adding OAuth providers)
- Add tests (before major refactor)
- Fix N+1 queries (before scaling to 10K users)

---

## 8. Debt Metrics

### 8.1 Code Quality Metrics

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| **Test Coverage** | 📊 TBD | 80% | pytest --cov |
| **Code Duplication** | 📊 TBD | <5% | SonarQube |
| **Complexity** (Cyclomatic) | 📊 TBD | <10/function | SonarQube |
| **Tech Debt Hours** | 📊 TBD | <500 hours | SonarQube (estimate) |

---

### 8.2 Velocity Impact

**Track**: Sprint velocity before/after debt paydown

**Expected**: Velocity increases 10-20% after cleanup sprint

**Example**:
- Sprint 1-4: 40 story points/sprint (with debt)
- Sprint 5: Cleanup sprint (0 features, 100% debt)
- Sprint 6-8: 48 story points/sprint (+20% velocity)

---

## 9. Common Debt Items (RoleFerry)

### 9.1 Current Debt (October 2025)

| Item | Impact | Effort | Plan |
|------|--------|--------|------|
| **No integration tests** | High | High | Add in Sprint 3 (Q4 2025) |
| **Hardcoded match score logic** | Medium | Low | Refactor to config (Q1 2026) |
| **Monolithic API** | Low | Very High | Extract enrichment service (Q2 2026, if needed) |
| **No API versioning** | Medium | Medium | Implement v1 before public API (Q1 2026) |

---

## 10. Communicating Debt to Non-Technical Stakeholders

### 10.1 Explain in Business Terms

**Bad**: "We have high cyclomatic complexity and tight coupling."

**Good**: "Our code is hard to change safely. Adding features takes 2x longer than it should. We need to refactor."

**Better**: "Imagine a messy closet. Finding clothes takes forever. If we spend 1 week organizing, we'll save 2 weeks/month going forward."

---

### 10.2 Show ROI

**Debt Paydown Sprint**:
- **Cost**: 1 sprint (2 weeks, $50K in eng salaries)
- **Benefit**: 20% velocity increase (40 → 48 story points/sprint)
- **Payback**: 2.5 sprints (5 weeks)
- **ROI**: 400% annually

**Pitch**: "Spend 2 weeks now, save 10 weeks/year."

---

## 11. Acceptance Criteria

- [ ] Technical debt defined (intentional vs. unintentional)
- [ ] Debt register maintained (Notion or Linear)
- [ ] 20% time allocated to debt paydown
- [ ] Boy Scout Rule enforced (leave code better)
- [ ] Code review standards (checklist)
- [ ] Definition of Done includes tests, docs
- [ ] Debt metrics tracked (coverage, duplication, complexity)

---

**Document Owner**: CTO, Engineering Manager  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (review debt register, adjust priorities)

