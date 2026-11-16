/**
 * Source catalog + permission governance (docs/31 §4, §12.2, §12.6).
 * Listing ≠ runnable. A source runs only when: permission approved and unexpired, public, commercial use allowed,
 * available, its Actor (if any) approved and selected, its provider route passes the gateway pre-check, and an
 * owner-approved program budget funds it. Member hints are org-private and always start in review.
 */
import type { Env } from "../env";
import { evaluateAccount, loadPrimary } from "../providers/gateway";
import { assertPublicUrl } from "../providers/net";
import { ProviderError } from "../providers/types";
import { canonicalUrl, platformOf, registrableDomain } from "./evidence";
import { activeBudgets, type BudgetView } from "./entitlements";
import { PROVIDER_UNITS } from "./taxonomy";

type Row = Record<string, any>;
export interface Eligibility { runnable: boolean; code: string | null }

export const parseList = (v: unknown): string[] => { try { const x = JSON.parse(String(v ?? "[]")); return Array.isArray(x) ? x.map(String) : []; } catch { return []; } };

/** Sources visible to an org: curated entries + the org's own hints. Never other tenants' hints. */
export async function visibleSources(d: D1Database, orgId: string): Promise<Row[]> {
  return (await d.prepare("SELECT * FROM discovery_sources WHERE origin='curated' OR submitted_by_org=? ORDER BY origin='member_hint', platform, name").bind(orgId).all<Row>()).results ?? [];
}

/** Static source-level governance (no provider state). */
export function sourceGovernance(s: Row, nowMs = Date.now()): Eligibility {
  const deny = (code: string): Eligibility => ({ runnable: false, code });
  if (s.permission_status === "pending_review") return deny("SOURCE_PENDING_REVIEW");
  if (s.permission_status === "rejected") return deny("SOURCE_REJECTED");
  if (s.permission_status === "suspended") return deny("SOURCE_SUSPENDED");
  if (s.permission_status !== "approved") return deny("SOURCE_NOT_APPROVED");
  if (s.access_status !== "public") return deny("SOURCE_NOT_PUBLIC");
  if (!s.review_expires_at || Date.parse(s.review_expires_at) <= nowMs) return deny("SOURCE_REVIEW_EXPIRED");
  if (s.commercial_use !== "allowed") return deny("SOURCE_COMMERCIAL_USE_UNCLEAR");
  if (s.availability !== "available") return deny("SOURCE_PAUSED");
  return { runnable: true, code: null };
}

export const unitsFor = (s: Row, actor: Row | null, maxUnitsPerJob: number) =>
  s.collection_method === "actor" ? Number(actor?.per_run_cost_usd_micros ?? 0) : Math.min(1, maxUnitsPerJob);

/** Evaluates provider routes once per (provider, capability) — the same pre-check the gateway uses before dispatch. */
export function routeChecker(env: Env, d: D1Database) {
  const cache = new Map<string, Promise<string | null>>();
  return (providerId: string, capability: string, unitType: string, units: number) => {
    const key = `${providerId}|${capability}|${units}`;
    if (!cache.has(key)) cache.set(key, (async () => {
      try { await d.prepare("SELECT 1 FROM usage_reservations LIMIT 1").first(); } catch { return "PROVIDER_SCHEMA_NOT_MIGRATED"; }
      const policy = await d.prepare("SELECT * FROM provider_policies WHERE provider_id=?").bind(providerId).first<Row>() ?? null;
      if (!policy) return "PROVIDER_POLICY_MISSING";
      const primary = await loadPrimary(d, providerId, capability);
      if (!primary) return policy.enabled ? "PROVIDER_NO_ELIGIBLE_ACCOUNT" : "PROVIDER_POLICY_DISABLED";
      const ev = await evaluateAccount(env, d, policy, primary, { providerId, capability, unitType, estimatedUnits: units, reserveCostUsdMicros: unitType === "usd_micros" ? units : undefined, maxCostUsdMicros: unitType === "usd_micros" ? units : undefined });
      // Concurrency is transient; the job runner retries it within bounds. Everything else blocks planning.
      return ev.ok || ev.code === "CONCURRENCY_LIMIT" ? null : `PROVIDER_${ev.code}`;
    })());
    return cache.get(key)!;
  };
}

