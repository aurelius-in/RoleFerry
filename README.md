# RoleFerry

<p align="center">
  <img src="wordmark.png" alt="RoleFerry" width="60%" />
</p>

<p align="center">
  <img src="roleferry_trans.png" alt="RoleFerry Logo" width="20%" />
  <img src="role_ferry_slow.gif" alt="RoleFerry Animation" width="30%" />
</p>

---

## 🎯 Mission

**Transform job applications from black-hole submissions into direct conversations with decision-makers through intelligent automation and managed infrastructure.**

> When a candidate clicks **Apply**, RoleFerry instantly **finds the right insider contact**, **drafts + sends** an optimized outreach sequence from RoleFerry's warmed infrastructure, and **tracks the pipeline** to hired—no tab‑hopping.

---

## ✨ Key Features

### 🎯 **10-Tab Workflow System**
- **Job Preferences/ICP**: Dynamic labeling (Job Seeker vs Recruiter modes)
- **Resume/Candidate Profile**: AI-powered parsing and data extraction
- **Job Descriptions**: URL import and pain point analysis
- **Pinpoint Match**: Solution-to-challenge alignment scoring
- **Find Contact**: Contact discovery with email verification
- **Context Research**: Auto-pulled company and contact summaries
- **Offer Creation**: Audience-adaptive tone (Recruiter/Manager/Exec)
- **Compose**: Variable substitution with jargon clarity detection
- **Campaign**: 3-email auto-generation with deliverability checks
- **Deliverability/Launch**: Pre-flight checks and send execution

### 🤖 **AI-Powered Intelligence**
- Match scores (0-100) with detailed breakdown (experience, skills, industry)
- Personalized job recommendations based on Intent & Job Preferences (IJP)
- AI-powered email drafting with variable substitution
- Resume extraction for personalized content generation
- Jargon detection and plain-English explanations

### 🔍 **Insider Connection Intelligence**
- Auto-discover hiring managers and recruiters at target companies
- Multi-provider enrichment waterfall (Apollo → Clay → Clearbit)
- Email verification (NeverBounce + MillionVerifier)
- LinkedIn profile discovery with confidence scoring

### 📧 **Managed Deliverability**
- 100+ pre-warmed sending domains (RoleFerry infrastructure)
- Real-time health scoring per mailbox
- Automatic domain rotation and throttling
- Custom tracking domains (CTD) for link safety
- No open-tracker pixels by default (privacy-first)
- Pre-flight checks (spam score, DNS validation, bounce tracking)

### 📊 **Advanced Analytics**
- Alignment score correlation with reply rates
- Cost per qualified lead tracking
- Conversion funnel analysis
- Campaign performance metrics
- A/B testing and variant analysis

### 🤝 **Copilot (Orion-Style)**
- Context-aware AI assistant (persistent right rail)
- Explains match rationale
- Drafts emails on command
- Surfaces insider connections
- Job search strategy coaching

### 👥 **Dual Mode Architecture**
- **Job Seeker Mode**: Find jobs, apply, track interviews
- **Recruiter Mode**: Source candidates, manage outreach, track placements
- Dynamic UI labels and workflow adaptation

---

## 🏗️ Architecture

### Frontend (Next.js 15 + React 19 + Tailwind CSS 4)
- **Modern Stack**: TypeScript, React Server Components, App Router
- **10-Tab Workflow**: Job Preferences, Resume, Job Descriptions, Pinpoint Match, Find Contact, Context Research, Offer Creation, Compose, Campaign, Deliverability/Launch
- **Utility Tabs**: Dashboard, Analytics, Settings, Help
- **Components**: Copilot Panel, Job Cards, Kanban Board, Persona Builder, IJP Wizard, Mode Toggle
- **Responsive**: Mobile-first design, dark + light themes

