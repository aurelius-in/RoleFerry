# Technology Stack
## RoleFerry Platform

**Version**: 1.0  
**Last Updated**: October 2025  
**Purpose**: Comprehensive inventory of technologies, libraries, and services

---

## 1. Overview

RoleFerry's technology stack is designed for:
- **Speed**: MVP launch in 3-4 months
- **Scalability**: 10K users → 500K users without major rewrites
- **Cost-efficiency**: $50K/month infrastructure at 10K users
- **Developer productivity**: Modern, well-documented tools

**Architecture Pattern**: Monolithic API (FastAPI) + Celery workers + Next.js frontend

---

## 2. Frontend

### 2.1 Core Framework
| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **Next.js** | 14.2 | React framework (SSR, routing) | Best-in-class DX, SEO-friendly, Vercel deployment |
| **React** | 18.2 | UI library | Industry standard, rich ecosystem |
| **TypeScript** | 5.3 | Type safety | Catch errors at compile time, better IDE support |

### 2.2 UI Components & Styling
| Technology | Version | Purpose |
|------------|---------|---------|
| **TailwindCSS** | 3.4 | Utility-first CSS framework |
| **shadcn/ui** | Latest | Pre-built accessible components (Radix UI-based) |
| **Radix UI** | 1.1 | Unstyled, accessible primitives |
| **Lucide React** | Latest | Icon library (consistent, lightweight) |

### 2.3 State Management
| Technology | Version | Purpose |
|------------|---------|---------|
| **Zustand** | 4.5 | Global state (user, auth, preferences) |
| **React Query** | 5.0 | Server state, caching, refetching |
| **React Hook Form** | 7.5 | Form state & validation |

### 2.4 Data Fetching & API
| Technology | Version | Purpose |
|------------|---------|---------|
| **Axios** | 1.6 | HTTP client (interceptors for auth) |
| **WebSockets** | Native | Real-time updates (Tracker, notifications) |

### 2.5 Validation & Schema
| Technology | Version | Purpose |
|------------|---------|---------|
| **Zod** | 3.22 | Schema validation (forms, API responses) |

### 2.6 Development Tools
| Technology | Version | Purpose |
|------------|---------|---------|
| **ESLint** | 8.5 | Linting (code quality, consistency) |
| **Prettier** | 3.1 | Code formatting |
| **TypeScript ESLint** | 6.10 | TypeScript-specific linting rules |

---

## 3. Backend

### 3.1 Core Framework
| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **FastAPI** | 0.110 | Python web framework | Async-native, auto-docs (OpenAPI), fast |
| **Uvicorn** | 0.27 | ASGI server | Production-grade, async support |
| **Python** | 3.11 | Language | Modern features (match/case, type hints), fast |

### 3.2 Database & ORM
| Technology | Version | Purpose |
|------------|---------|---------|
| **PostgreSQL** | 15.5 | Primary database |
| **SQLAlchemy** | 2.0 | ORM (async support) |
| **Alembic** | 1.13 | Database migrations |
| **asyncpg** | 0.29 | Async PostgreSQL driver |
| **PgBouncer** | 1.21 | Connection pooling |

**PostgreSQL Extensions**:
- `pg_trgm`: Fuzzy text search (job titles, company names)
- `pgcrypto`: Encryption functions
- `uuid-ossp`: UUID generation

### 3.3 Caching & Queues
| Technology | Version | Purpose |
|------------|---------|---------|
| **Redis** | 7.2 | Cache, session store, message broker |
| **redis-py** | 5.0 | Python Redis client |
| **Celery** | 5.3 | Distributed task queue |
| **Flower** | 2.0 | Celery monitoring UI |

### 3.4 Authentication & Security
| Technology | Version | Purpose |
|------------|---------|---------|
| **python-jose** | 3.3 | JWT encoding/decoding |
| **passlib** | 1.7 | Password hashing (bcrypt) |
| **python-multipart** | 0.0.6 | File upload support |
| **cryptography** | 41.0 | Encryption utilities |

### 3.5 Validation & Serialization
| Technology | Version | Purpose |
|------------|---------|---------|
| **Pydantic** | V2 (2.5) | Data validation, settings management |

### 3.6 Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| **Pytest** | 8.0 | Unit & integration testing |
| **pytest-asyncio** | 0.23 | Async test support |
| **pytest-cov** | 4.1 | Code coverage |
| **pytest-mock** | 3.12 | Mocking utilities |
| **Faker** | 22.0 | Generate test data |
| **responses** | 0.24 | Mock HTTP requests |

### 3.7 Development Tools
| Technology | Version | Purpose |
|------------|---------|---------|
| **Black** | 23.12 | Code formatter |
| **isort** | 5.13 | Import sorting |
| **mypy** | 1.8 | Static type checking |
| **Bandit** | 1.7 | Security linting |
| **pre-commit** | 3.6 | Git hooks |

---