/** Full eligibility for one source (governance → Actor → provider route → program budget). */
export async function fullEligibility(env: Env, d: D1Database, s: Row, opts: { orgId: string; maxUnitsPerJob: number; budgets?: BudgetView[]; route?: ReturnType<typeof routeChecker>; actors?: Map<string, Row | null> }): Promise<Eligibility & { units: number; unitType: string; actor: Row | null }> {
  const unitType = PROVIDER_UNITS[s.provider_id] ?? "credits";
  let actor: Row | null = null;
  const gov = sourceGovernance(s);
  if (!gov.runnable) return { ...gov, units: 0, unitType, actor };
  if (s.collection_method === "actor") {
    if (env.SPECIALIZED_SCRAPER !== s.provider_id) return { runnable: false, code: "PROVIDER_NOT_SELECTED", units: 0, unitType, actor };
    actor = opts.actors?.get(s.actor_registry_id) ?? await d.prepare("SELECT * FROM actor_registry WHERE id=?").bind(s.actor_registry_id).first<Row>() ?? null;
    opts.actors?.set(s.actor_registry_id, actor);
    if (!actor || actor.status !== "approved" || actor.provider_id !== s.provider_id || !actor.approval_expires_at || Date.parse(actor.approval_expires_at) <= Date.now() || !(actor.per_run_cost_usd_micros > 0))
      return { runnable: false, code: "ACTOR_NOT_APPROVED", units: 0, unitType, actor };
  }
  const units = unitsFor(s, actor, opts.maxUnitsPerJob);
  const capability = s.collection_method === "actor" ? `actor:${actor!.actor_id}` : s.capability;
  const routeCode = await (opts.route ?? routeChecker(env, d))(s.provider_id, capability, unitType, units);
  if (routeCode) return { runnable: false, code: routeCode, units, unitType, actor };
  const budgets = opts.budgets ?? await activeBudgets(d, opts.orgId);
  const b = budgets.find((x) => x.providerId === s.provider_id && x.unitType === unitType);
  if (!b) return { runnable: false, code: "PROGRAM_BUDGET_MISSING", units, unitType, actor };
  if (b.orgRemaining < units || b.monthCap - b.monthUsed < units) return { runnable: false, code: "PROGRAM_BUDGET_EXHAUSTED", units, unitType, actor };
  return { runnable: true, code: null, units, unitType, actor };
}

/** Member-safe catalog projection. No Actor IDs, account labels or internal reviewer identities. */
export function publicSource(s: Row, el?: Eligibility | null) {
  return {
    id: s.id, slug: s.slug, platform: s.platform, sourceType: s.source_type, name: s.name, identifier: s.identifier, baseUrl: s.base_url, description: s.description,
    topics: parseList(s.topics_json), categories: parseList(s.categories_json), geography: s.geography, language: s.language,
    accessStatus: s.access_status, permissionStatus: s.permission_status, commercialUse: s.commercial_use, collectionMethod: s.collection_method,
    provider: s.provider_id, availability: s.availability, limitations: s.limitations, freshness: s.freshness_note, origin: s.origin,
    reviewedAt: s.reviewed_at, reviewExpiresAt: s.review_expires_at, reviewNote: s.origin === "member_hint" ? s.review_note : undefined,
    validation: s.origin === "member_hint" ? safeJson(s.validation_json) : undefined,
    runnable: el ? el.runnable : null, unavailableCode: el ? el.code : null,
  };
}
const safeJson = (v: unknown) => { try { return JSON.parse(String(v ?? "{}")); } catch { return {}; } };

