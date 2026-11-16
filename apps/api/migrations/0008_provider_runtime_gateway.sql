-- DAYANEXA 0008 — Provider Runtime Gateway (additive only; no data is dropped or rewritten).
-- AccountProfile = provider_accounts (+ columns below). CredentialReference = provider_accounts.secret_binding (name only).
-- Defaults are fail-closed: no capabilities, no multi-account permission, no price, zero caps.

ALTER TABLE provider_accounts ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE provider_accounts ADD COLUMN priority INTEGER NOT NULL DEFAULT 100;
ALTER TABLE provider_accounts ADD COLUMN concurrency_limit INTEGER NOT NULL DEFAULT 1 CHECK (concurrency_limit BETWEEN 1 AND 100);
ALTER TABLE provider_accounts ADD COLUMN per_request_unit_cap REAL NOT NULL DEFAULT 0 CHECK (per_request_unit_cap >= 0);
ALTER TABLE provider_accounts ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'requests';
ALTER TABLE provider_accounts ADD COLUMN unit_price_usd_micros INTEGER CHECK (unit_price_usd_micros IS NULL OR unit_price_usd_micros >= 0);
ALTER TABLE provider_accounts ADD COLUMN data_region TEXT NOT NULL DEFAULT 'global';
ALTER TABLE provider_accounts ADD COLUMN multi_account_terms_ok INTEGER NOT NULL DEFAULT 0 CHECK (multi_account_terms_ok IN (0,1));
ALTER TABLE provider_accounts ADD COLUMN quota_max_age_hours INTEGER NOT NULL DEFAULT 48 CHECK (quota_max_age_hours BETWEEN 1 AND 744);

ALTER TABLE actor_registry ADD COLUMN approval_expires_at TEXT;

ALTER TABLE provider_usage ADD COLUMN account_id TEXT;
ALTER TABLE provider_usage ADD COLUMN reservation_id TEXT;

-- Provider-reported (or official/dashboard) allowance. Never invented: source + verified_at mandatory.
CREATE TABLE IF NOT EXISTS quota_snapshots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES provider_accounts(id),
  unit_type TEXT NOT NULL,
  allowance_units REAL NOT NULL CHECK (allowance_units >= 0),
  used_units_reported REAL NOT NULL DEFAULT 0 CHECK (used_units_reported >= 0),
  window_kind TEXT NOT NULL CHECK (window_kind IN ('day','month','fixed')),
  reset_at TEXT,
  reset_timezone TEXT NOT NULL DEFAULT 'UTC',
  source TEXT NOT NULL CHECK (source IN ('provider_api','account_dashboard','official_published','estimated','unknown')),
  source_note TEXT,
  verified_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quota_snapshots_account ON quota_snapshots(account_id, verified_at);

-- Atomic pre-call reservation → settle / release / unknown_charge. One row per outbound attempt.
CREATE TABLE IF NOT EXISTS usage_reservations (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES provider_accounts(id),
  capability TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  units_reserved REAL NOT NULL CHECK (units_reserved >= 0),
  cost_reserved_usd_micros INTEGER NOT NULL DEFAULT 0 CHECK (cost_reserved_usd_micros >= 0),
  units_actual REAL,
  cost_actual_usd_micros INTEGER,
  status TEXT NOT NULL CHECK (status IN ('reserved','settled','released','unknown_charge')),
  exception TEXT,
  error_code TEXT,
  provider_request_id TEXT,
  org_id TEXT,
  user_id TEXT,
  mission_id TEXT,
  task_ref TEXT,
  purpose TEXT NOT NULL,
  fallback_of TEXT,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  reconciled_by TEXT REFERENCES users(id),
  reconciliation_note TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_usage_res_account_day ON usage_reservations(account_id, day, status);
CREATE INDEX IF NOT EXISTS idx_usage_res_account_month ON usage_reservations(account_id, month, status);
CREATE INDEX IF NOT EXISTS idx_usage_res_provider_day ON usage_reservations(provider_id, day, status);
CREATE INDEX IF NOT EXISTS idx_usage_res_task ON usage_reservations(task_ref, day, status);
CREATE INDEX IF NOT EXISTS idx_usage_res_status ON usage_reservations(status, created_at);

-- Scoped owner approvals (paid usage etc.). Must carry cap, period and expiry.
CREATE TABLE IF NOT EXISTS provider_approvals (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES provider_accounts(id),
  capability TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('paid_usage')),
  max_spend_usd_micros INTEGER NOT NULL CHECK (max_spend_usd_micros > 0),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  approved_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_approvals_account ON provider_approvals(account_id, capability, status);

-- Compliant fallback: outage only. The CHECK makes rate-limit/ban/quota/terms rotation unrepresentable.
CREATE TABLE IF NOT EXISTS fallback_rules (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  primary_account_id TEXT NOT NULL REFERENCES provider_accounts(id),
  fallback_account_id TEXT NOT NULL REFERENCES provider_accounts(id),
  trigger_kind TEXT NOT NULL DEFAULT 'upstream_error' CHECK (trigger_kind IN ('upstream_error')),
  priority INTEGER NOT NULL DEFAULT 100,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  approved_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (primary_account_id <> fallback_account_id)
);
CREATE INDEX IF NOT EXISTS idx_fallback_rules_primary ON fallback_rules(primary_account_id, capability, status);

-- Persistent circuit breaker per account (survives isolates).
CREATE TABLE IF NOT EXISTS circuit_breakers (
  account_id TEXT PRIMARY KEY REFERENCES provider_accounts(id),
  failures INTEGER NOT NULL DEFAULT 0,
  open_until TEXT,
  error_class TEXT CHECK (error_class IS NULL OR error_class IN ('outage','rate_limited','auth_denied')),
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);
