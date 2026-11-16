import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { makeD1 } from "./d1shim";

// Session verification is mocked (token = Clerk user id). Routing, middleware, principal resolution, permissions,
// the Provider Runtime Gateway, the discovery engine and all SQL run for real on the real migrations.
// Only the outbound provider network (global fetch) is stubbed — no live provider is called by tests.
vi.mock("../apps/api/src/auth/clerk", () => ({
  verifySession: async (token: string) => (token ? { clerkUserId: token, sessionId: null } : null),
  fetchClerkUser: async () => null,
  isGoogleAccount: () => true,
}));
const { createApp } = await import("../apps/api/src/index");

const SECRET = "FAKE_TEST_TAVILY_CREDENTIAL_ZZ9";
const { d1, raw } = makeD1();
const env = { APP_ENV: "test", DB: d1, CLERK_JWT_KEY: "test", TAVILY_API_KEY: SECRET, SPECIALIZED_SCRAPER: "none", PAYMENTS_MODE: "mock", PAYMENT_LIVE_ENABLED: "false" } as never;
const app = createApp();
let seq = 0;
const call = async (who: string | null, method: string, path: string, body?: unknown, idem?: string | false) => {
  const headers: Record<string, string> = {};
  if (who) headers.authorization = `Bearer ${who}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idem !== false && method === "POST") headers["idempotency-key"] = idem ?? `test-idem-${Date.now()}-${seq++}`;
  const r = await app.request(`/api/v1${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }, env);
  const text = await r.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text };
};
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const H = 3_600_000, DAY = 86_400_000;

// ---------- provider network stub ----------
type Mode = "ok" | "429" | "401" | "500";
let tavilyQueue: Mode[] = [];
let tavilyResults: (body: any) => any[] = () => [];
let fetchSpy: ReturnType<typeof vi.fn>;
const tavilyCalls = () => fetchSpy.mock.calls.filter((c) => String(c[0]).includes("api.tavily.com"));
beforeEach(() => {
  tavilyQueue = [];
  tavilyResults = (b) => {
    const dom = (b.include_domains?.[0] ?? "example.com").split("/")[0];
    const slug = String(b.query).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    return [
      { url: `https://www.${dom}/r/indonesia/comments/${slug}-a?utm_source=x`, title: `Butuh aplikasi kasir offline untuk toko kecil ${slug}`, content: "Saya mencari aplikasi kasir offline yang murah, masalah stok sering selisih dan masih pakai spreadsheet manual setiap hari.", score: 0.9, published_date: "2026-11-01" },
      { url: `https://${dom}/r/indonesia/comments/${slug}-b`, title: `Rekomendasi software pembukuan UMKM ${slug}`, content: "Ada rekomendasi software pembukuan untuk UMKM? Bersedia bayar kalau fiturnya cocok dengan kebutuhan toko kami di Bandung.", score: 0.8 },
      { url: `https://${dom}/login?next=/private`, title: "Login", content: "Silakan login untuk melihat konten.", score: 0.1 },
    ];
  };
  fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("api.tavily.com")) {
      const mode = tavilyQueue.shift() ?? "ok";
      if (mode === "429") return new Response("{}", { status: 429, headers: { "retry-after": "120" } });
      if (mode === "401") return new Response("{}", { status: 401 });
      if (mode === "500") return new Response("{}", { status: 500 });
      const b = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify({ results: tavilyResults(b), usage: { credits: 1 }, request_id: `tvly_req_${seq++}` }), { status: 200 });
    }
    if (init?.method === "HEAD") return new Response(null, { status: 200 });
    throw new Error(`unexpected network call ${url}`);
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

