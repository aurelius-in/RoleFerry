# Glossary
## RoleFerry Platform Terminology

**Purpose**: Define technical terms, acronyms, and platform-specific concepts  
**Audience**: All stakeholders

---

## A

**Acceptance Criteria (AC)**: Conditions that must be met for a feature to be considered complete.

**API (Application Programming Interface)**: Interface for programmatic access to RoleFerry services.

**Application**: Record of a job seeker applying to a job OR recruiter contacting a candidate (context-dependent).

**ARPU (Average Revenue Per User)**: Total revenue / total users.

**ATS (Applicant Tracking System)**: Software used by companies to manage hiring pipeline (e.g., Greenhouse, Lever).

**AWS (Amazon Web Services)**: Cloud infrastructure provider (primary hosting).

---

## B

**Bounce**: Email delivery failure (hard bounce = permanent, soft bounce = temporary).

**Bounce Rate**: % of sent emails that bounce.

---

## C

**CAC (Customer Acquisition Cost)**: Total marketing/sales spend / new users acquired.

**CAN-SPAM**: US law regulating commercial email (requires opt-out, physical address, honest subject lines).

**CCPA (California Consumer Privacy Act)**: CA privacy law (right to know, delete, opt-out of sale).

**Celery**: Distributed task queue for background jobs (Python).

**Churn Rate**: % of users who cancel subscription per month.

**Copilot**: AI assistant (context-aware Q&A, draft generation).

**CTD (Custom Tracking Domain)**: User-owned domain for link rewriting (e.g., click.mycompany.com).

---

## D

**DAU (Daily Active Users)**: Unique users active in a given day.

**Deliverability**: Ability to land emails in inbox (not spam folder).

**Domain Warmup**: Gradual increase in email volume to build sender reputation.

**DPO (Data Protection Officer)**: GDPR-required role for data privacy oversight.

---

## E

**Enrichment**: Process of finding contact data (company domain → people → emails → verification).

**ECS (Elastic Container Service)**: AWS container orchestration (runs API servers, workers).

---

## F

**Freemium**: Business model with free tier + paid upgrades.

---

## G

**GDPR (General Data Protection Regulation)**: EU privacy law (strict data protection, user rights).

**Gross Margin**: (Revenue - COGS) / Revenue (target: 70%+).

---

## H

**Health Score**: 0-100 metric for mailbox deliverability (based on bounces, spam reports).

---

## I

**IAM (Identity and Access Management)**: AWS service for user/role permissions.

**IJP (Intent & Job Preferences)**: User's job search criteria (role, location, salary, etc.).

**Inbox Placement**: % of emails reaching inbox (vs. spam folder).

---

## J

**JD (Job Description)**: Text describing job responsibilities, requirements.

---

## K

**Kanban**: Board view with columns for pipeline stages (Saved, Applied, Interviewing, etc.).

