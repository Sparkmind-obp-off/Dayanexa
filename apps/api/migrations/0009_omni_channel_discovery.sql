-- DAYANEXA 0009 — Omni-Channel Demand Discovery (docs/31). Additive only; nothing is dropped or rewritten.
-- Reuses: signals (canonical evidence), demands/demand_evidence (handoff), usage_reservations (gateway),
-- actor_registry (Actor mapping), audit_events. New: versioned member discovery policy, source catalog with
-- permission review, discovery campaigns + child source jobs, campaign entitlement ledger, program budget
-- and campaign envelope reservations. Defaults are fail-closed: no source is approved, no budget exists.

-- MemberDiscoveryPolicy: versioned, plan-scoped, never email-scoped.
CREATE TABLE IF NOT EXISTS discovery_policies (
  id TEXT PRIMARY KEY,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('free','pro','plus')),
  version INTEGER NOT NULL CHECK (version >= 1),
  period_days INTEGER NOT NULL DEFAULT 30 CHECK (period_days BETWEEN 1 AND 366),
  guaranteed_campaigns INTEGER NOT NULL CHECK (guaranteed_campaigns >= 0),
  conditional_bonus_campaigns INTEGER NOT NULL DEFAULT 0 CHECK (conditional_bonus_campaigns >= 0),
  bonus_min_headroom_pct INTEGER NOT NULL DEFAULT 50 CHECK (bonus_min_headroom_pct BETWEEN 0 AND 100),
  max_channels INTEGER NOT NULL DEFAULT 4 CHECK (max_channels BETWEEN 1 AND 20),
  max_items_per_job INTEGER NOT NULL DEFAULT 8 CHECK (max_items_per_job BETWEEN 1 AND 50),
  max_units_per_job REAL NOT NULL DEFAULT 1 CHECK (max_units_per_job > 0),
  max_attempts_per_job INTEGER NOT NULL DEFAULT 2 CHECK (max_attempts_per_job BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (plan_code, version)
);
CREATE INDEX IF NOT EXISTS idx_discovery_policies_plan ON discovery_policies(plan_code, status, version DESC);
INSERT OR IGNORE INTO discovery_policies (id,plan_code,version,period_days,guaranteed_campaigns,conditional_bonus_campaigns,bonus_min_headroom_pct,max_channels,max_items_per_job,max_units_per_job,max_attempts_per_job,note,created_by)
VALUES
  ('dpol_free_v1','free',1,30,1,1,50,4,8,1,2,'docs/31 launch baseline: 1 guaranteed + up to 1 conditional campaign per rolling 30 days.','migration'),
  ('dpol_pro_v1','pro',1,30,4,0,50,6,10,1,2,'Initial Pro discovery policy; adjust by publishing a new version.','migration'),
  ('dpol_plus_v1','plus',1,30,10,0,50,8,10,1,2,'Initial Plus discovery policy; adjust by publishing a new version.','migration');

