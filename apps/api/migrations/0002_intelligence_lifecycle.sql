-- DAYANEXA 0002 — market perception, demand, opportunity, solution, capability, catalog, execution, delivery.
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('search','website','platform','customer','partner','manual')),
  base_url TEXT,
  terms_note TEXT NOT NULL,
  allowed_purposes TEXT NOT NULL DEFAULT 'demand_discovery',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','blocked')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  source_id TEXT REFERENCES sources(id),
  provider_id TEXT NOT NULL,
  collection_method TEXT NOT NULL,
  query TEXT,
  url TEXT,
  title TEXT,
  content_excerpt TEXT,
  content_hash TEXT NOT NULL,
  raw_payload_hash TEXT,
  provider_request_id TEXT,
  observed_at TEXT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  retention_until TEXT,
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN ('captured','normalized','classified','discarded')),
  classification_json TEXT,
  inference_trace_id TEXT,
  created_by TEXT REFERENCES users(id),
  UNIQUE (org_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_signals_org ON signals(org_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS demands (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  origin TEXT NOT NULL CHECK (origin IN ('customer','market')),
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  segment TEXT,
  desired_outcome TEXT,
  urgency TEXT,
  budget_hint_minor INTEGER,
  requester_name TEXT,
  requester_contact TEXT,
  status TEXT NOT NULL DEFAULT 'DEMAND_HYPOTHESIS_CREATED',
  demand_confidence INTEGER CHECK (demand_confidence BETWEEN 0 AND 100),
  validation_note TEXT,
  validated_by TEXT REFERENCES users(id),
  validated_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_demands_org ON demands(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS demand_evidence (
  id TEXT PRIMARY KEY,
  demand_id TEXT NOT NULL REFERENCES demands(id),
  signal_id TEXT REFERENCES signals(id),
  stance TEXT NOT NULL CHECK (stance IN ('supports','contradicts')),
  note TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (demand_id, signal_id)
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  demand_id TEXT NOT NULL REFERENCES demands(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPPORTUNITY_CREATED',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunity_assessments (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  demand_confidence INTEGER NOT NULL CHECK (demand_confidence BETWEEN 0 AND 100),
  commercial_potential INTEGER NOT NULL CHECK (commercial_potential BETWEEN 0 AND 100),
  execution_feasibility INTEGER NOT NULL CHECK (execution_feasibility BETWEEN 0 AND 100),
  strategic_value INTEGER NOT NULL CHECK (strategic_value BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  rationale TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  rubric_version TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('manual','ai_assisted')),
  inference_trace_id TEXT,
  reviewer_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS solutions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product','service','software','package','managed_outcome','partner')),
  description TEXT NOT NULL,
  feasibility_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('agent','tool','provider','human','process','software')),
  description TEXT NOT NULL,
  readiness TEXT NOT NULL DEFAULT 'planned' CHECK (readiness IN ('planned','building','ready','retired')),
  limits_note TEXT,
  cost_note TEXT,
  owner_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS capability_gaps (
  id TEXT PRIMARY KEY,
  solution_id TEXT NOT NULL REFERENCES solutions(id),
  capability_name TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK (resolution IN ('reuse','compose','build','acquire','integrate','partner','contributor','defer','reject')),
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','resolved','rejected')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  solution_id TEXT REFERENCES solutions(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product','service','package','solution','managed','subscription')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  is_public INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  product_id TEXT REFERENCES products(id),
  opportunity_id TEXT REFERENCES opportunities(id),
  customer_org_id TEXT REFERENCES organizations(id),
  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  deliverables TEXT NOT NULL,
  exclusions TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL,
  refund_terms TEXT NOT NULL,
  delivery_days INTEGER NOT NULL CHECK (delivery_days > 0),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','authorization_pending','published','accepted','withdrawn','expired')),
  approval_id TEXT REFERENCES approvals(id),
  valid_until TEXT,
  accepted_by TEXT REFERENCES users(id),
  accepted_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offers_customer ON offers(customer_org_id, status);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  task_profile TEXT NOT NULL,
  allowed_tools_json TEXT NOT NULL DEFAULT '[]',
  daily_neuron_budget INTEGER NOT NULL DEFAULT 500,
  escalation_rule TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active','paused','retired')),
  owner_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  offer_id TEXT NOT NULL REFERENCES offers(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MISSION_PLANNED',
  budget_minor INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  executor_type TEXT NOT NULL CHECK (executor_type IN ('agent','human')),
  agent_id TEXT REFERENCES agents(id),
  assignee_user_id TEXT REFERENCES users(id),
  compensation_minor INTEGER NOT NULL DEFAULT 0 CHECK (compensation_minor >= 0),
  acceptance_criteria TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','blocked','cancelled')),
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_user_id, status);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  task_id TEXT REFERENCES tasks(id),
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quality_reviews (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved','changes_requested')),
  notes TEXT NOT NULL,
  reviewer_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL UNIQUE REFERENCES missions(id),
  delivery_note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_acceptance' CHECK (status IN ('awaiting_acceptance','accepted','disputed')),
  delivered_by TEXT REFERENCES users(id),
  delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  decision_note TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  mission_id TEXT REFERENCES missions(id),
  payment_intent_id TEXT,
  opened_by TEXT REFERENCES users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  resolution TEXT,
  resolved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS lifecycle_transitions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  actor_user_id TEXT,
  correlation_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transitions_entity ON lifecycle_transitions(entity_type, entity_id, created_at);
CREATE TRIGGER IF NOT EXISTS lifecycle_transitions_no_update BEFORE UPDATE ON lifecycle_transitions
BEGIN SELECT RAISE(ABORT, 'lifecycle_transitions is append-only'); END;

CREATE TABLE IF NOT EXISTS learning_records (
  id TEXT PRIMARY KEY,
  mission_id TEXT REFERENCES missions(id),
  opportunity_id TEXT REFERENCES opportunities(id),
  summary TEXT NOT NULL,
  what_worked TEXT,
  what_failed TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
