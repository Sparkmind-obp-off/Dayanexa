-- DAYANEXA 0004 — payment intents/events, refunds, payouts, costs, double-entry ledger.
CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  offer_id TEXT REFERENCES offers(id),
  provider TEXT NOT NULL CHECK (provider IN ('mock','duitku','xendit','midtrans','faspay')),
  mode TEXT NOT NULL CHECK (mode IN ('mock','live')),
  merchant_order_id TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT,
  provider_reference TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PENDING','SUCCEEDED','FAILED','EXPIRED','REFUND_PENDING','REFUNDED','REFUND_FAILED','DISPUTED','RECONCILIATION_REQUIRED')),
  checkout_url TEXT,
  idempotency_key TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_org ON payment_intents(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_offer ON payment_intents(offer_id);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  merchant_order_id TEXT,
  event_type TEXT NOT NULL,
  normalized_status TEXT NOT NULL,
  amount INTEGER,
  currency TEXT,
  payload_hash TEXT NOT NULL,
  payload_redacted_json TEXT NOT NULL,
  processing_outcome TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  UNIQUE (provider, provider_event_id)
);
CREATE TRIGGER IF NOT EXISTS payment_events_no_delete BEFORE DELETE ON payment_events
BEGIN SELECT RAISE(ABORT, 'payment_events are immutable'); END;

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL REFERENCES payment_intents(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approval_pending' CHECK (status IN ('approval_pending','approved','submitted','refunded','failed','rejected')),
  approval_id TEXT REFERENCES approvals(id),
  provider_refund_id TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payout_requests (
  id TEXT PRIMARY KEY,
  contributor_user_id TEXT NOT NULL REFERENCES users(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'approval_pending' CHECK (status IN ('approval_pending','approved','rejected','paid_externally')),
  approval_id TEXT REFERENCES approvals(id),
  external_reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (task_id)
);

CREATE TABLE IF NOT EXISTS cost_records (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  mission_id TEXT REFERENCES missions(id),
  category TEXT NOT NULL CHECK (category IN ('ai','search','scraping','contributor','gateway_fee','partner','other')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ledger_journals (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  description TEXT NOT NULL,
  reverses_journal_id TEXT REFERENCES ledger_journals(id),
  created_by TEXT,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL REFERENCES ledger_journals(id),
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal ON ledger_entries(journal_id);
CREATE TRIGGER IF NOT EXISTS ledger_entries_immutable_u BEFORE UPDATE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger entries are immutable; post a reversal'); END;
CREATE TRIGGER IF NOT EXISTS ledger_entries_immutable_d BEFORE DELETE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger entries are immutable; post a reversal'); END;
CREATE TRIGGER IF NOT EXISTS ledger_journals_guard BEFORE UPDATE ON ledger_journals
WHEN NOT (OLD.status = 'posted' AND NEW.status = 'reversed' AND OLD.source_type = NEW.source_type AND OLD.source_id = NEW.source_id AND OLD.description = NEW.description)
BEGIN SELECT RAISE(ABORT, 'posted journals are immutable except posted->reversed'); END;
CREATE TRIGGER IF NOT EXISTS ledger_journals_no_delete BEFORE DELETE ON ledger_journals
BEGIN SELECT RAISE(ABORT, 'journals cannot be deleted'); END;

INSERT OR IGNORE INTO ledger_accounts (id, code, name, account_type) VALUES
  ('acct-gateway-clearing', '1000', 'Gateway clearing (receivable from gateway)', 'asset'),
  ('acct-bank', '1100', 'Bank (settled funds)', 'asset'),
  ('acct-contributor-payable', '2100', 'Contributor payable', 'liability'),
  ('acct-refunds-payable', '2200', 'Customer refunds payable', 'liability'),
  ('acct-unearned-revenue', '2300', 'Unearned revenue (paid, not yet accepted)', 'liability'),
  ('acct-platform-revenue', '4000', 'Recognized revenue (accepted outcomes)', 'revenue'),
  ('acct-gateway-fees', '5000', 'Payment gateway fees', 'expense'),
  ('acct-contributor-cost', '5100', 'Contributor compensation', 'expense'),
  ('acct-provider-cost', '5200', 'AI / data provider cost', 'expense');
