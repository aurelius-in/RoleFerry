# Epic Breakdown
## RoleFerry Platform

**Version**: 1.0  
**Purpose**: High-level epics and sprint planning  
**Audience**: Product, Engineering

---

## Epic 1: Foundation (Weeks 1-4)

### User Management
- [ ] User signup (email/password)
- [ ] OAuth (Google, Microsoft)
- [ ] Login + JWT tokens
- [ ] Password reset
- [ ] Email verification

**Effort**: 1 sprint (2 weeks)  
**Team**: 1 full-stack engineer

---

### Database Setup
- [ ] PostgreSQL schema (users, jobs, companies)
- [ ] Alembic migrations
- [ ] Seed data (platform templates)
- [ ] Connection pooling

**Effort**: 0.5 sprints (1 week)  
**Team**: 1 backend engineer

---

## Epic 2: Job Discovery (Weeks 3-6)

### Jobs Ingestion
- [ ] Apify scrapers (Indeed, LinkedIn)
- [ ] ATS APIs (Greenhouse, Lever)
- [ ] Job deduplication
- [ ] Company enrichment (Clearbit)

**Effort**: 1 sprint  
**Team**: 1 backend engineer

---

### Jobs List UI
- [ ] Job cards (logo, title, company, location)
- [ ] Filters (role, location, remote, salary)
- [ ] Pagination
- [ ] Basic match scoring (keyword-based)

**Effort**: 1 sprint  
**Team**: 1 frontend engineer

---

## Epic 3: Application Tracking (Weeks 5-8)

### Tracker Backend
- [ ] Applications table
- [ ] CRUD APIs (/api/applications)
- [ ] CSV import/export
- [ ] Notes, interview dates

**Effort**: 1 sprint  
**Team**: 1 backend engineer

---

### Tracker UI
- [ ] Kanban board (5 columns, drag & drop)
- [ ] Table view (sortable, filterable)
- [ ] Application detail modal
- [ ] Status updates

**Effort**: 1.5 sprints  
**Team**: 1 frontend engineer

---

## Epic 4: Enrichment & Outreach (Weeks 7-12)

### Enrichment Service
- [ ] Apollo client integration
- [ ] Clay client integration (fallback)
- [ ] Email verification (NeverBounce)
- [ ] Celery job queue
- [ ] Contact storage

**Effort**: 2 sprints  
**Team**: 1 backend engineer

---

### Sequence Engine
- [ ] Sequence templates (CRUD)
- [ ] Outreach records (queue, send, track)
- [ ] Variable substitution
- [ ] Stop-on-reply logic
- [ ] SendGrid integration

**Effort**: 2 sprints  
**Team**: 1 backend engineer

---

### Outreach UI
- [ ] "Connect via Email" modal
- [ ] Draft preview
- [ ] Send confirmation
- [ ] Sequence status badges

**Effort**: 1 sprint  
**Team**: 1 frontend engineer

---

## Epic 5: Deliverability (Weeks 10-13)

### Infrastructure
- [ ] Domain setup (SPF, DKIM, DMARC)
- [ ] Mailbox management (create, monitor)
- [ ] Health scoring algorithm
- [ ] Warmup protocol
- [ ] Throttling logic

**Effort**: 2 sprints  
**Team**: 1 DevOps + 1 backend

---

### Admin Dashboard
- [ ] Mailbox grid (health, status, cap)
- [ ] Health detail view
- [ ] Warmup controls
- [ ] Test send feature

**Effort**: 1 sprint  
**Team**: 1 frontend engineer

---

## Epic 6: AI Features (Weeks 14-20)

### Match Scoring (ML)
- [ ] Feature engineering (resume, JD, company data)
- [ ] Model training (XGBoost, user feedback)
- [ ] Inference pipeline (score on demand)
- [ ] Cache scores (Redis, 24h TTL)

**Effort**: 3 sprints  
**Team**: 1 ML engineer

---

### AI Copilot
- [ ] LLM integration (Anthropic, OpenAI)
- [ ] Context assembly (resume, job, page)
- [ ] Streaming UI (real-time response)
- [ ] Preset questions

**Effort**: 2 sprints  
**Team**: 1 full-stack engineer

---

### Draft Generation
- [ ] Prompt engineering (subject, body)
- [ ] Variable substitution
- [ ] "Use Author" regenerate
- [ ] Resume parsing (AI extraction)

**Effort**: 1 sprint  
**Team**: 1 backend engineer

---

## Epic 7: Recruiter Mode (Weeks 20-26)

### Recruiter Features
- [ ] Mode switcher (UI labels change)
- [ ] Bulk import (CSV, 100+ rows)
- [ ] Persona builder
- [ ] Lead assignment (team features)

**Effort**: 2 sprints  
**Team**: 1 full-stack engineer

---

### ATS Integrations
- [ ] Greenhouse OAuth + API
- [ ] Lever OAuth + API
- [ ] Bidirectional sync (jobs, candidates)

**Effort**: 2 sprints (1 sprint per ATS)  
**Team**: 1 backend engineer

---

## Total Effort Summary

| Epic | Sprints | Engineers | Calendar Weeks |
|------|---------|-----------|----------------|
| Foundation | 1.5 | 2 | 3 |
| Job Discovery | 2 | 2 | 4 |
| Tracking | 2.5 | 2 | 5 |
| Enrichment & Outreach | 4 | 2 | 8 |
| Deliverability | 3 | 2 | 6 |
| AI Features | 6 | 2 | 12 |
| Recruiter Mode | 4 | 2 | 8 |
| **Total** | **23 sprints** | **Avg 2** | **46 weeks** |

**Parallel Execution**: With 3-4 engineers, can complete in ~14-16 weeks (4 months).

---

**Document Owner**: Engineering Manager, Scrum Master  
**Version**: 1.0  
**Date**: October 2025

