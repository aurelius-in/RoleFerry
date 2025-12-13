-- Outreach sends and status tracking for Week 10 backend work
-- Depends on pgcrypto/gen_random_uuid() from earlier migrations.

CREATE TABLE IF NOT EXISTS outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id TEXT,
  contact_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent', -- 'queued', 'sent', 'failed'
  sent_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  opened_at TIMESTAMP WITHOUT TIME ZONE,
  replied_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_user_campaign ON outreach(user_id, campaign_id);



