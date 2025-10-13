# Data Retention Policy
## RoleFerry Platform

**Effective Date**: October 13, 2025  
**Compliance**: GDPR, CCPA, SOC 2

---

## 1. Policy Statement

RoleFerry retains personal data only as long as necessary for business purposes and legal obligations, then securely deletes it.

---

## 2. Retention Schedule

### 2.1 User Data

| Data Type | Retention Period | Deletion Method | Justification |
|-----------|------------------|-----------------|---------------|
| **User accounts** | Until user deletes OR 3 years inactive | Hard delete | User owns data |
| **Resumes** | Active + 90 days post-deletion request | S3 object delete + DB purge | GDPR minimization |
| **Job preferences** | Active account only | Hard delete with account | Session data |
| **Login history** | 1 year | Rolling deletion | Security analysis |

---

### 2.2 Application Data

| Data Type | Retention Period | Deletion Method | Justification |
|-----------|------------------|-----------------|---------------|
| **Applications** | Indefinite (user-owned) | User-initiated delete | Pipeline history |
| **Notes** | With application | Cascade delete | User content |
| **Interview dates** | With application | Cascade delete | User content |

---

### 2.3 Contact Data (GDPR Critical)

| Data Type | Retention Period | Deletion Method | Justification |
|-----------|------------------|-----------------|---------------|
| **Contacts** | **90 days** after last outreach | Auto-delete (cron) | GDPR minimization |
| **Opted-out contacts** | **Permanent** (suppression list) | Never delete | CAN-SPAM requirement |
| **Bounced emails** | 1 year | Hard delete | Deliverability analysis |

**Critical**: 90-day retention is GDPR best practice for B2B contact data.

---

### 2.4 Outreach Data

| Data Type | Retention Period | Deletion Method | Justification |
|-----------|------------------|-----------------|---------------|
| **Outreach metadata** (sent, delivered, replied) | 2 years | Archive to Glacier, then delete | Analytics, compliance |
| **Email content** (subject, body) | 90 days | Purge body text | Debugging, then minimize |
| **Link clicks** | 2 years | Aggregate, delete individual clicks | Analytics |

---

### 2.5 System Data

| Data Type | Retention Period | Deletion Method | Justification |
|-----------|------------------|-----------------|---------------|
| **Audit logs** | 7 years | Archive to S3 Glacier Deep Archive | SOC 2, legal compliance |
| **Application logs** | 30 days (hot), 1 year (archive) | CloudWatch → S3 lifecycle | Debugging, forensics |
| **Metrics** | 13 months (Datadog default) | Rolling deletion | Trend analysis |

---

### 2.6 Financial Data

| Data Type | Retention Period | Deletion Method | Justification |
|-----------|------------------|-----------------|---------------|
| **Payment records** | 7 years | Encrypted archive (S3 Glacier) | Tax law (IRS), PCI DSS |
| **Invoices** | 7 years | PDF archive (S3) | Accounting |
| **Subscription history** | 3 years | Database archive table | Churn analysis |

---

## 3. Automated Deletion Jobs

### 3.1 Daily Cron: Delete Stale Contacts

```sql
-- Runs daily at 2 AM UTC
DELETE FROM contacts
WHERE last_contacted_at < NOW() - INTERVAL '90 days'
  AND opted_out = FALSE;  -- Never delete suppression list
```

**Monitoring**: Log count of deleted contacts (expect 50-200/day at scale)

---

### 3.2 Weekly Cron: Purge Email Bodies

```sql
-- Runs weekly Sunday 2 AM UTC
UPDATE outreach
SET body = NULL, subject = '[Purged for privacy]'
WHERE sent_at < NOW() - INTERVAL '90 days'
  AND body IS NOT NULL;
```

**Benefit**: Reduces database size, GDPR minimization.

---

### 3.3 Monthly Cron: Archive Old Jobs

```sql
-- Move jobs >90 days old to archive table
INSERT INTO jobs_archive
SELECT * FROM jobs
WHERE posted_date < NOW() - INTERVAL '90 days'
  AND id NOT IN (SELECT job_id FROM applications);  -- Don't archive if user applied

DELETE FROM jobs
WHERE posted_date < NOW() - INTERVAL '90 days'
  AND id NOT IN (SELECT job_id FROM applications);
```

