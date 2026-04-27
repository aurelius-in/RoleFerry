-- Persistent reply storage for Instantly webhook events and polling.
-- Links to outreach table via contact_email + campaign_id.

CREATE TABLE IF NOT EXISTS reply (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'demo-user',
  outreach_id UUID REFERENCES outreach(id) ON DELETE SET NULL,
  campaign_id TEXT,
  contact_email TEXT NOT NULL,
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body TEXT,
  label TEXT DEFAULT 'neutral',
  source TEXT DEFAULT 'webhook',
  received_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reply_contact ON reply(contact_email);
CREATE INDEX IF NOT EXISTS idx_reply_campaign ON reply(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reply_outreach ON reply(outreach_id);

-- Add reply_body column to outreach so we can show the latest reply inline.
ALTER TABLE outreach ADD COLUMN IF NOT EXISTS reply_body TEXT;
ALTER TABLE outreach ADD COLUMN IF NOT EXISTS reply_label TEXT;
