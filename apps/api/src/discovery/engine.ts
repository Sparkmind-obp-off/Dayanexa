/**
 * DAYANEXA Discovery Campaign Engine (docs/31 §12.4).
 *
 * DRAFT → VALIDATING → SCOPE_READY → RESERVED → QUEUED → RUNNING → RECONCILING → COMPLETED / PARTIAL / FAILED / CANCELLED
 *
 * - The PARENT campaign owns the single entitlement and the aggregate program-budget envelope.
 * - CHILD jobs (one per approved source) never own entitlements; each job dispatches ONLY through the
 *   Provider Runtime Gateway (governedCall) with idempotency key disc:<job>:<attempt>.
 * - Entitlement is consumed only when at least one job reached accepted dispatch; otherwise released.
 * - Retry of the same campaign re-uses its entitlement row and is bounded; expansion is a NEW campaign.
 * - Jobs are leased; a crashed RUNNING job that was never dispatched is re-queued, a dispatched one is
 *   marked UNKNOWN_CHARGE (no blind retry → no double charge).
 */
import type { Env } from "../env";
import { digestHex } from "../lib/crypto";
import { newId, nowIso } from "../lib/ids";
import { fail } from "../lib/http";
import { auditStatement } from "../services/audit";
import { currentSubscription } from "../services/billing";
import { GatewayError, governedCall, type DispatchResult, type DispatchTicket, type GatewayOutcome } from "../providers/gateway";
import { tavilySearch } from "../providers/tavily";
import { firecrawlScrape } from "../providers/firecrawl";
import { runActor, type ActorProvider } from "../providers/actors";
import { ProviderError } from "../providers/types";
import { canonicalUrl, heuristics, independentSourceKey, platformOf, textFingerprint } from "./evidence";
import { activeBudgets, activePolicy, bonusFunded, consumeEntitlementStatement, releaseEntitlementStatement, reserveEntitlement, reserveEnvelope } from "./entitlements";
import { fullEligibility, isRestrictedUrl, parseList, routeChecker, visibleSources } from "./catalog";
import { CAMPAIGN_TRANSITIONS, GEOGRAPHIES, LIMITATIONS, reasonFor, type CampaignStatus } from "./taxonomy";

type Row = Record<string, any>;
export interface Brief { title: string; topic: string; audience: string | null; keywords: string[]; categories: string[]; customCategory: string | null; geography: string; language: string; purpose: string | null }
export interface Actor { userId: string; orgId: string; requestId?: string }

const LEASE_MS = 150_000;
const MAX_CAMPAIGN_RETRIES = 2;

// ---------- lifecycle ----------
export async function move(d: D1Database, id: string, from: CampaignStatus[], to: CampaignStatus, reason: string, actor: { userId?: string | null; requestId?: string }, set: Record<string, unknown> = {}): Promise<boolean> {
  const cur = await d.prepare("SELECT status FROM discovery_campaigns WHERE id=?").bind(id).first<{ status: CampaignStatus }>();
  if (!cur || !from.includes(cur.status)) return false;
  if (!CAMPAIGN_TRANSITIONS[cur.status].includes(to)) throw new Error(`illegal campaign transition ${cur.status} → ${to}`);
  const cols = Object.keys(set);
  const r = await d.prepare(`UPDATE discovery_campaigns SET status=?, status_reason=?, updated_at=datetime('now')${cols.map((c) => `, ${c}=?`).join("")} WHERE id=? AND status=?`)
    .bind(to, reason.slice(0, 500), ...cols.map((c) => set[c]), id, cur.status).run();
  if (!r.meta.changes) return false;
  await d.prepare("INSERT INTO lifecycle_transitions (id,entity_type,entity_id,from_state,to_state,reason,actor_user_id,correlation_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(newId("trn"), "discovery_campaign", id, cur.status, to, reason.slice(0, 500), actor.userId ?? null, actor.requestId ?? null).run();
  return true;
}

// ---------- scope planning ----------
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);

function relevance(s: Row, brief: Brief): { score: number; reasons: string[] } {
  const reasons: string[] = []; let score = 0;
  const cats = parseList(s.categories_json);
  const hit = brief.categories.filter((c) => cats.includes(c));
  if (hit.length) { score += 3 * hit.length; reasons.push(`kategori cocok: ${hit.join(", ")}`); }
  if (s.geography === brief.geography) { score += 3; reasons.push(`geografi ${s.geography}`); } else if (s.geography === "global") score += 1;
  if (brief.language === "any" || s.language === "any" || s.language === brief.language) { score += 1; } else score -= 2;
  const hay = new Set(words(`${s.name} ${s.description ?? ""} ${parseList(s.topics_json).join(" ")}`));
  const terms = [...new Set(words(`${brief.topic} ${brief.keywords.join(" ")} ${brief.audience ?? ""}`))].filter((w) => hay.has(w));
  if (terms.length) { score += Math.min(4, terms.length); reasons.push(`topik: ${terms.slice(0, 4).join(", ")}`); }
  if (s.origin === "member_hint") { score += 2; reasons.push("sumber yang Anda ajukan"); }
  return { score, reasons };
}

export interface ScopeChannel { sourceId: string; name: string; platform: string; sourceType: string; provider: string; collectionMethod: string; units: number; unitType: string; reason: string; score: number }
export interface ScopeUnavailable { sourceId: string; name: string; platform: string; code: string; reason: string }
export interface Scope { mode: string; policyId: string; policyVersion: number; maxChannels: number; maxItemsPerJob: number; channels: ScopeChannel[]; unavailable: ScopeUnavailable[]; totals: { providerId: string; unitType: string; units: number }[]; limitations: string[]; plannedAt: string }

