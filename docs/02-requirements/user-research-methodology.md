# User Research Methodology
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, UX, Leadership  
**Purpose**: Systematic approach to understanding users

---

## 1. Research Philosophy

**"Build what users need, not what we think they want."**

### Principles
1. **Talk to users early** (before building)
2. **Validate with data** (not opinions)
3. **Continuous research** (not one-time)
4. **Include diverse users** (job seekers + recruiters, various industries)

---

## 2. Research Methods

### 2.1 User Interviews

**When**: Exploratory phase, feature discovery

**Goal**: Understand pain points, motivations, workflows

**Sample Size**: 20-30 users (diminishing returns after 20)

**Format**:
- 30-45 minutes, 1-on-1 (Zoom, in-person)
- Semi-structured (prepared questions, but flexible)
- Recorded (with permission) for analysis

**Example Questions** (Job Seeker):
- "Walk me through your last job search. What was most frustrating?"
- "How did you decide which companies to apply to?"
- "Tell me about a time you got an interview. What worked?"
- "What tools do you use today? What do you like/dislike?"

**Incentive**: $50 Amazon gift card (30-min interview)

---

### 2.2 Surveys

**When**: Quantitative validation, broad feedback

**Goal**: Measure sentiment, prioritize features, segment users

**Sample Size**: 500+ responses (statistical significance)

**Tool**: Typeform, Google Forms

**Example Survey** (Feature Prioritization):
```
Which features are most important to you? (Rank 1-5)

1. Find hiring manager emails
2. AI-generated outreach emails
3. Application tracker (Kanban)
4. Job match scoring
5. Interview scheduling assistant

How likely are you to recommend RoleFerry? (NPS)
0 (Not at all) ──────────────── 10 (Extremely likely)

What's your biggest pain point in job searching?
[Open text field]
```

---

### 2.3 Usability Testing

**When**: Prototype or new feature ready

**Goal**: Identify UX issues before launch

**Sample Size**: 5-8 users (80% of usability issues found with 5 users)

**Format**:
- 60 minutes, 1-on-1
- Task-based ("Apply to a job and track it")
- Think-aloud protocol ("What are you thinking right now?")
- Screen recording (observe clicks, hesitations)

**Example Tasks**:
1. "Sign up for RoleFerry and complete onboarding"
2. "Find a job you'd apply to and click Apply"
3. "Check the status of your application in the Tracker"
4. "Edit the draft email before sending"

**Metrics**:
- Task completion rate (did they succeed?)
- Time on task (how long did it take?)
- Error rate (wrong clicks, confusion)
- Satisfaction (post-task rating 1-5)

---

### 2.4 Beta Testing

**When**: Feature ready, pre-launch

**Goal**: Catch bugs, gather feedback, validate PMF

**Sample Size**: 20-50 users (mix of job seekers + recruiters)

**Duration**: 2 weeks

