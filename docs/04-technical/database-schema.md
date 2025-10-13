# Database Schema Reference
## RoleFerry Platform

**Database**: PostgreSQL 15.5  
**Purpose**: Complete schema documentation with examples  
**Audience**: Backend Engineers, Database Administrators

---

## 1. Schema Overview

**Total Tables**: 15 core tables  
**Extensions Used**:
- `pg_trgm`: Fuzzy text search
- `pgcrypto`: Encryption functions
- `uuid-ossp`: UUID generation

---

## 2. Core Tables

### 2.1 users

**Purpose**: User accounts (job seekers & recruiters)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),  -- NULL for OAuth users
    full_name VARCHAR(255),
    mode VARCHAR(20) NOT NULL DEFAULT 'job_seeker',  -- job_seeker | recruiter
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',  -- free | pro | teams
    credits_remaining INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    
    CONSTRAINT chk_mode CHECK (mode IN ('job_seeker', 'recruiter')),
    CONSTRAINT chk_subscription CHECK (subscription_tier IN ('free', 'pro', 'teams'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_subscription ON users(subscription_tier);
```

**Sample Data**:
```sql
INSERT INTO users (email, full_name, mode, subscription_tier, email_verified) VALUES
('sarah@example.com', 'Sarah Johnson', 'job_seeker', 'pro', TRUE),
('david@techcorp.com', 'David Chen', 'recruiter', 'teams', TRUE);
```

---

### 2.2 resumes

**Purpose**: Parsed resume data for job seekers

```sql
CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    roles JSONB,  -- [{"title": "PM", "company": "Acme", "tenure": "3 years"}]
    key_metrics JSONB,  -- ["Reduced churn by 25%", "Shipped 5 features"]
    accomplishments JSONB,
    skills JSONB,  -- ["Python", "Product Strategy"]
    raw_text TEXT,
    pdf_url VARCHAR(500),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_resume_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_resumes_user ON resumes(user_id);
CREATE INDEX idx_resumes_skills ON resumes USING GIN(skills jsonb_path_ops);
```

**Sample Data**:
```sql
INSERT INTO resumes (user_id, roles, key_metrics, skills, pdf_url) VALUES
(1, 
 '[{"title": "Senior PM", "company": "Tech Inc", "tenure": "3 years"}]'::jsonb,
 '["Reduced time-to-hire by 30%", "Launched mobile app (50K users)"]'::jsonb,
 '["Product Strategy", "SQL", "A/B Testing"]'::jsonb,
 'https://s3.amazonaws.com/roleferry-resumes/user-1.pdf');
```

---

### 2.3 job_preferences (IJP)

**Purpose**: User job search preferences

```sql
CREATE TABLE job_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    values JSONB,  -- ["work-life balance", "impact"]
    role_types JSONB,  -- ["full-time", "contract"]
    locations JSONB,  -- ["San Francisco", "Remote"]
    remote_ok BOOLEAN DEFAULT TRUE,
    role_levels JSONB,  -- ["senior", "lead"]
    company_sizes JSONB,  -- ["startup", "mid-market"]
    industries JSONB,  -- ["saas", "fintech"]
    skills JSONB,
    hidden_companies JSONB,  -- Company IDs to exclude
    min_salary INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ijp_user ON job_preferences(user_id);
CREATE INDEX idx_ijp_industries ON job_preferences USING GIN(industries jsonb_path_ops);
```

---

### 2.4 companies

**Purpose**: Employer organizations

```sql
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,  -- Primary key for deduplication
    size VARCHAR(50),  -- "1-10", "50-200", "1000+"
    industry VARCHAR(255),
    founded_year INTEGER,
    funding_stage VARCHAR(50),
    tech_stack JSONB,
    logo_url VARCHAR(500),
    website VARCHAR(500),
    linkedin_url VARCHAR(500),
    glassdoor_rating DECIMAL(2,1),
    enriched_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name_trgm ON companies USING GIN(name gin_trgm_ops);
CREATE INDEX idx_companies_industry ON companies(industry);
```

**Sample Data**:
```sql
INSERT INTO companies (name, domain, size, industry, logo_url, glassdoor_rating) VALUES
('Acme Corp', 'acme.com', '50-200', 'SaaS', 'https://cdn.roleferry.com/logos/acme.png', 4.2),
('Beta Inc', 'beta.io', '200-500', 'Fintech', 'https://cdn.roleferry.com/logos/beta.png', 3.8);
```

---

### 2.5 jobs

**Purpose**: Job postings

```sql
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE,  -- From job board (dedup key)
    source VARCHAR(100) NOT NULL,  -- 'indeed', 'linkedin', 'greenhouse'
    title VARCHAR(500) NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    location VARCHAR(255),
    remote BOOLEAN DEFAULT FALSE,
    job_type VARCHAR(50),  -- 'full-time', 'contract', 'part-time'
    description TEXT,
    description_summary TEXT,  -- AI-generated 2-sentence summary
    comp_min INTEGER,  -- USD annual
    comp_max INTEGER,
    requires_visa_sponsorship BOOLEAN DEFAULT FALSE,
    posted_date TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- Auto-archive date (90 days)
    
    CONSTRAINT chk_salary_range CHECK (comp_min IS NULL OR comp_max IS NULL OR comp_min <= comp_max)
);

CREATE INDEX idx_jobs_title_trgm ON jobs USING GIN(to_tsvector('english', title));
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_remote ON jobs(remote) WHERE remote = TRUE;
CREATE INDEX idx_jobs_posted_date ON jobs(posted_date DESC);
CREATE INDEX idx_jobs_external_id ON jobs(external_id);
```

---

### 2.6 applications

**Purpose**: User applications to jobs (tracker)

```sql
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'applied',  -- saved|applied|interviewing|offer|rejected
    match_score INTEGER,  -- 0-100
    applied_at TIMESTAMP WITH TIME ZONE,
    last_action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    interview_dates JSONB,  -- [{"date": "2025-10-20", "stage": "phone", "interviewer": "John"}]
    offer_details JSONB,  -- {"salary": 150000, "equity": "0.5%"}
    reply_status VARCHAR(50) DEFAULT 'pending',  -- pending|replied|no_reply
    
    CONSTRAINT chk_match_score CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 100)),
    CONSTRAINT chk_status CHECK (status IN ('saved', 'applied', 'interviewing', 'offer', 'rejected'))
);