**K-factor**: Viral coefficient (avg # of users each user refers).

**KPI (Key Performance Indicator)**: Metric used to measure success.

---

## L

**Lead**: Recruiter-mode equivalent of Application (candidate being contacted).

**LLM (Large Language Model)**: AI model for text generation (Anthropic Claude, OpenAI GPT).

**LivePage**: Personalized landing page for email recipients (video, calendar link, metrics).

**LTV (Lifetime Value)**: Total revenue from a user over their lifetime.

**LTV:CAC**: Ratio of lifetime value to customer acquisition cost (target: >3:1).

---

## M

**MAU (Monthly Active Users)**: Unique users active in a given month.

**Match Score**: 0-100 metric for job-to-user fit (experience, skills, industry).

**MFA (Multi-Factor Authentication)**: Additional security layer beyond password (e.g., TOTP).

**MRR (Monthly Recurring Revenue)**: Sum of all monthly subscription revenue.

**MTTR (Mean Time To Resolve)**: Average time from incident detection to resolution.

---

## N

**NFR (Non-Functional Requirement)**: Quality attribute (performance, security, usability).

**NPS (Net Promoter Score)**: Customer satisfaction metric (-100 to +100).

---

## O

**OAuth**: Open standard for access delegation (e.g., "Sign in with Google").

**ORM (Object-Relational Mapping)**: SQLAlchemy (maps Python objects to database tables).

**Outreach**: Individual email send event.

---

## P

**PAI (Publicly Available Information)**: Contact data from public sources (LinkedIn, company websites).

**Persona**: Saved filter set for contact discovery (e.g., "VP Engineering at Series B SaaS").

**PII (Personally Identifiable Information)**: Data that identifies an individual (name, email, resume).

**PagerDuty**: On-call alerting service.

---

## Q

**QPS (Queries Per Second)**: Database or API request rate.

---

## R

**RDS (Relational Database Service)**: AWS managed PostgreSQL.

**Redis**: In-memory data store (cache, queue, sessions).

**Reply Rate**: % of delivered emails that get replies (target: 15%+).

**Residual Risk**: Risk remaining after mitigations applied.

**RM-ODP (Reference Model of Open Distributed Processing)**: ISO standard for architecture documentation (conceptual, logical, implementable layers).

**RPO (Recovery Point Objective)**: Max acceptable data loss (target: 15 min).

**RTO (Recovery Time Objective)**: Max acceptable downtime (target: 1 hour).

---

## S

**SAM (Serviceable Addressable Market)**: Portion of TAM you can realistically target.

**Sequence**: Multi-step email campaign (Step 1 → delay → Step 2 → delay → Step 3).

**SOC 2 Type II**: Security/privacy certification for SaaS companies.

**SOM (Serviceable Obtainable Market)**: Portion of SAM you can capture (target: 1% TAM).

**SPF (Sender Policy Framework)**: DNS record authorizing email senders.

**SQL Injection**: Attack injecting malicious SQL via inputs.

**SSO (Single Sign-On)**: Enterprise auth (Okta, Azure AD).

---

## T

**TAM (Total Addressable Market)**: Total revenue opportunity (RoleFerry: $45B).

**Tracker**: Dashboard showing application pipeline (Kanban or Table view).

**TTL (Time To Live)**: How long data is cached/retained.

---

## U

**UAT (User Acceptance Testing)**: Beta users validate features before launch.

**Use Case**: Scenario describing user-system interaction (actor, flow, outcome).

**User Story**: Requirement format ("As a [user], I want [feature], so that [benefit]").

---

## V

**VPC (Virtual Private Cloud)**: Isolated network in AWS.

---

## W

**WAF (Web Application Firewall)**: Security layer blocking malicious traffic (SQL injection, DDoS).

**Webhook**: HTTP callback (external service → RoleFerry when event occurs).

---

## X

**XSS (Cross-Site Scripting)**: Attack injecting malicious scripts into web pages.

---

## Platform-Specific Terms

**Apply**: One-click action creating application + triggering enrichment + sending outreach.

**Author**: AI system that generates email drafts from resume + JD.

**Board View**: Kanban-style tracker (columns = pipeline stages).

**Enrichment Job**: Background task finding contacts for an application.

**Find Connections**: Feature discovering hiring managers/HR at target company.

**Insider Connection**: Contact at target company (hiring manager, dept head, HR).

**Mailbox**: Email account used for sending (e.g., auto1@rf-send-01.com).

**Sequencer**: System automating multi-step email campaigns.

**Stop-on-Reply**: Automatically cancel remaining sequence steps when recipient replies.

**Table View**: Spreadsheet-style tracker (rows = applications, columns = fields).

**Warmup**: Process of gradually increasing email volume to build sender reputation.

---

## Acronyms Quick Reference

| Acronym | Full Term |
|---------|-----------|
| **AC** | Acceptance Criteria |
| **API** | Application Programming Interface |
| **ARR** | Annual Recurring Revenue |
| **ATS** | Applicant Tracking System |
| **AWS** | Amazon Web Services |
| **CAC** | Customer Acquisition Cost |
| **CDN** | Content Delivery Network |
| **CRM** | Customer Relationship Management |
| **CSAT** | Customer Satisfaction Score |
| **CTD** | Custom Tracking Domain |
| **DAU** | Daily Active Users |
| **DDoS** | Distributed Denial of Service |
| **DKIM** | DomainKeys Identified Mail |
| **DMARC** | Domain-based Message Authentication |
| **DR** | Disaster Recovery |
| **ECS** | Elastic Container Service |
| **GDPR** | General Data Protection Regulation |
| **IAM** | Identity and Access Management |
| **IJP** | Intent & Job Preferences |
| **JD** | Job Description |
| **JWT** | JSON Web Token |
| **KPI** | Key Performance Indicator |
| **LLM** | Large Language Model |
| **LTV** | Lifetime Value |
| **MAU** | Monthly Active Users |
| **MFA** | Multi-Factor Authentication |
| **MRR** | Monthly Recurring Revenue |
| **MTTR** | Mean Time To Resolve |
| **NFR** | Non-Functional Requirement |
| **NPS** | Net Promoter Score |
| **ORM** | Object-Relational Mapping |
| **PAI** | Publicly Available Information |
| **PII** | Personally Identifiable Information |
| **RDS** | Relational Database Service |
| **RM-ODP** | Reference Model of Open Distributed Processing |
| **RPO** | Recovery Point Objective |
| **RTO** | Recovery Time Objective |
| **S3** | Simple Storage Service (AWS) |
| **SAM** | Serviceable Addressable Market |
| **SLA** | Service Level Agreement |
| **SOM** | Serviceable Obtainable Market |
| **SPF** | Sender Policy Framework |
| **SQL** | Structured Query Language |
| **SRE** | Site Reliability Engineering |
| **SSO** | Single Sign-On |
| **TAM** | Total Addressable Market |
| **TLS** | Transport Layer Security |
| **TTL** | Time To Live |
| **UAT** | User Acceptance Testing |
| **VPC** | Virtual Private Cloud |
| **WAF** | Web Application Firewall |
| **XSS** | Cross-Site Scripting |

---

**Document Owner**: Documentation Team  
**Version**: 1.0  
**Date**: October 2025  
**Contributions**: Submit additions via PR