---

## 4. User-Initiated Deletion

### 4.1 Delete Account Workflow

**Trigger**: User clicks Settings → Account → "Delete Account"

**Process** (runs immediately):
```python
async def delete_user_account(user_id: int):
    """GDPR-compliant account deletion"""
    db = SessionLocal()
    
    try:
        user = db.query(User).get(user_id)
        
        # 1. Stop all active sequences
        db.query(Outreach).join(Application)\
          .filter(Application.user_id == user_id, Outreach.status == 'queued')\
          .update({"status": "canceled"})
        
        # 2. Delete PII
        user.email = f"deleted-{user_id}@deleted.roleferry.com"
        user.full_name = "[Deleted User]"
        user.hashed_password = None
        
        # 3. Delete resume
        if user.resume:
            # Delete S3 file
            s3_client.delete_object(
                Bucket='roleferry-prod-resumes',
                Key=user.resume.pdf_url.split('/')[-1]
            )
            db.delete(user.resume)
        
        # 4. Delete IJP
        if user.job_preferences:
            db.delete(user.job_preferences)
        
        # 5. Delete contacts discovered for this user's applications
        db.query(Contact).filter(
            Contact.id.in_(
                db.query(Outreach.contact_id)
                  .join(Application)
                  .filter(Application.user_id == user_id)
            )
        ).delete(synchronize_session=False)
        
        # 6. Anonymize applications (keep for stats, but no PII)
        db.query(Application).filter(Application.user_id == user_id)\
          .update({"notes": None})
        
        # 7. Mark user as deleted
        user.email_verified = False
        user.subscription_tier = 'deleted'
        
        db.commit()
        
        # 8. Send confirmation email (to original email, before it was deleted)
        send_email(
            to=original_email,
            subject="Your RoleFerry account has been deleted",
            body="Your data has been permanently deleted per your request."
        )
        
        logging.info(f"User {user_id} account deleted successfully")
    
    finally:
        db.close()
```

**Completion**: 30 days maximum (GDPR requirement), we do immediately.

---

## 5. Data Subject Access Request (DSAR)

### 5.1 Export User Data

**Trigger**: User clicks Settings → Privacy → "Download My Data"

**Process**:
```python
def export_user_data(user_id: int) -> dict:
    """Generate JSON export of all user data"""
    db = SessionLocal()
    
    try:
        user = db.query(User).get(user_id)
        
        export = {
            "user": {
                "email": user.email,
                "full_name": user.full_name,
                "created_at": user.created_at.isoformat(),
                "subscription_tier": user.subscription_tier
            },
            "resume": user.resume.to_dict() if user.resume else None,
            "job_preferences": user.job_preferences.to_dict() if user.job_preferences else None,
            "applications": [
                {
                    "job_title": app.job.title,
                    "company": app.job.company.name,
                    "status": app.status,
                    "applied_at": app.applied_at.isoformat() if app.applied_at else None,
                    "notes": app.notes
                }
                for app in user.applications
            ],
            "outreach": [
                {
                    "contact": outreach.contact.full_name,
                    "subject": outreach.subject,
                    "sent_at": outreach.sent_at.isoformat() if outreach.sent_at else None,
                    "status": outreach.status
                }
                for app in user.applications
                for outreach in app.outreach
            ]
        }
        
        return export
    finally:
        db.close()
```

**Delivery**: JSON download, ready within 30 seconds.

---

## 6. Acceptance Criteria

- [ ] Retention schedule documented for all data types
- [ ] Automated deletion jobs running (daily, weekly, monthly cron)
- [ ] 90-day contact deletion enforced (GDPR)
- [ ] User deletion workflow tested (DSAR)
- [ ] Audit logs retained 7 years (SOC 2)
- [ ] Payment records retained 7 years (tax law)
- [ ] Monitoring: Track deletion job execution (success/failure)

---

**Document Owner**: Data Protection Officer (DPO, future), Legal  
**Reviewed By**: CTO, Compliance Counsel  
**Version**: 1.0  
**Effective Date**: October 13, 2025  
**Next Review**: Annually (or upon regulation change)

