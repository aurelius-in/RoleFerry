-- Week 11: add verification fields to outreach sends

ALTER TABLE outreach
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS verification_score DOUBLE PRECISION;