// ---------- fixtures ----------
const USERS = ["alice", "bob", "carol", "dave", "erin", "frank", "gina", "hank", "ivan", "judy", "kim", "leo"];
beforeAll(() => {
  raw.exec(`INSERT INTO users (id,clerk_user_id,email,status) VALUES ('usr_owner0000001','user_owner','owner@example.com','active');
    INSERT INTO organizations (id,name,kind,created_by) VALUES ('org_owner0000001','Owner','personal','usr_owner0000001');
    INSERT INTO memberships (org_id,user_id,role) VALUES ('org_owner0000001','usr_owner0000001','owner');
    INSERT INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES ('usr_owner0000001','owner','platform','global','test');`);
  for (const u of USERS) {
    const pad = (s: string) => (s + "0000000000000").slice(0, 12);
    raw.exec(`INSERT INTO users (id,clerk_user_id,email,status) VALUES ('usr_${pad(u)}','user_${u}','${u}@example.com','active');
      INSERT INTO organizations (id,name,kind,created_by) VALUES ('org_${pad(u)}','${u}','personal','usr_${pad(u)}');
      INSERT INTO memberships (org_id,user_id,role) VALUES ('org_${pad(u)}','usr_${pad(u)}','owner');
      INSERT INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES ('usr_${pad(u)}','member','platform','global','system');`);
  }
  // Provider Runtime Gateway: Tavily free-tier route with a verified quota snapshot, price 0, caps > 0.
  raw.exec(`INSERT INTO provider_policies (provider_id,enabled,allow_paid_usage,daily_unit_cap,monthly_unit_cap,unit_type,fallback_mode) VALUES ('tavily',1,0,500,5000,'credits','stop');
    INSERT INTO provider_accounts (id,provider_id,label,secret_binding,ownership_status,account_status,capabilities_json,terms_reviewed_at,unit_type,unit_price_usd_micros,per_request_unit_cap,daily_unit_cap,monthly_unit_cap,concurrency_limit,priority)
      VALUES ('pacc_tavily00001','tavily','tavily-main-INTERNAL-LABEL','TAVILY_API_KEY','authorized','active','["search"]','${iso(-DAY)}','credits',0,5,500,5000,5,10);`);
  raw.prepare("INSERT INTO quota_snapshots (id,account_id,unit_type,allowance_units,used_units_reported,window_kind,reset_at,source,verified_at) VALUES ('qsn_t1','pacc_tavily00001','credits',1000,0,'month',?,'provider_api',?)").run(iso(20 * DAY), iso(-H));
});

const approve = (id: string) => call("user_owner", "POST", `/admin/discovery/sources/${id}/review`, { to: "approved", accessStatus: "public", commercialUse: "allowed", expiresAt: iso(90 * DAY), note: "Reviewed: search-index scoped public pages only.", collectionMethodConfirmed: true });
const budget = (over: Record<string, unknown> = {}) => call("user_owner", "POST", "/admin/discovery/budgets", { providerId: "tavily", unitType: "credits", monthUnitsCap: 200, perOrgMonthUnitsCap: 20, bonusEnabled: false, expiresAt: iso(30 * DAY), reason: "Owner-approved verified free Tavily allowance for member discovery.", ...over });
const brief = (over: Record<string, unknown> = {}) => ({ title: "Riset kasir UMKM", topic: "UMKM toko kecil butuh aplikasi kasir dan pembukuan offline", keywords: ["aplikasi kasir", "UMKM"], categories: ["msme_ops", "software_ai"], geography: "ID", language: "id", ...over });
const plan = (who: string, mode: string, sourceIds: string[] = [], b = brief(), idem?: string) => call(who, "POST", "/discovery/campaigns", { mode, sourceIds, brief: b }, idem);
const start = (who: string, id: string, scopeHash: string) => call(who, "POST", `/discovery/campaigns/${id}/start`, { scopeHash });
const entRows = (campaignId: string) => raw.prepare("SELECT * FROM discovery_entitlements WHERE campaign_id=?").all(campaignId) as any[];

describe("member access & separation of authority", () => {
  it("member gets v3:use + a policy-driven discovery entitlement, never staff permissions", async () => {
    const r = await call("user_alice", "GET", "/me");
    expect(r.status).toBe(200);
    expect(r.json.permissions).toContain("v3:use");
    expect(r.json.permissions).not.toContain("workspace:read");
    expect(r.json.permissions).not.toContain("provider:admin");
    expect(r.json.roles).toEqual(["member"]);
    expect(r.json.discovery).toMatchObject({ eligible: true, plan: "free", policy: { version: 1, guaranteed: 1, conditionalBonus: 1 } });
    expect(r.json.discovery.state).toBe("pending_capacity"); // no program budget yet → not falsely "available"
  });
  it("members are denied every owner-only discovery control; owner is allowed", async () => {
    for (const path of ["/admin/discovery/sources", "/admin/discovery/budgets", "/admin/discovery/policies", "/admin/discovery/campaigns"]) {
      expect((await call("user_alice", "GET", path)).status, path).toBe(403);
      expect((await call("user_owner", "GET", path)).status, path).toBe(200);
    }
    expect((await call("user_alice", "POST", "/admin/discovery/sources/dsrc_kaskus/review", { to: "approved", accessStatus: "public", commercialUse: "allowed", expiresAt: iso(DAY), note: "self-approve attempt", collectionMethodConfirmed: true })).status).toBe(403);
    expect((await call("user_alice", "POST", "/admin/discovery/budgets", { providerId: "tavily", unitType: "credits", monthUnitsCap: 999, perOrgMonthUnitsCap: 999, expiresAt: iso(DAY), reason: "member self-funding attempt" })).status).toBe(403);
    expect((await budget()).status).toBe(201);
    raw.exec("UPDATE discovery_program_budgets SET status='revoked'");
  });
  it("legacy operator discovery routes stay staff-only", async () => {
    expect((await call("user_alice", "POST", "/discovery/search", { query: "abc def" })).status).toBe(403);
  });
});

