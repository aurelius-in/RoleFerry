# Data Architecture: Conceptual Level
## RoleFerry Platform

**RM-ODP Viewpoints**: Information, Enterprise (Conceptual)  
**Audience**: Business Analysts, Product Managers, Data Stakeholders  
**Purpose**: Business understanding of data structures and flows

---

## 1. Information Model Overview

### 1.1 Core Business Entities

RoleFerry's data model centers around the **Application** lifecycle—connecting **Users** (job seekers or recruiters) with **Jobs**, discovering **Contacts** at **Companies**, and tracking **Outreach** sequences through **Deliverability infrastructure**.

```
┌─────────────────────────────────────────────────────────────┐
│                     ROLEFERRY DATA DOMAINS                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User Domain │────▶│ Job Domain   │────▶│Pipeline Domain│
│              │     │              │     │              │
│  - Users     │     │  - Jobs      │     │- Applications│
│  - Resumes   │     │  - Companies │     │- Outreach    │
│  - IJP       │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │Contact Domain│
                     │              │
                     │  - Contacts  │
                     │  - Enrichment│
                     └──────────────┘
                             │
                             ▼
                     ┌──────────────┐
                     │Infra Domain  │
                     │              │
                     │  - Mailboxes │
                     │  - Health    │
                     └──────────────┘
```

### 1.2 Entity Relationships (Business View)

#### User ↔ Profile Data
- **User** HAS ONE **Resume** (parsed into structured extract)
- **User** HAS ONE **Job Preferences** (IJP: values, role, location, etc.)
- **User** CREATES MANY **Applications** or **Leads** (depending on mode)

**Business Rule**: User must complete IJP before seeing matched jobs.

#### Job ↔ Company
- **Job** BELONGS TO ONE **Company**
- **Company** HAS MANY **Jobs** (open positions)
- **Company** HAS MANY **Contacts** (employees, enriched dynamically)

**Business Rule**: Company domain is unique key; enrichment cached 30 days.

#### Application ↔ Outreach
- **Application** TRIGGERS MANY **Outreach** events (emails to contacts)
- **Outreach** TARGETS ONE **Contact**
- **Outreach** FOLLOWS ONE **Sequence** (multi-step template)

**Business Rule**: Sequence stops when contact replies OR max steps reached.

#### Deliverability Infrastructure
- **Outreach** SENDS FROM ONE **Mailbox**
- **Mailbox** HAS **Health Score** (calculated from bounces, spam reports)
- **Mailbox** ENFORCES **Daily Cap** (throttling)

**Business Rule**: Emails only send from mailboxes with health >70 and under cap.

---

## 2. Data Domains

### 2.1 User Domain

#### Purpose
Store user identity, authentication, preferences, and resume data.

#### Key Entities
- **User**: Account holder (job seeker or recruiter)
- **Resume**: Structured extract of candidate background
- **Job Preferences (IJP)**: Filters for job matching

#### Lifecycle
1. User signs up → Profile created
2. User uploads resume → Resume parsed (AI extraction)
3. User completes IJP wizard → Preferences saved
4. Preferences updated → Match scores recalculated

#### Data Ownership
- **User owns their data**: Can export (CSV), delete (GDPR), update anytime
- **Resume privacy**: Not shared with employers unless explicitly sent in outreach

---

### 2.2 Job Domain

#### Purpose
Catalog of available positions and employer information.

#### Key Entities
- **Job**: Open position (title, JD, location, comp, etc.)
- **Company**: Employer organization (name, domain, industry, size)

#### Data Sources
- **Job boards**: Indeed, LinkedIn, Greenhouse, Lever (scraped or API)
- **User submissions**: Manual job entry
- **Enrichment**: Clearbit, Crunchbase (company metadata)

#### Lifecycle
1. Job scraped/imported → Stored with external_id (deduplication)
2. Company domain enriched → Logo, size, industry cached
3. Job matched to users → Match scores calculated
4. Job expires (90 days old) → Archived (not deleted, for analytics)

