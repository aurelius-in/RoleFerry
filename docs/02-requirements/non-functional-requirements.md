# Non-Functional Requirements
## RoleFerry Platform

**Document Type**: Requirements Specification  
**Audience**: Engineering, QA, Product  
**Purpose**: Define system quality attributes and constraints

---

## 1. Performance Requirements

### 1.1 Response Time
| Operation | Target (P95) | Target (P99) | Measurement |
|-----------|--------------|--------------|-------------|
| **API - Simple GET** | <300ms | <500ms | /health, /api/auth/me |
| **API - Complex Query** | <500ms | <1s | /api/jobs (20 items) |
| **API - Aggregation** | <1s | <2s | /api/analytics/dashboard |
| **Enrichment Job** | <30s | <60s | Company → 3 contacts |
| **Email Send (queue)** | <5min | <10min | Queue → delivered |
| **Page Load (frontend)** | <2s | <3s | Jobs List, Tracker |

**REQ-PERF-001**: 95% of API requests shall complete in <500ms  
**REQ-PERF-002**: Enrichment jobs shall complete in <30s (P95)  
**REQ-PERF-003**: Email sending shall queue in <5min (P95)

---

### 1.2 Throughput
| Metric | MVP (Year 1) | Scale (Year 3) |
|--------|--------------|----------------|
| **Concurrent Users** | 500 | 10,000 |
| **API Requests/sec** | 100 | 1,000 |
| **Enrichment Jobs/min** | 10 | 100 |
| **Emails/hour** | 200 | 10,000 |

**REQ-PERF-004**: System shall handle 500 concurrent users at MVP launch  
**REQ-PERF-005**: System shall scale to 10K concurrent users by Year 3

---

### 1.3 Database Performance
**REQ-PERF-006**: Database queries shall complete in <100ms (P95)  
**REQ-PERF-007**: Connection pool shall support 100 simultaneous connections  
**REQ-PERF-008**: Read replicas shall lag <15 seconds behind primary

---

## 2. Scalability Requirements

### 2.1 Horizontal Scalability
**REQ-SCALE-001**: API servers shall scale horizontally (add instances)  
**REQ-SCALE-002**: Celery workers shall scale independently of API  
**REQ-SCALE-003**: Auto-scaling shall trigger at 70% CPU utilization

### 2.2 Data Scalability
**REQ-SCALE-004**: Database shall support 10M+ applications without partitioning  
**REQ-SCALE-005**: Outreach table shall support 100M+ rows (partitioned by month)  
**REQ-SCALE-006**: Redis cache shall support 10GB+ data (cluster mode)

### 2.3 Storage Scalability
**REQ-SCALE-007**: S3 shall support 100TB+ resume storage  
**REQ-SCALE-008**: CloudWatch logs shall support 1TB/month ingestion

---

## 3. Availability Requirements

### 3.1 Uptime
**REQ-AVAIL-001**: System shall maintain 99.5% uptime (SLA for paid users)  
**REQ-AVAIL-002**: Planned maintenance windows <4 hours/month, off-peak only  
**REQ-AVAIL-003**: Database shall auto-failover in <2 minutes (Multi-AZ)

**Calculation**: 99.5% = 43.8 hours downtime/year (~3.65 hours/month)

### 3.2 Fault Tolerance
**REQ-AVAIL-004**: API shall continue if single instance fails (min 2 instances)  
**REQ-AVAIL-005**: Email sending shall failover to secondary provider (SendGrid → Mailgun)  
**REQ-AVAIL-006**: Enrichment shall use fallback providers (Apollo → Clay → Hunter)

### 3.3 Disaster Recovery
**REQ-AVAIL-007**: RTO (Recovery Time Objective) shall be <1 hour  
**REQ-AVAIL-008**: RPO (Recovery Point Objective) shall be <15 minutes  
**REQ-AVAIL-009**: Database backups shall be tested monthly (restore drill)

---

## 4. Reliability Requirements

### 4.1 Error Rates
**REQ-REL-001**: API 5xx error rate shall be <0.1%  
**REQ-REL-002**: Enrichment job failure rate shall be <5%  
**REQ-REL-003**: Email delivery rate shall be >95%

### 4.2 Data Integrity
**REQ-REL-004**: Database writes shall be ACID-compliant (PostgreSQL default)  
**REQ-REL-005**: Data corruption detection via checksums (RDS automatic)  
**REQ-REL-006**: Application creates/updates shall be idempotent (prevent duplicates)

### 4.3 Retry Logic
**REQ-REL-007**: Failed API calls to external services shall retry 3x with exponential backoff  
**REQ-REL-008**: Celery tasks shall retry 3x before marking failed  
**REQ-REL-009**: Email sends shall retry for 24 hours before giving up

---

## 5. Security Requirements