describe("source catalog & permission governance", () => {
  it("catalog lists curated sources but none is runnable before review (listing ≠ runnable)", async () => {
    const r = await call("user_alice", "GET", "/discovery/catalog");
    expect(r.status).toBe(200);
    expect(r.json.items.length).toBeGreaterThanOrEqual(11);
    expect(r.json.runnable).toBe(0);
    expect(r.json.items.find((s: any) => s.id === "dsrc_kaskus")).toMatchObject({ runnable: false, unavailableCode: "SOURCE_PENDING_REVIEW" });
    expect(r.text).not.toContain("INTERNAL-LABEL");
    expect(r.text).not.toContain(SECRET);
  });
  it("search and filters work", async () => {
    expect((await call("user_alice", "GET", "/discovery/catalog?platform=reddit")).json.items.every((s: any) => s.platform === "reddit")).toBe(true);
    const q = await call("user_alice", "GET", "/discovery/catalog?q=smallbusiness");
    expect(q.json.items.map((s: any) => s.id)).toEqual(["dsrc_reddit_smallbusiness"]);
    expect((await call("user_alice", "GET", "/discovery/catalog?category=b2b")).json.items.every((s: any) => s.categories.includes("b2b"))).toBe(true);
  });
  it("owner approval requires public access, explicit commercial use, method confirmation and a bounded expiry", async () => {
    const bad = await call("user_owner", "POST", "/admin/discovery/sources/dsrc_kaskus/review", { to: "approved", accessStatus: "public", commercialUse: "unclear", expiresAt: iso(DAY), note: "missing commercial decision" });
    expect(bad.json.error.code).toBe("COMMERCIAL_USE_REQUIRED");
    expect((await call("user_owner", "POST", "/admin/discovery/sources/dsrc_kaskus/review", { to: "approved", accessStatus: "public", commercialUse: "allowed", expiresAt: iso(400 * DAY), note: "too long an expiry", collectionMethodConfirmed: true })).json.error.code).toBe("INVALID_EXPIRY");
    for (const id of ["dsrc_reddit_indonesia", "dsrc_kaskus", "dsrc_quora", "dsrc_web_open_id", "dsrc_stackexchange"]) expect((await approve(id)).status, id).toBe(200);
    const reviews = raw.prepare("SELECT COUNT(*) AS n FROM discovery_source_reviews WHERE source_id='dsrc_kaskus' AND to_status='approved'").get() as any;
    expect(reviews.n).toBe(1);
    // Approved but no owner-approved program budget → still not runnable; entitlement is not falsely fulfilled.
    const r = await call("user_alice", "GET", "/discovery/catalog");
    expect(r.json.items.find((s: any) => s.id === "dsrc_kaskus")).toMatchObject({ runnable: false, unavailableCode: "PROGRAM_BUDGET_MISSING" });
  });
  it("custom URL hints are validated, org-private and never executable until reviewed", async () => {
    const ok = await call("user_alice", "POST", "/discovery/sources/hints", { input: "https://www.reddit.com/r/UMKM/?utm_source=abc" });
    expect(ok.status).toBe(201);
    expect(ok.json.validation).toMatchObject({ ok: true, permissionStatus: "pending_review", canonicalUrl: "https://reddit.com/r/UMKM", identifier: "r/UMKM" });
    const login = await call("user_alice", "POST", "/discovery/sources/hints", { input: "https://www.instagram.com/someone" });
    expect(login.json.validation).toMatchObject({ ok: false, permissionStatus: "rejected", accessStatus: "login_required" });
    const priv = await call("user_alice", "POST", "/discovery/sources/hints", { input: "https://chat.whatsapp.com/AbCdEf" });
    expect(priv.json.validation).toMatchObject({ ok: false, accessStatus: "private" });
    const ssrf = await call("user_alice", "POST", "/discovery/sources/hints", { input: "http://169.254.169.254/latest/meta-data" });
    expect(ssrf.json.validation.ok).toBe(false);
    // Bob cannot see or use Alice's hint.
    const bobCat = await call("user_bob", "GET", "/discovery/catalog");
    expect(bobCat.json.items.some((s: any) => s.id === ok.json.source.id)).toBe(false);
    await budget();
    const bobPlan = await plan("user_bob", "single", [ok.json.source.id]);
    expect(bobPlan.status).toBe(404);
    // Alice's own unreviewed hint is visible but not runnable.
    const aliceCat = await call("user_alice", "GET", "/discovery/catalog");
    expect(aliceCat.json.items.find((s: any) => s.id === ok.json.source.id)).toMatchObject({ runnable: false, unavailableCode: "SOURCE_PENDING_REVIEW", origin: "member_hint" });
    const unrev = await plan("user_alice", "single", [ok.json.source.id]);
    expect(unrev.json.campaign).toMatchObject({ status: "FAILED", blockedCode: "NO_RUNNABLE_SOURCE" });
    expect(tavilyCalls()).toHaveLength(0);
    expect(entRows(unrev.json.campaign.id)).toHaveLength(0);
  });
});

