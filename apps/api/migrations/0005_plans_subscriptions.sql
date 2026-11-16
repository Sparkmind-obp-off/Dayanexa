-- DAYANEXA 0005 — SaaS plans (Free/Pro/Plus) subscriptions and payment purpose.
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_code TEXT NOT NULL CHECK (plan_code IN ('free','pro','plus')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','canceled','expired')),
  current_period_start TEXT,
  current_period_end TEXT,
  payment_intent_id TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id, status);
ALTER TABLE payment_intents ADD COLUMN purpose TEXT NOT NULL DEFAULT 'offer';
ALTER TABLE payment_intents ADD COLUMN plan_code TEXT;
