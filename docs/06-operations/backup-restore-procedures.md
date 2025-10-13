# Backup & Restore Procedures
## RoleFerry Platform

**Version**: 1.0  
**Audience**: DevOps, SRE, Database Administrators  
**Purpose**: Comprehensive backup strategy and recovery procedures

---

## 1. Backup Strategy Summary

| Asset | Method | Frequency | Retention | RTO | RPO |
|-------|--------|-----------|-----------|-----|-----|
| **PostgreSQL** | RDS Automated Snapshots | Daily | 30 days | 2 hours | 24 hours |
| **PostgreSQL** | Continuous WAL | Real-time | 7 days | 15 min | <1 min |
| **S3 Resumes** | Cross-region replication | Real-time | Indefinite | Immediate | 0 |
| **Redis** | No backup (cache only) | N/A | N/A | N/A | N/A |
| **Application Config** | Git repository | Per commit | Indefinite | Immediate | 0 |
| **Secrets** | AWS Secrets Manager versions | Per rotation | 90 days | Immediate | 0 |

---

## 2. PostgreSQL Backup

### 2.1 Automated Snapshots (RDS)

**Configuration**:
```bash
aws rds modify-db-instance \
  --db-instance-identifier roleferry-prod-db \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately
```

**Snapshot Schedule**: Daily at 3:00 AM UTC (low traffic period)

**Manual Snapshot** (before major changes):
```bash
aws rds create-db-snapshot \
  --db-instance-identifier roleferry-prod-db \
  --db-snapshot-identifier roleferry-prod-manual-$(date +%Y%m%d-%H%M)
```

---

### 2.2 Point-in-Time Recovery (PITR)

**Enable**: Automatic with RDS (no config needed)

**Restore to Specific Time**:
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier roleferry-prod-db \
  --target-db-instance-identifier roleferry-prod-recovered \
  --restore-time 2025-10-13T14:45:00Z \
  --db-subnet-group-name roleferry-db-subnet \
  --publicly-accessible false
```

**Recovery Time**: 15-30 minutes (depending on database size)

---

### 2.3 Export to S3 (Compliance Backup)

**Weekly Full Export**:
```bash
#!/bin/bash
# scripts/backup-db-to-s3.sh

BACKUP_DATE=$(date +%Y%m%d)
BACKUP_FILE="roleferry-backup-${BACKUP_DATE}.sql.gz"

# Export database
pg_dump -h $DB_HOST -U $DB_USER -d roleferry | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://roleferry-prod-backups/database/$BACKUP_FILE

# Encrypt
aws s3 cp s3://roleferry-prod-backups/database/$BACKUP_FILE \
  s3://roleferry-prod-backups/database/$BACKUP_FILE \
  --server-side-encryption AES256

# Clean up local
rm $BACKUP_FILE

# Lifecycle: Archive to Glacier after 90 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket roleferry-prod-backups \
  --lifecycle-configuration file://lifecycle-policy.json
```

**lifecycle-policy.json**:
```json
{
  "Rules": [{
    "Id": "ArchiveBackups",
    "Status": "Enabled",
    "Prefix": "database/",
    "Transitions": [{
      "Days": 90,
      "StorageClass": "GLACIER"
    }],
    "Expiration": {
      "Days": 730
    }
  }]
}
```

---

## 3. Restore Procedures

### 3.1 Restore from Snapshot (Recent Backup)

**Use Case**: Database corruption, accidental deletion

**Steps**:
```bash
# 1. Identify snapshot to restore
aws rds describe-db-snapshots \
  --db-instance-identifier roleferry-prod-db \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime]' \
  --output table

# 2. Restore snapshot to new instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier roleferry-prod-db-restored \
  --db-snapshot-identifier roleferry-prod-snapshot-2025-10-13 \
  --db-subnet-group-name roleferry-db-subnet \
  --publicly-accessible false

# 3. Wait for restore (check status)
aws rds wait db-instance-available \
  --db-instance-identifier roleferry-prod-db-restored

# 4. Update application to point to restored instance
# Update DATABASE_URL in Secrets Manager
aws secretsmanager update-secret \
  --secret-id roleferry/prod/database_url \
  --secret-string "postgresql://user:pass@roleferry-prod-db-restored.xxx.rds.amazonaws.com/roleferry"

# 5. Force redeploy API services (pick up new DATABASE_URL)
aws ecs update-service \
  --cluster roleferry-prod \
  --service api \
  --force-new-deployment

# 6. Verify data integrity
psql -h roleferry-prod-db-restored.xxx.rds.amazonaws.com \
  -U admin -d roleferry \
  -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM applications;"

# 7. Monitor for 1 hour, then delete old instance (if confident)
aws rds delete-db-instance \
  --db-instance-identifier roleferry-prod-db \
  --skip-final-snapshot
```

**Downtime**: 30-60 minutes (restore + redeploy)  
**Data Loss**: Up to 24 hours (snapshot interval)

---

### 3.2 Point-in-Time Recovery (Minimal Data Loss)

**Use Case**: Need to recover to exact timestamp (e.g., before bad migration)

**Steps**:
```bash
# Restore to 5 minutes before incident
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier roleferry-prod-db \
  --target-db-instance-identifier roleferry-prod-pitr \
  --restore-time 2025-10-13T14:55:00Z