### Backend (FastAPI + Python 3.11+)
- **APIs**: 100+ endpoints across 35+ routers
- **10-Tab Workflow APIs**: Complete backend support for all workflow tabs
- **Integrations**: Apollo, Clay, SendGrid, Stripe, Anthropic, Apify, NeverBounce, MillionVerifier
- **AI Services**: Jargon detection, email verification, content generation
- **Database**: PostgreSQL (with migrations)
- **Queue**: Celery + Redis (background jobs)
- **Caching**: Redis (match scores, enrichment data)

### Infrastructure (AWS + Terraform)
- **Compute**: ECS Fargate (API + Workers)
- **Database**: RDS PostgreSQL with read replicas
- **Cache**: ElastiCache Redis
- **Storage**: S3 (resumes, exports)
- **Email**: SendGrid + AWS SES (fallback)
- **Monitoring**: Datadog APM, CloudWatch

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional)

### 1. Clone Repository
```bash
git clone https://github.com/aurelius-in/RoleFerry.git
cd RoleFerry
```

### 2. Backend Setup
```bash
cd backend
cp ../.env.example .env  # Configure API keys
pip install -r requirements.txt
python -m app  # Runs migrations + starts FastAPI on :8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev  # Starts Next.js on :3000
```

### 4. Access Application
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Demo**: Open `docs/index.html` in browser (no server needed)

---

## 📚 Documentation

Comprehensive enterprise-grade documentation (100+ documents, 40,000+ lines):

### Strategic Planning (11 docs)
- [Executive Summary](docs/01-strategic/executive-summary.md)
- [Product Vision](docs/01-strategic/product-vision.md)
- [Product Roadmap](docs/01-strategic/product-roadmap.md)
- [Exit Strategy](docs/01-strategic/exit-strategy.md)
- [Vision, Mission & Values](docs/01-strategic/vision-mission-values.md)

### Requirements (12 docs)
- [Functional Requirements](docs/02-requirements/functional-requirements.md)
- [User Stories](docs/02-requirements/user-stories.md) (50+ stories)
- [Use Cases](docs/02-requirements/use-cases.md) (30+ cases)
- [IJP Wizard Flow](docs/02-requirements/user-flows.md)

### Architecture (12 docs - RM-ODP 3-Layer)
- [System Architecture](docs/03-architecture/) (Conceptual, Logical, Implementable)
- [Data Architecture](docs/03-architecture/) (ER diagrams, schemas)
- [Security Architecture](docs/03-architecture/) (Auth, encryption, compliance)
- [Integration Architecture](docs/03-architecture/) (API contracts, webhooks)

### Technical (20 docs)
- [API Specification](docs/04-technical/api-specification.md)
- [Database Schema](docs/04-technical/database-schema.md)
- [Email Infrastructure Guide](docs/04-technical/email-infrastructure-guide.md)
- [Performance Optimization](docs/04-technical/performance-optimization.md)
- [CI/CD Pipeline](docs/04-technical/cicd-pipeline.md)

### UX Design (9 docs)
- [Design System](docs/05-ux-design/design-system.md)
- [UI Specifications](docs/05-ux-design/ui-specifications.md)
- [User Journey Maps](docs/05-ux-design/user-journey-maps.md)
- [Onboarding Flow](docs/05-ux-design/onboarding-flow.md)
- [Accessibility Guide](docs/05-ux-design/accessibility-guide.md) (WCAG 2.1 AA)

### Operations (17 docs)
- [Deployment Guide](docs/06-operations/deployment-guide.md)
- [Monitoring & Alerting](docs/06-operations/monitoring-alerting.md)
- [Incident Response](docs/06-operations/incident-response-plan.md)
- [Disaster Recovery](docs/06-operations/disaster-recovery-plan.md)
- [Scaling Guide](docs/06-operations/scaling-guide.md)

### Compliance (7 docs)
- [GDPR Compliance](docs/07-compliance/gdpr-compliance-guide.md)
- [Privacy Policy](docs/07-compliance/privacy-policy.md)
- [Terms of Service](docs/07-compliance/terms-of-service.md)
- [Acceptable Use Policy](docs/07-compliance/acceptable-use-policy.md)

