/**
 * Omni-Channel Demand Discovery API (docs/31).
 * Member routes: tenant-scoped by the caller's own organization memberships (never workspace:read).
 * Admin routes (/admin/discovery/*): owner-only (provider:admin) — source permission review, program budgets,
 * versioned policies and the cross-tenant operations view.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/ratelimit";
import { assertCan } from "../auth/policy";
import { many, one } from "../lib/db";
import { fail } from "../lib/http";
import { newId, nowIso } from "../lib/ids";
import { body, optText, text } from "../lib/validate";
import { audit, auditStatement } from "../services/audit";
import { assertEntitlement, usageStatement } from "../services/entitlements";
import { activeBudgets, memberDiscoveryStatus } from "../discovery/entitlements";
import { fullEligibility, parseList, publicSource, routeChecker, validateHint, visibleSources } from "../discovery/catalog";
import { cancelCampaign, createCampaign, loadOwned, retryCampaign, runCampaign, startCampaign, type Brief } from "../discovery/engine";
import { themes } from "../discovery/evidence";
import { CATEGORY_CODES, DEMAND_CATEGORIES, GEO_CODES, GEOGRAPHIES, LANG_CODES, LANGUAGES, LIMITATIONS, reasonFor, TERMINAL } from "../discovery/taxonomy";
import { D, notifyStaff, P, RID } from "./helpers";

export const discovery = new Hono<AppEnv>();
type Row = Record<string, any>;

const SOURCE_ID = z.string().regex(/^dsrc_[a-z0-9_]{3,60}$/);
const campaignId = (c: { req: { param: (k: string) => string | undefined } }) => {
  const v = c.req.param("id") ?? "";
  if (!/^dcmp_[a-z0-9]{10,40}$/.test(v)) fail(400, "INVALID_ID");
  return v;
};
const idem = (c: { req: { header: (k: string) => string | undefined } }) => {
  const h = c.req.header("idempotency-key");
  if (!h || !/^[\w-]{8,80}$/.test(h)) fail(400, "IDEMPOTENCY_KEY_REQUIRED", "Header idempotency-key (8–80 karakter) wajib.");
  return h!;
};
/** Fail closed with a clear message if migration 0009 is not applied (instead of a 500). */
async function requireSchema(d: D1Database) {
  try { await d.prepare("SELECT 1 FROM discovery_campaigns LIMIT 1").first(); }
  catch { fail(503, "DISCOVERY_SCHEMA_NOT_MIGRATED", "Skema discovery (D1 migration 0009) belum diterapkan. Pemilik perlu menyetujui migrasi."); }
}
discovery.use("/discovery/*", async (c, next) => { await requireSchema(D(c)); await next(); });
discovery.use("/admin/discovery/*", requirePermission("provider:admin"));
discovery.use("/admin/discovery/*", async (c, next) => { await requireSchema(D(c)); await next(); });
const actorOf = (c: Parameters<typeof P>[0]) => { const p = P(c); assertCan(p, "v3:use"); return { userId: p.userId, orgId: p.primaryOrgId, orgIds: p.orgIds, requestId: RID(c) }; };

// ---------- metadata & entitlement ----------
discovery.get("/discovery/meta", (c) => c.json({
  modes: [{ code: "single", label: "Satu channel" }, { code: "multi", label: "Beberapa channel" }, { code: "omni", label: "Otomatis / omni" }],
  categories: DEMAND_CATEGORIES.map(({ code, label }) => ({ code, label })), geographies: GEOGRAPHIES.map(({ code, label }) => ({ code, label })), languages: LANGUAGES, limitations: LIMITATIONS,
}));
discovery.get("/discovery/entitlement", async (c) => { const a = actorOf(c); return c.json(await memberDiscoveryStatus(D(c), a.orgId, a.userId)); });