// ---------- Member source hints ----------
const RESTRICTED: { re: RegExp; access: "login_required" | "private" | "restricted"; why: string }[] = [
  { re: /(^|\.)facebook\.com\/groups\//i, access: "restricted", why: "Grup Facebook: status publik/privat harus direview; grup privat tidak pernah dikumpulkan." },
  { re: /(^|\.)facebook\.com\/(messages|messenger)|messenger\.com/i, access: "private", why: "Pesan pribadi tidak pernah dikumpulkan." },
  { re: /(^|\.)(wa\.me|chat\.whatsapp\.com|web\.whatsapp\.com)/i, access: "private", why: "Grup/obrolan WhatsApp bersifat privat." },
  { re: /(^|\.)t\.me\/(joinchat|\+)/i, access: "private", why: "Tautan undangan Telegram privat." },
  { re: /(^|\.)discord\.(gg|com\/invite)/i, access: "private", why: "Server Discord memerlukan keanggotaan." },
  { re: /(^|\.)(instagram\.com|linkedin\.com\/feed|x\.com\/i\/|twitter\.com\/i\/)/i, access: "login_required", why: "Konten memerlukan login; tidak dikumpulkan." },
  { re: /\/(login|signin|sign-in|auth|account|checkout|cart|admin)(\/|$|\?)/i, access: "login_required", why: "Halaman login/akun tidak dikumpulkan." },
];

/** True for URLs that must never be kept as evidence (private/login/restricted surfaces). */
export function isRestrictedUrl(canonical: string): boolean {
  const bare = canonical.replace(/^https?:\/\//, "");
  return RESTRICTED.some((r) => r.re.test(bare));
}

export interface HintValidation {
  ok: boolean; input: string; kind: "url" | "community" | "name"; canonicalUrl: string | null; platform: string; identifier: string | null;
  scopeDomains: string[]; accessStatus: "public" | "login_required" | "private" | "restricted" | "unknown"; permissionStatus: "pending_review" | "rejected";
  reachability: { checked: boolean; status: number | null; redirectedTo: string | null; note: string } ; reasons: string[];
}

/** Validates a member-supplied URL/community name. Never approves: the best outcome is pending_review. */
export async function validateHint(raw: string): Promise<HintValidation> {
  const input = raw.trim().slice(0, 500);
  const reasons: string[] = [];
  const base = { input, reachability: { checked: false, status: null, redirectedTo: null, note: "Tidak dicek." } };
  const sub = input.match(/^\/?r\/([A-Za-z0-9_]{2,21})$/);
  if (sub) {
    return { ...base, ok: true, kind: "community", canonicalUrl: `https://reddit.com/r/${sub[1]}`, platform: "reddit", identifier: `r/${sub[1]}`, scopeDomains: ["reddit.com"], accessStatus: "unknown", permissionStatus: "pending_review",
      reasons: ["Subreddit dikenali. Status publik dan izin pengumpulan wajib direview owner sebelum dapat dijalankan."] };
  }
  if (!/^https?:\/\//i.test(input)) {
    if (!/^[\p{L}\p{N} .,'&()/_-]{2,120}$/u.test(input)) return { ...base, ok: false, kind: "name", canonicalUrl: null, platform: "web", identifier: null, scopeDomains: [], accessStatus: "unknown", permissionStatus: "rejected", reasons: ["Format nama komunitas tidak valid."] };
    return { ...base, ok: true, kind: "name", canonicalUrl: null, platform: "web", identifier: input, scopeDomains: [], accessStatus: "unknown", permissionStatus: "pending_review",
      reasons: ["Nama komunitas dicatat sebagai petunjuk. Owner perlu memetakan ke sumber publik yang sah sebelum dapat dijalankan."] };
  }
  let url: URL;
  try { url = assertPublicUrl(input); } catch (e) {
    return { ...base, ok: false, kind: "url", canonicalUrl: null, platform: "web", identifier: null, scopeDomains: [], accessStatus: "unknown", permissionStatus: "rejected", reasons: [e instanceof ProviderError ? e.message : "URL tidak valid."] };
  }
  const canonical = canonicalUrl(url.toString());
  if (!canonical) return { ...base, ok: false, kind: "url", canonicalUrl: null, platform: "web", identifier: null, scopeDomains: [], accessStatus: "unknown", permissionStatus: "rejected", reasons: ["URL tidak valid."] };
  const platform = platformOf(canonical);
  const host = new URL(canonical).hostname;
  for (const r of RESTRICTED) if (r.re.test(canonical.replace(/^https:\/\//, ""))) {
    reasons.push(r.why);
    if (r.access !== "restricted") return { ...base, ok: false, kind: "url", canonicalUrl: canonical, platform, identifier: null, scopeDomains: [], accessStatus: r.access, permissionStatus: "rejected", reasons };
    return { ...base, ok: true, kind: "url", canonicalUrl: canonical, platform, identifier: null, scopeDomains: [registrableDomain(host)], accessStatus: "restricted", permissionStatus: "pending_review", reasons };
  }
  // Bounded reachability probe: no credentials, no cookies, manual redirects, short timeout, body never read.
  const reach = { checked: true, status: null as number | null, redirectedTo: null as string | null, note: "" };
  let access: HintValidation["accessStatus"] = "unknown";
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(canonical, { method: "HEAD", redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "DAYANEXA-SourceValidator/1.0 (+https://dayanexa.biz.id)" } });
    clearTimeout(t);
    reach.status = res.status;
    const loc = res.headers.get("location");
    if (loc) reach.redirectedTo = loc.slice(0, 300);
    if (res.status === 401 || res.status === 403 || (loc && /login|signin|auth|account/i.test(loc))) { access = "login_required"; reach.note = "Halaman meminta login atau menolak akses."; }
    else if (res.status >= 200 && res.status < 400) { reach.note = "Dapat dijangkau secara publik (belum berarti izin pengumpulan)."; }
    else reach.note = `Respons HTTP ${res.status}.`;
  } catch { reach.note = "Tidak dapat dijangkau saat validasi."; }
  if (access === "login_required") {
    reasons.push("Sumber memerlukan login/akses terbatas — tidak dapat dikumpulkan.");
    return { ...base, reachability: reach, ok: false, kind: "url", canonicalUrl: canonical, platform, identifier: null, scopeDomains: [], accessStatus: access, permissionStatus: "rejected", reasons };
  }
  const seg = new URL(canonical).pathname.split("/").filter(Boolean);
  const identifier = platform === "reddit" && seg[0] === "r" && seg[1] ? `r/${seg[1]}` : null;
  reasons.push("URL publik bukan bukti izin pengumpulan. Menunggu review izin & penggunaan komersial oleh owner.");
  return { ...base, reachability: reach, ok: true, kind: "url", canonicalUrl: canonical, platform, identifier, scopeDomains: [registrableDomain(host)], accessStatus: access, permissionStatus: "pending_review", reasons };
}