#### Data Quality
- **Deduplication**: External_id prevents duplicate jobs
- **Freshness**: Jobs older than 90 days flagged as stale
- **Enrichment accuracy**: Company data refreshed every 30 days

---

### 2.3 Pipeline Domain

#### Purpose
Track application status and outreach activity.

#### Key Entities
- **Application** (job seeker) / **Lead** (recruiter): Pipeline record
- **Outreach**: Individual email send event
- **Sequence**: Email campaign template (multi-step)

#### Lifecycle (Job Seeker)
1. User clicks Apply → Application created (status: Applied)
2. Enrichment finds contacts → Contacts linked to application
3. Sequence starts → Outreach events created (queued → sent → delivered)
4. Contact replies → Sequence stops, status → Interviewing
5. Interview scheduled → Date logged, status → Interviewing
6. Offer received → Status → Offer
7. Accepted/rejected → Status → Won/Lost

#### Lifecycle (Recruiter)
1. Recruiter imports leads → Lead records created
2. Enrichment verifies emails → Contacts enriched
3. Sequence launches → Outreach queued
4. Candidate replies → Lead moves to Contacted
5. Call scheduled → Lead moves to Appointments
6. Offer extended → Lead moves to Offers
7. Candidate accepts → Won; declines → Lost

#### Business Metrics
- **Reply rate**: Replied outreach / Total delivered
- **Time-to-interview**: Days from Applied to first interview
- **Sequence effectiveness**: Compare reply rates across templates

---

### 2.4 Contact Domain

#### Purpose
Store enriched contact data (names, emails, titles at companies).

#### Key Entities
- **Contact**: Individual person (name, title, email, LinkedIn)
- **Enrichment Source**: Apollo, Clay, Hunter (provenance tracking)

#### Data Sensitivity
- **PII**: Contact data is PII (names, emails)
- **Source attribution**: Always display where contact was found
- **Suppression**: Contacts who opt out → never contact again
- **TTL**: Contacts auto-deleted 90 days after last outreach (GDPR minimization)

#### Verification
- **Email confidence**: 0.0-1.0 score from NeverBounce/ZeroBounce
- **Bounce tracking**: >3 bounces → contact marked invalid
- **Spam reports**: 1 spam report → immediate suppression

---

### 2.5 Deliverability Domain

#### Purpose
Manage sending infrastructure health and reputation.

#### Key Entities
- **Mailbox**: Email account (e.g., auto1@rf-send-01.com)
- **Domain**: Root domain (e.g., rf-send-01.com)
- **Health Score**: 0-100 (calculated from send behavior)

#### Health Scoring Factors
- **Bounce rate**: <3% = good, >10% = critical
- **Spam reports**: Each report = -20 points
- **Engagement**: Opens/clicks (if tracked) = bonus points
- **Warmup age**: 30+ days = +10 points

#### Throttling Rules
- **Daily cap**: 50 emails/mailbox/day (ISP best practice)
- **Gradual warmup**: New domains start at 5/day, increase 5%/day
- **Pause on degradation**: Health <50 → auto-pause

#### Rotation Strategy
- **Round-robin**: Distribute sends evenly across healthy mailboxes
- **Exclude paused**: Domains in warmup/degraded excluded from pool
- **Load balancing**: If one domain hits cap, spill to next

---

## 3. Data Flows

### 3.1 Enrichment Flow

```
User Action: Click "Apply" on Job
  ↓
Application Record Created
  ↓
Enrichment Job Queued (Celery)
  ↓
┌─────────────────────────────────────────┐
│ Step 1: Company Domain Lookup           │
│  - Input: Company name                  │
│  - Output: Domain (e.g., acme.com)      │
│  - Sources: Clearbit → Google fallback  │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 2: Find People at Company          │
│  - Input: Domain + Persona filters      │
│  - Output: 10-20 profiles               │
│  - Sources: Apollo → Clay fallback      │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 3: Discover Work Emails            │
│  - Input: Name + Domain                 │
│  - Output: Email addresses              │
│  - Sources: Apollo → Hunter → Snov.io   │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 4: Email Verification              │
│  - Input: Email addresses               │
│  - Output: Valid/Risky/Invalid status   │
│  - Sources: NeverBounce, ZeroBounce     │
└─────────────────────────────────────────┘
  ↓
Top 3 Verified Contacts Saved
  ↓
Sequence Triggered
```