### Business (23 docs)
- [Go-to-Market Plan](docs/08-business/go-to-market-plan.md)
- [Pricing Strategy](docs/08-business/pricing-strategy.md)
- [Competitive Analysis](docs/08-business/competitive-analysis.md)
- [Fundraising Deck Outline](docs/08-business/fundraising-deck-outline.md)
- [Unit Economics](docs/08-business/unit-economics.md)

---

## 🎨 Product Differentiators

### vs. LinkedIn Recruiter
- ✅ **95% cheaper** ($1,788/year vs. $8,000/seat)
- ✅ **Email-first** (15%+ reply rate vs. 3-5% InMail)
- ✅ **Managed deliverability** (we handle warmed domains)

### vs. Simplify/Huntr (Job Trackers)
- ✅ **Active, not passive** (auto-finds contacts, sends emails)
- ✅ **AI-powered** (match scoring, draft generation)
- ✅ **Complete automation** (apply → contact → send in one click)

### vs. Apollo (Sales Tool)
- ✅ **Recruiting-specific** UX (not sales-focused)
- ✅ **Managed infrastructure** (you don't need your own domains)
- ✅ **AI drafting** built-in (not just templates)

### vs. Clay (Enrichment)
- ✅ **End-to-end workflow** (not just enrichment)
- ✅ **Job search optimized** (persona filters for hiring managers)
- ✅ **Affordable for individuals** ($49/mo vs. $349/mo)

---

## 🔧 Technology Stack

**Frontend:**
- Next.js 15 (React 19, TypeScript)
- Tailwind CSS 4 (utility-first styling)
- React Query (state management)
- Framer Motion (animations)

**Backend:**
- FastAPI (Python async framework)
- PostgreSQL (relational database)
- Redis (caching + queues)
- Celery (background jobs)
- SQLAlchemy (ORM)

**AI/ML:**
- Anthropic Claude Sonnet (long-context drafting)
- OpenAI GPT-4 (fallback)
- Custom match scoring algorithm

**Integrations:**
- Apollo + Clay (contact enrichment)
- SendGrid + AWS SES (email delivery)
- NeverBounce + MillionVerifier (email verification)
- Stripe (payments)
- Clearbit (company data)

**Infrastructure:**
- AWS (ECS, RDS, ElastiCache, S3, CloudFront)
- Terraform (infrastructure as code)
- GitHub Actions (CI/CD)
- Datadog (monitoring + APM)

---

## 📊 Performance

- **API Latency**: P95 <500ms
- **Match Score**: <100ms (cached)
- **Enrichment**: <30s (Apollo + Clay waterfall)
- **Email Send**: <5min (queued, throttled)
- **Page Load**: <2s (FCP)

---

## 🔐 Security & Compliance

- **GDPR Compliant**: 90-day data retention, self-service deletion
- **SOC 2 Type II**: Audit-ready (policies + procedures documented)
- **CAN-SPAM**: Auto opt-out, no open tracking by default
- **Encryption**: At-rest (AES-256), in-transit (TLS 1.3)
- **Authentication**: JWT-based, refresh tokens, MFA support

---

## 📈 Pricing

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | 10 applications/month, basic matching |
| **Pro** | $49/mo | Unlimited applications, AI Copilot, 500 enrichment credits, LivePages |
| **Teams** | $149/seat | All Pro features, personas, team collaboration, priority support |
| **Enterprise** | Custom | White-label, API access, SLA, dedicated support |

---

## 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines.

---

## 📄 License

Copyright © 2025 Reliable AI Network, Inc. All rights reserved.

See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

RoleFerry is inspired by best practices from leading platforms in job search, recruiting, and sales automation. We've blended UI patterns from industry leaders with our unique differentiators: click-to-contact intelligence, Author + Sequencer, and deliverability handled by our own domains.

---

## 📞 Contact

- **Website**: https://roleferry.com
- **Support**: hello@roleferry.com
- **Sales**: hello@roleferry.com
- **GitHub**: https://github.com/aurelius-in/RoleFerry

---

<p align="center">
  <strong>Smooth crossing in rough seas.</strong> 🌊⛴️
</p>
