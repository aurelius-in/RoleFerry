# Data Architecture: Implementable Level
## RoleFerry Platform

**RM-ODP Viewpoint**: Technical Implementation  
**Audience**: Database Administrators, Backend Engineers  
**Purpose**: Production-ready database implementation with complete SQL

---

## 1. Complete Schema DDL

### 1.1 Create Database
```sql
CREATE DATABASE roleferry
    WITH 
    OWNER = admin
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

\c roleferry

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

### 1.2 Core Tables (Complete DDL)

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    full_name VARCHAR(255),
    mode VARCHAR(20) NOT NULL DEFAULT 'job_seeker' 
        CHECK (mode IN ('job_seeker', 'recruiter')),
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free'
        CHECK (subscription_tier IN ('free', 'pro', 'teams', 'enterprise')),
    credits_remaining INTEGER DEFAULT 0 CHECK (credits_remaining >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC'
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_subscription ON users(subscription_tier);
CREATE INDEX idx_users_verified ON users(email_verified) WHERE email_verified = TRUE;

-- Resumes table
CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    roles JSONB DEFAULT '[]'::jsonb,
    key_metrics JSONB DEFAULT '[]'::jsonb,
    accomplishments JSONB DEFAULT '[]'::jsonb,
    skills JSONB DEFAULT '[]'::jsonb,
    raw_text TEXT,
    pdf_url VARCHAR(500),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_resume_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_resumes_user ON resumes(user_id);
CREATE INDEX idx_resumes_skills ON resumes USING GIN(skills jsonb_path_ops);

-- Job preferences
CREATE TABLE job_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    values JSONB DEFAULT '[]'::jsonb,
    role_types JSONB DEFAULT '["full-time"]'::jsonb,
    locations JSONB DEFAULT '[]'::jsonb,
    remote_ok BOOLEAN DEFAULT TRUE,
    role_levels JSONB DEFAULT '[]'::jsonb,
    company_sizes JSONB DEFAULT '[]'::jsonb,
    industries JSONB DEFAULT '[]'::jsonb,
    skills JSONB DEFAULT '[]'::jsonb,
    hidden_companies JSONB DEFAULT '[]'::jsonb,
    min_salary INTEGER CHECK (min_salary IS NULL OR min_salary >= 0),
    max_salary INTEGER CHECK (max_salary IS NULL OR max_salary >= min_salary),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_ijp_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ijp_user ON job_preferences(user_id);
CREATE INDEX idx_ijp_industries ON job_preferences USING GIN(industries jsonb_path_ops);

-- Companies
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    size VARCHAR(50),
    industry VARCHAR(255),
    founded_year INTEGER CHECK (founded_year >= 1800 AND founded_year <= EXTRACT(YEAR FROM NOW())),
    funding_stage VARCHAR(50),
    tech_stack JSONB DEFAULT '[]'::jsonb,
    logo_url VARCHAR(500),
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    glassdoor_rating DECIMAL(2,1) CHECK (glassdoor_rating >= 0 AND glassdoor_rating <= 5),
    enriched_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name_trgm ON companies USING GIN(name gin_trgm_ops);
CREATE INDEX idx_companies_industry ON companies(industry);

-- Jobs
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE,
    source VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    company_id INTEGER NOT NULL,
    location VARCHAR(255),
    remote BOOLEAN DEFAULT FALSE,
    job_type VARCHAR(50) DEFAULT 'full-time',
    description TEXT,
    description_summary TEXT,
    comp_min INTEGER CHECK (comp_min >= 0),
    comp_max INTEGER CHECK (comp_max >= 0),
    requires_visa_sponsorship BOOLEAN DEFAULT FALSE,
    posted_date TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '90 days',
    
    CONSTRAINT fk_job_company FOREIGN KEY (company_id) 
        REFERENCES companies(id) ON DELETE RESTRICT,
    CONSTRAINT chk_salary_range CHECK (comp_min IS NULL OR comp_max IS NULL OR comp_min <= comp_max)
);

CREATE INDEX idx_jobs_title_trgm ON jobs USING GIN(to_tsvector('english', title));
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_remote ON jobs(remote) WHERE remote = TRUE;
CREATE INDEX idx_jobs_posted_date ON jobs(posted_date DESC);
CREATE INDEX idx_jobs_external_id ON jobs(external_id);
CREATE INDEX idx_jobs_expires_at ON jobs(expires_at) WHERE expires_at > NOW();

-- Applications
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    job_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'applied'
        CHECK (status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected')),
    match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    interview_dates JSONB DEFAULT '[]'::jsonb,
    offer_details JSONB DEFAULT '{}'::jsonb,
    reply_status VARCHAR(50) DEFAULT 'pending'
        CHECK (reply_status IN ('pending', 'replied', 'no_reply')),
    
    CONSTRAINT fk_application_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_application_job FOREIGN KEY (job_id) 
        REFERENCES jobs(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_application_user_job ON applications(user_id, job_id);
CREATE INDEX idx_application_status ON applications(status, last_action_at DESC);
CREATE INDEX idx_application_user_status ON applications(user_id, status);
CREATE INDEX idx_application_match_score ON applications(match_score DESC) WHERE match_score IS NOT NULL;

-- Contacts
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_confidence DECIMAL(3,2) CHECK (email_confidence >= 0 AND email_confidence <= 1),
    linkedin_url VARCHAR(500),
    source VARCHAR(100) NOT NULL,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    opted_out BOOLEAN DEFAULT FALSE,
    opted_out_at TIMESTAMP WITH TIME ZONE,
    bounce_count INTEGER DEFAULT 0 CHECK (bounce_count >= 0),
    spam_reports INTEGER DEFAULT 0 CHECK (spam_reports >= 0),
    
    CONSTRAINT fk_contact_company FOREIGN KEY (company_id) 
        REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_title_trgm ON contacts USING GIN(to_tsvector('english', title));
CREATE INDEX idx_contacts_verified ON contacts(email_verified) WHERE email_verified = TRUE;
CREATE INDEX idx_contacts_opted_out ON contacts(opted_out) WHERE opted_out = TRUE;
CREATE INDEX idx_contacts_last_contacted ON contacts(last_contacted_at DESC);

-- Sequence templates
CREATE TABLE sequence_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_platform BOOLEAN DEFAULT FALSE,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_sequence_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sequence_user ON sequence_templates(user_id);
CREATE INDEX idx_sequence_platform ON sequence_templates(is_platform) WHERE is_platform = TRUE;

-- Outreach
CREATE TABLE outreach (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    sequence_instance_id INTEGER,
    step_no INTEGER NOT NULL CHECK (step_no >= 1),
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    from_mailbox VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'replied', 'failed', 'canceled')),
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    link_clicks INTEGER DEFAULT 0 CHECK (link_clicks >= 0),
    livepage_id INTEGER,
    
    CONSTRAINT fk_outreach_application FOREIGN KEY (application_id) 
        REFERENCES applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_outreach_contact FOREIGN KEY (contact_id) 
        REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_outreach_application ON outreach(application_id);
CREATE INDEX idx_outreach_contact ON outreach(contact_id);
CREATE INDEX idx_outreach_status_queued ON outreach(status, queued_at) WHERE status = 'queued';
CREATE INDEX idx_outreach_mailbox ON outreach(from_mailbox);
CREATE INDEX idx_outreach_sent_at ON outreach(sent_at DESC) WHERE sent_at IS NOT NULL;

-- Mailboxes
CREATE TABLE mailboxes (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
    status VARCHAR(50) DEFAULT 'warmup' CHECK (status IN ('warmup', 'active', 'paused')),
    warmup_enabled BOOLEAN DEFAULT TRUE,
    warmup_start_date TIMESTAMP WITH TIME ZONE,
    daily_cap INTEGER DEFAULT 50 CHECK (daily_cap > 0),
    sent_today INTEGER DEFAULT 0 CHECK (sent_today >= 0),
    bounce_count_7d INTEGER DEFAULT 0,
    spam_reports_7d INTEGER DEFAULT 0,
    last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mailbox_health ON mailboxes(health_score DESC);
CREATE INDEX idx_mailbox_status ON mailboxes(status) WHERE status = 'active';
CREATE INDEX idx_mailbox_sent_today ON mailboxes(sent_today, daily_cap);
CREATE INDEX idx_mailbox_available ON mailboxes(status, health_score, sent_today, daily_cap) 
    WHERE status = 'active' AND health_score >= 70 AND sent_today < daily_cap;
```

