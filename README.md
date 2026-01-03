# RoleFerry

<p align="center">
  <img src="wordmark.png" alt="RoleFerry" width="60%" />
</p>

<p align="center">
  <img src="roleferry_trans.png" alt="RoleFerry Logo" width="20%" />
  <img src="role_ferry_slow.gif" alt="RoleFerry Animation" width="30%" />
</p>

---

## 🚀 Try RoleFerry

- **Website**: https://roleferry.com
- **Beta release target**: **Feb 14, 2026 (Valentine’s Day)**
- **Beta pricing window**: **Free until Mar 14, 2026** (see Pricing)

---

## 🎯 Mission

**Transform job applications from black-hole submissions into direct conversations with decision-makers through an end-to-end workflow: preferences → proof → targeting → outreach → launch.**

---

## ✨ What RoleFerry Does (in plain English)

RoleFerry is a **workflow app** for job seekers (and recruiter mode) that helps you:

- **Turn a job description into a targeted message** (with the right angle, not generic fluff)
- **Find the right insider contact** (recruiter/hiring manager) and route them into your pipeline
- **Generate and refine outreach sequences** with variable safety + clarity checks
- **Run deliverability “pre-flight” checks** before you send
- **Track what happened** so the workflow stays repeatable

---

## 🎯 12-Tab Workflow

RoleFerry is organized as a **12-tab journey** (matching the in-app navigation):

- **Dashboard**
- **Job Prefs (ICP)**
- **Resume**
- **Jobs (Job Descriptions)**
- **Gaps (Gap Analysis)**
- **Match (Pain Point Match)**
- **Contact (Find Contact)**
- **Research (Context Research)**
- **Offer (Offer Creation)**
- **Compose**
- **Campaign**
- **Launch (Deliverability / Launch)**

Utilities like **Analytics**, **Tracker**, **Settings**, and **Help** support the workflow but aren’t treated as “steps”.

---

## 🏗️ Architecture (Current)

### Frontend
- **Next.js 15 + React 19 + TypeScript**
- **Tailwind CSS 4**
- App Router, modern layout/navigation, demo vs live data modes

### Backend
- **FastAPI** + **Pydantic v2**
- **PostgreSQL** (SQL migrations in `backend/app/migrations/`)
- **SQLAlchemy**
- **Redis** (cache/state where needed)
- **OpenAI-backed LLM mode** + deterministic/stub mode for safe demos
- **Prometheus metrics** (`prometheus-client`)

### Deployment
- **Primary beta path**: Dockerized services deployed on **Railway**
- **Reference docs**: AWS/Terraform materials exist in-repo, but Railway is the primary beta flow today

---

## 📚 Documentation (current entrypoints)

The documentation set is large and evolving. The most useful starting points right now:

- **Docs homepage**: `docs/home.html`
- **Docs index**: `docs/README.md`
- **Docs navigation map**: `docs/NAVIGATION.md`
- **LLM-connected demo runbook**: `DEMO_RUNBOOK.md`
- **Developer quickstart**: `DEVELOPMENT.md`
- **Deployment reference**: `DEPLOYMENT.md`

---

## 🎨 Product Differentiators (and who only does part of it)

RoleFerry’s core differentiator is **workflow integration**: it turns “a pile of tools” into a repeatable pipeline.

### Partial competitors (examples)
- **Job tracking only**: Teal, Huntr, Simplify  
  Great trackers, but they don’t complete insider discovery → research → outreach → launch checks.
- **Resume/ATS optimization only**: Jobscan  
  Improves materials, but doesn’t execute outbound outreach or pipeline tracking.
- **Enrichment only**: Apollo, Clay, Clearbit  
  Great data, but not a job-search workflow with copy + campaign launch controls.
- **Sequencing only**: Instantly, Smartlead, Lemlist  
  Great for sends, but they don’t build the job-side context (JDs → angles → offer → copy).
- **Warmup/deliverability only**: Mailreach, Warmbox, Lemwarm  
  Solves deliverability primitives, not the end-to-end job workflow.
- **Copilot-only assistants**: Orion-style copilots  
  Helpful drafting aids, but not a full workflow system with launch checks + tracking.

### Concrete “RoleFerry” examples
- **From a JD URL → outbound-ready campaign**:
  import JD → gap analysis → pain-point match → find contact → research → offer → compose → campaign → launch checks
- **From “I want these roles” → consistent weekly output**:
  define Job Prefs/ICP → shortlist targets → generate message angles → run sequences → track outcomes → iterate

---

## 📈 Pricing (Beta + Post-Beta)

### Beta
- **Free** through **Mar 14, 2026**

### After beta (effective Mar 15, 2026)
- **Core App**: **$99/month**
- **Usage**: **$1 per lead** (e.g., per verified/enriched contact you push through the campaign workflow)

### Workflow-aligned upsells (not random add-ons)
- **Live coaching + app**: weekly reviews of Job Prefs, positioning, offers, and outreach
- **Deliverability add-on**: domains/DNS/sending posture support for high-volume outreach
- **Recruiter/teams**: collaboration + reporting (pricing varies)

> Example: 200 leads/month → $99 + $200 = **$299/month**

---

## 📊 Performance (how we think about it)

- **Fast UX by default**: Next.js static output where possible + app-router layouts
- **Caching where it matters**: Redis-backed hot paths and repeated computations
- **Safe sending**: pre-flight checks + throttling guidance to reduce deliverability risk

---

## 🔐 Security & Compliance

- **GDPR Compliant**: retention + deletion flows
- **CAN-SPAM**: opt-out support, no open tracking by default
- **Encryption**: in-transit TLS, at-rest encryption where supported
- **Authentication**: JWT-based sessions

---

## 🤝 Contributing

- Contribution guidelines: `docs/CONTRIBUTING.md`
- Local dev: `DEVELOPMENT.md`

---

## 📄 License

Copyright © 2025–2026 Reliable AI Network, Inc. All rights reserved.

See [LICENSE](LICENSE) for details.

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