// ---------- catalog ----------
discovery.get("/discovery/catalog", async (c) => {
  const a = actorOf(c), d = D(c);
  const q = (c.req.query("q") ?? "").toLowerCase().trim().slice(0, 100);
  const f = { platform: c.req.query("platform"), geography: c.req.query("geography"), language: c.req.query("language"), category: c.req.query("category"), sourceType: c.req.query("sourceType") };
  const { plan } = await import("../services/billing").then((m) => m.currentSubscription(d, a.orgId));
  const policy = await d.prepare("SELECT max_units_per_job FROM discovery_policies WHERE plan_code=? AND status='active' ORDER BY version DESC LIMIT 1").bind(plan.code).first<Row>();
  const budgets = await activeBudgets(d, a.orgId); const route = routeChecker(c.env, d); const actors = new Map<string, Row | null>();
  const items = [];
  for (const s of await visibleSources(d, a.orgId)) {
    const hay = `${s.name} ${s.platform} ${s.identifier ?? ""} ${s.description ?? ""} ${s.topics_json} ${s.categories_json}`.toLowerCase();
    if (q && !q.split(/\s+/).every((w) => hay.includes(w))) continue;
    if (f.platform && s.platform !== f.platform) continue;
    if (f.geography && s.geography !== f.geography && s.geography !== "global") continue;
    if (f.language && s.language !== f.language && s.language !== "any") continue;
    if (f.sourceType && s.source_type !== f.sourceType) continue;
    if (f.category && !parseList(s.categories_json).includes(f.category)) continue;
    const el = await fullEligibility(c.env, d, s, { orgId: a.orgId, maxUnitsPerJob: Number(policy?.max_units_per_job ?? 1), budgets, route, actors });
    items.push({ ...publicSource(s, el), unavailableReason: reasonFor(el.code) });
  }
  const platforms = [...new Set((await visibleSources(d, a.orgId)).map((s) => s.platform))].sort();
  return c.json({ items, platforms, runnable: items.filter((i) => i.runnable).length, note: "Tercantum di katalog ≠ dapat dijalankan. Hanya sumber yang lolos review izin dan memiliki rute penyedia terdanai yang dapat dipakai." });
});

/** Member-submitted public URL / community name. Org-private, never auto-approved. */
discovery.post("/discovery/sources/hints", rateLimit("discovery-hint", 10, 3600), async (c) => {
  const a = actorOf(c), d = D(c);
  const input = await body(c, z.object({ input: text(500, 2), note: optText(500) }));
  const v = await validateHint(input.input);
  const key = v.canonicalUrl ?? `name:${input.input.toLowerCase()}`;
  const dup = await one<Row>(d, "SELECT * FROM discovery_sources WHERE submitted_by_org=? AND origin='member_hint' AND hint_input=?", a.orgId, key);
  if (dup) return c.json({ source: publicSource(dup), validation: v, duplicate: true });
  const id = `dsrc_${newId("h").slice(2).replace(/[^a-z0-9]/g, "")}`;
  await d.batch([
    d.prepare(`INSERT INTO discovery_sources (id,slug,platform,source_type,name,identifier,base_url,description,geography,language,access_status,permission_status,commercial_use,collection_method,provider_id,capability,scope_domains_json,limitations,origin,submitted_by_org,submitted_by_user,hint_input,validation_json)
      VALUES (?,?,?,?,?,?,?,?,'global','any',?,?,'unclear',?,?, 'search', ?, ?, 'member_hint', ?, ?, ?, ?)`)
      .bind(id, `hint-${id.slice(5)}`, v.platform, v.kind === "community" ? "community" : v.canonicalUrl ? "page" : "community", (v.identifier ?? v.canonicalUrl ?? input.input).slice(0, 120), v.identifier, v.canonicalUrl,
        input.note, v.accessStatus, v.permissionStatus, v.scopeDomains.length ? "search_scoped" : "search_open", "tavily", JSON.stringify(v.scopeDomains), "Petunjuk dari member; menunggu review izin.", a.orgId, a.userId, key, JSON.stringify(v)),
    d.prepare("INSERT INTO discovery_source_reviews (id,source_id,from_status,to_status,note,reviewer_user_id) VALUES (?,?,?,?,?,?)").bind(newId("dsrv"), id, "unreviewed", v.permissionStatus, `Validasi otomatis: ${v.reasons.join(" ")}`.slice(0, 1000), a.userId),
    auditStatement(d, { requestId: a.requestId, actorUserId: a.userId, action: "discovery.source.hint_submitted", resourceType: "discovery_source", resourceId: id, orgId: a.orgId, outcome: v.ok ? "success" : "denied", metadata: { platform: v.platform, access: v.accessStatus, status: v.permissionStatus } }),
  ]);
  if (v.ok) await notifyStaff(d, "discovery.source_review", "Sumber discovery menunggu review", (v.canonicalUrl ?? input.input).slice(0, 200), "/app/w/admin-control", ["owner"]);
  const row = (await one<Row>(d, "SELECT * FROM discovery_sources WHERE id=?", id))!;
  return c.json({ source: publicSource(row), validation: v, duplicate: false }, 201);
});