**Data Persisted**:
- Company domain (cached 30 days)
- Contacts (stored until 90 days post-outreach)
- Enrichment source (audit trail: "Found via Apollo")

**Data NOT Persisted**:
- Intermediate API responses (unless debugging enabled)
- Unverified emails (discarded if confidence <70%)

---

### 3.2 Outreach Send Flow

```
Sequence Started
  ↓
Outreach Records Created (one per contact × step)
  ↓
Worker Picks Up Queued Outreach
  ↓
┌─────────────────────────────────────────┐
│ Select Mailbox                          │
│  - Criteria: Health >70, Sent < Cap    │
│  - Method: Round-robin                  │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Substitute Variables                    │
│  - {{first_name}} → Contact.first_name │
│  - {{company}} → Company.name           │
│  - {{role}} → Job.title                 │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Rewrite Links (Custom Tracking Domain) │
│  - linkedin.com/in/X → click.rf.io/abc │
└─────────────────────────────────────────┘
  ↓
Send via Email Service (SendGrid/Mailgun)
  ↓
Update Outreach Status: Queued → Sent
  ↓
Increment Mailbox.sent_today
  ↓
Schedule Next Step (if multi-step sequence)
```

**Data Updated**:
- Outreach.status: queued → sent → delivered (via webhook)
- Outreach.sent_at, delivered_at (timestamps)
- Mailbox.sent_today (daily counter, resets at midnight UTC)

---

### 3.3 Reply Detection Flow

```
Email Service Receives Reply
  ↓
Webhook POST to /webhooks/email
  ↓
┌─────────────────────────────────────────┐
│ Match Reply to Outreach Record          │
│  - Input: from_email, to_mailbox        │
│  - Output: Outreach record              │
│  - Method: Query by mailbox + contact   │
└─────────────────────────────────────────┘
  ↓
Outreach.status → Replied
  ↓
┌─────────────────────────────────────────┐
│ Stop Sequence                           │
│  - Cancel future Outreach (queued)      │
│  - Same contact, same application       │
└─────────────────────────────────────────┘
  ↓
Update Application Status
  - Applied → Interviewing (if positive reply)
  ↓
Push Notification to User
```

**Data Updated**:
- Outreach.replied_at
- Outreach.status → replied
- Future Outreach.status → canceled
- Application.status → interviewing
- Application.reply_status → replied

---

## 4. Data Lifecycle Policies

### 4.1 Retention Policies

| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| User accounts | Indefinite (until user deletes) | User owns data |
| Applications/Leads | Indefinite | Pipeline history; exportable by user |
| Contacts (enriched) | 90 days post-last-outreach | GDPR minimization; re-enrich if needed |
| Outreach events | 2 years | Analytics, deliverability forensics |
| Email content (body) | 90 days | Debugging; then purged |
| Health logs (bounces) | 1 year | Trend analysis |
| Audit logs | 7 years | Compliance (SOC 2, legal) |

### 4.2 Deletion Workflows

#### User-Initiated Deletion (GDPR "Right to be Forgotten")
1. User clicks "Delete Account" in Settings
2. System:
   - Stops all active sequences
   - Deletes PII: name, email, resume, notes
   - Anonymizes Applications (user_id → NULL, retains for stats)
   - Deletes Contacts discovered for user's applications
   - Retains aggregated metrics (no PII)
3. Confirmation: "Your data has been deleted within 30 days"

#### Automated Data Expiry
- **Contacts**: Cron job (daily) deletes contacts >90 days since last outreach
- **Email bodies**: Cron job (weekly) purges bodies >90 days old
- **Stale jobs**: Archive jobs >90 days old (move to cold storage)

---

## 5. Data Quality & Governance

### 5.1 Data Quality Dimensions

