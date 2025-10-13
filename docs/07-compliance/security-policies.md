# Security Policies
## RoleFerry Platform

**Effective Date**: October 13, 2025  
**Audience**: All Employees, Contractors, Partners  
**Purpose**: Comprehensive security policies and procedures

---

## 1. Information Security Policy

### 1.1 Purpose
Protect RoleFerry's information assets from threats, ensure confidentiality/integrity/availability, and comply with legal/regulatory requirements.

### 1.2 Scope
Applies to:
- All employees, contractors, vendors
- All systems (production, staging, development)
- All data (user data, company data, source code)

### 1.3 Responsibilities
- **CEO**: Overall accountability
- **CTO**: Security strategy, implementation
- **All Employees**: Follow policies, report incidents
- **Contractors/Vendors**: Sign NDA, comply with policies

---

## 2. Access Control Policy

### 2.1 User Access
**Principle**: Least privilege—grant minimum access necessary.

**Rules**:
- **Production database**: CTO + DevOps Lead only (read-only for debugging)
- **AWS console**: Admins only (MFA required)
- **Secrets Manager**: Automated access via IAM roles (no manual access)
- **Admin panels**: Product + Engineering leads only

**Provisioning**:
1. Manager requests access (ticket in Linear)
2. IT/DevOps reviews, approves
3. Access granted via IAM role/group
4. Logged in audit trail

**Deprovisioning**:
- Access revoked within 24 hours of termination
- Exit interview includes credential return (laptops, keys)

---

### 2.2 Multi-Factor Authentication (MFA)
**Required for**:
- AWS console access (all users)
- GitHub (all engineers)
- Datadog, Stripe, SendGrid (admins)
- Production database access (read-only exceptions)

**Tools**: Google Authenticator, Authy, YubiKey

---

### 2.3 Password Policy
**Requirements**:
- Minimum 12 characters
- Uppercase, lowercase, number, symbol
- No common passwords (checked against haveibeenpwned.com)
- Changed every 90 days (for admin accounts)
- No password reuse (last 5 passwords)

**Storage**: 1Password (team vault)

---

## 3. Data Protection Policy

### 3.1 Data Classification

| Classification | Examples | Protection |
|----------------|----------|------------|
| **Public** | Marketing materials, blog posts | None required |
| **Internal** | Product roadmap, internal docs | Access control (employees only) |
| **Confidential** | User data, resumes, contacts | Encryption, access logs |
| **Restricted** | Passwords, API keys, payment data | Encryption, Secrets Manager, PCI DSS |

### 3.2 Encryption Standards
**At Rest**:
- Database: AES-256 (RDS encryption enabled)
- S3: AES-256 (server-side encryption)
- Backups: AES-256 (RDS snapshots)

**In Transit**:
- All connections: TLS 1.3
- API → Services: HTTPS
- Internal services: mTLS (future)

**Key Management**:
- AWS KMS (managed keys)
- Automatic rotation: 90 days

---

### 3.3 Data Retention & Disposal

| Data Type | Retention | Disposal Method |
|-----------|-----------|-----------------|
| **User accounts** | Until deletion request | Hard delete (GDPR) |
| **Contacts** | 90 days post-last-outreach | Auto-delete (cron job) |
| **Outreach metadata** | 2 years | Archive to Glacier |
| **Logs** | 30 days (hot), 1 year (archive) | S3 lifecycle policy |
| **Backups** | 30 days (snapshots), 7 days (WAL) | Auto-expiry |

**Secure Disposal**:
- Database records: `DELETE FROM` (no soft deletes for PII)
- Files: S3 delete with versioning purge
- Backups: Encrypted, auto-expire

---

## 4. Acceptable Use Policy

### 4.1 Employee Device Policy
- Company laptops: Encrypted (FileVault, BitLocker)
- Personal devices: NOT allowed for production access
- Remote work: VPN required (future)
- Lost devices: Report immediately → remote wipe

### 4.2 Prohibited Activities
- ❌ Sharing credentials (passwords, API keys)
- ❌ Accessing production data without business need
- ❌ Storing company data on personal devices
- ❌ Using unauthorized SaaS tools (shadow IT)
- ❌ Sharing confidential info externally (without NDA)

### 4.3 Consequences
- **First violation**: Written warning
- **Second violation**: Suspension (unpaid, 1 week)
- **Third violation**: Termination

---

## 5. Incident Response Policy

### 5.1 Incident Categories
- **Security**: Data breach, unauthorized access, malware
- **Privacy**: GDPR violation, PII exposure
- **Availability**: Downtime, DDoS attack
- **Compliance**: CAN-SPAM violation, regulatory inquiry

### 5.2 Reporting
**All employees must report**:
- Security incidents → security@roleferry.com (immediate)
- Privacy concerns → privacy@roleferry.com (24 hours)
- Downtime → on-call engineer (PagerDuty, immediate)