## 4. External Services & APIs

### 4.1 Email Infrastructure
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **SendGrid** | Primary email sending | $20/mo (40K emails) |
| **Mailgun** | Secondary/failover | $35/mo (50K emails) |

### 4.2 Enrichment & Contact Data
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **Apollo.io** | Contact discovery, company data | $99/mo (10K credits) |
| **Clay** | Enrichment waterfalls | $349/mo (50K credits) |
| **Hunter.io** | Email finder (fallback) | $49/mo (5K searches) |
| **Snov.io** | Email finder (fallback) | $39/mo (1K credits) |
| **NeverBounce** | Email verification | $0.008/verification |
| **ZeroBounce** | Email verification (fallback) | $0.008/verification |

### 4.3 AI/LLM
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **Anthropic (Claude Sonnet)** | Copilot, draft generation, match scoring | $3/$15 per 1M tokens (input/output) |
| **OpenAI (GPT-4 Turbo)** | Fallback LLM | $10/$30 per 1M tokens |

### 4.4 Payments
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **Stripe** | Subscription billing, payment processing | 2.9% + $0.30 per transaction |

### 4.5 Company Data
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **Clearbit** | Company enrichment | $99/mo (1K lookups) |
| **Crunchbase** | Funding data | Free (public API, rate-limited) |

### 4.6 Job Boards (Scraping/APIs)
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **Apify** | Web scraping (Indeed, LinkedIn) | $49/mo (usage-based) |
| **Greenhouse API** | ATS integration | Free (partner tier) |
| **Lever API** | ATS integration | Free |

---

## 5. Infrastructure & Cloud

### 5.1 Cloud Provider
| Service | Purpose | Estimated Cost (10K users) |
|---------|---------|----------------------------|
| **AWS** | Primary cloud provider | $30K/month |

### 5.2 AWS Services
| Service | Purpose | Instance/Config |
|---------|---------|-----------------|
| **ECS Fargate** | Container orchestration (API, workers) | 5 API tasks (1 vCPU, 2GB), 10 worker tasks |
| **RDS PostgreSQL** | Primary database | db.t4g.large, Multi-AZ, 500GB gp3 |
| **ElastiCache Redis** | Cache & queue | cache.t4g.medium (2 nodes, cluster mode) |
| **S3** | Object storage (resumes, logs) | Standard tier, 1TB storage |
| **CloudFront** | CDN (frontend assets) | 10TB data transfer |
| **ALB** | Load balancer | 1 ALB, 50M LCUs/month |
| **Route 53** | DNS | 10 hosted zones |
| **CloudWatch** | Logs & metrics | 50GB logs, 10 custom metrics |
| **Secrets Manager** | Store API keys, DB passwords | 20 secrets |
| **ECR** | Docker image registry | 50GB storage |

### 5.3 Monitoring & Observability
| Service | Purpose | Cost Model |
|---------|---------|------------|
| **Datadog** | APM, metrics, logs, traces | $31/host/month (10 hosts) = $310/mo |
| **Sentry** | Error tracking | $26/mo (10K errors/month) |
| **PagerDuty** | On-call alerting | $25/user/month (3 users) = $75/mo |

### 5.4 CI/CD
| Service | Purpose | Cost |
|---------|---------|------|
| **GitHub Actions** | CI/CD pipelines | Free (2,000 minutes/month) |

### 5.5 Content Delivery
| Service | Purpose | Cost |
|---------|---------|------|
| **Vercel** | Frontend hosting (alternative to AWS) | $20/mo (Pro tier) |

---

## 6. Development & Collaboration

### 6.1 Version Control
| Tool | Purpose |
|------|---------|
| **Git** | Source control |
| **GitHub** | Repository hosting, code review |

### 6.2 Project Management
| Tool | Purpose |
|------|---------|
| **Linear** | Issue tracking, sprints |
| **Notion** | Documentation, wikis |
| **Figma** | Design (UI/UX) |

### 6.3 Communication
| Tool | Purpose |
|------|---------|
| **Slack** | Team chat |
| **Google Meet** | Video calls |

### 6.4 Security & Secrets
| Tool | Purpose |
|------|---------|
| **1Password** | Password manager (team) |
| **AWS Secrets Manager** | Production secrets |
| **Snyk** | Dependency vulnerability scanning |

---

## 7. Optional/Future Technologies

### 7.1 Mobile (Phase 2)
| Technology | Purpose |
|------------|---------|
| **React Native** | iOS & Android apps |
| **Expo** | React Native toolchain |

### 7.2 Advanced Analytics (Phase 3)
| Technology | Purpose |
|------------|---------|
| **Snowflake** | Data warehouse |
| **dbt** | Data transformation |
| **Looker** | BI dashboards |

### 7.3 Machine Learning (Phase 3)
| Technology | Purpose |
|------------|---------|
| **scikit-learn** | Match scoring model training |
| **MLflow** | ML experiment tracking |
| **AWS SageMaker** | Model hosting |

