-- Week 12: beta feedback survey responses with pricing willingness

CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT,
  nps_score INTEGER,
  would_pay_499 BOOLEAN,
  suggested_price TEXT,
  feedback_text TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user ON beta_feedback(user_id, created_at DESC);