---

## 2. Triggers & Functions (Complete Implementation)

### 2.1 Update Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER trg_resumes_updated_at
    BEFORE UPDATE ON resumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ijp_updated_at
    BEFORE UPDATE ON job_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sequence_updated_at
    BEFORE UPDATE ON sequence_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### 2.2 Application Last Action Update
```sql
CREATE OR REPLACE FUNCTION update_application_last_action()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE applications SET last_action_at = NOW() WHERE id = NEW.application_id;
    ELSIF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        UPDATE applications SET last_action_at = NOW() WHERE id = NEW.application_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outreach_updates_application
    AFTER INSERT OR UPDATE ON outreach
    FOR EACH ROW
    EXECUTE FUNCTION update_application_last_action();
```

---

### 2.3 Stop Sequence on Reply
```sql
CREATE OR REPLACE FUNCTION stop_sequence_on_reply()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'replied' AND (OLD.status IS NULL OR OLD.status != 'replied') THEN
        -- Cancel future outreach steps
        UPDATE outreach
        SET status = 'canceled'
        WHERE application_id = NEW.application_id
          AND contact_id = NEW.contact_id
          AND step_no > NEW.step_no
          AND status = 'queued';
        
        -- Update application
        UPDATE applications
        SET reply_status = 'replied',
            status = CASE 
                WHEN status = 'saved' THEN 'applied'
                WHEN status = 'applied' THEN 'interviewing'
                ELSE status
            END,
            last_action_at = NOW()
        WHERE id = NEW.application_id;
        
        -- Update contact last_contacted
        UPDATE contacts
        SET last_contacted_at = NEW.replied_at
        WHERE id = NEW.contact_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outreach_reply
    AFTER UPDATE OF status ON outreach
    FOR EACH ROW
    EXECUTE FUNCTION stop_sequence_on_reply();
```