#### Accuracy
- **Contacts**: Multi-provider waterfall improves email accuracy (85%+ verified)
- **Match scores**: ML model retrained monthly on user feedback (thumbs up/down)
- **Company data**: Refreshed every 30 days (Clearbit/Crunchbase)

#### Completeness
- **Required fields enforced**: User.email, Job.title, Company.domain
- **Enrichment coverage**: Target 80%+ jobs have company domain
- **Contact coverage**: Target 70%+ applications find 1+ verified contact

#### Consistency
- **Deduplication**: Companies matched by domain (case-insensitive)
- **Normalization**: Phone numbers, URLs (strip protocols), titles (lowercase)

#### Timeliness
- **Job freshness**: Flag jobs >90 days old
- **Enrichment staleness**: Re-enrich companies >30 days old
- **Health scores**: Calculated every 6 hours

### 5.2 Data Ownership

| Domain | Owner | Consumers | Access Control |
|--------|-------|-----------|----------------|
| Users | User (self-service) | API, Copilot | User can view/edit own; admins read-only |
| Jobs | Platform (scraped) | All users (filtered by IJP) | Public within platform |
| Contacts | Platform (enriched) | User who triggered enrichment | Isolated per application |
| Outreach | User + Platform | User (via Tracker), ops (deliverability) | User sees own; ops sees aggregates |
| Health | Platform (ops) | Sequencer (mailbox selection) | Ops team only |

### 5.3 Data Lineage

#### Example: Contact Email Provenance
```
Contact: john.doe@acme.com
  ↓
Source: Apollo API
  ↓
Discovered: 2025-10-13 10:23 UTC
  ↓
Verification: NeverBounce → "valid" (confidence: 0.95)
  ↓
Used in Outreach: Application #1234, Step 1, Sent 2025-10-13 10:30 UTC
  ↓
Delivered: 2025-10-13 10:32 UTC (SendGrid webhook)
  ↓
Replied: 2025-10-14 14:15 UTC
```

**Audit Trail Stored**:
- Contact.source = "apollo"
- Contact.discovered_at
- Outreach.sent_at, delivered_at, replied_at
- Logs: API call to Apollo (timestamp, response code)

---

## 6. Privacy & Compliance

### 6.1 Personally Identifiable Information (PII)

#### PII Data Elements
- **User domain**: email, name, resume text, phone, address (if provided)
- **Contact domain**: name, email, LinkedIn URL, title, company

#### Protection Mechanisms
- **Encryption at rest**: AES-256 for database fields (User.email, Contact.email)
- **Encryption in transit**: TLS 1.3 for all API calls
- **Access logging**: Every PII access logged (who, when, what)
- **Tokenization**: Contact emails hashed for analytics (no plain text in reports)

### 6.2 Consent & Opt-Out

#### Contact Consent Model
RoleFerry operates under **publicly available information (PAI)** doctrine:
- Contacts sourced from Apollo, LinkedIn, company websites (public sources)
- No explicit consent required (B2B outreach exception in CAN-SPAM)
- Users informed via disclaimer: "Contact found via public sources; accuracy not guaranteed"

#### Opt-Out Enforcement
- **Email footer**: Every outreach includes "Reply 'unsubscribe' to opt out"
- **Processing**: Opt-out detected via webhook → Contact.opted_out = TRUE within 1 hour
- **Suppression**: Opted-out contacts excluded from future sequences (global)

### 6.3 GDPR Compliance

#### Data Subject Rights
| Right | Implementation |
|-------|----------------|
| **Access** | User can download all data (JSON export in Settings) |
| **Rectification** | User can edit profile, resume, preferences anytime |
| **Erasure** | "Delete Account" button triggers full data purge |
| **Portability** | CSV export of applications, contacts, outreach history |
| **Restriction** | User can pause sequences (no new emails sent) |
| **Objection** | Contact opt-out honored globally |

#### Lawful Basis
- **User data**: Consent (T&C acceptance on signup)
- **Contact data**: Legitimate interest (B2B outreach for job search/recruiting)

#### Data Residency
- **US users**: Data stored in us-east-1 (AWS Virginia)
- **EU users (future)**: Data stored in eu-west-1 (AWS Ireland)