**Process**:
1. **Recruit**: Email waitlist, select diverse cohort
2. **Onboard**: Kickoff call, provide instructions
3. **Monitor**: Daily Slack channel, log bugs/feedback
4. **Survey**: Exit survey (what worked? what didn't?)
5. **Iterate**: Fix P0/P1 bugs before launch

**Incentive**: Free Pro for 3 months (early access)

---

## 3. Research Cadence

| Method | Frequency | Owner |
|--------|-----------|-------|
| **User Interviews** | Monthly (5-10 interviews) | Product Manager |
| **Surveys** | Quarterly (feature prioritization, NPS) | Product Manager |
| **Usability Testing** | Per feature (before launch) | UX Designer |
| **Beta Testing** | Per major release | Product Manager |
| **Analytics Review** | Weekly (funnel, retention) | Product Manager |

---

## 4. Recruiting Participants

### 4.1 Sources

**Job Seekers**:
- Waitlist signups (email opt-in for research)
- Current users (in-app prompt: "Help us improve RoleFerry")
- LinkedIn outreach (target profiles: recently job hunting)
- Career coaching communities (partner with coaches)

**Recruiters**:
- LinkedIn (search: "Head of Talent," "Recruiting Manager")
- Recruiter Slack communities (Recruiting Brainfood, others)
- Current customers (upsell research participation → feature influence)

---

### 4.2 Screening Criteria

**Job Seekers**:
- ✅ Currently job hunting OR hired in last 6 months
- ✅ Applied to 10+ jobs (experienced the pain)
- ✅ White-collar roles (our target market)
- ❌ Students (different use case)
- ❌ Blue-collar roles (not our ICP)

**Recruiters**:
- ✅ Hiring 5+ roles/year
- ✅ Company 50-500 employees
- ✅ Tech or professional services industry
- ❌ Enterprise (>1K employees, complex buying)

---

## 5. Data Analysis

### 5.1 Qualitative Analysis (Interviews, Usability)

**Process**:
1. **Transcribe**: Use Otter.ai for automatic transcription
2. **Tag Themes**: Identify recurring patterns (e.g., "frustrated with ATS," "no insider access")
3. **Affinity Mapping**: Group similar feedback (Miro board)
4. **Prioritize**: High-frequency themes = top priority

**Tools**: Notion (notes), Miro (affinity mapping), Dovetail (research repository)

---

### 5.2 Quantitative Analysis (Surveys)

**Metrics**:
- **NPS** (Net Promoter Score): % Promoters (9-10) - % Detractors (0-6)
  - Target: 50+ (excellent for B2B SaaS)
- **Feature Ranking**: Average rank (1-5) for each feature
- **Willingness to Pay**: % who'd pay $49/month

**Tool**: Google Sheets, Excel (pivot tables, charts)

---

## 6. Synthesis & Insights

### 6.1 Research Report Template

```markdown
# User Research Report: [Feature/Topic]

## Executive Summary
- Key finding 1 (e.g., 80% struggle to find hiring managers)
- Key finding 2 (e.g., InMail reply rates <5%)
- Recommendation (e.g., Build contact discovery as MVP feature)

## Methodology
- 20 user interviews (30 min each)
- 500 survey responses
- 5 usability tests

## Key Findings

### Finding 1: Black-Hole Applications
- 78% mentioned applications going into "black holes"
- Quotes: "[User quote here]"
- Impact: High (core pain point)

### Finding 2: No Insider Access
- 68% don't know anyone at target companies
- Quotes: "[User quote here]"
- Impact: High (directly addressable)

## Recommendations
1. Prioritize contact discovery (MVP feature)
2. Build email drafting (AI assists)
3. Defer job matching (lower priority, nice-to-have)

## Appendix
- Interview guide
- Survey questions
- Raw data (link)
```

---

## 7. Sharing Insights

### 7.1 Weekly Product Sync

**Attendees**: Product, Eng, Design

**Agenda**:
- User feedback this week (3-5 highlights)
- NPS trend (up/down?)
- Top feature requests
- Usability issues found

**Outcome**: Prioritize next sprint

---

### 7.2 Monthly All-Hands

**Format**: 10-minute presentation

**Content**:
- User story (real example, anonymized)
- Key metric (NPS, retention, reply rate)
- Product decision driven by research (e.g., "We're building X because users told us Y")

**Goal**: Keep entire team user-focused

---

## 8. Research Repository

### 8.1 Notion Database

**Structure**:
```
📁 User Research
  ├── 📄 Interview Notes (Oct 2025)
  ├── 📄 Survey Results (Q3 2025)
  ├── 📄 Usability Test: Copilot (Oct 13)
  ├── 📄 Beta Feedback: LivePages (Oct 20)
  └── 📊 Insights Library
       ├── Pain Points
       ├── Feature Requests
       └── Quotes
```

**Benefits**:
- Searchable (find past research)
- Centralized (one source of truth)
- Shared (entire team can access)

---

## 9. Ethical Considerations

### 9.1 Informed Consent

**Required**:
- Explain purpose (research, not sales)
- Ask permission to record
- Assure anonymity (data won't be shared with names)
- Offer opt-out (can stop anytime)

**Template**:
```
"This interview is to help us improve RoleFerry. It will be recorded for analysis but kept confidential. Your name won't be shared. You can stop anytime. Sound good?"
```

---

### 9.2 PII Protection

**Do**:
- Anonymize quotes (remove names, companies)
- Store recordings securely (password-protected, deleted after 90 days)
- Limit access (only Product + UX)

**Don't**:
- Share recordings publicly
- Use real names in reports
- Store indefinitely (90-day retention)

---

## 10. Acceptance Criteria

- [ ] Research methods defined (interviews, surveys, usability, beta)
- [ ] Cadence established (monthly interviews, quarterly surveys)
- [ ] Recruiting process (sources, screening criteria)
- [ ] Analysis framework (qualitative + quantitative)
- [ ] Research repository (Notion database)
- [ ] Ethical guidelines (consent, PII protection)
- [ ] Insights shared (weekly sync, monthly all-hands)

---

**Document Owner**: VP Product, UX Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (refine based on what's working)

