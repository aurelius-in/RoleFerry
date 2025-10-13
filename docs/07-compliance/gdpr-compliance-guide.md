# GDPR Compliance Guide
## RoleFerry Platform (EU Expansion - Phase 3)

**Regulation**: General Data Protection Regulation (EU)  
**Scope**: EU users (when we launch in EU region)  
**Penalties**: Up to €20M or 4% of global annual revenue, whichever is higher

---

## 1. GDPR Principles

### 1.1 Seven Key Principles
1. **Lawfulness, Fairness, Transparency**: Process data legally, explain how
2. **Purpose Limitation**: Use data only for stated purposes
3. **Data Minimization**: Collect only what's necessary
4. **Accuracy**: Keep data correct and up-to-date
5. **Storage Limitation**: Delete data when no longer needed
6. **Integrity & Confidentiality**: Secure data, prevent breaches
7. **Accountability**: Demonstrate compliance

---

## 2. Lawful Basis for Processing

### 2.1 User Data (Job Seekers, Recruiters)
**Lawful Basis**: **Consent**

**Implementation**:
- Terms & Conditions checkbox on signup (clear, affirmative action)
- Privacy Policy linked, easily accessible
- Granular consent (marketing emails = separate opt-in)

### 2.2 Contact Data (Enriched Contacts)
**Lawful Basis**: **Legitimate Interest**

**Justification**:
- Business purpose: Job search, recruiting (not marketing/spam)
- Publicly available information (LinkedIn, company sites)
- Minimal intrusion (one-time outreach, opt-out honored)

**Balancing Test**:
- Our interest (help users find jobs) vs. Contact's privacy (one email from public sources)
- Conclusion: Legitimate interest applies (B2B context, professional outreach)

**Safeguards**:
- Opt-out within 1 hour (exceeds 10-day legal requirement)
- 90-day data deletion (minimization)
- Source attribution ("Found via Apollo")

---

## 3. Data Subject Rights (DSR)

### 3.1 Right to Access
**Request**: "I want to download all my data"

**Response** (within 30 days):
- Self-service: Settings → Privacy → "Download My Data"
- Format: JSON (machine-readable) + CSV (human-readable)
- Includes: Profile, resume, applications, outreach history, audit logs

**Implementation**:
```python
@router.get("/api/user/export")
async def export_data(user: User):
    return {
        "user": user.to_dict(),
        "applications": [app.to_dict() for app in user.applications],
        "outreach": [o.to_dict() for o in user.outreach_history]
    }
```

---

### 3.2 Right to Rectification
**Request**: "My resume data is incorrect"

**Response** (immediate):
- User can edit profile, resume, preferences anytime (Settings)
- No manual intervention needed (self-service)

---

### 3.3 Right to Erasure ("Right to be Forgotten")
**Request**: "Delete my account"

**Response** (within 30 days):
- Settings → Account → "Delete Account" button
- Confirmation: "This is permanent. Continue?"
- Process:
  1. Stop all sequences
  2. Delete PII (name, email, resume)
  3. Anonymize applications (user_id → NULL, keep for stats)
  4. Delete contacts discovered for user
  5. Email confirmation: "Your data has been deleted"

**Exceptions** (can retain):
- Financial records (7 years, tax compliance)
- Audit logs (7 years, legal requirement)
- Aggregated analytics (anonymized, no PII)

---

### 3.4 Right to Data Portability
**Request**: "Export my data to use elsewhere"

**Response**:
- Same as Right to Access (JSON/CSV export)
- Machine-readable format (can import to other tools)

---

### 3.5 Right to Object
**Request**: "Stop using my data for X purpose"

**Response**:
- Marketing emails: Unsubscribe link (immediate)
- Analytics tracking: Settings → Disable analytics

---

## 4. Data Protection Impact Assessment (DPIA)

**Required for**: High-risk processing (profiling, large-scale PII, etc.)

**RoleFerry's Assessment**:
- **Contact enrichment**: Medium risk (public sources, opt-out available, 90-day retention)
- **Email outreach**: Low risk (B2B, professional context, not bulk spam)
- **User data**: Low risk (user consents, can delete anytime)

**Conclusion**: DPIA not required for initial launch (not high-risk under GDPR Article 35).

---

## 5. Data Transfers (EU → US)

### 5.1 Standard Contractual Clauses (SCCs)
**Mechanism**: EU-approved contract templates for international data transfers

**Implementation**:
- SCCs signed with US-based vendors (SendGrid, Apollo, AWS)
- Ensures EU-equivalent data protection

### 5.2 Data Residency (Phase 3)
**Solution**: Store EU user data in AWS eu-west-1 (Ireland)

**Configuration**:
```python
# Route EU users to EU database
if user.region == "EU":
    DATABASE_URL = settings.EU_DATABASE_URL  # eu-west-1 RDS
else:
    DATABASE_URL = settings.US_DATABASE_URL  # us-east-1 RDS
```

---

## 6. Breach Notification

### 6.1 Timeline
- **72 hours**: Notify supervisory authority (Irish DPA if we use AWS Ireland)
- **Without undue delay**: Notify affected users (if high risk)

### 6.2 Notification Template
```
To: Irish Data Protection Commission (dpc@dataprotection.ie)

Subject: Data Breach Notification - RoleFerry Inc.

We are notifying you of a personal data breach under GDPR Article 33.

Breach Details:
- Date/time discovered: 2025-10-13 14:30 UTC
- Nature of breach: Unauthorized database access
- Data affected: 500 user email addresses, names
- No sensitive data (passwords, resumes) exposed

Measures Taken:
- Revoked compromised credentials
- Patched vulnerability
- Notifying affected users

Contact: dpo@roleferry.com

RoleFerry Inc.
[Address]
```

---

## 7. Data Protection Officer (DPO)

**Required**: Yes, if processing EU data at scale (>5,000 users)

**Responsibilities**:
- Monitor GDPR compliance
- Advise on DPIAs
- Cooperate with supervisory authorities
- Act as contact point for users (data requests)

**Appointment**: Phase 3 (EU launch)

---

## 8. Cookies & Consent

### 8.1 Cookie Banner (EU Users Only)
```
We use cookies to:
✓ Keep you logged in (essential)
✓ Improve our product (analytics)

[Accept All] [Reject Non-Essential] [Cookie Settings]
```

**Categories**:
- **Essential**: Session cookies (no consent required)
- **Analytics**: Google Analytics (requires consent)
- **Marketing**: None (we don't use tracking pixels)

---

## 9. Acceptance Criteria (Phase 3 - EU Launch)

- [ ] DPO appointed (external counsel or hire)
- [ ] EU data residency (AWS eu-west-1)
- [ ] SCCs signed with all vendors
- [ ] GDPR-compliant Privacy Policy
- [ ] Data subject rights implemented (all 6 rights)
- [ ] Cookie consent banner (EU users)
- [ ] Breach notification process tested
- [ ] GDPR training for all employees
- [ ] Legal counsel review (EU data protection lawyer)

---

## 10. Ongoing Compliance

### Quarterly Reviews
- [ ] Data retention policies enforced (90-day contact deletion)
- [ ] Audit logs reviewed (any unauthorized access?)
- [ ] Vendor compliance checked (SOC 2, Privacy Shield)
- [ ] User rights requests (DSR log reviewed)

---

**Document Owner**: Data Protection Officer (DPO, future hire)  
**Legal Counsel**: EU privacy lawyer (Phase 3)  
**Version**: 1.0  
**Date**: October 2025  
**Effective**: Upon EU launch (target: Q3 2026)