---

## 7. Analytics & Reporting Data

### 7.1 Aggregated Metrics (Non-PII)

#### Platform-Wide KPIs
- Total applications created
- Average match score
- Reply rate (delivered / replied)
- Time-to-interview (Applied → Interviewing, median days)
- Sequence effectiveness (reply rate by template)

#### User-Specific Metrics
- Applications by status (Saved: 5, Applied: 20, Interviewing: 3, etc.)
- Outreach activity (Sent: 60, Delivered: 58, Replied: 9)
- Best-performing sequences (Template X: 18% reply rate)

### 7.2 Data Warehouse (Future)

**Phase 2 (Year 2)**:
- ETL pipeline: PostgreSQL → S3 → Snowflake/Redshift
- Use cases: BI dashboards (Looker, Tableau), ML training data
- Anonymization: Strip PII before warehouse load

---

## 8. Disaster Recovery & Backup

### 8.1 Backup Strategy

| Data Type | Backup Frequency | Retention | Recovery RTO |
|-----------|------------------|-----------|--------------|
| PostgreSQL (primary) | Continuous (WAL) | 30 days | 15 minutes |
| PostgreSQL (snapshots) | Daily | 90 days | 2 hours |
| Redis (cache) | Not backed up | N/A | N/A (repopulates) |
| S3 (resumes, uploads) | Versioning enabled | Indefinite | Instant |

### 8.2 Recovery Scenarios

#### Scenario 1: Database Corruption
- **Action**: Restore from latest snapshot (RDS automated backup)
- **Data loss**: Max 24 hours (snapshot interval)
- **Mitigation**: Use WAL for point-in-time recovery (<15 min loss)

#### Scenario 2: Accidental Deletion (User or Admin)
- **Action**: Query audit logs, restore specific records from backup
- **Process**: Manual (support ticket, ops team restores)

#### Scenario 3: Regional Outage (AWS us-east-1)
- **Action**: Failover to us-west-2 (DR region)
- **Data sync**: Read replica (15-min lag)
- **RTO**: 1 hour (DNS switch, smoke tests)

---

## 9. Future Data Considerations

### 9.1 Scaling Challenges (100K+ users)

#### Database Sharding
- **Trigger**: Single PostgreSQL instance >1TB
- **Strategy**: Shard by user_id (hash-based partitioning)
- **Impact**: Application queries must include user_id in WHERE clause

#### Time-Series Data (Outreach Events)
- **Trigger**: >10M outreach records
- **Strategy**: Separate time-series DB (TimescaleDB or InfluxDB)
- **Impact**: Analytics queries offloaded from primary DB

### 9.2 Advanced Analytics

#### ML Training Data
- **Match scoring**: User feedback (thumbs up/down on jobs) → retrain model quarterly
- **Reply prediction**: Outreach features (subject length, time of day) → predict reply likelihood
- **Churn prediction**: User activity patterns → proactive engagement campaigns

#### Graph Database (Contacts)
- **Use case**: Map employee networks (who worked with whom)
- **Technology**: Neo4j or Neptune
- **Benefit**: Warm intro suggestions ("You both worked at Microsoft")

---

## 10. Acceptance Criteria (Data Architecture)

### Conceptual Level
- [ ] All core entities identified with clear business definitions
- [ ] Data flows documented for 3 main workflows (Apply, Outreach, Reply)
- [ ] Privacy policies defined (PII, retention, GDPR rights)
- [ ] Data quality dimensions specified (accuracy, completeness, timeliness)
- [ ] Stakeholders can understand data model without technical background

### Governance
- [ ] Data ownership assigned (who creates, who reads, who updates)
- [ ] Retention policies comply with GDPR (90-day contact deletion)
- [ ] Opt-out mechanism honors requests within 1 hour
- [ ] Audit logs track all PII access (who, when, what)

---

**Document Owner**: Data Architect / Chief Data Officer  
**Stakeholder Sign-Off**: CTO, Legal, Compliance  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (data policies evolve with regulations)

