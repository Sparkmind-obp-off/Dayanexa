-- DAYANEXA 0006 — V2: onboarding/consent, versioned immutable quotes, invoices, entitlement usage events,
-- request drafts, support, privacy requests, contributor task acceptance, separated revenue/tax accounts.

-- Onboarding & consent (Asia/Jakarta shown in UI; timestamps stored UTC).
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE users ADD COLUMN privacy_accepted_at TEXT;
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN onboarded_at TEXT;

-- Versioned quotes. A quote's commercial terms are frozen (snapshot + hash) when submitted for authorization.
ALTER TABLE offers ADD COLUMN demand_id TEXT REFERENCES demands(id);
ALTER TABLE offers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE offers ADD COLUMN quote_group_id TEXT;
ALTER TABLE offers ADD COLUMN superseded_by TEXT;
ALTER TABLE offers ADD COLUMN assumptions TEXT;
ALTER TABLE offers ADD COLUMN payment_terms TEXT;
ALTER TABLE offers ADD COLUMN revision_policy TEXT;
ALTER TABLE offers ADD COLUMN service_layer TEXT NOT NULL DEFAULT 'project' CHECK (service_layer IN ('project','managed'));
ALTER TABLE offers ADD COLUMN estimated_direct_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (estimated_direct_cost_minor >= 0);
ALTER TABLE offers ADD COLUMN min_margin_bps INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE offers ADD COLUMN valid_days INTEGER NOT NULL DEFAULT 14;
ALTER TABLE offers ADD COLUMN snapshot_json TEXT;
ALTER TABLE offers ADD COLUMN snapshot_hash TEXT;
ALTER TABLE offers ADD COLUMN published_at TEXT;
ALTER TABLE offers ADD COLUMN accepted_snapshot_hash TEXT;
UPDATE offers SET quote_group_id = id WHERE quote_group_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_offers_demand ON offers(demand_id);
CREATE INDEX IF NOT EXISTS idx_offers_group ON offers(quote_group_id, version);

CREATE TRIGGER IF NOT EXISTS offers_terms_immutable BEFORE UPDATE ON offers
WHEN OLD.status <> 'draft' AND (
  NEW.title IS NOT OLD.title OR NEW.scope IS NOT OLD.scope OR NEW.deliverables IS NOT OLD.deliverables OR NEW.exclusions IS NOT OLD.exclusions
  OR NEW.acceptance_criteria IS NOT OLD.acceptance_criteria OR NEW.refund_terms IS NOT OLD.refund_terms OR NEW.delivery_days IS NOT OLD.delivery_days
  OR NEW.price_minor IS NOT OLD.price_minor OR NEW.tax_minor IS NOT OLD.tax_minor OR NEW.currency IS NOT OLD.currency
  OR NEW.customer_org_id IS NOT OLD.customer_org_id OR NEW.version IS NOT OLD.version OR NEW.assumptions IS NOT OLD.assumptions
  OR NEW.payment_terms IS NOT OLD.payment_terms OR NEW.revision_policy IS NOT OLD.revision_policy OR NEW.service_layer IS NOT OLD.service_layer
  OR NEW.valid_days IS NOT OLD.valid_days OR NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.snapshot_hash IS NOT OLD.snapshot_hash)
BEGIN SELECT RAISE(ABORT, 'offer terms are immutable after submission; create a new version'); END;

CREATE TRIGGER IF NOT EXISTS offers_acceptance_once BEFORE UPDATE ON offers
WHEN OLD.status = 'accepted' AND NEW.status <> 'accepted'
BEGIN SELECT RAISE(ABORT, 'accepted quotes cannot change state'); END;

-- Entitlement usage events (single source for quota counters; same window in UI and API).
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('request','ai_assist')),
  ref_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_usage_org_kind ON usage_events(org_id, kind, created_at);
INSERT OR IGNORE INTO usage_events (id, org_id, user_id, kind, ref_id, created_at)
  SELECT 'use_' || id, org_id, created_by, 'request', id, created_at FROM demands WHERE origin = 'customer';

-- Invoices: subscription invoices are separate from project/managed quotes and from payment intents.
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL CHECK (kind IN ('subscription','project','managed')),
  subscription_id TEXT,
  offer_id TEXT REFERENCES offers(id),
  payment_intent_id TEXT UNIQUE REFERENCES payment_intents(id),
  description TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor = subtotal_minor + tax_minor),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  mode TEXT NOT NULL CHECK (mode IN ('mock','live')),
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','void','refunded')),
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id, issued_at DESC);

-- Save/resume request drafts (do not consume quota).
CREATE TABLE IF NOT EXISTS request_drafts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customer support.
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  related_type TEXT,
  related_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  staff_reply TEXT,
  replied_by TEXT REFERENCES users(id),
  replied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status, created_at DESC);

-- Privacy: export is immediate; deletion is reviewed (financial/audit records are retained as required).
CREATE TABLE IF NOT EXISTS privacy_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('export','delete')),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_review','completed','rejected')),
  note TEXT,
  handled_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Contributor journey: explicit acceptance of scope/compensation, submission and review notes.
ALTER TABLE tasks ADD COLUMN contributor_decision TEXT CHECK (contributor_decision IN ('accepted','declined'));
ALTER TABLE tasks ADD COLUMN contributor_decided_at TEXT;
ALTER TABLE tasks ADD COLUMN submission_note TEXT;
ALTER TABLE tasks ADD COLUMN submitted_at TEXT;
ALTER TABLE tasks ADD COLUMN review_note TEXT;

-- Separated economic accounts.
INSERT OR IGNORE INTO ledger_accounts (id, code, name, account_type) VALUES
  ('acct-tax-payable', '2400', 'Tax payable (collected from customers)', 'liability'),
  ('acct-subscription-revenue', '4100', 'Subscription access revenue', 'revenue'),
  ('acct-managed-revenue', '4200', 'Managed operations revenue', 'revenue');