**No Retaliation**: Employees who report in good faith are protected.

### 5.3 Response Procedure
1. **Contain**: Isolate affected systems (revoke access, block IPs)
2. **Assess**: Determine scope (what data, how many users)
3. **Notify**: Internal (leadership), external (users, authorities if required)
4. **Remediate**: Fix vulnerability, restore service
5. **Post-Mortem**: Root cause analysis, preventive measures

---

## 6. Third-Party Vendor Policy

### 6.1 Vendor Due Diligence
Before engaging vendor:
- [ ] SOC 2 Type II certified (or equivalent)
- [ ] Privacy Policy reviewed (GDPR/CCPA compliant)
- [ ] SLA acceptable (99%+ uptime for critical vendors)
- [ ] Data Processing Agreement (DPA) signed
- [ ] Security questionnaire completed

### 6.2 Approved Vendors
- **Infrastructure**: AWS, Vercel
- **Email**: SendGrid, Mailgun
- **Enrichment**: Apollo, Clay
- **Payments**: Stripe
- **Monitoring**: Datadog, Sentry

### 6.3 Vendor Reviews
- **Quarterly**: Check vendor uptime, security incidents
- **Annually**: Re-review SLAs, renew contracts
- **Ad-hoc**: If vendor has breach or outage

---

## 7. Secure Development Policy

### 7.1 Code Security
- **No secrets in code**: Use environment variables, Secrets Manager
- **Input validation**: All user inputs validated (Pydantic, Zod)
- **Output encoding**: Prevent XSS (escape HTML)
- **Parameterized queries**: No raw SQL (SQLAlchemy ORM)
- **Dependency updates**: Monthly (automated via Dependabot)

### 7.2 Code Review
- **All PRs**: Minimum 1 approval before merge
- **Security-sensitive**: 2 approvals (auth, payments, encryption)
- **Checklist**: Security review (injection, auth bypass, data leaks)

### 7.3 Testing
- **Unit tests**: 80%+ coverage
- **Security tests**: SQL injection, XSS, CSRF (automated)
- **Penetration test**: Annual (external firm)

---

## 8. Training & Awareness

### 8.1 Security Training
**Frequency**: Annually for all employees

**Topics**:
- Phishing awareness (simulated phishing tests quarterly)
- Password hygiene (use password manager, no reuse)
- Social engineering (verify requests for data)
- Incident reporting (how and when)

**Delivery**: Online course (30 minutes), completion tracked

### 8.2 Role-Specific Training
- **Engineers**: Secure coding (OWASP Top 10)
- **Support**: Data handling (don't share PII via email)
- **Sales**: Customer data privacy (GDPR, CCPA basics)

---

## 9. Physical Security (Office)

**Note**: Fully remote company (Phase 1), but policies for future office:

- **Badge access**: RFID badges for entry
- **Visitor log**: All visitors signed in, escorted
- **Clean desk**: No PII left on desks overnight
- **Device locks**: Laptops locked when unattended

---

## 10. Compliance

### 10.1 Audit Schedule
- **Internal**: Quarterly (CTO reviews policies, access logs)
- **External**: Annually (third-party security audit)
- **SOC 2 Type II**: Target Year 2 (requires 6+ months operational history)

### 10.2 Policy Updates
- **Review**: Annually or upon regulatory change
- **Approval**: CEO + CTO
- **Communication**: All employees notified via email, re-training if major changes

---

## 11. Policy Violations

### 11.1 Reporting
**How**: Email security@roleferry.com or anonymous form

**What Happens**:
1. Investigation (CTO + HR)
2. Determination (violation confirmed?)
3. Disciplinary action (warning, suspension, termination)
4. Remediation (e.g., revoke access, change passwords)

### 11.2 Whistleblower Protection
Employees who report violations in good faith are protected from retaliation.

---

## 12. Acceptance Criteria

- [ ] All policies documented and approved by leadership
- [ ] Employees trained (100% completion)
- [ ] Access controls implemented (least privilege)
- [ ] Encryption enabled (database, S3, transit)
- [ ] Incident response plan tested (tabletop exercise)
- [ ] Vendor due diligence completed (SOC 2 checks)
- [ ] Audit schedule established (quarterly internal, annual external)

---

## 13. Acknowledgment

**All employees must sign**:

> I, [Name], acknowledge that I have read, understood, and agree to comply with RoleFerry's Security Policies. I understand that violations may result in disciplinary action up to and including termination.

> Signature: ________________  Date: __________

---

**Document Owner**: CTO, CISO (future hire)  
**Reviewed By**: CEO, Legal Counsel  
**Version**: 1.0  
**Effective Date**: October 13, 2025  
**Next Review**: Annually (or upon incident/regulation change)