// ---------- campaigns ----------
const briefSchema = z.object({
  title: text(160, 4), topic: text(1000, 10), audience: optText(200), keywords: z.array(z.string().trim().min(2).max(60)).max(8).default([]),
  categories: z.array(z.enum(CATEGORY_CODES)).max(5).default([]), customCategory: optText(80),
  geography: z.enum(GEO_CODES).default("ID"), language: z.enum(LANG_CODES).default("id"), purpose: optText(300),
});
const campaignInput = z.object({ mode: z.enum(["single", "multi", "omni"]), sourceIds: z.array(SOURCE_ID).max(20).default([]), brief: briefSchema });

discovery.post("/discovery/campaigns", rateLimit("discovery-plan", 30, 3600), async (c) => {
  const a = actorOf(c);
  const input = await body(c, campaignInput);
  const r = await createCampaign(c.env, D(c), a, { idempotencyKey: idem(c), mode: input.mode, sourceIds: input.mode === "omni" ? [] : input.sourceIds, brief: input.brief as Brief });
  return c.json(await campaignView(c, a, r.id), r.replayed ? 200 : 201);
});
discovery.get("/discovery/campaigns", async (c) => {
  const a = actorOf(c);
  const items = await many<Row>(D(c), `SELECT id,mode,title,status,status_reason,blocked_code,parent_campaign_id,channels_planned,channels_succeeded,channels_empty,channels_failed,channels_unavailable,records_total,records_unique,records_duplicate,independent_sources,units_reserved,units_actual,created_at,completed_at
    FROM discovery_campaigns WHERE org_id IN (${a.orgIds.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT 100`, ...a.orgIds);
  return c.json({ items });
});
discovery.get("/discovery/campaigns/:id", async (c) => { const a = actorOf(c); return c.json(await campaignView(c, a, campaignId(c))); });
discovery.post("/discovery/campaigns/:id/start", rateLimit("discovery-start", 10, 3600), async (c) => {
  const a = actorOf(c), id = campaignId(c);
  const { scopeHash } = await body(c, z.object({ scopeHash: z.string().regex(/^[a-f0-9]{64}$/) }));
  await startCampaign(c.env, D(c), a, id, scopeHash);
  return c.json(await campaignView(c, a, id));
});
/** Durable continuation: runs remaining QUEUED jobs (and lease recovery) within a bounded request. */
discovery.post("/discovery/campaigns/:id/resume", rateLimit("discovery-resume", 30, 3600), async (c) => {
  const a = actorOf(c), id = campaignId(c);
  const cm = await loadOwned(D(c), a, id);
  if (["QUEUED", "RUNNING"].includes(cm.status)) await runCampaign(c.env, D(c), { ...a, orgId: cm.org_id }, id);
  return c.json(await campaignView(c, a, id));
});
discovery.post("/discovery/campaigns/:id/cancel", async (c) => { const a = actorOf(c), id = campaignId(c); await cancelCampaign(D(c), a, id); return c.json(await campaignView(c, a, id)); });
discovery.post("/discovery/campaigns/:id/retry", rateLimit("discovery-start", 10, 3600), async (c) => { const a = actorOf(c), id = campaignId(c); await retryCampaign(c.env, D(c), a, id); return c.json(await campaignView(c, a, id)); });
/** Expansion = a NEW campaign on the same brief (subject to remaining allowance). */
discovery.post("/discovery/campaigns/:id/expand", rateLimit("discovery-plan", 30, 3600), async (c) => {
  const a = actorOf(c), id = campaignId(c);
  const parent = await loadOwned(D(c), a, id);
  const input = await body(c, z.object({ mode: z.enum(["single", "multi", "omni"]), sourceIds: z.array(SOURCE_ID).max(20).default([]) }));
  const r = await createCampaign(c.env, D(c), a, { idempotencyKey: idem(c), mode: input.mode, sourceIds: input.mode === "omni" ? [] : input.sourceIds, brief: JSON.parse(parent.brief_json), parentCampaignId: id });
  return c.json(await campaignView(c, a, r.id), r.replayed ? 200 : 201);
});