CREATE UNIQUE INDEX idx_application_user_job ON applications(user_id, job_id);  -- Prevent duplicates
CREATE INDEX idx_application_status ON applications(status, last_action_at DESC);
CREATE INDEX idx_application_user_status ON applications(user_id, status);
```

---

### 2.7 contacts

**Purpose**: Enriched contact data (hiring managers, HR, etc.)

```sql
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_confidence DECIMAL(3,2),  -- 0.00-1.00
    linkedin_url VARCHAR(500),
    source VARCHAR(100) NOT NULL,  -- 'apollo', 'clay', 'hunter'
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    opted_out BOOLEAN DEFAULT FALSE,
    opted_out_at TIMESTAMP WITH TIME ZONE,
    bounce_count INTEGER DEFAULT 0,
    spam_reports INTEGER DEFAULT 0,
    
    CONSTRAINT chk_email_confidence CHECK (email_confidence IS NULL OR (email_confidence >= 0.0 AND email_confidence <= 1.0))
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_title_trgm ON contacts USING GIN(to_tsvector('english', title));
CREATE INDEX idx_contacts_opted_out ON contacts(opted_out) WHERE opted_out = TRUE;
```

---

### 2.8 sequence_templates

**Purpose**: Reusable email sequence templates

```sql
CREATE TABLE sequence_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL for platform templates
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_platform BOOLEAN DEFAULT FALSE,  -- Platform template vs user-created
    steps JSONB NOT NULL,  -- [{"step_no": 1, "subject": "...", "body": "...", "delay_hours": 0}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sequence_user ON sequence_templates(user_id);
CREATE INDEX idx_sequence_platform ON sequence_templates(is_platform) WHERE is_platform = TRUE;
```

**Sample Data**:
```sql
INSERT INTO sequence_templates (name, description, is_platform, steps) VALUES
('Job Seeker Default', '3-step mentor ask', TRUE, 
 '[
    {"step_no": 1, "subject": "Quick advice on {{role}} at {{company}}?", "body": "Hi {{first_name}},...", "delay_hours": 0},
    {"step_no": 2, "subject": "Following up", "body": "Hi again,...", "delay_hours": 48},
    {"step_no": 3, "subject": "Last follow-up", "body": "Just wanted to...", "delay_hours": 72}
 ]'::jsonb);
```

---

### 2.9 outreach

**Purpose**: Individual email send events

```sql
CREATE TABLE outreach (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    sequence_instance_id INTEGER,  -- NULL for one-off emails
    step_no INTEGER NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    from_mailbox VARCHAR(255) NOT NULL,  -- e.g., auto1@rf-send-01.com
    status VARCHAR(50) DEFAULT 'queued',  -- queued|sent|delivered|bounced|replied
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    link_clicks INTEGER DEFAULT 0,
    livepage_id INTEGER,
    
    CONSTRAINT chk_outreach_status CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'replied', 'failed'))
);

CREATE INDEX idx_outreach_application ON outreach(application_id);
CREATE INDEX idx_outreach_contact ON outreach(contact_id);
CREATE INDEX idx_outreach_status_queued ON outreach(status, queued_at) WHERE status = 'queued';
CREATE INDEX idx_outreach_mailbox ON outreach(from_mailbox);
CREATE INDEX idx_outreach_sent_at ON outreach(sent_at DESC);
```

---

### 2.10 mailboxes

**Purpose**: Sending infrastructure health

```sql
CREATE TABLE mailboxes (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,  -- rf-send-01.com
    email VARCHAR(255) UNIQUE NOT NULL,  -- auto1@rf-send-01.com
    health_score INTEGER DEFAULT 100,  -- 0-100
    status VARCHAR(50) DEFAULT 'warmup',  -- warmup|active|paused
    warmup_enabled BOOLEAN DEFAULT TRUE,
    warmup_start_date TIMESTAMP WITH TIME ZONE,
    daily_cap INTEGER DEFAULT 50,
    sent_today INTEGER DEFAULT 0,
    bounce_count_7d INTEGER DEFAULT 0,
    spam_reports_7d INTEGER DEFAULT 0,
    last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    smtp_host VARCHAR(255) NOT NULL,  -- sendgrid.net
    smtp_port INTEGER DEFAULT 587,
    smtp_username VARCHAR(255) NOT NULL,
    smtp_password_encrypted VARCHAR(500) NOT NULL,
    
    CONSTRAINT chk_health_score CHECK (health_score >= 0 AND health_score <= 100),
    CONSTRAINT chk_status CHECK (status IN ('warmup', 'active', 'paused'))
);