### 5.1 Authentication & Authorization
**REQ-SEC-001**: All API endpoints (except /health) shall require authentication  
**REQ-SEC-002**: Passwords shall be hashed with bcrypt (min 12 rounds)  
**REQ-SEC-003**: JWT tokens shall expire in 15 minutes  
**REQ-SEC-004**: Failed login attempts >5 in 10 min shall trigger CAPTCHA

### 5.2 Data Protection
**REQ-SEC-005**: PII shall be encrypted at rest (AES-256)  
**REQ-SEC-006**: All connections shall use TLS 1.3  
**REQ-SEC-007**: API keys shall be stored in AWS Secrets Manager (not code)  
**REQ-SEC-008**: Database backups shall be encrypted

### 5.3 Access Control
**REQ-SEC-009**: Users shall only access their own data (enforced at DB query level)  
**REQ-SEC-010**: API rate limiting: 60 requests/minute per user  
**REQ-SEC-011**: Admin operations shall require MFA (Phase 2)

### 5.4 Vulnerability Management
**REQ-SEC-012**: Dependency vulnerabilities shall be patched within 7 days (critical), 30 days (high)  
**REQ-SEC-013**: Code shall pass static analysis (Bandit, ESLint security rules)  
**REQ-SEC-014**: Annual penetration test by external firm

---

## 6. Usability Requirements

### 6.1 Learnability
**REQ-USE-001**: New users shall complete IJP wizard in <10 minutes (P95)  
**REQ-USE-002**: First application shall be created in <5 minutes from signup  
**REQ-USE-003**: Onboarding completion rate shall be >70%

### 6.2 Efficiency
**REQ-USE-004**: Apply button click → email sent shall take <60 seconds (user perspective)  
**REQ-USE-005**: Tracker page load shall display data in <2 seconds  
**REQ-USE-006**: Common actions (Apply, Save) shall be 1-click

### 6.3 Error Handling
**REQ-USE-007**: Error messages shall be user-friendly (no stack traces)  
**REQ-USE-008**: Form validation errors shall be inline and specific  
**REQ-USE-009**: System errors shall provide next steps ("Try again" or "Contact support")

---

## 7. Accessibility Requirements (WCAG 2.1 AA)

### 7.1 Perceivable
**REQ-ACC-001**: Text contrast ratio shall be ≥4.5:1 for normal text, ≥3:1 for large text  
**REQ-ACC-002**: Images shall have alt text  
**REQ-ACC-003**: Videos shall have captions (if used)

### 7.2 Operable
**REQ-ACC-004**: All functionality shall be keyboard accessible  
**REQ-ACC-005**: Focus indicators shall be visible (3px outline)  
**REQ-ACC-006**: No content shall flash >3 times per second

### 7.3 Understandable
**REQ-ACC-007**: Form labels shall be explicit (`<label for="...">`)  
**REQ-ACC-008**: Error messages shall be announced to screen readers (aria-live)  
**REQ-ACC-009**: Language shall be declared (`<html lang="en">`)

### 7.4 Robust
**REQ-ACC-010**: HTML shall be valid (W3C validator)  
**REQ-ACC-011**: ARIA roles shall be used correctly  
**REQ-ACC-012**: System shall work with screen readers (NVDA, JAWS)

---

## 8. Compatibility Requirements

### 8.1 Browser Support
**REQ-COMPAT-001**: System shall support:
- Chrome 90+ (>60% users)
- Firefox 88+ (>10% users)
- Safari 14+ (>15% users)
- Edge 90+ (>5% users)

**REQ-COMPAT-002**: Mobile browsers (iOS Safari 14+, Chrome Android 90+)

### 8.2 Device Support
**REQ-COMPAT-003**: Responsive design for:
- Desktop (1920×1080, 1366×768)
- Tablet (768×1024)
- Mobile (375×667, 414×896)

### 8.3 Screen Readers
**REQ-COMPAT-004**: Compatible with NVDA, JAWS, VoiceOver

---

## 9. Maintainability Requirements

### 9.1 Code Quality
**REQ-MAINT-001**: Code coverage shall be ≥80% (unit + integration tests)  
**REQ-MAINT-002**: Cyclomatic complexity shall be <10 per function  
**REQ-MAINT-003**: Code reviews required for all PRs (1+ approval)

### 9.2 Documentation
**REQ-MAINT-004**: All public APIs shall have OpenAPI docs (auto-generated)  
**REQ-MAINT-005**: Database schema changes shall have migration scripts (Alembic)  
**REQ-MAINT-006**: Architecture docs shall be updated quarterly

### 9.3 Deployment
**REQ-MAINT-007**: Deployment shall be automated (CI/CD, no manual steps)  
**REQ-MAINT-008**: Rollback shall be possible within 5 minutes  
**REQ-MAINT-009**: Blue-green deployment for zero-downtime releases

---

## 10. Monitoring & Observability Requirements

### 10.1 Logging
**REQ-MON-001**: All errors shall be logged (ERROR level)  
**REQ-MON-002**: User actions shall be logged (INFO level) for analytics  
**REQ-MON-003**: Logs shall be structured (JSON format)  
**REQ-MON-004**: Log retention: 30 days (hot), 1 year (archive)