discovery.get("/discovery/campaigns/:id/evidence", async (c) => {
  const a = actorOf(c), id = campaignId(c), d = D(c);
  const cm = await loadOwned(d, a, id);
  const includeDup = c.req.query("duplicates") === "1";
  const rows = await many<Row>(d, `SELECT e.id,e.job_id,e.rank,e.provider_score,e.duplicate_kind,e.duplicate_of,e.independent_source_key,s.id AS source_id,s.name AS source_name,s.platform AS source_platform,
      g.id AS signal_id,g.url,g.canonical_url,g.title,g.content_excerpt,g.platform,g.community,g.observed_at,g.captured_at,g.provider_id,g.adapter,g.collection_method,g.provider_request_id,g.content_hash,g.fingerprint,g.evidence_quality,g.signal_kind,g.heuristic_json
    FROM discovery_campaign_evidence e JOIN signals g ON g.id=e.signal_id JOIN discovery_sources s ON s.id=e.source_id
    WHERE e.campaign_id=? AND e.org_id=? ${includeDup ? "" : "AND e.duplicate_kind='unique'"} ORDER BY s.name, e.rank LIMIT 500`, id, cm.org_id);
  const items = rows.map((r) => ({ ...r, heuristic: r.heuristic_json ? JSON.parse(r.heuristic_json) : null, heuristic_json: undefined }));
  const brief = JSON.parse(cm.brief_json) as Brief;
  const uniq = rows.filter((r) => r.duplicate_kind === "unique");
  return c.json({ items, themes: themes(uniq as { title: string | null; content_excerpt: string | null; independent_source_key: string }[], [brief.topic, ...brief.keywords]),
    note: "Bukti yang diamati (judul, cuplikan, URL, waktu) terpisah dari inferensi (tema & isyarat demand heuristik). Tidak ada yang berstatus demand tervalidasi." });
});

/** Opportunity-assessment handoff: creates a demand hypothesis with linked campaign evidence (uses the normal request quota). */
discovery.post("/discovery/campaigns/:id/handoff", rateLimit("discovery-handoff", 10, 3600), async (c) => {
  const a = actorOf(c), id = campaignId(c), d = D(c);
  const cm = await loadOwned(d, a, id);
  if (!["COMPLETED", "PARTIAL"].includes(cm.status)) fail(409, "CAMPAIGN_NOT_FINISHED", "Handoff hanya dari kampanye yang selesai.");
  const input = await body(c, z.object({ title: text(160, 5), problem: text(4000, 20), signalIds: z.array(z.string().regex(/^sig_[a-z0-9]{10,40}$/)).min(1).max(20) }));
  await assertEntitlement(d, cm.org_id, "request");
  const ph = input.signalIds.map(() => "?").join(",");
  const owned = await many<{ signal_id: string }>(d, `SELECT DISTINCT signal_id FROM discovery_campaign_evidence WHERE campaign_id=? AND org_id=? AND signal_id IN (${ph})`, id, cm.org_id, ...input.signalIds);
  if (owned.length !== new Set(input.signalIds).size) fail(404, "SIGNAL_NOT_IN_CAMPAIGN", "Semua bukti harus berasal dari kampanye ini.");
  const demandId = newId("dem");
  await d.batch([
    d.prepare(`INSERT INTO demands (id,org_id,origin,title,problem,segment,status,created_by) VALUES (?,?,'customer',?,?,?,'DEMAND_HYPOTHESIS_CREATED',?)`)
      .bind(demandId, cm.org_id, input.title, `${input.problem}\n\n[Dari kampanye discovery ${id} — sinyal, belum demand tervalidasi]`.slice(0, 6000), JSON.parse(cm.brief_json).audience ?? null, a.userId),
    ...owned.map((o) => d.prepare("INSERT OR IGNORE INTO demand_evidence (id,demand_id,signal_id,stance,note,created_by) VALUES (?,?,?,'supports',?,?)").bind(newId("evd"), demandId, o.signal_id, `Dari kampanye discovery ${id}`, a.userId)),
    usageStatement(d, cm.org_id, a.userId, "request", demandId),
    d.prepare("INSERT INTO lifecycle_transitions (id,entity_type,entity_id,from_state,to_state,reason,actor_user_id,correlation_id) VALUES (?,?,?,?,?,?,?,?)").bind(newId("trn"), "demand", demandId, "NONE", "DEMAND_HYPOTHESIS_CREATED", `Handoff dari kampanye discovery ${id}`, a.userId, a.requestId),
    auditStatement(d, { requestId: a.requestId, actorUserId: a.userId, action: "discovery.handoff", resourceType: "demand", resourceId: demandId, orgId: cm.org_id, metadata: { campaignId: id, signals: owned.length } }),
  ]);
  await notifyStaff(d, "intake.new", "Hipotesis demand dari discovery", input.title, "/app/w/demand");
  return c.json({ demandId, status: "DEMAND_HYPOTHESIS_CREATED", note: "Hipotesis dibuat dengan bukti terlampir. Validasi demand tetap proses terpisah." }, 201);
});