export async function planScope(env: Env, d: D1Database, actor: Actor, mode: "single" | "multi" | "omni", sourceIds: string[], brief: Brief): Promise<{ scope: Scope; policy: Row }> {
  const { plan } = await currentSubscription(d, actor.orgId);
  const policy = await activePolicy(d, plan.code);
  if (!policy) fail(423, "DISCOVERY_POLICY_MISSING", "Belum ada kebijakan discovery aktif untuk paket ini.");
  const maxChannels = Number(policy!.max_channels);
  const all = await visibleSources(d, actor.orgId);
  const byId = new Map(all.map((s) => [s.id, s]));
  if (mode === "single" && sourceIds.length !== 1) fail(422, "SINGLE_REQUIRES_ONE_SOURCE", "Mode single-channel membutuhkan tepat satu sumber.");
  if (mode === "multi" && (sourceIds.length < 2 || sourceIds.length > maxChannels)) fail(422, "MULTI_SOURCE_COUNT", `Mode multi-channel membutuhkan 2–${maxChannels} sumber.`);
  for (const id of sourceIds) if (!byId.has(id)) fail(404, "SOURCE_NOT_FOUND", "Sumber tidak ditemukan di katalog Anda.");
  const budgets = await activeBudgets(d, actor.orgId);
  const route = routeChecker(env, d); const actors = new Map<string, Row | null>();
  const candidates = mode === "omni" ? all : sourceIds.map((id) => byId.get(id)!);
  type Evaluated = { s: Row; el: Awaited<ReturnType<typeof fullEligibility>>; rel: { score: number; reasons: string[] } };
  const evaluated: Evaluated[] = [];
  for (const s of candidates) {
    const el = await fullEligibility(env, d, s, { orgId: actor.orgId, maxUnitsPerJob: Number(policy!.max_units_per_job), budgets, route, actors });
    evaluated.push({ s, el, rel: relevance(s, brief) });
  }
  const channels: ScopeChannel[] = []; const unavailable: ScopeUnavailable[] = [];
  const toChannel = (x: (typeof evaluated)[number], reason: string): ScopeChannel => ({ sourceId: x.s.id, name: x.s.name, platform: x.s.platform, sourceType: x.s.source_type, provider: x.s.provider_id, collectionMethod: x.s.collection_method, units: x.el.units, unitType: x.el.unitType, reason, score: x.rel.score });
  if (mode === "omni") {
    // Rank runnable sources by relevance, then enforce platform diversity and remaining program budget.
    const runnable = evaluated.filter((x) => x.el.runnable && x.rel.score > 0).sort((a, b) => b.rel.score - a.rel.score);
    const left = new Map(budgets.map((b) => [`${b.providerId}|${b.unitType}`, Math.min(b.orgRemaining, b.monthCap - b.monthUsed)]));
    const usedPlatforms = new Set<string>();
    const ordered = [...runnable.filter((x) => { if (usedPlatforms.has(x.s.platform)) return false; usedPlatforms.add(x.s.platform); return true; }), ...runnable.filter((x) => !channels.some((c) => c.sourceId === x.s.id))];
    const picked = new Set<string>();
    for (const x of ordered) {
      if (picked.has(x.s.id) || channels.length >= maxChannels) continue;
      const k = `${x.s.provider_id}|${x.el.unitType}`;
      if ((left.get(k) ?? 0) < x.el.units) continue;
      left.set(k, (left.get(k) ?? 0) - x.el.units); picked.add(x.s.id);
      channels.push(toChannel(x, `Dipilih otomatis — ${x.rel.reasons.join("; ") || "cakupan umum"}`));
    }
    for (const x of evaluated) if (!picked.has(x.s.id)) unavailable.push({ sourceId: x.s.id, name: x.s.name, platform: x.s.platform, code: x.el.runnable ? "NOT_SELECTED" : x.el.code!, reason: reasonFor(x.el.runnable ? "NOT_SELECTED" : x.el.code)! });
  } else {
    const left = new Map(budgets.map((b) => [`${b.providerId}|${b.unitType}`, Math.min(b.orgRemaining, b.monthCap - b.monthUsed)]));
    for (const x of evaluated) {
      const k = `${x.s.provider_id}|${x.el.unitType}`;
      if (x.el.runnable && (left.get(k) ?? 0) >= x.el.units) { left.set(k, (left.get(k) ?? 0) - x.el.units); channels.push(toChannel(x, "Dipilih oleh Anda")); }
      else { const code = x.el.runnable ? "PROGRAM_BUDGET_EXHAUSTED" : x.el.code!; unavailable.push({ sourceId: x.s.id, name: x.s.name, platform: x.s.platform, code, reason: reasonFor(code)! }); }
    }
  }
  const totals = new Map<string, { providerId: string; unitType: string; units: number }>();
  for (const c of channels) { const k = `${c.provider}|${c.unitType}`; const t = totals.get(k) ?? { providerId: c.provider, unitType: c.unitType, units: 0 }; t.units += c.units; totals.set(k, t); }
  return { policy: policy!, scope: { mode, policyId: policy!.id, policyVersion: Number(policy!.version), maxChannels, maxItemsPerJob: Number(policy!.max_items_per_job), channels, unavailable,
    totals: [...totals.values()], limitations: LIMITATIONS, plannedAt: nowIso() } };
}

export const scopeHash = (briefHash: string, scope: Scope) => digestHex("SHA-256", `${briefHash}|${scope.mode}|${scope.channels.map((c) => `${c.sourceId}:${c.units}`).sort().join(",")}`);
export const briefHash = (b: Brief) => digestHex("SHA-256", JSON.stringify([b.topic.trim().toLowerCase(), [...b.keywords].map((k) => k.toLowerCase()).sort(), [...b.categories].sort(), b.geography, b.language, b.audience ?? ""]));