describe("campaign engine — single, multi, omni", () => {
  it("single-channel: scope review → governed real dispatch → provenance → consumed entitlement → reconciled usage", async () => {
    const p = await plan("user_carol", "single", ["dsrc_reddit_indonesia"]);
    expect(p.status).toBe(201);
    expect(p.json.campaign.status).toBe("SCOPE_READY");
    expect(p.json.scope.channels).toHaveLength(1);
    expect(tavilyCalls()).toHaveLength(0); // planning never calls a provider
    const s = await start("user_carol", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(s.status).toBe(200);
    expect(s.json.campaign.status).toBe("COMPLETED");
    expect(tavilyCalls()).toHaveLength(1);
    const sent = JSON.parse(String(tavilyCalls()[0][1].body));
    expect(sent.include_domains).toEqual(["reddit.com"]);
    expect((tavilyCalls()[0][1].headers as any).authorization).toBe(`Bearer ${SECRET}`); // server-side only
    expect(s.text).not.toContain(SECRET);
    expect(s.text).not.toContain("INTERNAL-LABEL");
    expect(s.json.entitlement).toMatchObject({ kind: "guaranteed", state: "consumed", policy_version: 1 });
    expect(s.json.coverage).toMatchObject({ channelsPlanned: 1, channelsSucceeded: 1, recordsUnique: 2 });
    expect(s.json.jobs[0]).toMatchObject({ status: "SUCCEEDED", records_dropped: 1, dispatched: 1 }); // login URL dropped
    // Gateway reservation settled with actual usage; program envelope settled.
    const res = raw.prepare("SELECT status,units_actual,task_ref,purpose FROM usage_reservations WHERE task_ref=?").all(p.json.campaign.id) as any[];
    expect(res).toEqual([expect.objectContaining({ status: "settled", units_actual: 1, purpose: "member_discovery" })]);
    expect(raw.prepare("SELECT status,units_actual FROM discovery_envelopes WHERE campaign_id=?").all(p.json.campaign.id)).toEqual([expect.objectContaining({ status: "settled", units_actual: 1 })]);
    // Evidence provenance
    const ev = await call("user_carol", "GET", `/discovery/campaigns/${p.json.campaign.id}/evidence`);
    expect(ev.json.items).toHaveLength(2);
    const e = ev.json.items[0];
    expect(e).toMatchObject({ provider_id: "tavily", adapter: "tavily.search@v1", collection_method: "search_scoped", platform: "reddit", community: "r/indonesia", evidence_quality: "search_snippet" });
    expect(e.provider_request_id).toMatch(/^tvly_req_/);
    expect(e.canonical_url).toMatch(/^https:\/\/reddit\.com\/r\/indonesia\//);
    expect(e.canonical_url).not.toContain("utm_");
    expect(e.content_hash).toHaveLength(64);
    expect(e.heuristic).toMatchObject({ label: "inferred", method: "keyword_heuristic@1" });
    expect(ev.text).not.toContain("DEMAND_VALIDATED");
    // Audit trail without secrets
    const audits = raw.prepare("SELECT action,metadata_json FROM audit_events WHERE resource_id=? OR metadata_json LIKE ?").all(p.json.campaign.id, `%${p.json.campaign.id}%`) as any[];
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["discovery.campaign.created", "discovery.campaign.reserved", "discovery.campaign.reconciled"]));
    expect(JSON.stringify(audits)).not.toContain(SECRET);
    // Lifecycle trail
    expect(s.json.transitions.map((t: any) => t.to_state)).toEqual(["DRAFT", "VALIDATING", "SCOPE_READY", "RESERVED", "QUEUED", "RUNNING", "RECONCILING", "COMPLETED"]);
  });

  it("Free allowance: a new campaign after the guaranteed one is denied (bonus unfunded) with no provider call", async () => {
    const p = await plan("user_carol", "single", ["dsrc_kaskus"]);
    const before = tavilyCalls().length;
    const s = await start("user_carol", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(s.status).toBe(402);
    expect(s.json.error.code).toBe("DISCOVERY_ALLOWANCE_EXHAUSTED");
    expect(tavilyCalls().length).toBe(before);
    expect(entRows(p.json.campaign.id)).toHaveLength(0);
    const me = await call("user_carol", "GET", "/discovery/entitlement");
    expect(me.json).toMatchObject({ used: 1, remaining: 0, state: "exhausted", bonusFunded: false });
    expect(me.json.nextResetAt).toBeTruthy();
  });

  it("multi-channel: one parent entitlement for many child jobs; cross-channel dedup and independent-source counts", async () => {
    // Every channel returns the SAME two posts → cross-channel duplicates must not inflate evidence.
    tavilyResults = () => [
      { url: "https://www.reddit.com/r/indonesia/comments/same-post", title: "Butuh aplikasi kasir", content: "Saya mencari aplikasi kasir offline murah untuk toko kelontong, sekarang masih manual pakai buku dan spreadsheet tiap malam.", score: 0.9 },
      { url: "https://blogkasir.example.co.id/artikel/kasir", title: "Kasir offline", content: "Saya mencari aplikasi kasir offline murah untuk toko kelontong, sekarang masih manual pakai buku dan spreadsheet tiap malam.", score: 0.7 },
    ];
    const p = await plan("user_dave", "multi", ["dsrc_web_open_id", "dsrc_quora", "dsrc_stackexchange"]);
    expect(p.json.scope.channels).toHaveLength(3);
    const s = await start("user_dave", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(s.json.campaign.status).toBe("COMPLETED");
    expect(s.json.jobs).toHaveLength(3);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM discovery_entitlements WHERE org_id='org_dave00000000'").get()).toMatchObject({ n: 1 });
    // web-open keeps both (one is a syndicated copy of the other); scoped channels drop out-of-scope hosts.
    expect(s.json.coverage.recordsUnique).toBe(1);
    expect(s.json.coverage.recordsDuplicate).toBe(1);
    expect(s.json.coverage.independentSources).toBe(1);
    const ev = await call("user_dave", "GET", `/discovery/campaigns/${p.json.campaign.id}/evidence?duplicates=1`);
    expect(ev.json.items.map((x: any) => x.duplicate_kind).sort()).toEqual(["syndicated_copy", "unique"]);
    const me = await call("user_dave", "GET", "/discovery/entitlement");
    expect(me.json.used).toBe(1); // 3 channels, still one campaign
  });

  it("omni: system selects approved, funded, relevant sources and explains the rest", async () => {
    const p = await plan("user_erin", "omni", [], brief({ categories: ["complaint", "msme_ops"] }));
    expect(p.json.campaign.status).toBe("SCOPE_READY");
    const picked = p.json.scope.channels.map((c: any) => c.sourceId);
    expect(picked.length).toBeGreaterThan(1);
    expect(picked.length).toBeLessThanOrEqual(4);
    for (const id of picked) expect(["dsrc_reddit_indonesia", "dsrc_kaskus", "dsrc_quora", "dsrc_web_open_id", "dsrc_stackexchange"]).toContain(id);
    expect(new Set(p.json.scope.channels.map((c: any) => c.platform)).size).toBe(picked.length); // platform diversity
    const fb = p.json.scope.unavailable.find((u: any) => u.sourceId === "dsrc_facebook_pages");
    expect(fb).toMatchObject({ code: "SOURCE_PENDING_REVIEW" });
    expect(p.json.scope.channels[0].reason).toMatch(/Dipilih otomatis/);
    const s = await start("user_erin", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(["COMPLETED", "PARTIAL"]).toContain(s.json.campaign.status);
    expect(s.json.entitlement.state).toBe("consumed");
  });

  it("idempotent create and start replays never duplicate campaigns or dispatches", async () => {
    const k = "same-key-123456";
    const a = await plan("user_frank", "single", ["dsrc_kaskus"], brief(), k);
    const b = await plan("user_frank", "single", ["dsrc_kaskus"], brief(), k);
    expect(b.status).toBe(200);
    expect(b.json.campaign.id).toBe(a.json.campaign.id);
    expect((await plan("user_frank", "single", ["dsrc_kaskus"], brief({ topic: "Topik lain yang berbeda sekali" }), k)).status).toBe(409);
    const s1 = await start("user_frank", a.json.campaign.id, a.json.campaign.scopeHash);
    const calls = tavilyCalls().length;
    const s2 = await start("user_frank", a.json.campaign.id, a.json.campaign.scopeHash);
    expect(s2.status).toBe(200);
    expect(s2.json.campaign.status).toBe(s1.json.campaign.status);
    expect(tavilyCalls().length).toBe(calls);
  });

  it("a stale scope hash forces the member to review the new scope", async () => {
    const p = await plan("user_gina", "single", ["dsrc_kaskus"]);
    const r = await start("user_gina", p.json.campaign.id, "0".repeat(64));
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("SCOPE_CHANGED");
    expect(entRows(p.json.campaign.id)).toHaveLength(0);
    expect(await call("user_gina", "POST", `/discovery/campaigns/${p.json.campaign.id}/cancel`, {})).toMatchObject({ status: 200 });
    expect((await call("user_gina", "GET", `/discovery/campaigns/${p.json.campaign.id}`)).json.campaign.status).toBe("CANCELLED");
    expect((await call("user_gina", "GET", "/discovery/entitlement")).json.used).toBe(0);
  });
});

describe("failure accounting, retry and provider governance", () => {
  it("partial: 429 on one channel → PARTIAL, no account rotation, retry re-uses the SAME entitlement", async () => {
    raw.exec("DELETE FROM circuit_breakers");
    tavilyQueue = ["ok", "429"];
    const p = await plan("user_hank", "multi", ["dsrc_kaskus", "dsrc_quora"]);
    const s = await start("user_hank", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(s.json.campaign.status).toBe("PARTIAL");
    expect(s.json.jobs.map((j: any) => j.status).sort()).toEqual(["FAILED", "SUCCEEDED"]);
    expect(s.json.jobs.find((j: any) => j.status === "FAILED").error_code).toBe("RATE_LIMITED");
    expect(s.json.entitlement.state).toBe("consumed");
    // Released reservation for the 429; no second account was tried (only one credential exists, and none rotated).
    expect(raw.prepare("SELECT status FROM usage_reservations WHERE task_ref=? ORDER BY created_at").all(p.json.campaign.id).map((r: any) => r.status)).toEqual(["settled", "released"]);
    raw.exec("DELETE FROM circuit_breakers");
    const r = await call("user_hank", "POST", `/discovery/campaigns/${p.json.campaign.id}/retry`, {});
    expect(r.status).toBe(200);
    expect(r.json.campaign.status).toBe("COMPLETED");
    expect(entRows(p.json.campaign.id)).toHaveLength(1);
    expect((await call("user_hank", "GET", "/discovery/entitlement")).json.used).toBe(1);
    expect((await call("user_hank", "POST", `/discovery/campaigns/${p.json.campaign.id}/retry`, {})).status).toBe(409); // not PARTIAL/FAILED any more
  });

  it("all channels rejected without a charge → FAILED and the entitlement is released (not consumed)", async () => {
    raw.exec("DELETE FROM circuit_breakers");
    tavilyQueue = ["401"];
    const p = await plan("user_ivan", "single", ["dsrc_kaskus"]);
    const s = await start("user_ivan", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(s.json.campaign.status).toBe("FAILED");
    expect(s.json.entitlement.state).toBe("released");
    expect((await call("user_ivan", "GET", "/discovery/entitlement")).json.used).toBe(0);
    expect(raw.prepare("SELECT status FROM discovery_envelopes WHERE campaign_id=?").all(p.json.campaign.id)).toEqual([{ status: "released" }]);
    // Credential denial auto-paused the account (gateway) — restore for later tests.
    raw.exec("UPDATE provider_accounts SET account_status='active' WHERE id='pacc_tavily00001'; DELETE FROM circuit_breakers;");
  });

  const blockedRoute: [string, string, string][] = [
    ["stale quota", "UPDATE quota_snapshots SET verified_at='2026-01-01T00:00:00.000Z'", "PROVIDER_QUOTA_STALE"],
    ["unknown pricing", "UPDATE provider_accounts SET unit_price_usd_micros=NULL", "PROVIDER_PRICE_UNKNOWN"],
    ["paid route without owner approval", "UPDATE provider_accounts SET unit_price_usd_micros=8000", "PROVIDER_PAID_APPROVAL_REQUIRED"],
    ["unavailable provider (policy disabled)", "UPDATE provider_policies SET enabled=0", "PROVIDER_POLICY_DISABLED"],
  ];
  for (const [name, sql, code] of blockedRoute) {
    it(`fail closed before dispatch: ${name}`, async () => {
      const snap = raw.prepare("SELECT verified_at FROM quota_snapshots WHERE id='qsn_t1'").get() as any;
      raw.exec(sql);
      try {
        const cat = await call("user_judy", "GET", "/discovery/catalog");
        expect(cat.json.items.find((s: any) => s.id === "dsrc_kaskus")).toMatchObject({ runnable: false, unavailableCode: code });
        const before = tavilyCalls().length;
        const p = await plan("user_judy", "single", ["dsrc_kaskus"]);
        expect(p.json.campaign).toMatchObject({ status: "FAILED", blockedCode: "NO_RUNNABLE_SOURCE" });
        expect(p.json.scope.unavailable[0].code).toBe(code);
        expect(tavilyCalls().length).toBe(before);
        expect(entRows(p.json.campaign.id)).toHaveLength(0);
      } finally {
        raw.prepare("UPDATE quota_snapshots SET verified_at=? WHERE id='qsn_t1'").run(snap.verified_at);
        raw.exec("UPDATE provider_accounts SET unit_price_usd_micros=0; UPDATE provider_policies SET enabled=1;");
      }
    });
  }

  it("program budget exhaustion limits scope instead of overspending", async () => {
    await budget({ perOrgMonthUnitsCap: 1, monthUnitsCap: 200 });
    const p = await plan("user_kim", "multi", ["dsrc_kaskus", "dsrc_quora"]);
    expect(p.json.scope.channels).toHaveLength(1);
    expect(p.json.scope.unavailable[0].code).toBe("PROGRAM_BUDGET_EXHAUSTED");
    const s = await start("user_kim", p.json.campaign.id, p.json.campaign.scopeHash);
    expect(s.json.campaign.status).toBe("COMPLETED");
    const p2 = await plan("user_kim", "single", ["dsrc_quora"]);
    expect(p2.json.campaign.status).toBe("FAILED");
    expect(p2.json.scope.unavailable[0].code).toBe("PROGRAM_BUDGET_EXHAUSTED");
    await budget(); // restore
  });

  it("conditional bonus campaign only when the owner funds it with headroom", async () => {
    await budget({ bonusEnabled: true });
    const st = await call("user_leo", "GET", "/discovery/entitlement");
    expect(st.json).toMatchObject({ bonusFunded: true, remaining: 2 });
    for (let i = 0; i < 2; i++) {
      const p = await plan("user_leo", "single", ["dsrc_kaskus"], brief({ topic: `Brief bonus nomor ${i} untuk riset kasir` }));
      const s = await start("user_leo", p.json.campaign.id, p.json.campaign.scopeHash);
      expect(s.json.entitlement.kind).toBe(i === 0 ? "guaranteed" : "bonus");
    }
    const p3 = await plan("user_leo", "single", ["dsrc_kaskus"], brief({ topic: "Brief ketiga yang harus ditolak" }));
    expect((await start("user_leo", p3.json.campaign.id, p3.json.campaign.scopeHash)).json.error.code).toBe("DISCOVERY_ALLOWANCE_EXHAUSTED");
    await budget();
  });

  it("concurrent starts cannot overspend the member entitlement", async () => {
    raw.exec("DELETE FROM discovery_entitlements WHERE org_id='org_alice0000000'");
    const a = await plan("user_alice", "single", ["dsrc_kaskus"], brief({ topic: "Kampanye paralel A untuk riset" }));
    const b = await plan("user_alice", "single", ["dsrc_quora"], brief({ topic: "Kampanye paralel B untuk riset" }));
    const [ra, rb] = await Promise.all([start("user_alice", a.json.campaign.id, a.json.campaign.scopeHash), start("user_alice", b.json.campaign.id, b.json.campaign.scopeHash)]);
    expect([ra.status, rb.status].sort()).toEqual([200, 402]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM discovery_entitlements WHERE org_id='org_alice0000000' AND state IN ('reserved','consumed')").get()).toMatchObject({ n: 1 });
  });
});

describe("tenant isolation, handoff and expansion", () => {
  it("cross-tenant access to campaigns, evidence and actions is denied", async () => {
    const own = (raw.prepare("SELECT id FROM discovery_campaigns WHERE org_id='org_carol0000000' AND status='COMPLETED' LIMIT 1").get() as any).id;
    for (const [m, path] of [["GET", `/discovery/campaigns/${own}`], ["GET", `/discovery/campaigns/${own}/evidence`], ["POST", `/discovery/campaigns/${own}/cancel`], ["POST", `/discovery/campaigns/${own}/retry`], ["POST", `/discovery/campaigns/${own}/expand`]] as const) {
      expect((await call("user_bob", m, path, m === "POST" ? { mode: "omni" } : undefined)).status, path).toBe(404);
    }
    const list = await call("user_bob", "GET", "/discovery/campaigns");
    expect(list.json.items.some((c: any) => c.id === own)).toBe(false);
  });
  it("opportunity-assessment handoff creates a demand hypothesis with linked campaign evidence", async () => {
    const own = (raw.prepare("SELECT id FROM discovery_campaigns WHERE org_id='org_carol0000000' AND status='COMPLETED' LIMIT 1").get() as any).id;
    const ev = await call("user_carol", "GET", `/discovery/campaigns/${own}/evidence`);
    const h = await call("user_carol", "POST", `/discovery/campaigns/${own}/handoff`, { title: "Kasir offline UMKM", problem: "UMKM membutuhkan kasir offline dan pembukuan sederhana.", signalIds: ev.json.items.map((x: any) => x.signal_id) });
    expect(h.status).toBe(201);
    const det = await call("user_carol", "GET", `/requests/${h.json.demandId}`);
    expect(det.json.demand.status).toBe("DEMAND_HYPOTHESIS_CREATED");
    expect(raw.prepare("SELECT COUNT(*) AS n FROM demand_evidence WHERE demand_id=?").get(h.json.demandId)).toMatchObject({ n: 2 });
    // Another tenant's signal cannot be smuggled into a handoff.
    const foreign = (raw.prepare("SELECT signal_id FROM discovery_campaign_evidence WHERE org_id='org_dave00000000' LIMIT 1").get() as any).signal_id;
    expect((await call("user_carol", "POST", `/discovery/campaigns/${own}/handoff`, { title: "Smuggle attempt", problem: "Trying to link another tenant's evidence item.", signalIds: [foreign] })).status).toBe(404);
  });
  it("expansion creates a NEW campaign on the same brief (subject to allowance)", async () => {
    const own = (raw.prepare("SELECT id FROM discovery_campaigns WHERE org_id='org_carol0000000' AND status='COMPLETED' LIMIT 1").get() as any).id;
    const x = await call("user_carol", "POST", `/discovery/campaigns/${own}/expand`, { mode: "multi", sourceIds: ["dsrc_kaskus", "dsrc_quora"] });
    expect(x.status).toBe(201);
    expect(x.json.campaign).toMatchObject({ parentCampaignId: own, status: "SCOPE_READY" });
    expect((await start("user_carol", x.json.campaign.id, x.json.campaign.scopeHash)).json.error.code).toBe("DISCOVERY_ALLOWANCE_EXHAUSTED");
  });
});