async function campaignView(c: Parameters<typeof P>[0], a: { orgId: string; orgIds: string[]; userId: string }, id: string) {
  const d = D(c);
  const cm = await loadOwned(d, a, id);
  const jobs = await many<Row>(d, `SELECT j.id,j.source_id,s.name AS source_name,s.platform,s.source_type,j.provider_id,j.collection_method,j.query,j.max_items,j.units_planned,j.status,j.attempt,j.max_attempts,j.dispatched,
      j.provider_run_id,j.units_actual,j.records_returned,j.records_new,j.records_duplicate,j.records_dropped,j.error_code,j.error_message,j.started_at,j.finished_at
    FROM discovery_jobs j JOIN discovery_sources s ON s.id=j.source_id WHERE j.campaign_id=? AND j.org_id=? ORDER BY s.name`, id, cm.org_id);
  const ent = await one<Row>(d, "SELECT kind,state,policy_version,reason,created_at,consumed_at FROM discovery_entitlements WHERE campaign_id=?", id);
  const transitions = await many<Row>(d, "SELECT from_state,to_state,reason,created_at FROM lifecycle_transitions WHERE entity_type='discovery_campaign' AND entity_id=? ORDER BY created_at, rowid", id);
  const byChannel = await many<Row>(d, `SELECT s.id AS source_id, s.name, s.platform, COUNT(*) AS records, SUM(e.duplicate_kind='unique') AS unique_records, SUM(e.duplicate_kind<>'unique') AS duplicates,
      COUNT(DISTINCT CASE WHEN e.duplicate_kind='unique' THEN e.independent_source_key END) AS independent_sources
    FROM discovery_campaign_evidence e JOIN discovery_sources s ON s.id=e.source_id WHERE e.campaign_id=? GROUP BY s.id ORDER BY records DESC`, id);
  const scope = JSON.parse(cm.scope_json || "{}");
  return {
    campaign: { id: cm.id, mode: cm.mode, title: cm.title, status: cm.status, statusReason: cm.status_reason, blockedCode: cm.blocked_code, parentCampaignId: cm.parent_campaign_id, policyVersion: cm.policy_version,
      brief: JSON.parse(cm.brief_json), scopeHash: cm.scope_hash, cancelRequested: Boolean(cm.cancel_requested), createdAt: cm.created_at, startedAt: cm.started_at, completedAt: cm.completed_at, terminal: (TERMINAL as string[]).includes(cm.status) },
    scope,
    coverage: { channelsPlanned: cm.channels_planned, channelsSucceeded: cm.channels_succeeded, channelsEmpty: cm.channels_empty, channelsFailed: cm.channels_failed, channelsUnavailable: cm.channels_unavailable,
      recordsTotal: cm.records_total, recordsUnique: cm.records_unique, recordsDuplicate: cm.records_duplicate, independentSources: cm.independent_sources, byChannel },
    usage: { unitsReserved: cm.units_reserved, unitsActual: cm.units_actual, costActualUsdMicros: cm.cost_actual_usd_micros, perJob: jobs.map((j) => ({ jobId: j.id, provider: j.provider_id, units: j.units_actual })) },
    entitlement: ent, jobs: jobs.map((j) => ({ ...j, reason: reasonFor(j.error_code) })), transitions,
  };
}

