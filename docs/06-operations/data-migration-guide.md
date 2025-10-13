# Data Migration Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Database Administrators, Backend Engineers  
**Purpose**: Safe database schema changes in production

---

## 1. Migration Principles

### 1.1 Zero-Downtime Migrations
- Never lock tables during peak hours
- Use backward-compatible changes
- Deploy in phases (add column → populate → remove old)

### 1.2 Rollback Strategy
- Every migration has `upgrade()` and `downgrade()`
- Test rollback on staging before production
- Keep previous version deployable during migration

---

## 2. Alembic Workflow

### 2.1 Create Migration
```bash
cd backend
alembic revision --autogenerate -m "Add interview_dates to applications"
```

### 2.2 Review Generated Migration
```python
# migrations/versions/001_add_interview_dates.py
def upgrade():
    op.add_column('applications', 
        sa.Column('interview_dates', sa.JSON(), nullable=True))

def downgrade():
    op.drop_column('applications', 'interview_dates')
```

### 2.3 Test on Staging
```bash
# Apply migration
alembic upgrade head

# Verify
psql -h staging-db -c "SELECT column_name FROM information_schema.columns WHERE table_name='applications';"

# Test rollback
alembic downgrade -1

# Re-apply
alembic upgrade head
```

### 2.4 Production Deployment
```bash
# Generate SQL (review before running)
alembic upgrade head --sql > migration_001.sql

# Review SQL file (check for table locks, duration)

# Apply during maintenance window
psql -h prod-db -U admin -d roleferry < migration_001.sql

# Verify
psql -h prod-db -c "SELECT COUNT(*) FROM applications;"
```

---

## 3. Common Migration Patterns

### 3.1 Add Column (Nullable)
**Safe**: No downtime

```python
def upgrade():
    op.add_column('applications', 
        sa.Column('offer_details', sa.JSON(), nullable=True))
```

---

### 3.2 Add Column (Not Null) - Two-Phase

**Phase 1**: Add nullable
```python
def upgrade():
    op.add_column('users', sa.Column('subscription_tier', sa.String(50), nullable=True))
```

**Phase 2**: Backfill, add constraint
```python
def upgrade():
    # Backfill
    op.execute("UPDATE users SET subscription_tier = 'free' WHERE subscription_tier IS NULL")
    
    # Add NOT NULL constraint
    op.alter_column('users', 'subscription_tier', nullable=False)
```

---

### 3.3 Rename Column - Multi-Phase

**Phase 1**: Add new column, dual-write
```python
def upgrade():
    op.add_column('jobs', sa.Column('description_text', sa.Text()))
    # Application writes to both columns
```

**Phase 2**: Backfill old → new
```python
def upgrade():
    op.execute("UPDATE jobs SET description_text = description WHERE description_text IS NULL")
```

**Phase 3**: Drop old column
```python
def upgrade():
    op.drop_column('jobs', 'description')
```

---

### 3.4 Add Index (Concurrent)

**Unsafe** (locks table):
```python
op.create_index('idx_applications_status', 'applications', ['status'])
```

**Safe** (no lock):
```python
op.execute("CREATE INDEX CONCURRENTLY idx_applications_status ON applications(status)")
```

---

## 4. Large Data Migrations

### 4.1 Batch Processing
```python
# Migrate 10M outreach records (rewrite links to CTD)
def upgrade():
    batch_size = 1000
    offset = 0
    
    while True:
        # Process batch
        op.execute(f"""
            UPDATE outreach
            SET body = replace(body, 'https://linkedin.com', 'https://click.roleferry.io')
            WHERE id IN (
                SELECT id FROM outreach
                WHERE body LIKE '%linkedin.com%'
                LIMIT {batch_size} OFFSET {offset}
            )
        """)
        
        if op.get_bind().execute(f"SELECT COUNT(*) FROM outreach WHERE body LIKE '%linkedin.com%' LIMIT 1 OFFSET {offset}").scalar() == 0:
            break
        
        offset += batch_size
        time.sleep(1)  # Throttle to avoid lock contention
```

---

## 5. Data Backups Before Migration

### 5.1 Pre-Migration Checklist
- [ ] Create manual snapshot
```bash
aws rds create-db-snapshot \
  --db-instance-identifier roleferry-prod \
  --db-snapshot-identifier pre-migration-$(date +%Y%m%d-%H%M)
```

- [ ] Export affected tables (if migration is risky)
```bash
pg_dump -h prod-db -U admin -t applications -t outreach > backup_tables.sql
```

- [ ] Verify backup integrity
```bash
psql -h test-db -U admin -d test < backup_tables.sql
```

---

## 6. Rollback Procedures

### 6.1 Immediate Rollback (Migration Failed)
```bash
# If migration failed mid-way
alembic downgrade -1

# Verify
alembic current
```

### 6.2 Delayed Rollback (Found Issue Post-Deploy)
```bash
# Create inverse migration
alembic revision -m "Revert add_interview_dates"

# Manually write downgrade logic
def upgrade():
    op.drop_column('applications', 'interview_dates')

def downgrade():
    op.add_column('applications', sa.Column('interview_dates', sa.JSON()))

# Deploy
alembic upgrade head
```

---

## 7. Acceptance Criteria

- [ ] Migration tested on staging (apply + rollback)
- [ ] SQL reviewed (no table locks >1 second)
- [ ] Snapshot created (pre-migration backup)
- [ ] Rollback procedure documented
- [ ] Team notified (Slack #engineering, 24-hour notice)
- [ ] Monitoring active (watch for errors post-migration)
- [ ] Post-migration verification (row counts, query tests)

---

**Document Owner**: Database Administrator, Backend Lead  
**Version**: 1.0  
**Date**: October 2025

