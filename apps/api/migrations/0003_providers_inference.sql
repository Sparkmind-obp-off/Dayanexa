-- DAYANEXA 0003 — provider usage/cost governance and inference traces.
CREATE TABLE IF NOT EXISTS provider_usage (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  org_id TEXT,
  user_id TEXT,
  units REAL NOT NULL DEFAULT 0,
  unit_type TEXT NOT NULL,
  usage_estimated INTEGER NOT NULL DEFAULT 1,
  estimated_cost_usd_micros INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success','failure','denied')),
  error_code TEXT,
  provider_request_id TEXT,
  latency_ms INTEGER,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_provider_usage_day ON provider_usage(provider_id, day);

CREATE TABLE IF NOT EXISTS inference_traces (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  task_profile TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT,
  policy_decision TEXT NOT NULL,
  request_id TEXT,
  provider_request_id TEXT,
  org_id TEXT,
  user_id TEXT,
  input_chars INTEGER NOT NULL DEFAULT 0,
  output_chars INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_neurons REAL NOT NULL DEFAULT 0,
  usage_estimated INTEGER NOT NULL DEFAULT 1,
  usage_payload_json TEXT,
  latency_ms INTEGER,
  finish_reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','failure','denied','invalid_output')),
  error_code TEXT,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inference_day ON inference_traces(provider_id, day);
CREATE INDEX IF NOT EXISTS idx_inference_month ON inference_traces(provider_id, month);

CREATE TABLE IF NOT EXISTS provider_benchmarks (
  id TEXT PRIMARY KEY,
  source_label TEXT NOT NULL,
  provider_id TEXT NOT NULL CHECK (provider_id IN ('apify','scrapely')),
  actor_id TEXT NOT NULL,
  items_returned INTEGER NOT NULL DEFAULT 0,
  items_accepted INTEGER NOT NULL DEFAULT 0,
  cost_usd_micros INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  success INTEGER NOT NULL,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