// ---------- owner administration ----------
discovery.get("/admin/discovery/sources", async (c) => c.json({ items: await many(D(c), "SELECT s.*, o.name AS submitted_org_name FROM discovery_sources s LEFT JOIN organizations o ON o.id=s.submitted_by_org ORDER BY s.permission_status='pending_review' DESC, s.origin, s.platform, s.name") }));
discovery.get("/admin/discovery/sources/:id/reviews", async (c) => c.json({ items: await many(D(c), "SELECT * FROM discovery_source_reviews WHERE source_id=? ORDER BY created_at DESC", c.req.param("id")) }));
discovery.post("/admin/discovery/sources", async (c) => {
  const p = P(c), d = D(c);
  const i = await body(c, z.object({ slug: z.string().regex(/^[a-z0-9-]{3,60}$/), platform: z.string().regex(/^[a-z0-9-]{2,30}$/), sourceType: z.enum(["search_scope", "community", "forum", "qna", "web_domain", "directory", "social", "page"]),
    name: text(120, 2), identifier: optText(120), baseUrl: optText(500), description: optText(1000), topics: z.array(z.string().max(40)).max(12).default([]), categories: z.array(z.enum(CATEGORY_CODES)).max(10).default([]),
    geography: z.enum(GEO_CODES).default("global"), language: z.enum(LANG_CODES).default("any"), collectionMethod: z.enum(["search_scoped", "search_open", "page_extract", "actor"]),
    providerId: z.enum(["tavily", "firecrawl", "apify", "scrapely"]), scopeDomains: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/[\w/.-]*)?$/)).max(10).default([]), actorRegistryId: optText(60), limitations: text(1000, 5) }));
  const capability = i.collectionMethod === "page_extract" ? "scrape" : i.collectionMethod === "actor" ? "actor" : "search";
  if ((i.collectionMethod === "actor") !== (i.providerId === "apify" || i.providerId === "scrapely")) fail(422, "METHOD_PROVIDER_MISMATCH");
  if (i.collectionMethod === "page_extract" && !i.baseUrl) fail(422, "BASE_URL_REQUIRED");
  const id = `dsrc_${i.slug.replace(/-/g, "_")}`;
  await d.prepare(`INSERT INTO discovery_sources (id,slug,platform,source_type,name,identifier,base_url,description,topics_json,categories_json,geography,language,access_status,permission_status,commercial_use,collection_method,provider_id,capability,scope_domains_json,actor_registry_id,limitations)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'unknown','pending_review','unclear',?,?,?,?,?,?)`).bind(id, i.slug, i.platform, i.sourceType, i.name, i.identifier, i.baseUrl, i.description, JSON.stringify(i.topics), JSON.stringify(i.categories), i.geography, i.language,
    i.collectionMethod, i.providerId, capability, JSON.stringify(i.scopeDomains), i.actorRegistryId, i.limitations).run();
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: "discovery.source.created", resourceType: "discovery_source", resourceId: id, metadata: { method: i.collectionMethod, provider: i.providerId } });
  return c.json({ id }, 201);
});
/** Permission review. Approval demands public access, explicit commercial-use decision, reviewer and an expiry (≤ 180 days). */
discovery.post("/admin/discovery/sources/:id/review", async (c) => {
  const p = P(c), d = D(c), id = c.req.param("id");
  const i = await body(c, z.object({ to: z.enum(["approved", "rejected", "suspended", "pending_review"]), accessStatus: z.enum(["public", "login_required", "private", "restricted", "unknown"]),
    commercialUse: z.enum(["allowed", "restricted", "unclear"]), expiresAt: optText(40), note: text(2000, 10), collectionMethodConfirmed: z.boolean().default(false) }));
  const s = await one<Row>(d, "SELECT * FROM discovery_sources WHERE id=?", id);
  if (!s) fail(404, "SOURCE_NOT_FOUND");
  let expires: string | null = null;
  if (i.to === "approved") {
    if (i.accessStatus !== "public") fail(422, "SOURCE_NOT_PUBLIC", "Hanya sumber publik yang dapat disetujui.");
    if (i.commercialUse !== "allowed") fail(422, "COMMERCIAL_USE_REQUIRED", "Persetujuan menuntut keputusan eksplisit bahwa penggunaan komersial diizinkan.");
    if (!i.collectionMethodConfirmed) fail(422, "COLLECTION_METHOD_UNCONFIRMED", "Konfirmasi bahwa metode pengumpulan persis ini telah direview terhadap ketentuan platform & penyedia.");
    const t = i.expiresAt ? Date.parse(i.expiresAt) : NaN;
    if (!Number.isFinite(t) || t <= Date.now() || t > Date.now() + 180 * 86_400_000) fail(422, "INVALID_EXPIRY", "expiresAt wajib ISO di masa depan, maksimal 180 hari.");
    expires = new Date(t).toISOString();
    if (s!.collection_method === "actor") {
      const a = await one<Row>(d, "SELECT status,approval_expires_at FROM actor_registry WHERE id=?", s!.actor_registry_id);
      if (!a || a.status !== "approved") fail(422, "ACTOR_NOT_APPROVED", "Actor yang dipetakan harus disetujui di Actor registry terlebih dahulu.");
    }
  }
  await d.batch([
    d.prepare(`UPDATE discovery_sources SET permission_status=?, access_status=?, commercial_use=?, reviewed_by=?, reviewed_at=?, review_expires_at=?, review_note=?, updated_at=datetime('now') WHERE id=?`)
      .bind(i.to, i.accessStatus, i.commercialUse, p.userId, nowIso(), expires, i.note, id),
    d.prepare("INSERT INTO discovery_source_reviews (id,source_id,from_status,to_status,commercial_use,note,expires_at,reviewer_user_id) VALUES (?,?,?,?,?,?,?,?)").bind(newId("dsrv"), id, s!.permission_status, i.to, i.commercialUse, i.note, expires, p.userId),
    auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: "discovery.source.reviewed", resourceType: "discovery_source", resourceId: id, metadata: { from: s!.permission_status, to: i.to, access: i.accessStatus, commercialUse: i.commercialUse, expires } }),
  ]);
  return c.json({ ok: true, status: i.to });
});
discovery.patch("/admin/discovery/sources/:id", async (c) => {
  const p = P(c), d = D(c), id = c.req.param("id");
  const i = await body(c, z.object({ availability: z.enum(["available", "paused", "unavailable"]) }));
  const r = await d.prepare("UPDATE discovery_sources SET availability=?, updated_at=datetime('now') WHERE id=?").bind(i.availability, id).run();
  if (!r.meta.changes) fail(404, "SOURCE_NOT_FOUND");
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: "discovery.source.availability", resourceType: "discovery_source", resourceId: id, metadata: i });
  return c.json({ ok: true });
});