---

### 2.4 Mailbox Counter Reset (Daily Cron)
```sql
CREATE OR REPLACE FUNCTION reset_mailbox_daily_counters()
RETURNS void AS $$
BEGIN
    UPDATE mailboxes
    SET sent_today = 0,
        bounce_count_7d = (
            SELECT COUNT(*)
            FROM outreach
            WHERE outreach.from_mailbox = mailboxes.email
              AND outreach.status = 'bounced'
              AND outreach.sent_at > NOW() - INTERVAL '7 days'
        ),
        spam_reports_7d = (
            SELECT COUNT(*)
            FROM outreach
            WHERE outreach.from_mailbox = mailboxes.email
              AND outreach.status = 'spam'
              AND outreach.sent_at > NOW() - INTERVAL '7 days'
        )
    WHERE sent_today > 0 OR bounce_count_7d > 0 OR spam_reports_7d > 0;
    
    -- Recalculate health scores
    PERFORM calculate_mailbox_health();
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'reset-mailboxes',
    '0 0 * * *',  -- Daily at midnight UTC
    'SELECT reset_mailbox_daily_counters()'
);
```

---

### 2.5 Health Score Calculation
```sql
CREATE OR REPLACE FUNCTION calculate_mailbox_health()
RETURNS void AS $$
DECLARE
    mailbox_record RECORD;
    new_health INTEGER;
    bounce_rate DECIMAL;
    spam_rate DECIMAL;
BEGIN
    FOR mailbox_record IN SELECT * FROM mailboxes LOOP
        -- Calculate rates
        bounce_rate := CASE 
            WHEN mailbox_record.sent_today > 0 
            THEN mailbox_record.bounce_count_7d::DECIMAL / mailbox_record.sent_today
            ELSE 0
        END;
        
        spam_rate := CASE 
            WHEN mailbox_record.sent_today > 0 
            THEN mailbox_record.spam_reports_7d::DECIMAL / mailbox_record.sent_today
            ELSE 0
        END;
        
        -- Base score
        new_health := 100;
        
        -- Penalties
        new_health := new_health - (bounce_rate * 500)::INTEGER;  -- -50 per 10% bounce
        new_health := new_health - (mailbox_record.spam_reports_7d * 20);  -- -20 per spam report
        
        -- Bonuses
        IF mailbox_record.warmup_start_date IS NOT NULL THEN
            IF NOW() - mailbox_record.warmup_start_date > INTERVAL '30 days' THEN
                new_health := new_health + 10;  -- Warmup complete bonus
            END IF;
        END IF;
        
        -- Clamp to 0-100
        new_health := GREATEST(0, LEAST(100, new_health));
        
        -- Update mailbox
        UPDATE mailboxes
        SET health_score = new_health,
            status = CASE 
                WHEN new_health < 50 THEN 'paused'
                WHEN new_health >= 70 AND status = 'warmup' 
                     AND NOW() - warmup_start_date > INTERVAL '30 days' THEN 'active'
                ELSE status
            END,
            last_health_check = NOW()
        WHERE id = mailbox_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule health check every 6 hours
SELECT cron.schedule(
    'calculate-health',
    '0 */6 * * *',
    'SELECT calculate_mailbox_health()'
);
```