-- Source catalog. Listing != runnable: execution requires permission_status='approved', unexpired review,
-- access_status='public', availability='available' and a ready provider route.
CREATE TABLE IF NOT EXISTS discovery_sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('search_scope','community','forum','qna','web_domain','directory','social','page')),
  name TEXT NOT NULL,
  identifier TEXT,
  base_url TEXT,
  description TEXT,
  topics_json TEXT NOT NULL DEFAULT '[]',
  categories_json TEXT NOT NULL DEFAULT '[]',
  geography TEXT NOT NULL DEFAULT 'global',
  language TEXT NOT NULL DEFAULT 'any',
  access_status TEXT NOT NULL DEFAULT 'unknown' CHECK (access_status IN ('public','login_required','private','restricted','unknown')),
  permission_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (permission_status IN ('unreviewed','pending_review','approved','rejected','suspended')),
  commercial_use TEXT NOT NULL DEFAULT 'unclear' CHECK (commercial_use IN ('allowed','restricted','unclear')),
  collection_method TEXT NOT NULL CHECK (collection_method IN ('search_scoped','search_open','page_extract','actor')),
  provider_id TEXT NOT NULL CHECK (provider_id IN ('tavily','firecrawl','apify','scrapely')),
  capability TEXT NOT NULL,
  scope_domains_json TEXT NOT NULL DEFAULT '[]',
  actor_registry_id TEXT REFERENCES actor_registry(id),
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','paused','unavailable')),
  limitations TEXT NOT NULL DEFAULT '',
  freshness_note TEXT,
  origin TEXT NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated','member_hint')),
  submitted_by_org TEXT REFERENCES organizations(id),
  submitted_by_user TEXT REFERENCES users(id),
  hint_input TEXT,
  validation_json TEXT NOT NULL DEFAULT '{}',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_expires_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- An approved source must be public, have a reviewer and an expiry. Unrepresentable otherwise.
  CHECK (permission_status <> 'approved' OR (access_status = 'public' AND reviewed_by IS NOT NULL AND review_expires_at IS NOT NULL)),
  -- Actor routes must point at a registry entry.
  CHECK (collection_method <> 'actor' OR actor_registry_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_discovery_sources_status ON discovery_sources(permission_status, availability, platform);
CREATE INDEX IF NOT EXISTS idx_discovery_sources_hint ON discovery_sources(submitted_by_org, origin);

-- Append-only permission review lifecycle.
CREATE TABLE IF NOT EXISTS discovery_source_reviews (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES discovery_sources(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  commercial_use TEXT,
  note TEXT NOT NULL,
  expires_at TEXT,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discovery_source_reviews ON discovery_source_reviews(source_id, created_at);
CREATE TRIGGER IF NOT EXISTS discovery_source_reviews_no_update BEFORE UPDATE ON discovery_source_reviews
BEGIN SELECT RAISE(ABORT, 'discovery_source_reviews is append-only'); END;
CREATE TRIGGER IF NOT EXISTS discovery_source_reviews_no_delete BEFORE DELETE ON discovery_source_reviews
BEGIN SELECT RAISE(ABORT, 'discovery_source_reviews is append-only'); END;

-- DiscoveryProgramBudget: DAYANEXA's owner-approved allocation funding member campaigns, per provider/unit/month.
CREATE TABLE IF NOT EXISTS discovery_program_budgets (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  month_units_cap REAL NOT NULL CHECK (month_units_cap > 0),
  per_org_month_units_cap REAL NOT NULL CHECK (per_org_month_units_cap > 0),
  bonus_enabled INTEGER NOT NULL DEFAULT 0 CHECK (bonus_enabled IN (0,1)),
  funding_class TEXT NOT NULL DEFAULT 'verified_free_allowance' CHECK (funding_class IN ('verified_free_allowance','approved_paid_allocation')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked')),
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL REFERENCES users(id),
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discovery_budgets_provider ON discovery_program_budgets(provider_id, unit_type, status);

-- DiscoveryCampaign (parent). Owns the entitlement and the aggregate budget envelope.
CREATE TABLE IF NOT EXISTS discovery_campaigns (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single','multi','omni')),
  title TEXT NOT NULL,
  brief_json TEXT NOT NULL,
  brief_hash TEXT NOT NULL,
  scope_hash TEXT,
  requested_sources_json TEXT NOT NULL DEFAULT '[]',
  scope_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','VALIDATING','SCOPE_READY','RESERVED','QUEUED','RUNNING','RECONCILING','COMPLETED','PARTIAL','FAILED','CANCELLED')),
  status_reason TEXT,
  blocked_code TEXT,
  policy_id TEXT REFERENCES discovery_policies(id),
  policy_version INTEGER,
  parent_campaign_id TEXT REFERENCES discovery_campaigns(id),
  cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0,1)),
  channels_planned INTEGER NOT NULL DEFAULT 0,
  channels_succeeded INTEGER NOT NULL DEFAULT 0,
  channels_empty INTEGER NOT NULL DEFAULT 0,
  channels_failed INTEGER NOT NULL DEFAULT 0,
  channels_unavailable INTEGER NOT NULL DEFAULT 0,
  records_total INTEGER NOT NULL DEFAULT 0,
  records_unique INTEGER NOT NULL DEFAULT 0,
  records_duplicate INTEGER NOT NULL DEFAULT 0,
  independent_sources INTEGER NOT NULL DEFAULT 0,
  units_reserved REAL NOT NULL DEFAULT 0,
  units_actual REAL NOT NULL DEFAULT 0,
  cost_actual_usd_micros INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  UNIQUE (org_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_discovery_campaigns_org ON discovery_campaigns(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_campaigns_user ON discovery_campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_campaigns_status ON discovery_campaigns(status, updated_at);

-- DiscoveryJob / SourceRun (child). One per approved source in scope. Never owns an entitlement.
CREATE TABLE IF NOT EXISTS discovery_jobs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES discovery_campaigns(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  source_id TEXT NOT NULL REFERENCES discovery_sources(id),
  provider_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  collection_method TEXT NOT NULL,
  query TEXT NOT NULL,
  max_items INTEGER NOT NULL,
  units_planned REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','QUEUED','RUNNING','SUCCEEDED','EMPTY','FAILED','CANCELLED','SKIPPED','UNKNOWN_CHARGE')),
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  dispatched INTEGER NOT NULL DEFAULT 0 CHECK (dispatched IN (0,1)),
  lease_until TEXT,
  lease_token TEXT,
  reservation_id TEXT,
  provider_run_id TEXT,
  account_label TEXT,
  units_actual REAL NOT NULL DEFAULT 0,
  cost_actual_usd_micros INTEGER NOT NULL DEFAULT 0,
  records_returned INTEGER NOT NULL DEFAULT 0,
  records_new INTEGER NOT NULL DEFAULT 0,
  records_duplicate INTEGER NOT NULL DEFAULT 0,
  records_dropped INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_campaign ON discovery_jobs(campaign_id, status);

-- MemberDiscoveryEntitlement ledger: one row per campaign. Child jobs never create rows.
-- Counted states: reserved + consumed. released / waived never count against the allowance.
-- A retry of the same campaign re-uses this single row; it can never create a second entitlement.
CREATE TABLE IF NOT EXISTS discovery_entitlements (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE REFERENCES discovery_campaigns(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  policy_id TEXT NOT NULL REFERENCES discovery_policies(id),
  policy_version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('guaranteed','bonus')),
  state TEXT NOT NULL CHECK (state IN ('reserved','consumed','released','waived')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  consumed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_discovery_ent_member ON discovery_entitlements(org_id, user_id, state, created_at);

-- Campaign envelope: aggregate pre-reservation against the program budget (per provider/unit).
CREATE TABLE IF NOT EXISTS discovery_envelopes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES discovery_campaigns(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  budget_id TEXT NOT NULL REFERENCES discovery_program_budgets(id),
  provider_id TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  units_reserved REAL NOT NULL CHECK (units_reserved >= 0),
  units_actual REAL,
  status TEXT NOT NULL CHECK (status IN ('reserved','settled','released')),
  month TEXT NOT NULL,
  created_at TEXT NOT NULL,
  settled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_discovery_env_budget ON discovery_envelopes(budget_id, month, status);
CREATE INDEX IF NOT EXISTS idx_discovery_env_campaign ON discovery_envelopes(campaign_id, status);

-- Evidence provenance on the canonical signals entity (no duplicate evidence model).
ALTER TABLE signals ADD COLUMN source_catalog_id TEXT;
ALTER TABLE signals ADD COLUMN platform TEXT;
ALTER TABLE signals ADD COLUMN community TEXT;
ALTER TABLE signals ADD COLUMN canonical_url TEXT;
ALTER TABLE signals ADD COLUMN fingerprint TEXT;
ALTER TABLE signals ADD COLUMN independent_source_key TEXT;
ALTER TABLE signals ADD COLUMN adapter TEXT;
ALTER TABLE signals ADD COLUMN actor_version TEXT;
ALTER TABLE signals ADD COLUMN evidence_quality TEXT;
ALTER TABLE signals ADD COLUMN signal_kind TEXT;
ALTER TABLE signals ADD COLUMN heuristic_json TEXT;
CREATE INDEX IF NOT EXISTS idx_signals_fingerprint ON signals(org_id, fingerprint);

-- Per-campaign occurrence of evidence (a signal can be observed by several campaigns/channels).
CREATE TABLE IF NOT EXISTS discovery_campaign_evidence (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES discovery_campaigns(id),
  job_id TEXT NOT NULL REFERENCES discovery_jobs(id),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  signal_id TEXT NOT NULL REFERENCES signals(id),
  source_id TEXT NOT NULL REFERENCES discovery_sources(id),
  rank INTEGER,
  provider_score REAL,
  duplicate_kind TEXT NOT NULL DEFAULT 'unique' CHECK (duplicate_kind IN ('unique','exact_duplicate','syndicated_copy')),
  duplicate_of TEXT REFERENCES discovery_campaign_evidence(id),
  independent_source_key TEXT NOT NULL,
  text_fingerprint TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, job_id, signal_id)
);
CREATE INDEX IF NOT EXISTS idx_dce_campaign ON discovery_campaign_evidence(campaign_id, duplicate_kind);

-- Curated catalog seed. EVERY entry starts 'pending_review' with no reviewer: nothing is runnable until the
-- owner reviews the exact collection method and commercial use. Methods are search-index scoped (Tavily),
-- i.e. publicly indexed pages only — no login, no private groups, no platform scraping.
INSERT OR IGNORE INTO discovery_sources (id,slug,platform,source_type,name,identifier,base_url,description,topics_json,categories_json,geography,language,access_status,permission_status,commercial_use,collection_method,provider_id,capability,scope_domains_json,limitations,freshness_note) VALUES
 ('dsrc_web_open_id','web-open-id','web','search_scope','Web publik (Indonesia)',NULL,NULL,'Pencarian web terbuka untuk halaman publik yang terindeks, fokus Indonesia.','["umum","bisnis","layanan","produk"]','["service_need","product_gap","complaint","msme_ops","software_ai","b2b","local","education","work_signal","custom"]','ID','id','public','pending_review','unclear','search_open','tavily','search','[]','Hanya halaman yang terindeks mesin pencari; bukan sampel representatif pasar.','Bergantung indeks penyedia pencarian.'),
 ('dsrc_web_open_gl','web-open-global','web','search_scope','Web publik (global)',NULL,NULL,'Pencarian web terbuka untuk halaman publik yang terindeks, global/English.','["general","business","services","products"]','["service_need","product_gap","complaint","msme_ops","software_ai","b2b","education","work_signal","custom"]','global','en','public','pending_review','unclear','search_open','tavily','search','[]','Only search-indexed public pages; not a representative market sample.','Depends on the search provider index.'),
 ('dsrc_reddit_all','reddit-public','reddit','community','Reddit — diskusi publik','reddit.com','https://www.reddit.com','Thread publik Reddit yang terindeks mesin pencari (bukan crawl Reddit).','["discussion","recommendations","complaints"]','["service_need","product_gap","complaint","software_ai","education","custom"]','global','en','public','pending_review','unclear','search_scoped','tavily','search','["reddit.com"]','Hanya cuplikan thread publik yang terindeks; komentar penuh tidak dikumpulkan; tidak memakai Reddit API.','Indeks bisa tertinggal beberapa hari.'),
 ('dsrc_reddit_indonesia','reddit-r-indonesia','reddit','community','Reddit — r/indonesia','r/indonesia','https://www.reddit.com/r/indonesia','Diskusi publik subreddit r/indonesia yang terindeks.','["indonesia","daily life","consumer"]','["service_need","product_gap","complaint","local","work_signal","custom"]','ID','id','public','pending_review','unclear','search_scoped','tavily','search','["reddit.com"]','Hanya halaman publik terindeks; bukan crawl subreddit.','Indeks bisa tertinggal.'),
 ('dsrc_reddit_smallbusiness','reddit-r-smallbusiness','reddit','community','Reddit — r/smallbusiness','r/smallbusiness','https://www.reddit.com/r/smallbusiness','Diskusi pemilik usaha kecil (publik, terindeks).','["small business","operations","marketing"]','["msme_ops","software_ai","b2b","service_need"]','global','en','public','pending_review','unclear','search_scoped','tavily','search','["reddit.com"]','Hanya halaman publik terindeks.','Indeks bisa tertinggal.'),
 ('dsrc_kaskus','kaskus-forum','kaskus','forum','Kaskus — forum publik','kaskus.co.id','https://www.kaskus.co.id','Thread publik forum Kaskus yang terindeks.','["forum","jual beli","teknologi","bisnis"]','["service_need","product_gap","complaint","msme_ops","local","work_signal"]','ID','id','public','pending_review','unclear','search_scoped','tavily','search','["kaskus.co.id"]','Hanya thread publik terindeks; tidak login, tidak crawl forum.','Indeks bisa tertinggal.'),
 ('dsrc_quora','quora-public','quora','qna','Quora — tanya jawab publik','quora.com','https://www.quora.com','Pertanyaan publik Quora yang terindeks.','["questions","advice"]','["service_need","product_gap","education","software_ai","custom"]','global','any','public','pending_review','unclear','search_scoped','tavily','search','["quora.com"]','Hanya halaman publik terindeks; jawaban penuh dapat terpotong.','Indeks bisa tertinggal.'),
 ('dsrc_stackexchange','stackexchange-public','stackexchange','qna','Stack Exchange — Q&A publik','stackexchange.com','https://stackexchange.com','Pertanyaan teknis publik jaringan Stack Exchange/Stack Overflow.','["software","automation","tools"]','["software_ai","msme_ops","b2b"]','global','en','public','pending_review','unclear','search_scoped','tavily','search','["stackoverflow.com","stackexchange.com"]','Konten CC BY-SA; atribusi wajib jika dipublikasikan ulang.','Indeks bisa tertinggal.'),
 ('dsrc_youtube','youtube-public','youtube','social','YouTube — halaman video publik','youtube.com','https://www.youtube.com','Halaman video publik yang terindeks (judul/deskripsi).','["video","review","tutorial"]','["product_gap","complaint","education","software_ai"]','global','any','public','pending_review','unclear','search_scoped','tavily','search','["youtube.com"]','Komentar tidak dikumpulkan; hanya metadata halaman yang terindeks.','Indeks bisa tertinggal.'),
 ('dsrc_threads','threads-public','threads','social','Threads — postingan publik terindeks','threads.net','https://www.threads.net','Postingan publik Threads yang muncul di indeks pencarian.','["social","consumer"]','["service_need","product_gap","complaint","local","custom"]','global','any','public','pending_review','unclear','search_scoped','tavily','search','["threads.net"]','Cakupan indeks sangat terbatas; tidak memakai Threads API; tidak login.','Indeks sangat tidak lengkap.'),
 ('dsrc_facebook_pages','facebook-public-pages','facebook','social','Facebook — halaman publik terindeks','facebook.com','https://www.facebook.com','Halaman/postingan publik Facebook yang muncul di indeks pencarian. Grup privat dikecualikan.','["social","local business"]','["service_need","complaint","local","msme_ops"]','global','any','public','pending_review','unclear','search_scoped','tavily','search','["facebook.com"]','Hanya konten publik terindeks; grup privat/tertutup tidak pernah diakses.','Indeks sangat tidak lengkap.');