CREATE INDEX idx_mailbox_health ON mailboxes(health_score DESC);
CREATE INDEX idx_mailbox_status ON mailboxes(status) WHERE status = 'active';
CREATE INDEX idx_mailbox_sent_today ON mailboxes(sent_today, daily_cap);
```

---

## 3. Triggers & Functions

### 3.1 Auto-Update last_action_at

```sql
CREATE OR REPLACE FUNCTION update_application_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_action_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_application_timestamp
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_application_timestamp();
```

---

### 3.2 Stop Sequence on Reply

```sql
CREATE OR REPLACE FUNCTION stop_sequence_on_reply()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'replied' AND OLD.status != 'replied' THEN
        -- Cancel future steps in same sequence
        UPDATE outreach
        SET status = 'canceled'
        WHERE application_id = NEW.application_id
          AND contact_id = NEW.contact_id
          AND status = 'queued'
          AND step_no > NEW.step_no;
        
        -- Update application status
        UPDATE applications
        SET reply_status = 'replied',
            last_action_at = NOW()
        WHERE id = NEW.application_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outreach_reply
    AFTER UPDATE OF status ON outreach
    FOR EACH ROW
    WHEN (NEW.status = 'replied')
    EXECUTE FUNCTION stop_sequence_on_reply();
```

---

### 3.3 Reset Mailbox Counters Daily

```sql
CREATE OR REPLACE FUNCTION reset_mailbox_counters()
RETURNS void AS $$
BEGIN
    UPDATE mailboxes
    SET sent_today = 0
    WHERE sent_today > 0;
END;
$$ LANGUAGE plpgsql;

-- Schedule via cron (pg_cron extension)
SELECT cron.schedule('reset-mailboxes', '0 0 * * *', 'SELECT reset_mailbox_counters()');
```

---

## 4. Common Queries

### 4.1 Get Applications with Outreach Stats

```sql
SELECT 
    a.id,
    a.status,
    a.match_score,
    j.title AS job_title,
    c.name AS company_name,
    COUNT(o.id) FILTER (WHERE o.status = 'sent') AS emails_sent,
    COUNT(o.id) FILTER (WHERE o.status = 'replied') AS emails_replied,
    MAX(o.sent_at) AS last_outreach_sent
FROM applications a
JOIN jobs j ON a.job_id = j.id
JOIN companies c ON j.company_id = c.id
LEFT JOIN outreach o ON o.application_id = a.id
WHERE a.user_id = $1
GROUP BY a.id, j.id, c.id
ORDER BY a.last_action_at DESC;
```

---

### 4.2 Find Available Mailbox for Sending

```sql
SELECT id, email, daily_cap, sent_today
FROM mailboxes
WHERE status = 'active'
  AND health_score >= 70
  AND sent_today < daily_cap
ORDER BY sent_today ASC  -- Load balance
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

---

### 4.3 Calculate Reply Rate by Sequence

```sql
SELECT 
    st.name AS sequence_name,
    COUNT(o.id) AS total_sent,
    COUNT(o.id) FILTER (WHERE o.status = 'replied') AS total_replied,
    ROUND(100.0 * COUNT(o.id) FILTER (WHERE o.status = 'replied') / COUNT(o.id), 2) AS reply_rate
FROM outreach o
JOIN sequence_templates st ON o.sequence_instance_id = st.id
WHERE o.sent_at > NOW() - INTERVAL '30 days'
GROUP BY st.id, st.name
ORDER BY reply_rate DESC;
```

---

## 5. Maintenance Scripts

### 5.1 Delete Stale Contacts (GDPR Compliance)

```sql
-- Delete contacts 90 days after last outreach
DELETE FROM contacts
WHERE last_contacted_at < NOW() - INTERVAL '90 days'
  AND opted_out = FALSE;
```

---

### 5.2 Archive Old Jobs

```sql
-- Move jobs >90 days old to archive table
INSERT INTO jobs_archive
SELECT * FROM jobs
WHERE posted_date < NOW() - INTERVAL '90 days';

DELETE FROM jobs
WHERE posted_date < NOW() - INTERVAL '90 days';
```

---

### 5.3 Vacuum & Analyze (Performance)

```sql
-- Run weekly (off-peak hours)
VACUUM ANALYZE applications;
VACUUM ANALYZE outreach;
VACUUM ANALYZE contacts;
```

---

**Document Owner**: Database Administrator  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (update as schema evolves)

