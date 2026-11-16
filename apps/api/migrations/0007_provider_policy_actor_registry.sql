-- DAYANEXA 0007 — persistent provider policy, authorized account profiles, and reviewed Actor registry.
-- Credentials remain Cloudflare secrets. This table stores binding names only, never secret values.
CREATE TABLE IF NOT EXISTS provider_policies (
  provider_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  allow_paid_usage INTEGER NOT NULL DEFAULT 0 CHECK (allow_paid_usage IN (0,1)),
  daily_unit_cap REAL NOT NULL DEFAULT 0 CHECK (daily_unit_cap >= 0),
  monthly_unit_cap REAL NOT NULL DEFAULT 0 CHECK (monthly_unit_cap >= 0),
  daily_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (daily_cost_usd_micros >= 0),
  monthly_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (monthly_cost_usd_micros >= 0),
  per_run_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (per_run_cost_usd_micros >= 0),
  unit_type TEXT NOT NULL DEFAULT 'requests',
  fallback_mode TEXT NOT NULL DEFAULT 'stop' CHECK (fallback_mode IN ('stop','approved_account_pool')),
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS provider_accounts (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  label TEXT NOT NULL,
  secret_binding TEXT NOT NULL,
  ownership_status TEXT NOT NULL DEFAULT 'authorized' CHECK (ownership_status IN ('authorized','pending','revoked')),
  account_status TEXT NOT NULL DEFAULT 'paused' CHECK (account_status IN ('active','paused','exhausted','disabled')),
  plan_name TEXT NOT NULL DEFAULT 'unknown',
  billing_mode TEXT NOT NULL DEFAULT 'free' CHECK (billing_mode IN ('free','prepaid','subscription','payg')),
  daily_unit_cap REAL NOT NULL DEFAULT 0 CHECK (daily_unit_cap >= 0),
  monthly_unit_cap REAL NOT NULL DEFAULT 0 CHECK (monthly_unit_cap >= 0),
  daily_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (daily_cost_usd_micros >= 0),
  monthly_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (monthly_cost_usd_micros >= 0),
  quota_reset_at TEXT,
  terms_reviewed_at TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider_id, secret_binding)
);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_provider_status ON provider_accounts(provider_id, ownership_status, account_status);
CREATE TABLE IF NOT EXISTS actor_registry (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL CHECK (provider_id IN ('apify','scrapely')),
  actor_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  purpose TEXT NOT NULL,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  output_mapping_json TEXT NOT NULL DEFAULT '{}',
  pricing_model TEXT NOT NULL DEFAULT 'unknown',
  terms_reviewed_at TEXT,
  privacy_reviewed_at TEXT,
  per_run_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (per_run_cost_usd_micros >= 0),
  daily_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (daily_cost_usd_micros >= 0),
  monthly_cost_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (monthly_cost_usd_micros >= 0),
  max_items INTEGER NOT NULL DEFAULT 10 CHECK (max_items BETWEEN 1 AND 500),
  timeout_seconds INTEGER NOT NULL DEFAULT 120 CHECK (timeout_seconds BETWEEN 1 AND 3600),
  concurrency_limit INTEGER NOT NULL DEFAULT 1 CHECK (concurrency_limit BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','paused','rejected')),
  version INTEGER NOT NULL DEFAULT 1,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider_id, actor_id)
);
CREATE INDEX IF NOT EXISTS idx_actor_registry_status ON actor_registry(provider_id, status);
