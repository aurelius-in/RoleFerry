-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Lead qualification core tables
CREATE TABLE IF NOT EXISTS lead_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prospect (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_domain_id UUID REFERENCES lead_domain(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  linkedin_url TEXT,
  company TEXT,
  confidence DOUBLE PRECISION,
  raw_preview_json JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_domain ON prospect(lead_domain_id);

CREATE TABLE IF NOT EXISTS prospect_qualification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospect(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  reason TEXT,
  model TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qual_prospect ON prospect_qualification(prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS prospect_contact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospect(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  provider TEXT,
  verification_status TEXT,
  verification_score INTEGER,
  verified_by TEXT,
  verified_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_prospect ON prospect_contact(prospect_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_cost_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospect(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  units DOUBLE PRECISION NOT NULL,
  unit_type TEXT NOT NULL,
  est_cost_usd NUMERIC(8,4) NOT NULL DEFAULT 0,
  meta JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_prospect ON pipeline_cost_ledger(prospect_id);

-- Summary view: latest qual + latest contact + total cost
CREATE OR REPLACE VIEW v_prospect_summary AS
WITH last_qual AS (
  SELECT DISTINCT ON (prospect_id) prospect_id, decision, reason, model, latency_ms, created_at
  FROM prospect_qualification
  ORDER BY prospect_id, created_at DESC
), last_contact AS (
  SELECT DISTINCT ON (prospect_id) prospect_id, email, phone, provider, verification_status, verification_score, verified_by, verified_at, created_at
  FROM prospect_contact
  ORDER BY prospect_id, created_at DESC
), costs AS (
  SELECT prospect_id, SUM(est_cost_usd) AS total_cost
  FROM pipeline_cost_ledger
  GROUP BY prospect_id
)
SELECT p.id AS prospect_id, d.domain, p.name, p.title, p.linkedin_url, p.company,
       lq.decision, lq.reason, lc.email, lc.verification_status, lc.verification_score,
       COALESCE(c.total_cost, 0) AS total_cost_usd
FROM prospect p
LEFT JOIN lead_domain d ON d.id = p.lead_domain_id
LEFT JOIN last_qual lq ON lq.prospect_id = p.id
LEFT JOIN last_contact lc ON lc.prospect_id = p.id
LEFT JOIN costs c ON c.prospect_id = p.id;