// ---------- create ----------
export async function createCampaign(env: Env, d: D1Database, actor: Actor, input: { idempotencyKey: string; mode: "single" | "multi" | "omni"; sourceIds: string[]; brief: Brief; parentCampaignId?: string | null }) {
  const bh = await briefHash(input.brief);
  const existing = await d.prepare("SELECT id,brief_hash,status FROM discovery_campaigns WHERE org_id=? AND idempotency_key=?").bind(actor.orgId, input.idempotencyKey).first<Row>();
  if (existing) {
    if (existing.brief_hash !== bh) fail(409, "IDEMPOTENCY_CONFLICT", "Kunci idempotensi sudah dipakai untuk brief lain.");
    return { id: existing.id as string, replayed: true };
  }
  const id = newId("dcmp");
  await d.batch([
    d.prepare(`INSERT INTO discovery_campaigns (id,org_id,user_id,idempotency_key,mode,title,brief_json,brief_hash,requested_sources_json,status,parent_campaign_id) VALUES (?,?,?,?,?,?,?,?,?,'DRAFT',?)`)
      .bind(id, actor.orgId, actor.userId, input.idempotencyKey, input.mode, input.brief.title, JSON.stringify(input.brief), bh, JSON.stringify(input.sourceIds), input.parentCampaignId ?? null),
    d.prepare("INSERT INTO lifecycle_transitions (id,entity_type,entity_id,from_state,to_state,reason,actor_user_id,correlation_id) VALUES (?,?,?,?,?,?,?,?)").bind(newId("trn"), "discovery_campaign", id, "NONE", "DRAFT", "Brief dibuat", actor.userId, actor.requestId ?? null),
    auditStatement(d, { requestId: actor.requestId, actorUserId: actor.userId, action: "discovery.campaign.created", resourceType: "discovery_campaign", resourceId: id, orgId: actor.orgId, metadata: { mode: input.mode, sources: input.sourceIds.length, parent: input.parentCampaignId ?? null } }),
  ]);
  await move(d, id, ["DRAFT"], "VALIDATING", "Validasi brief, izin sumber, rute penyedia dan anggaran", actor);
  try {
    const { scope, policy } = await planScope(env, d, actor, input.mode, input.sourceIds, input.brief);
    const sh = await scopeHash(bh, scope);
    if (!scope.channels.length) {
      await move(d, id, ["VALIDATING"], "FAILED", "Tidak ada sumber yang dapat dijalankan saat ini. Hak discovery tidak terpakai.", actor,
        { scope_json: JSON.stringify(scope), scope_hash: sh, blocked_code: "NO_RUNNABLE_SOURCE", policy_id: policy.id, policy_version: policy.version, channels_unavailable: scope.unavailable.length, completed_at: nowIso() });
    } else {
      await move(d, id, ["VALIDATING"], "SCOPE_READY", "Ruang lingkup siap ditinjau", actor,
        { scope_json: JSON.stringify(scope), scope_hash: sh, policy_id: policy.id, policy_version: policy.version, channels_planned: scope.channels.length, channels_unavailable: scope.unavailable.length });
    }
  } catch (e) {
    await move(d, id, ["VALIDATING"], "FAILED", e instanceof Error ? e.message : "Validasi gagal", actor, { blocked_code: (e as { code?: string }).code ?? "VALIDATION_FAILED", completed_at: nowIso() });
    throw e;
  }
  return { id, replayed: false };
}

// ---------- start ----------
export async function startCampaign(env: Env, d: D1Database, actor: Actor, campaignId: string, confirmScopeHash: string, opts: { deadlineMs?: number } = {}) {
  const c = await loadOwned(d, actor, campaignId);
  if (c.status !== "SCOPE_READY") return { campaignId, status: c.status as CampaignStatus, replayed: true };
  const brief = JSON.parse(c.brief_json) as Brief;
  // Re-plan: permissions, provider readiness and budgets may have changed since the member reviewed the scope.
  const { scope, policy } = await planScope(env, d, actor, c.mode, parseList(c.requested_sources_json), brief);
  const sh = await scopeHash(c.brief_hash, scope);
  if (sh !== c.scope_hash || confirmScopeHash !== c.scope_hash) {
    await d.prepare("UPDATE discovery_campaigns SET scope_json=?, scope_hash=?, channels_planned=?, channels_unavailable=?, updated_at=datetime('now') WHERE id=? AND status='SCOPE_READY'")
      .bind(JSON.stringify(scope), sh, scope.channels.length, scope.unavailable.length, campaignId).run();
    fail(409, "SCOPE_CHANGED", "Ruang lingkup berubah (izin, kapasitas atau anggaran). Tinjau ulang sebelum memulai.", { scopeHash: sh, scope });
  }
  if (!scope.channels.length) fail(423, "NO_RUNNABLE_SOURCE", "Tidak ada sumber yang dapat dijalankan saat ini.");
  // Lock: only one concurrent start wins SCOPE_READY → RESERVED.
  if (!(await move(d, campaignId, ["SCOPE_READY"], "RESERVED", "Mereservasi hak discovery dan anggaran kampanye", actor))) return { campaignId, status: (await loadOwned(d, actor, campaignId)).status as CampaignStatus, replayed: true };
  const budgets = await activeBudgets(d, actor.orgId);
  const ent = await reserveEntitlement(d, { campaignId, orgId: actor.orgId, userId: actor.userId, policy, bonusFunded: bonusFunded(policy, budgets, [...new Set(scope.channels.map((x) => x.provider))]) });
  if (!ent) {
    await move(d, campaignId, ["RESERVED"], "SCOPE_READY", "Hak discovery periode ini sudah habis", actor);
    await auditStatement(d, { requestId: actor.requestId, actorUserId: actor.userId, action: "discovery.campaign.denied", resourceType: "discovery_campaign", resourceId: campaignId, orgId: actor.orgId, outcome: "denied", metadata: { code: "DISCOVERY_ALLOWANCE_EXHAUSTED" } }).run();
    fail(402, "DISCOVERY_ALLOWANCE_EXHAUSTED", "Hak kampanye discovery Anda untuk periode ini sudah terpakai. Lihat waktu reset di panel hak discovery.");
  }
  const envelopes: string[] = [];
  for (const t of scope.totals) {
    const b = budgets.find((x) => x.providerId === t.providerId && x.unitType === t.unitType);
    const envId = b ? await reserveEnvelope(d, { campaignId, orgId: actor.orgId, budgetId: b.id, units: t.units }) : null;
    if (!envId) {
      await d.batch([
        ...envelopes.map((e) => d.prepare("UPDATE discovery_envelopes SET status='released', settled_at=? WHERE id=? AND status='reserved'").bind(nowIso(), e)),
        releaseEntitlementStatement(d, campaignId, "Anggaran program tidak cukup sebelum dispatch"),
      ]);
      await move(d, campaignId, ["RESERVED"], "SCOPE_READY", "Anggaran program tidak cukup; reservasi dibatalkan", actor);
      fail(429, "PROGRAM_BUDGET_EXHAUSTED", `Alokasi program untuk ${t.providerId} tidak cukup. Hak discovery tidak terpakai; coba ruang lingkup lebih kecil.`);
    }
    envelopes.push(envId!);
  }
  const jobs = scope.channels.map((ch) => d.prepare(`INSERT INTO discovery_jobs (id,campaign_id,org_id,source_id,provider_id,capability,collection_method,query,max_items,units_planned,status,max_attempts) VALUES (?,?,?,?,?,?,?,?,?,?,'QUEUED',?)`)
    .bind(newId("djob"), campaignId, actor.orgId, ch.sourceId, ch.provider, "", ch.collectionMethod, "", scope.maxItemsPerJob, ch.units, Number(policy.max_attempts_per_job)));
  const unitsReserved = scope.totals.reduce((a, t) => a + t.units, 0);
  await d.batch([...jobs, d.prepare("UPDATE discovery_campaigns SET units_reserved=? WHERE id=?").bind(unitsReserved, campaignId),
    auditStatement(d, { requestId: actor.requestId, actorUserId: actor.userId, action: "discovery.campaign.reserved", resourceType: "discovery_campaign", resourceId: campaignId, orgId: actor.orgId, metadata: { entitlement: ent!.kind, policyVersion: policy.version, channels: scope.channels.length, totals: scope.totals } })]);
  await move(d, campaignId, ["RESERVED"], "QUEUED", "Job sumber dijadwalkan", actor);
  return runCampaign(env, d, actor, campaignId, opts.deadlineMs ?? 45_000);
}