---

## 3. Materialized Views

### 3.1 Match Scores Cache
```sql
CREATE MATERIALIZED VIEW match_scores AS
SELECT 
    a.user_id,
    a.job_id,
    a.match_score AS score,
    CASE 
        WHEN a.match_score >= 90 THEN 'excellent'
        WHEN a.match_score >= 75 THEN 'strong'
        WHEN a.match_score >= 50 THEN 'fair'
        ELSE 'low'
    END AS category,
    a.applied_at AS calculated_at
FROM applications a
WHERE a.match_score IS NOT NULL;

CREATE UNIQUE INDEX idx_match_scores_user_job ON match_scores(user_id, job_id);
CREATE INDEX idx_match_scores_score ON match_scores(score DESC);

-- Refresh hourly
SELECT cron.schedule(
    'refresh-match-scores',
    '0 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY match_scores'
);
```

---

## 4. Partitioning (For Scale)

### 4.1 Partition Outreach by Month
```sql
-- Convert to partitioned table (requires migration)
CREATE TABLE outreach_partitioned (
    LIKE outreach INCLUDING ALL
) PARTITION BY RANGE (sent_at);

-- Create monthly partitions
CREATE TABLE outreach_2025_10 PARTITION OF outreach_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE outreach_2025_11 PARTITION OF outreach_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Auto-create future partitions (pg_partman extension)
CREATE EXTENSION IF NOT EXISTS pg_partman;

SELECT partman.create_parent(
    p_parent_table => 'public.outreach_partitioned',
    p_control => 'sent_at',
    p_type => 'native',
    p_interval => 'monthly',
    p_premake => 3  -- Create 3 months ahead
);
```

---

## 5. Seed Data (Development)