### 7.4 Real-Time Features (Phase 2)
| Technology | Purpose |
|------------|---------|
| **WebSockets (Socket.io)** | Real-time notifications |
| **Redis Pub/Sub** | Event broadcasting |

---

## 8. Technology Decision Rationale

### 8.1 Why FastAPI (vs. Django/Flask)?
✅ **Pros**:
- Async-native (better concurrency for I/O-heavy workloads)
- Auto-generated OpenAPI docs (saves doc writing time)
- Fast development (Pydantic validation, type hints)
- Modern (active development, growing ecosystem)

❌ **Cons**:
- Smaller ecosystem than Django (no built-in admin panel)
- Less mature (fewer pre-built integrations)

**Decision**: FastAPI's speed and async support outweigh Django's batteries-included approach. We're building custom UIs anyway (no need for Django Admin).

### 8.2 Why PostgreSQL (vs. MongoDB)?
✅ **Pros**:
- ACID guarantees (critical for financial data, sequences)
- Rich indexing (GIN, GIST for JSONB queries)
- JSONB support (flexible schema where needed)
- Mature tooling (PgAdmin, Alembic, SQLAlchemy)

❌ **Cons**:
- Vertical scaling challenges (mitigated with read replicas)

**Decision**: Our data is relational (users → applications → jobs → contacts). PostgreSQL's JSONB gives flexibility without sacrificing ACID.

### 8.3 Why Celery (vs. AWS Lambda)?
✅ **Pros**:
- No cold starts (workers always warm)
- Complex workflows (chains, chords, retries)
- Cost-effective (fixed $200/mo for 10 workers vs. Lambda invocation costs)
- Debuggability (local dev identical to prod)

❌ **Cons**:
- Infrastructure management (need to run workers)
- Scaling requires provisioning (vs. Lambda's auto-scale)

**Decision**: Enrichment jobs are long-running (10-30s), frequent (1K+/day). Lambda's 15-min timeout and cold starts are deal-breakers.

### 8.4 Why Next.js (vs. Vite + React)?
✅ **Pros**:
- SSR out-of-box (better SEO for job listings)
- File-based routing (simpler than React Router)
- API routes (useful for webhooks, proxies)
- Vercel deployment (one-click deploys)

❌ **Cons**:
- Heavier than Vite (more opinionated)
- Vendor lock-in (Vercel-specific features)

**Decision**: SEO matters for organic job search traffic. Next.js SSR + static generation is perfect for job listings.

---

## 9. Cost Breakdown (10K Users, $1M ARR)

| Category | Monthly Cost | Annual Cost |
|----------|-------------|-------------|
| **AWS Infrastructure** | $30,000 | $360,000 |
| **External APIs** | $5,000 | $60,000 |
| **Email Sending** | $2,000 | $24,000 |
| **Monitoring (Datadog, Sentry)** | $400 | $4,800 |
| **LLM APIs (Anthropic, OpenAI)** | $3,000 | $36,000 |
| **Software Licenses** | $500 | $6,000 |
| **Total** | **$40,900** | **$490,800** |

**Gross Margin**: ($1M revenue - $490K COGS) / $1M = **51%**

**Target**: Scale to 50K users, improve margin to 70% (economies of scale on AWS, bulk API discounts).

---

## 10. Technology Risk Assessment

| Technology | Risk | Mitigation |
|------------|------|------------|
| **Anthropic API** | Rate limits, downtime | Fallback to OpenAI; cache frequent prompts |
| **Apollo.io** | Credit limits, accuracy | Multi-provider waterfall (Clay, Hunter); verify emails |
| **SendGrid** | Deliverability issues | Multi-provider (Mailgun fallback); health monitoring |
| **PostgreSQL** | Single point of failure | Multi-AZ RDS, read replicas, automated backups |
| **Celery workers** | Task queue backlog | Auto-scaling (add workers on queue depth); monitoring |

---

## 11. Upgrade Path (Year 2+)

### From Monolith to Microservices (Optional)
**Trigger**: API server >10K RPS, team >20 engineers

**Candidates for extraction**:
1. **Enrichment Service**: High volume, isolated logic
2. **Sequencer Service**: Complex state machine, scales independently
3. **Analytics Service**: Read-heavy, can use separate DB

**Tech**: gRPC for inter-service communication, Kubernetes for orchestration

### Database Sharding
**Trigger**: PostgreSQL >1TB, query latency >500ms

**Strategy**: Shard by `user_id` (hash-based), Citus extension

---

## 12. Acceptance Criteria

- [ ] All technologies listed with versions
- [ ] Cost estimates provided for 10K users
- [ ] Decision rationale documented for major choices
- [ ] Risk assessment completed
- [ ] Alternatives considered and rejected (with reasons)

---

**Document Owner**: CTO, Engineering Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (tech stack evolves rapidly)