// ---------- run ----------
function buildQuery(brief: Brief, s: Row): string {
  const base = brief.keywords.length ? brief.keywords.join(" ") : brief.topic.slice(0, 160);
  const parts = [base];
  if (s.identifier && /^r\/\w+$/.test(s.identifier)) parts.push(s.identifier);
  const geo = GEOGRAPHIES.find((g) => g.code === brief.geography);
  if (geo?.query && s.geography !== brief.geography && !base.toLowerCase().includes(geo.query.toLowerCase())) parts.push(geo.query);
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 300);
}
const inScope = (canonical: string, domains: string[]) => { const host = new URL(canonical).hostname; return !domains.length || domains.some((dm) => { const h = dm.split("/")[0]; return host === h || host.endsWith(`.${h}`); }); };
const fillTemplate = (tpl: unknown, vars: Record<string, string | number>): unknown => {
  if (typeof tpl === "string") { const m = tpl.match(/^\{\{(\w+)\}\}$/); if (m && m[1] in vars) return vars[m[1]]; return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? "")); }
  if (Array.isArray(tpl)) return tpl.map((x) => fillTemplate(x, vars));
  if (tpl && typeof tpl === "object") return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, fillTemplate(v, vars)]));
  return tpl;
};
interface Item { url: string; title: string; content: string; publishedAt: string | null; score: number | null }
interface Collected { items: Item[]; adapter: string; actorVersion: string | null; quality: string }
const actorItem = (fallbackTitle: string) => (it: unknown): Item => {
  const o = it as Row;
  return { url: String(o.url ?? o.link ?? ""), title: String(o.title ?? o.name ?? fallbackTitle).slice(0, 300), content: String(o.text ?? o.description ?? o.body ?? JSON.stringify(o)).slice(0, 4000),
    publishedAt: typeof o.publishedAt === "string" ? o.publishedAt : typeof o.date === "string" ? o.date : null, score: null };
};

