-- Subscription intents for stubbed upgrade/cancel flows
CREATE TABLE IF NOT EXISTS subscription_intent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'upgrade' or 'cancel'
    target_plan TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_intent_user ON subscription_intent(user_id);


