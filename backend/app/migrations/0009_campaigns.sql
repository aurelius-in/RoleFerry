-- Week 12+: Persisted multi-recipient campaigns
-- A campaign groups many rows (contacts/roles/companies) and stores flexible JSON snapshots
-- for context and composed emails.

CREATE TABLE IF NOT EXISTS campaign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_user_created ON campaign(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_row (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- Spreadsheet-like columns (initial set mirrors example_campaign_spreadsheet.csv)
  email TEXT,
  email_provider TEXT,
  lead_status TEXT,
  first_name TEXT,
  last_name TEXT,
  verification_status TEXT,
  interest_status TEXT,
  website TEXT,
  job_title TEXT,
  linkedin TEXT,
  employees INTEGER,
  company_name TEXT,
  applied_job_link TEXT,
  applied_job_title TEXT,
  personalized_page TEXT,

  -- Extensibility: store richer structures without schema churn
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  emails JSONB NOT NULL DEFAULT '{}'::jsonb,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_row_campaign ON campaign_row(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_row_user_campaign ON campaign_row(user_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_row_campaign_email ON campaign_row(campaign_id, email);