# Wait for restore
aws rds wait db-instance-available --db-instance-identifier roleferry-prod-pitr

# Follow steps 4-7 from above
```

**Downtime**: 15-30 minutes  
**Data Loss**: <15 minutes (WAL precision)

---

### 3.3 Restore Single Table (Surgical Recovery)

**Use Case**: Only one table corrupted, don't want to restore entire DB

**Steps**:
```bash
# 1. Restore snapshot to temp instance (see 3.1)

# 2. Export single table from temp instance
pg_dump -h roleferry-prod-db-restored.xxx.rds.amazonaws.com \
  -U admin -d roleferry -t applications \
  --data-only > applications_backup.sql

# 3. Restore to production (CAUTION: overwrites current data)
psql -h roleferry-prod-db.xxx.rds.amazonaws.com \
  -U admin -d roleferry \
  -c "TRUNCATE applications CASCADE;"  # Deletes all rows

psql -h roleferry-prod-db.xxx.rds.amazonaws.com \
  -U admin -d roleferry < applications_backup.sql

# 4. Delete temp instance
aws rds delete-db-instance \
  --db-instance-identifier roleferry-prod-db-restored \
  --skip-final-snapshot
```

---

## 4. S3 Backup & Restore

### 4.1 Resume Files

**Backup**: Automatic (S3 versioning + cross-region replication)

**Configuration**:
```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket roleferry-prod-resumes \
  --versioning-configuration Status=Enabled

# Enable cross-region replication (to us-west-2)
aws s3api put-bucket-replication \
  --bucket roleferry-prod-resumes \
  --replication-configuration file://replication-config.json
```

**Restore Deleted File**:
```bash
# List versions
aws s3api list-object-versions \
  --bucket roleferry-prod-resumes \
  --prefix user-123/resume.pdf

# Restore specific version
aws s3api copy-object \
  --copy-source roleferry-prod-resumes/user-123/resume.pdf?versionId=xxx \
  --bucket roleferry-prod-resumes \
  --key user-123/resume.pdf
```

---

## 5. Disaster Recovery Scenarios

### Scenario 1: Complete Database Loss
**Trigger**: RDS instance deleted (malicious or accident)

**Recovery**:
1. Restore from latest snapshot (30 min)
2. Point-in-time recovery if WAL available (reduce data loss)
3. Update secrets, redeploy services
4. Verify data integrity
5. Notify affected users if data loss >1 hour

**Downtime**: 1-2 hours  
**Data Loss**: <15 min (best case), <24 hours (worst case)

---

### Scenario 2: Region Outage (us-east-1)
**Trigger**: AWS region completely offline

**Recovery**:
1. Promote read replica in us-west-2 to primary (10 min)
2. Scale up ECS services in us-west-2
3. Route 53 failover to us-west-2 (automatic)
4. Verify service operational

**Downtime**: 30-60 minutes  
**Data Loss**: <5 minutes (replication lag)

---

### Scenario 3: Accidental Data Deletion
**Trigger**: Engineer runs `DELETE FROM users` without WHERE clause

**Recovery**:
1. Immediately stop application (prevent cascading deletes)
2. Restore from snapshot (most recent)
3. Calculate data loss window
4. Notify affected users
5. Post-mortem (prevent recurrence)

---

## 6. Testing Backup Integrity

### Monthly Backup Test
```bash
#!/bin/bash
# scripts/test-backup-restore.sh

# Restore latest snapshot to test instance
LATEST_SNAPSHOT=$(aws rds describe-db-snapshots \
  --db-instance-identifier roleferry-prod-db \
  --query 'DBSnapshots[0].DBSnapshotIdentifier' \
  --output text)

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier roleferry-test-restore \
  --db-snapshot-identifier $LATEST_SNAPSHOT

# Wait for restore
aws rds wait db-instance-available --db-instance-identifier roleferry-test-restore

# Verify data integrity
psql -h roleferry-test-restore.xxx.rds.amazonaws.com -U admin -d roleferry \
  -c "SELECT COUNT(*) FROM users;" \
  -c "SELECT COUNT(*) FROM applications;" \
  -c "SELECT COUNT(*) FROM outreach;"

# Clean up
aws rds delete-db-instance \
  --db-instance-identifier roleferry-test-restore \
  --skip-final-snapshot

echo "Backup test completed successfully"
```

**Schedule**: Monthly (first Sunday, 2 AM UTC)

---

## 7. Acceptance Criteria

- [ ] Automated daily snapshots configured (30-day retention)
- [ ] Point-in-time recovery tested (restore to specific timestamp)
- [ ] S3 versioning enabled (resumes, uploads)
- [ ] Cross-region replication active (us-east-1 → us-west-2)
- [ ] Monthly backup tests pass (verify data integrity)
- [ ] Restore procedures documented (snapshot, PITR, single table)
- [ ] Recovery drills completed (quarterly DR tests)

---

**Document Owner**: DevOps Lead, Database Administrator  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (after each DR drill)