discovery.get("/admin/discovery/budgets", async (c) => c.json({ items: await many(D(c), "SELECT * FROM discovery_program_budgets ORDER BY created_at DESC"), usage: await activeBudgets(D(c), null) }));
/** Owner-approved program allocation. It funds member campaigns but never bypasses gateway caps or paid approval. */
discovery.post("/admin/discovery/budgets", async (c) => {
  const p = P(c), d = D(c);
  const i = await body(c, z.object({ providerId: z.enum(["tavily", "firecrawl", "apify", "scrapely"]), unitType: z.enum(["credits", "usd_micros"]), monthUnitsCap: z.number().positive().max(1_000_000_000),
    perOrgMonthUnitsCap: z.number().positive().max(1_000_000_000), bonusEnabled: z.boolean().default(false), fundingClass: z.enum(["verified_free_allowance", "approved_paid_allocation"]).default("verified_free_allowance"),
    expiresAt: text(40, 10), reason: text(1000, 10) }));
  const t = Date.parse(i.expiresAt);
  if (!Number.isFinite(t) || t <= Date.now() || t > Date.now() + 93 * 86_400_000) fail(422, "INVALID_EXPIRY", "expiresAt wajib ISO di masa depan, maksimal 93 hari.");
  if (i.perOrgMonthUnitsCap > i.monthUnitsCap) fail(422, "PER_ORG_CAP_TOO_HIGH");
  const id = newId("dbud");
  await d.batch([
    d.prepare("UPDATE discovery_program_budgets SET status='revoked' WHERE provider_id=? AND unit_type=? AND status='active'").bind(i.providerId, i.unitType),
    d.prepare(`INSERT INTO discovery_program_budgets (id,provider_id,unit_type,month_units_cap,per_org_month_units_cap,bonus_enabled,funding_class,status,reason,approved_by,starts_at,expires_at) VALUES (?,?,?,?,?,?,?,'active',?,?,?,?)`)
      .bind(id, i.providerId, i.unitType, i.monthUnitsCap, i.perOrgMonthUnitsCap, i.bonusEnabled ? 1 : 0, i.fundingClass, i.reason, p.userId, nowIso(), new Date(t).toISOString()),
    auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: "discovery.budget.approved", resourceType: "discovery_program_budget", resourceId: id, metadata: { ...i } }),
  ]);
  return c.json({ id }, 201);
});
discovery.post("/admin/discovery/budgets/:id/revoke", async (c) => {
  const p = P(c), d = D(c);
  const r = await d.prepare("UPDATE discovery_program_budgets SET status='revoked' WHERE id=? AND status<>'revoked'").bind(c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "BUDGET_NOT_FOUND");
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: "discovery.budget.revoked", resourceType: "discovery_program_budget", resourceId: c.req.param("id") });
  return c.json({ ok: true });
});