### 10.2 Metrics
**REQ-MON-005**: Application metrics (latency, error rate) shall update real-time  
**REQ-MON-006**: Business metrics (signups, applications) shall be tracked daily  
**REQ-MON-007**: Infrastructure metrics (CPU, memory) shall be collected every minute

### 10.3 Alerting
**REQ-MON-008**: Critical alerts (P0) shall page on-call engineer (PagerDuty)  
**REQ-MON-009**: Alert fatigue: <5 alerts/week in steady state  
**REQ-MON-010**: Alerts shall include runbook links

---

## 11. Compliance Requirements

### 11.1 GDPR
**REQ-COMP-001**: Users shall be able to export all data (JSON/CSV)  
**REQ-COMP-002**: Users shall be able to delete account (<30 days completion)  
**REQ-COMP-003**: Data breach notification within 72 hours

### 11.2 CCPA
**REQ-COMP-004**: California residents shall have right to know data collected  
**REQ-COMP-005**: Opt-out of data sale (not applicable—we don't sell)

### 11.3 CAN-SPAM
**REQ-COMP-006**: All emails shall have unsubscribe link  
**REQ-COMP-007**: Opt-out requests honored within 1 hour (target: 10 business days legal)  
**REQ-COMP-008**: Email footer shall include physical address

---

## 12. Cost & Resource Constraints

### 12.1 Infrastructure Budget
**REQ-COST-001**: Infrastructure cost shall be <$50K/month at 10K users  
**REQ-COST-002**: Cost per user shall decrease as scale increases (economies of scale)

### 12.2 API Costs
**REQ-COST-003**: Enrichment cost shall be <$0.15/contact (Apollo + Clay + verification)  
**REQ-COST-004**: LLM cost shall be <$0.02/draft (Anthropic Sonnet)  
**REQ-COST-005**: Email sending cost shall be <$0.01/email (SendGrid)

### 12.3 Team Size
**REQ-COST-006**: System shall be operable by 2 engineers (MVP phase)  
**REQ-COST-007**: On-call rotation: max 1 week on-call per month per engineer

---

## 13. Legal & Regulatory Constraints

### 13.1 Data Residency
**REQ-LEGAL-001**: US user data shall remain in US (AWS us-east-1)  
**REQ-LEGAL-002**: EU user data shall remain in EU (Phase 3: AWS eu-west-1)

### 13.2 Data Retention
**REQ-LEGAL-003**: Contact data shall be deleted after 90 days (GDPR minimization)  
**REQ-LEGAL-004**: Audit logs shall be retained for 7 years (compliance)

### 13.3 Terms of Service
**REQ-LEGAL-005**: Users shall accept T&C before accessing platform  
**REQ-LEGAL-006**: Privacy Policy shall be accessible from all pages  
**REQ-LEGAL-007**: Changes to T&C shall require re-acceptance

---

## 14. Environmental Requirements

### 14.1 Operating Environment
**REQ-ENV-001**: System shall run on AWS (primary), GCP (future failover)  
**REQ-ENV-002**: Database: PostgreSQL 15+  
**REQ-ENV-003**: Cache: Redis 7+  
**REQ-ENV-004**: Containers: Docker 20+, ECS Fargate

### 14.2 Third-Party Dependencies
**REQ-ENV-005**: System shall function if Apollo API is unavailable (fallback to Clay)  
**REQ-ENV-006**: System shall function if SendGrid is unavailable (failover to Mailgun)  
**REQ-ENV-007**: Critical path shall not depend on single vendor

---

## 15. Acceptance Criteria

- [ ] All performance targets defined with measurable thresholds
- [ ] Scalability requirements specify MVP and Year 3 targets
- [ ] Security requirements map to OWASP Top 10
- [ ] Accessibility requirements follow WCAG 2.1 AA
- [ ] Monitoring requirements enable <5min MTTD (Mean Time To Detect)
- [ ] Compliance requirements cover GDPR, CCPA, CAN-SPAM
- [ ] All requirements testable (no vague "shall be fast")

---

## 16. Traceability Matrix (Sample)

| NFR | Related FR | Test Case | Priority |
|-----|-----------|-----------|----------|
| REQ-PERF-001 | REQ-JS-002 (One-Click Apply) | Load test: 100 req/s | P0 |
| REQ-SEC-001 | REQ-AUTH-001 (Login) | Security test: JWT validation | P0 |
| REQ-AVAIL-001 | N/A (System-wide) | Uptime monitoring | P0 |
| REQ-USE-001 | REQ-ONBOARD-002 (IJP Wizard) | UX test: Time-to-complete | P1 |

---

**Document Owner**: Engineering Manager, QA Lead  
**Reviewed By**: CTO, Product, DevOps  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly during development, quarterly post-launch