async function runJob(env: Env, d: D1Database, actor: Actor, c: Row, jobId: string): Promise<void> {
  const token = newId("dlse");
  const claim = await d.prepare("UPDATE discovery_jobs SET status='RUNNING', attempt=attempt+1, lease_until=?, lease_token=?, started_at=COALESCE(started_at,?) WHERE id=? AND status='QUEUED' AND attempt < max_attempts")
    .bind(new Date(Date.now() + LEASE_MS).toISOString(), token, nowIso(), jobId).run();
  if (!claim.meta.changes) { await d.prepare("UPDATE discovery_jobs SET status='FAILED', error_code=COALESCE(error_code,'ATTEMPTS_EXHAUSTED'), finished_at=? WHERE id=? AND status='QUEUED' AND attempt >= max_attempts").bind(nowIso(), jobId).run(); return; }
  const job = (await d.prepare("SELECT * FROM discovery_jobs WHERE id=?").bind(jobId).first<Row>())!;
  const s = (await d.prepare("SELECT * FROM discovery_sources WHERE id=?").bind(job.source_id).first<Row>())!;
  const brief = JSON.parse(c.brief_json) as Brief;
  const finish = (status: string, set: Record<string, unknown>) => {
    const cols = Object.keys(set);
    return d.prepare(`UPDATE discovery_jobs SET status=?, lease_until=NULL, finished_at=?${cols.map((k) => `, ${k}=?`).join("")} WHERE id=? AND lease_token=?`).bind(status, nowIso(), ...cols.map((k) => set[k]), jobId, token);
  };
  // Source may have been suspended/expired after the member started: re-check before any network I/O.
  const el = await fullEligibility(env, d, s, { orgId: c.org_id, maxUnitsPerJob: Number(job.units_planned) || 1 });
  if (!el.runnable && !(el.code === "PROGRAM_BUDGET_EXHAUSTED" || el.code === "PROGRAM_BUDGET_MISSING")) { await finish("SKIPPED", { error_code: el.code, error_message: reasonFor(el.code) }).run(); return; }
  const query = buildQuery(brief, s);
  const scopeDomains = parseList(s.scope_domains_json);
  const unitType = el.unitType;
  const capability = s.collection_method === "actor" ? `actor:${el.actor!.actor_id}` : s.capability;
  await d.prepare("UPDATE discovery_jobs SET query=?, capability=? WHERE id=?").bind(query, capability, jobId).run();
  try {
    const gwReq = {
      providerId: s.provider_id, capability, purpose: "member_discovery", unitType, estimatedUnits: Number(job.units_planned), idempotencyKey: `disc:${job.id}:${job.attempt}`,
      orgId: c.org_id, userId: c.user_id, taskRef: c.id, requestId: actor.requestId,
      ...(unitType === "usd_micros" ? { reserveCostUsdMicros: Number(job.units_planned), maxCostUsdMicros: Number(job.units_planned) } : {}),
    };
    // Accepted dispatch: the gateway has reserved and is about to send. Marked inside every dispatcher.
    const mark = (ticket: DispatchTicket) => d.prepare("UPDATE discovery_jobs SET dispatched=1, reservation_id=? WHERE id=?").bind(ticket.reservationId, jobId).run();
    let out: GatewayOutcome<Collected>;
    if (s.collection_method === "search_open" || s.collection_method === "search_scoped") {
      const includeDomains = s.collection_method === "search_scoped" ? scopeDomains.map((x) => x.split("/")[0]) : undefined;
      out = await governedCall(env, d, gwReq, async (ticket): Promise<DispatchResult<Collected>> => {
        await mark(ticket);
        const r = await tavilySearch(ticket, query, { maxResults: Number(job.max_items), depth: "basic", includeDomains });
        return { value: { items: r.results as Item[], adapter: "tavily.search@v1", actorVersion: null, quality: "search_snippet" }, unitsActual: r.creditsUsed, providerRequestId: r.providerRequestId, usageEstimated: r.usageEstimated };
      });
    } else if (s.collection_method === "page_extract") {
      out = await governedCall(env, d, gwReq, async (ticket): Promise<DispatchResult<Collected>> => {
        await mark(ticket);
        const r = await firecrawlScrape(ticket, s.base_url);
        return { value: { items: [{ url: r.url, title: r.title ?? r.url, content: r.markdown.slice(0, 4000), publishedAt: null, score: null }], adapter: "firecrawl.scrape@v2", actorVersion: null, quality: "page_extract" }, unitsActual: r.creditsUsed, providerRequestId: r.providerRequestId, usageEstimated: r.usageEstimated };
      });
    } else {
      const a = el.actor!;
      let tpl: unknown = {}; try { tpl = JSON.parse(a.input_schema_json || "{}"); } catch { tpl = {}; }
      const actorInput = fillTemplate((tpl as Row).inputTemplate ?? {}, { query, maxItems: Number(job.max_items) }) as Record<string, unknown>;
      const runOpts = { maxItems: Math.min(Number(job.max_items), Number(a.max_items)), maxChargeUsd: Number(job.units_planned) / 1_000_000, timeoutSeconds: a.timeout_seconds };
      out = await governedCall(env, d, gwReq, async (ticket): Promise<DispatchResult<Collected>> => {
        await mark(ticket);
        const r = await runActor(ticket, s.provider_id as ActorProvider, a.actor_id, actorInput, { ...runOpts, idempotencyKey: ticket.reservationId });
        if (r.status !== "SUCCEEDED") throw new ProviderError("UPSTREAM_ERROR", `Actor run ended with status ${r.status}`);
        return { value: { items: r.items.map(actorItem(s.name)), adapter: `${s.provider_id}.actor@v1`, actorVersion: `${a.actor_id}#v${a.version}`, quality: "structured_item" }, unitsActual: r.costUsdMicros, costActualUsdMicros: r.costUsdMicros, providerRequestId: r.runId, usageEstimated: false };
      });
    }
    const ing = await ingest(d, c, job, s, out.value.items, { query, scopeDomains, adapter: out.value.adapter, actorVersion: out.value.actorVersion, quality: out.value.quality, runId: out.providerRequestId ?? null });
    await finish(ing.kept ? "SUCCEEDED" : "EMPTY", { units_actual: out.unitsActual, cost_actual_usd_micros: out.costActualUsdMicros, provider_run_id: out.providerRequestId ?? null, account_label: out.accountLabel,
      records_returned: out.value.items.length, records_new: ing.created, records_duplicate: ing.duplicates, records_dropped: ing.dropped, error_code: null, error_message: null }).run();
  } catch (error) {
    const after = await d.prepare("SELECT dispatched,attempt,max_attempts FROM discovery_jobs WHERE id=?").bind(jobId).first<Row>();
    const code = (error as { code?: string }).code ?? "UNKNOWN";
    const canRetry = Number(after?.attempt ?? 0) < Number(after?.max_attempts ?? 0);
    if (error instanceof GatewayError) {
      // Rejected BEFORE dispatch: nothing was sent, nothing was charged.
      if ((code === "CONCURRENCY_LIMIT" || code === "RESERVATION_RACE_LOST") && canRetry) { await finish("QUEUED", { error_code: `PROVIDER_${code}` }).run(); return; }
      await finish("FAILED", { error_code: `PROVIDER_${code}`, error_message: reasonFor(`PROVIDER_${code}`) }).run(); return;
    }
    if (code === "TIMEOUT" || code === "UNKNOWN") { await finish("UNKNOWN_CHARGE", { error_code: code, error_message: reasonFor("TIMEOUT"), units_actual: Number(job.units_planned) }).run(); return; }
    if (code === "UPSTREAM_ERROR" && canRetry) { await finish("QUEUED", { error_code: code }).run(); return; }
    await finish("FAILED", { error_code: code, error_message: reasonFor(code) ?? (error instanceof Error ? error.message.slice(0, 200) : null) }).run();
  }
}