discovery.get("/admin/discovery/policies", async (c) => c.json({ items: await many(D(c), "SELECT * FROM discovery_policies ORDER BY plan_code, version DESC") }));
/** Publishes a new policy version (previous active version for the plan is retired; history is preserved). */
discovery.post("/admin/discovery/policies", async (c) => {
  const p = P(c), d = D(c);
  const i = await body(c, z.object({ planCode: z.enum(["free", "pro", "plus"]), periodDays: z.number().int().min(1).max(366), guaranteedCampaigns: z.number().int().min(0).max(100), conditionalBonusCampaigns: z.number().int().min(0).max(100),
    bonusMinHeadroomPct: z.number().int().min(0).max(100), maxChannels: z.number().int().min(1).max(20), maxItemsPerJob: z.number().int().min(1).max(50), maxAttemptsPerJob: z.number().int().min(1).max(5), note: text(500, 5) }));
  const cur = await one<{ v: number }>(d, "SELECT COALESCE(MAX(version),0) AS v FROM discovery_policies WHERE plan_code=?", i.planCode);
  const version = Number(cur?.v ?? 0) + 1, id = `dpol_${i.planCode}_v${version}`;
  await d.batch([
    d.prepare("UPDATE discovery_policies SET status='retired' WHERE plan_code=? AND status='active'").bind(i.planCode),
    d.prepare(`INSERT INTO discovery_policies (id,plan_code,version,period_days,guaranteed_campaigns,conditional_bonus_campaigns,bonus_min_headroom_pct,max_channels,max_items_per_job,max_units_per_job,max_attempts_per_job,note,created_by) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?)`)
      .bind(id, i.planCode, version, i.periodDays, i.guaranteedCampaigns, i.conditionalBonusCampaigns, i.bonusMinHeadroomPct, i.maxChannels, i.maxItemsPerJob, i.maxAttemptsPerJob, i.note, p.userId),
    auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: "discovery.policy.published", resourceType: "discovery_policy", resourceId: id, metadata: i }),
  ]);
  return c.json({ id, version }, 201);
});
discovery.get("/admin/discovery/campaigns", async (c) => c.json({ items: await many(D(c), `SELECT c.id,c.org_id,o.name AS org_name,c.mode,c.title,c.status,c.status_reason,c.channels_planned,c.channels_succeeded,c.channels_failed,c.records_unique,c.independent_sources,c.units_reserved,c.units_actual,c.cost_actual_usd_micros,c.created_at,
  (SELECT state FROM discovery_entitlements e WHERE e.campaign_id=c.id) AS entitlement_state, (SELECT COUNT(*) FROM discovery_jobs j WHERE j.campaign_id=c.id AND j.status='UNKNOWN_CHARGE') AS unknown_charge_jobs
  FROM discovery_campaigns c JOIN organizations o ON o.id=c.org_id ORDER BY c.created_at DESC LIMIT 200`) }));