```sql
-- Platform sequence templates
INSERT INTO sequence_templates (name, description, is_platform, steps) VALUES
('Job Seeker Default', '3-step mentor ask', TRUE, 
 '[
    {"step_no": 1, "delay_hours": 0, "subject": "Quick advice on {{role}} at {{company}}?", "body": "Hi {{first_name}},\n\nI spotted the {{role}} opening at {{company}} and think my background fits ({{my_metric}}). Open to a brief 15-min chat to sanity-check fit?\n\nThanks,\n{{my_name}}"},
    {"step_no": 2, "delay_hours": 48, "subject": "Following up on {{role}}", "body": "Hi {{first_name}},\n\nJust following up on my email from a couple days ago. Still interested in chatting about the {{role}} role if you have 15 minutes.\n\nThanks,\n{{my_name}}"},
    {"step_no": 3, "delay_hours": 96, "subject": "Last follow-up", "body": "Hi {{first_name}},\n\nLast email! I know you''re busy. If the timing isn''t right, no worries—just wanted to make sure this didn''t slip through the cracks.\n\nBest,\n{{my_name}}"}
 ]'::jsonb),

('Recruiter Cold Intro', '2-step passive candidate outreach', TRUE,
 '[
    {"step_no": 1, "delay_hours": 0, "subject": "{{role}} opportunity at {{company}}", "body": "Hi {{first_name}},\n\nI''m recruiting for a {{role}} role at {{company}}. Based on your background, I think you''d be a great fit.\n\nInterested in learning more?\n\nBest,\n{{my_name}}"},
    {"step_no": 2, "delay_hours": 72, "subject": "Still interested?", "body": "Hi {{first_name}},\n\nFollowing up on the {{role}} opportunity. Let me know if you''d like to chat.\n\nThanks,\n{{my_name}}"}
 ]'::jsonb);

-- Test users (staging only)
INSERT INTO users (email, hashed_password, full_name, mode, subscription_tier, email_verified) VALUES
('test_js@roleferry.com', '$2b$12$hash...', 'Test Job Seeker', 'job_seeker', 'pro', TRUE),
('test_rec@roleferry.com', '$2b$12$hash...', 'Test Recruiter', 'recruiter', 'teams', TRUE);
```

---

## 6. Performance Tuning

### 6.1 Vacuum & Analyze Schedule
```sql
-- Automated vacuum (enabled by default in RDS)
-- Manual ANALYZE for critical tables after bulk updates
ANALYZE applications;
ANALYZE outreach;
ANALYZE contacts;

-- Full vacuum (during maintenance window)
VACUUM FULL applications;  -- Reclaims disk space
```

### 6.2 Connection Pooling (PgBouncer)
```ini
# pgbouncer.ini
[databases]
roleferry = host=roleferry-prod-db.xxx.rds.amazonaws.com port=5432 dbname=roleferry

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

---

## 7. Backup & Recovery

### 7.1 Automated Backups (RDS)
```bash
# Enable automated backups
aws rds modify-db-instance \
  --db-instance-identifier roleferry-prod-db \
  --backup-retention-period 30 \
  --preferred-backup-window "03:00-04:00"
```

### 7.2 Point-in-Time Recovery
```bash
# Restore to specific timestamp
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier roleferry-prod-db \
  --target-db-instance-identifier roleferry-recovered \
  --restore-time 2025-10-13T14:30:00Z
```

---

## 8. Security Hardening

### 8.1 Database User Roles
```sql
-- Read-only user (for analytics, read replicas)
CREATE ROLE readonly;
GRANT CONNECT ON DATABASE roleferry TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;

-- Application user (API servers)
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE roleferry TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Deny dangerous operations
REVOKE CREATE ON SCHEMA public FROM app_user;
REVOKE DROP ON ALL TABLES FROM app_user;
```

### 8.2 Row-Level Security (RLS)
```sql
-- Enable RLS on applications (users see only their data)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_isolation ON applications
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- Application sets user context
-- SET LOCAL app.current_user_id = 123;
```

---

## 9. Monitoring Queries

### 9.1 Slow Query Log
```sql
-- Enable slow query logging (RDS parameter group)
-- log_min_duration_statement = 1000  (log queries >1s)

-- Find slow queries
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 9.2 Connection Monitoring
```sql
-- Current connections
SELECT 
    datname,
    usename,
    state,
    COUNT(*)
FROM pg_stat_activity
GROUP BY datname, usename, state
ORDER BY count DESC;

-- Kill idle connections (>10 minutes)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes'
  AND datname = 'roleferry';
```

---

## 10. Acceptance Criteria

- [ ] All tables created with indexes, constraints, triggers
- [ ] Seed data loaded (templates, test users)
- [ ] Health score calculation automated (cron)
- [ ] Daily counter resets working
- [ ] Partitioning implemented for outreach (>10M rows)
- [ ] Connection pooling configured (PgBouncer)
- [ ] Backup strategy tested (restore from snapshot)
- [ ] Row-level security enabled (multi-tenant isolation)

---

**Document Owner**: Database Administrator, Backend Lead  
**Version**: 1.0  
**Date**: October 2025  
**Maintenance**: Update as schema evolves