async function ingest(d: D1Database, c: Row, job: Row, s: Row, items: Item[], meta: { query: string; scopeDomains: string[]; adapter: string; actorVersion: string | null; quality: string; runId: string | null }) {
  let created = 0, duplicates = 0, dropped = 0, kept = 0; let rank = 0;
  const seen = new Set<string>();
  const ident = typeof s.identifier === "string" && /^r\/\w+$/.test(s.identifier) ? s.identifier.toLowerCase() : null;
  for (const it of items.slice(0, Number(job.max_items))) {
    rank++;
    const canonical = canonicalUrl(it.url);
    // Compliance + scope filter: never keep restricted/login/private URLs or out-of-scope hosts.
    if (!canonical || isRestrictedUrl(canonical) || (s.collection_method === "search_scoped" && !inScope(canonical, meta.scopeDomains))
      || (ident && !new URL(canonical).pathname.toLowerCase().startsWith(`/${ident}`)) || seen.has(canonical)) { dropped++; continue; }
    seen.add(canonical);
    const title = (it.title || canonical).slice(0, 300), content = (it.content || "").slice(0, 4000);
    const { key, community } = independentSourceKey(canonical);
    const hash = await digestHex("SHA-256", `${canonical}|${content}`);
    const fp = await textFingerprint(title, content);
    const h = heuristics(title, content);
    const sigId = newId("sig");
    const ins = await d.prepare(`INSERT OR IGNORE INTO signals (id,org_id,provider_id,collection_method,query,url,title,content_excerpt,content_hash,raw_payload_hash,provider_request_id,observed_at,retention_until,created_by,
        source_catalog_id,platform,community,canonical_url,fingerprint,independent_source_key,adapter,actor_version,evidence_quality,signal_kind,heuristic_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','+180 days'),?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(sigId, c.org_id, s.provider_id, s.collection_method, meta.query, it.url, title, content, hash, hash, meta.runId, it.publishedAt, c.user_id,
        s.id, platformOf(canonical), community ?? s.identifier ?? null, canonical, fp, key, meta.adapter, meta.actorVersion, meta.quality, h.signalKind, JSON.stringify(h)).run();
    const signalId = ins.meta.changes ? sigId : (await d.prepare("SELECT id FROM signals WHERE org_id=? AND content_hash=?").bind(c.org_id, hash).first<{ id: string }>())!.id;
    if (ins.meta.changes) created++;
    const prior = await d.prepare(`SELECT e.id, e.signal_id, e.independent_source_key FROM discovery_campaign_evidence e JOIN signals g ON g.id=e.signal_id
      WHERE e.campaign_id=? AND e.duplicate_kind='unique' AND (e.signal_id=? OR g.canonical_url=? OR (? IS NOT NULL AND e.text_fingerprint=?)) ORDER BY e.created_at LIMIT 1`).bind(c.id, signalId, canonical, fp, fp).first<Row>();
    const kind = !prior ? "unique" : prior.signal_id === signalId || prior.independent_source_key === key ? "exact_duplicate" : "syndicated_copy";
    if (kind !== "unique") duplicates++;
    const r = await d.prepare("INSERT OR IGNORE INTO discovery_campaign_evidence (id,campaign_id,job_id,org_id,signal_id,source_id,rank,provider_score,duplicate_kind,duplicate_of,independent_source_key,text_fingerprint) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(newId("dcev"), c.id, job.id, c.org_id, signalId, s.id, rank, it.score, kind, prior?.id ?? null, key, fp).run();
    if (r.meta.changes) kept++;
  }
  return { created, duplicates, dropped, kept };
}

export async function runCampaign(env: Env, d: D1Database, actor: Actor, campaignId: string, deadlineMs = 45_000) {
  const deadline = Date.now() + deadlineMs;
  let c = (await d.prepare("SELECT * FROM discovery_campaigns WHERE id=?").bind(campaignId).first<Row>())!;
  if (c.status === "QUEUED") await move(d, campaignId, ["QUEUED"], "RUNNING", "Menjalankan job sumber", actor, { started_at: c.started_at ?? nowIso() });
  // Lease recovery (durable resume after a crashed isolate).
  await d.batch([
    d.prepare("UPDATE discovery_jobs SET status='QUEUED', lease_until=NULL, lease_token=NULL WHERE campaign_id=? AND status='RUNNING' AND dispatched=0 AND lease_until < ?").bind(campaignId, nowIso()),
    d.prepare("UPDATE discovery_jobs SET status='UNKNOWN_CHARGE', error_code='AMBIGUOUS_DISPATCH', units_actual=units_planned, lease_until=NULL, finished_at=? WHERE campaign_id=? AND status='RUNNING' AND dispatched=1 AND lease_until < ?").bind(nowIso(), campaignId, nowIso()),
  ]);
  for (let guard = 0; guard < 50; guard++) {
    c = (await d.prepare("SELECT * FROM discovery_campaigns WHERE id=?").bind(campaignId).first<Row>())!;
    if (c.cancel_requested) { await d.prepare("UPDATE discovery_jobs SET status='CANCELLED', finished_at=? WHERE campaign_id=? AND status='QUEUED'").bind(nowIso(), campaignId).run(); break; }
    if (Date.now() > deadline) break;
    const next = await d.prepare("SELECT id FROM discovery_jobs WHERE campaign_id=? AND status='QUEUED' ORDER BY created_at, id LIMIT 1").bind(campaignId).first<{ id: string }>();
    if (!next) break;
    await runJob(env, d, actor, c, next.id);
  }
  const open = await d.prepare("SELECT COUNT(*) AS n FROM discovery_jobs WHERE campaign_id=? AND status IN ('QUEUED','RUNNING')").bind(campaignId).first<{ n: number }>();
  if (Number(open?.n ?? 0) === 0) await reconcile(d, actor, campaignId);
  return { campaignId, status: ((await d.prepare("SELECT status FROM discovery_campaigns WHERE id=?").bind(campaignId).first<{ status: CampaignStatus }>())!).status, replayed: false };
}

// ---------- reconcile ----------
export async function reconcile(d: D1Database, actor: Actor, campaignId: string) {
  if (!(await move(d, campaignId, ["RUNNING", "QUEUED", "RESERVED"], "RECONCILING", "Rekonsiliasi pemakaian dan hak discovery", actor))) return;
  const c = (await d.prepare("SELECT * FROM discovery_campaigns WHERE id=?").bind(campaignId).first<Row>())!;
  const jobs = (await d.prepare("SELECT * FROM discovery_jobs WHERE campaign_id=?").bind(campaignId).all<Row>()).results ?? [];
  // Fair accounting: the entitlement is consumed only when a provider actually accepted work (results, an empty
  // result, a charge, or an ambiguous charge). Definite failures with released reservations give it back.
  const dispatchedAny = jobs.some((j) => ["SUCCEEDED", "EMPTY", "UNKNOWN_CHARGE"].includes(j.status) || Number(j.units_actual) > 0);
  const st = (s: string) => jobs.filter((j) => j.status === s).length;
  const ok = st("SUCCEEDED"), empty = st("EMPTY"), failed = st("FAILED") + st("UNKNOWN_CHARGE") + st("SKIPPED"), cancelled = st("CANCELLED");
  const unitsActual = jobs.reduce((a, j) => a + Number(j.units_actual || 0), 0);
  const cost = jobs.reduce((a, j) => a + Number(j.cost_actual_usd_micros || 0), 0);
  const stmts: D1PreparedStatement[] = [];
  // Envelopes: settle actual usage per provider; release every unused reservation.
  const envs = (await d.prepare("SELECT * FROM discovery_envelopes WHERE campaign_id=? ORDER BY created_at").bind(campaignId).all<Row>()).results ?? [];
  for (const prov of [...new Set(envs.map((e) => e.provider_id))]) {
    const actual = jobs.filter((j) => j.provider_id === prov).reduce((a, j) => a + Number(j.units_actual || 0), 0);
    const settled = envs.filter((e) => e.provider_id === prov && e.status === "settled").reduce((a, e) => a + Number(e.units_actual || 0), 0);
    let remaining = Math.max(0, actual - settled);
    for (const e of envs.filter((x) => x.provider_id === prov && x.status === "reserved")) {
      const take = Math.min(remaining, Number(e.units_reserved)); remaining -= take;
      stmts.push(take > 0 ? d.prepare("UPDATE discovery_envelopes SET status='settled', units_actual=?, settled_at=? WHERE id=? AND status='reserved'").bind(take, nowIso(), e.id)
        : d.prepare("UPDATE discovery_envelopes SET status='released', units_actual=0, settled_at=? WHERE id=? AND status='reserved'").bind(nowIso(), e.id));
    }
  }
  stmts.push(dispatchedAny ? consumeEntitlementStatement(d, campaignId) : releaseEntitlementStatement(d, campaignId, "Tidak ada pekerjaan yang diterima penyedia; hak discovery dikembalikan."));
  const ev = await d.prepare(`SELECT COUNT(*) AS total, SUM(duplicate_kind='unique') AS uniq, COUNT(DISTINCT CASE WHEN duplicate_kind='unique' THEN independent_source_key END) AS indep FROM discovery_campaign_evidence WHERE campaign_id=?`).bind(campaignId).first<Row>();
  const total = Number(ev?.total ?? 0), uniq = Number(ev?.uniq ?? 0);
  let to: CampaignStatus; let reason: string;
  if (c.cancel_requested) { to = "CANCELLED"; reason = dispatchedAny ? "Dibatalkan; job yang sudah dikirim tetap dihitung (hak discovery terpakai)." : "Dibatalkan sebelum dispatch; hak discovery dikembalikan."; }
  else if (ok + empty === jobs.length && jobs.length) { to = "COMPLETED"; reason = ok ? "Semua channel selesai." : "Semua channel selesai tanpa hasil yang lolos filter."; }
  else if (ok + empty > 0) { to = "PARTIAL"; reason = `${ok + empty} dari ${jobs.length} channel selesai; ${failed + cancelled} gagal/dilewati.`; }
  else { to = "FAILED"; reason = dispatchedAny ? "Semua channel gagal; sebagian biaya tidak pasti sehingga hak discovery terpakai." : "Semua channel gagal tanpa biaya; hak discovery dikembalikan."; }
  stmts.push(d.prepare(`UPDATE discovery_campaigns SET channels_succeeded=?, channels_empty=?, channels_failed=?, records_total=?, records_unique=?, records_duplicate=?, independent_sources=?, units_actual=?, cost_actual_usd_micros=? WHERE id=?`)
    .bind(ok, empty, failed + cancelled, total, uniq, total - uniq, Number(ev?.indep ?? 0), unitsActual, cost, campaignId));
  stmts.push(auditStatement(d, { requestId: actor.requestId, actorUserId: actor.userId, actorType: "system", action: "discovery.campaign.reconciled", resourceType: "discovery_campaign", resourceId: campaignId, orgId: c.org_id,
    outcome: to === "FAILED" ? "failure" : "success", metadata: { to, dispatchedAny, entitlement: dispatchedAny ? "consumed" : "released", unitsReserved: c.units_reserved, unitsActual, costUsdMicros: cost, jobs: { ok, empty, failed, cancelled }, records: { total, uniq } } }));
  await d.batch(stmts);
  await move(d, campaignId, ["RECONCILING"], to, reason, actor, { completed_at: nowIso() });
}

// ---------- cancel / retry ----------
export async function cancelCampaign(d: D1Database, actor: Actor, campaignId: string) {
  const c = await loadOwned(d, actor, campaignId);
  if (c.status === "DRAFT" || c.status === "SCOPE_READY") { await move(d, campaignId, ["DRAFT", "SCOPE_READY"], "CANCELLED", "Dibatalkan oleh member sebelum reservasi", actor, { cancel_requested: 1, completed_at: nowIso() }); return; }
  if (!["RESERVED", "QUEUED", "RUNNING"].includes(c.status)) fail(409, "NOT_CANCELLABLE", `Kampanye berstatus ${c.status} tidak dapat dibatalkan.`);
  await d.batch([
    d.prepare("UPDATE discovery_campaigns SET cancel_requested=1, updated_at=datetime('now') WHERE id=?").bind(campaignId),
    d.prepare("UPDATE discovery_jobs SET status='CANCELLED', finished_at=? WHERE campaign_id=? AND status='QUEUED'").bind(nowIso(), campaignId),
    auditStatement(d, { requestId: actor.requestId, actorUserId: actor.userId, action: "discovery.campaign.cancel_requested", resourceType: "discovery_campaign", resourceId: campaignId, orgId: c.org_id }),
  ]);
  const open = await d.prepare("SELECT COUNT(*) AS n FROM discovery_jobs WHERE campaign_id=? AND status='RUNNING'").bind(campaignId).first<{ n: number }>();
  if (!Number(open?.n ?? 0)) await reconcile(d, actor, campaignId);
}

/** Bounded retry of the SAME campaign. Re-uses the campaign's entitlement row: never consumes a second one. */
export async function retryCampaign(env: Env, d: D1Database, actor: Actor, campaignId: string, opts: { deadlineMs?: number } = {}) {
  const c = await loadOwned(d, actor, campaignId);
  if (!["PARTIAL", "FAILED"].includes(c.status)) fail(409, "NOT_RETRYABLE", "Hanya kampanye PARTIAL atau FAILED yang dapat diulang.");
  const retries = await d.prepare("SELECT COUNT(*) AS n FROM lifecycle_transitions WHERE entity_type='discovery_campaign' AND entity_id=? AND to_state='QUEUED' AND from_state IN ('PARTIAL','FAILED')").bind(campaignId).first<{ n: number }>();
  if (Number(retries?.n ?? 0) >= MAX_CAMPAIGN_RETRIES) fail(409, "RETRY_LIMIT", `Batas ulang (${MAX_CAMPAIGN_RETRIES}x) untuk kampanye ini tercapai.`);
  const jobs = ((await d.prepare("SELECT j.*, s.permission_status FROM discovery_jobs j JOIN discovery_sources s ON s.id=j.source_id WHERE j.campaign_id=? AND j.status IN ('FAILED','SKIPPED')").bind(campaignId).all<Row>()).results ?? []);
  if (!jobs.length) fail(409, "NOTHING_TO_RETRY", "Tidak ada job gagal yang dapat diulang (job dengan status biaya tidak pasti tidak diulang otomatis).");
  const policy = (await d.prepare("SELECT * FROM discovery_policies WHERE id=?").bind(c.policy_id).first<Row>())!;
  const budgets = await activeBudgets(d, actor.orgId);
  const ent = await reserveEntitlement(d, { campaignId, orgId: actor.orgId, userId: actor.userId, policy, bonusFunded: bonusFunded(policy, budgets, [...new Set(jobs.map((j) => j.provider_id))]) });
  if (!ent) return fail(402, "DISCOVERY_ALLOWANCE_EXHAUSTED", "Hak discovery untuk mengulang kampanye ini tidak tersedia pada periode ini.");
  const byProv = new Map<string, number>(); for (const j of jobs) byProv.set(`${j.provider_id}`, (byProv.get(j.provider_id) ?? 0) + Number(j.units_planned));
  const envs: string[] = [];
  for (const [prov, units] of byProv) {
    const b = budgets.find((x) => x.providerId === prov);
    const id = b ? await reserveEnvelope(d, { campaignId, orgId: actor.orgId, budgetId: b.id, units }) : null;
    if (!id) {
      await d.batch(envs.map((e) => d.prepare("UPDATE discovery_envelopes SET status='released', settled_at=? WHERE id=? AND status='reserved'").bind(nowIso(), e)));
      if (ent.state === "reserved") await releaseEntitlementStatement(d, campaignId, "Anggaran program tidak cukup untuk retry").run();
      fail(429, "PROGRAM_BUDGET_EXHAUSTED", "Alokasi program tidak cukup untuk mengulang sekarang.");
    }
    envs.push(id!);
  }
  await d.batch([
    ...jobs.map((j) => d.prepare("UPDATE discovery_jobs SET status='QUEUED', max_attempts=attempt+?, error_code=NULL, error_message=NULL, finished_at=NULL, lease_token=NULL WHERE id=? AND status IN ('FAILED','SKIPPED')").bind(Number(policy.max_attempts_per_job), j.id)),
    auditStatement(d, { requestId: actor.requestId, actorUserId: actor.userId, action: "discovery.campaign.retry", resourceType: "discovery_campaign", resourceId: campaignId, orgId: c.org_id, metadata: { jobs: jobs.length, entitlement: ent.state, newEntitlement: false } }),
  ]);
  await move(d, campaignId, ["PARTIAL", "FAILED"], "QUEUED", "Retry terbatas pada kampanye yang sama (tanpa hak discovery baru)", actor, { completed_at: null });
  return runCampaign(env, d, actor, campaignId, opts.deadlineMs ?? 45_000);
}

export async function loadOwned(d: D1Database, actor: Actor & { orgIds?: string[] }, id: string): Promise<Row> {
  const orgs = actor.orgIds ?? [actor.orgId];
  const c = await d.prepare(`SELECT * FROM discovery_campaigns WHERE id=? AND org_id IN (${orgs.map(() => "?").join(",")})`).bind(id, ...orgs).first<Row>();
  if (!c) fail(404, "CAMPAIGN_NOT_FOUND");
  return c!;
}
