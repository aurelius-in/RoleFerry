-- Core RoleFerry entities for Week 9 backend work
-- Note: uses pgcrypto from 0001_leads.sql for gen_random_uuid()

-- Job preferences stored as a single JSON document per user
CREATE TABLE IF NOT EXISTS job_preferences (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Resumes: raw text plus parsed JSON from rule-based parser
CREATE TABLE IF NOT EXISTS resume (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  raw_text TEXT,
  parsed_json JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_user ON resume(user_id, created_at DESC);

-- Jobs the user is tracking / applying to
CREATE TABLE IF NOT EXISTS job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  url TEXT,
  content TEXT,
  parsed_json JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_user ON job(user_id, created_at DESC);

-- Applications link a user to a specific job and track status in the funnel
CREATE TABLE IF NOT EXISTS application (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  job_id UUID REFERENCES job(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved',
  applied_at TIMESTAMP WITHOUT TIME ZONE,
  last_action_at TIMESTAMP WITHOUT TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_user_status ON application(user_id, status);

-- Pain point matches between a JD and a resume for a given user
CREATE TABLE IF NOT EXISTS pain_point_match (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  job_id UUID REFERENCES job(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resume(id) ON DELETE SET NULL,
  challenge_text TEXT NOT NULL,
  solution_text TEXT NOT NULL,
  relevance_score DOUBLE PRECISION,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pain_point_match_user_job ON pain_point_match(user_id, job_id);

-- Offers generated for a given application
CREATE TABLE IF NOT EXISTS offer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  application_id UUID REFERENCES application(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  tone TEXT,
  length_preset TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);


