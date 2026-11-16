import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { makeD1 } from "./d1shim";
import { governedCall, GatewayError, assertTicket, bindingAllowed, gatewayStatus, type DispatchTicket } from "../apps/api/src/providers/gateway";
import { tavilySearch } from "../apps/api/src/providers/tavily";
import { firecrawlScrape } from "../apps/api/src/providers/firecrawl";
import { runActor } from "../apps/api/src/providers/actors";
import { ProviderError } from "../apps/api/src/providers/types";
import { WorkersAiProvider } from "../apps/api/src/inference/workersai";
import { runInference, _resetBreaker } from "../apps/api/src/inference/service";

const SECRET = "FAKE_TEST_CREDENTIAL_VALUE_A1";
const env = { APP_ENV: "test", TAVILY_API_KEY: SECRET, TAVILY_API_KEY_2: "FAKE_TEST_CREDENTIAL_VALUE_B2" } as never;
const nowIso = () => new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

function setup(opts: { policy?: Partial<Record<string, unknown>> | null; account?: Partial<Record<string, unknown>>; snapshot?: Partial<Record<string, unknown>> | null } = {}) {
  const { d1, raw } = makeD1();
  raw.exec(`INSERT INTO users (id,clerk_user_id,email,status) VALUES ('usr_owner000001','user_o','owner@example.com','active')`);
  if (opts.policy !== null) {
    const p = { enabled: 1, allow_paid_usage: 0, daily_unit_cap: 100, monthly_unit_cap: 1000, daily_cost_usd_micros: 0, monthly_cost_usd_micros: 0, per_run_cost_usd_micros: 0, unit_type: "credits", fallback_mode: "stop", ...opts.policy };
    raw.prepare("INSERT INTO provider_policies (provider_id,enabled,allow_paid_usage,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,per_run_cost_usd_micros,unit_type,fallback_mode) VALUES ('tavily',?,?,?,?,?,?,?,?,?)")
      .run(p.enabled as number, p.allow_paid_usage as number, p.daily_unit_cap as number, p.monthly_unit_cap as number, p.daily_cost_usd_micros as number, p.monthly_cost_usd_micros as number, p.per_run_cost_usd_micros as number, p.unit_type as string, p.fallback_mode as string);
  }
  addAccount(raw, "pacc_primary000001", "TAVILY_API_KEY", 10, opts.account);
  if (opts.snapshot !== null) addSnapshot(raw, "pacc_primary000001", opts.snapshot);
  return { d1, raw };
}
function addAccount(raw: any, id: string, binding: string, priority: number, over: Partial<Record<string, unknown>> = {}) {
  const a = { ownership_status: "authorized", account_status: "active", capabilities_json: '["search"]', terms_reviewed_at: nowIso(), unit_type: "credits", unit_price_usd_micros: 0,
    per_request_unit_cap: 5, daily_unit_cap: 50, monthly_unit_cap: 500, daily_cost_usd_micros: 0, monthly_cost_usd_micros: 0, concurrency_limit: 5, multi_account_terms_ok: 0, data_region: "global", ...over };
  raw.prepare(`INSERT INTO provider_accounts (id,provider_id,label,secret_binding,ownership_status,account_status,capabilities_json,terms_reviewed_at,unit_type,unit_price_usd_micros,per_request_unit_cap,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,concurrency_limit,multi_account_terms_ok,data_region,priority)
    VALUES (?,'tavily',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, `acct-${id}`, binding, a.ownership_status as string, a.account_status as string, a.capabilities_json as string, a.terms_reviewed_at as string | null, a.unit_type as string,
    a.unit_price_usd_micros as number | null, a.per_request_unit_cap as number, a.daily_unit_cap as number, a.monthly_unit_cap as number, a.daily_cost_usd_micros as number, a.monthly_cost_usd_micros as number, a.concurrency_limit as number, a.multi_account_terms_ok as number, a.data_region as string, priority);
}
function addSnapshot(raw: any, accountId: string, over: Partial<Record<string, unknown>> = {}) {
  const s = { allowance_units: 1000, used_units_reported: 0, window_kind: "month", source: "provider_api", verified_at: hoursAgo(1), reset_at: inDays(20), ...over };
  raw.prepare("INSERT INTO quota_snapshots (id,account_id,unit_type,allowance_units,used_units_reported,window_kind,reset_at,source,verified_at) VALUES (?,?,'credits',?,?,?,?,?,?)")
    .run(`qsn_${Math.random().toString(36).slice(2, 14)}`, accountId, s.allowance_units as number, s.used_units_reported as number, s.window_kind as string, s.reset_at as string | null, s.source as string, s.verified_at as string);
}
let seq = 0;
const req = (units = 1, extra: Record<string, unknown> = {}) => ({ providerId: "tavily", capability: "search", purpose: "test", unitType: "credits", estimatedUnits: units, idempotencyKey: `test:${Date.now()}:${seq++}`, orgId: "org_x", userId: "usr_owner000001", ...extra });
const okDispatch = (units = 1) => vi.fn(async (_t: DispatchTicket) => ({ value: "ok", unitsActual: units, providerRequestId: "prov_req_1" }));
const res = (raw: any) => raw.prepare("SELECT * FROM usage_reservations ORDER BY created_at").all() as any[];

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchSpy = vi.fn(async () => new Response(JSON.stringify({ results: [], usage: { credits: 1 }, request_id: "r1" }), { status: 200 })); vi.stubGlobal("fetch", fetchSpy); _resetBreaker(); });
afterEach(() => vi.unstubAllGlobals());

describe("gateway: blocked BEFORE any network dispatch (fail closed)", () => {
  const cases: [string, Parameters<typeof setup>[0], string][] = [
    ["no policy", { policy: null }, "POLICY_MISSING"],
    ["policy disabled", { policy: { enabled: 0 } }, "POLICY_DISABLED"],
    ["unauthorized account", { account: { ownership_status: "pending" } }, "NO_ELIGIBLE_ACCOUNT"],
    ["paused account", { account: { account_status: "paused" } }, "NO_ELIGIBLE_ACCOUNT"],
    ["capability not approved", { account: { capabilities_json: '["scrape"]' } }, "NO_ELIGIBLE_ACCOUNT"],
    ["terms not reviewed", { account: { terms_reviewed_at: null } }, "TERMS_NOT_REVIEWED"],
    ["unknown price", { account: { unit_price_usd_micros: null } }, "PRICE_UNKNOWN"],
    ["zero caps", { account: { daily_unit_cap: 0 } }, "CAP_NOT_CONFIGURED"],
    ["no quota snapshot", { snapshot: null }, "QUOTA_UNKNOWN"],
    ["estimated quota", { snapshot: { source: "estimated" } }, "QUOTA_UNKNOWN"],
    ["stale quota", { snapshot: { verified_at: hoursAgo(100) } }, "QUOTA_STALE"],
    ["quota window reset since snapshot", { snapshot: { reset_at: hoursAgo(1) } }, "QUOTA_STALE"],
    ["quota exhausted", { snapshot: { allowance_units: 10, used_units_reported: 10 } }, "QUOTA_EXHAUSTED"],
    ["paid without approval", { account: { unit_price_usd_micros: 500 } }, "PAID_APPROVAL_REQUIRED"],
  ];
  for (const [name, opts, code] of cases) {
    it(name, async () => {
      const { d1, raw } = setup(opts);
      const dispatch = okDispatch();
      await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code });
      expect(dispatch).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res(raw)).toHaveLength(0);
      expect(raw.prepare("SELECT status,error_code FROM provider_usage").get()).toMatchObject({ status: "denied", error_code: code });
    });
  }
  it("missing credential", async () => {
    const { d1 } = setup();
    const dispatch = okDispatch();
    await expect(governedCall({ APP_ENV: "test" } as never, d1, req(), dispatch)).rejects.toMatchObject({ code: "CREDENTIAL_MISSING" });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("credential reference cannot point at a foreign secret", async () => {
    expect(bindingAllowed("tavily", "CLERK_SECRET_KEY")).toBe(false);
    expect(bindingAllowed("tavily", "TAVILY_API_KEY_2")).toBe(true);
    expect(bindingAllowed("workers-ai", "AI")).toBe(true);
    const { d1, raw } = setup();
    raw.exec("UPDATE provider_accounts SET secret_binding='CLERK_SECRET_KEY'");
    await expect(governedCall({ ...(env as object), CLERK_SECRET_KEY: "sk_live_x" } as never, d1, req(), okDispatch())).rejects.toMatchObject({ code: "CREDENTIAL_BINDING_INVALID" });
  });
  it("per-request cap", async () => {
    const { d1 } = setup();
    await expect(governedCall(env, d1, req(6), okDispatch())).rejects.toMatchObject({ code: "PER_REQUEST_CAP" });
  });
  it("daily account cap enforced across calls", async () => {
    const { d1 } = setup({ account: { daily_unit_cap: 3 } });
    for (let i = 0; i < 3; i++) await governedCall(env, d1, req(1), okDispatch());
    await expect(governedCall(env, d1, req(1), okDispatch())).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });
  it("provider-level policy cap enforced", async () => {
    const { d1 } = setup({ policy: { daily_unit_cap: 2 } });
    await governedCall(env, d1, req(1), okDispatch()); await governedCall(env, d1, req(1), okDispatch());
    await expect(governedCall(env, d1, req(1), okDispatch())).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });
  it("idempotency key is never re-sent", async () => {
    const { d1 } = setup();
    const r = req();
    await governedCall(env, d1, r, okDispatch());
    const again = okDispatch();
    await expect(governedCall(env, d1, r, again)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(again).not.toHaveBeenCalled();
  });
});

describe("gateway: atomic reservation + reconciliation", () => {
  it("concurrent requests cannot overspend the last allowance", async () => {
    const { d1, raw } = setup({ account: { daily_unit_cap: 3, concurrency_limit: 50 } });
    const dispatch = vi.fn(async () => { await new Promise((r) => setTimeout(r, 5)); return { value: "ok", unitsActual: 1 }; });
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => governedCall(env, d1, req(1), dispatch)));
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(3);
    expect(dispatch).toHaveBeenCalledTimes(3);
    for (const r of results) if (r.status === "rejected") expect(["RESERVATION_RACE_LOST", "BUDGET_EXCEEDED"]).toContain((r.reason as GatewayError).code);
    expect(raw.prepare("SELECT SUM(units_actual) AS u FROM usage_reservations WHERE status='settled'").get().u).toBe(3);
  });
  it("concurrency limit holds in-flight calls", async () => {
    const { d1 } = setup({ account: { concurrency_limit: 2 } });
    let release!: () => void; const gate = new Promise<void>((r) => (release = r));
    const slow = vi.fn(async () => { await gate; return { value: "ok", unitsActual: 1 }; });
    const a = governedCall(env, d1, req(), slow), b = governedCall(env, d1, req(), slow);
    await new Promise((r) => setTimeout(r, 10));
    await expect(governedCall(env, d1, req(), okDispatch())).rejects.toMatchObject({ code: "CONCURRENCY_LIMIT" });
    release(); await Promise.all([a, b]);
  });
  it("settles actual usage, releases unused reservation and flags overruns", async () => {
    const { d1, raw } = setup();
    const out = await governedCall(env, d1, req(2), okDispatch(1));
    expect(out.unitsActual).toBe(1);
    expect(res(raw)[0]).toMatchObject({ status: "settled", units_reserved: 2, units_actual: 1, exception: null, provider_request_id: "prov_req_1" });
    await governedCall(env, d1, req(1), okDispatch(3));
    expect(res(raw)[1]).toMatchObject({ status: "settled", exception: "actual_exceeds_reservation" });
    // Settled actuals (1 + 3) count against caps, not the original reservations.
    expect(raw.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='provider.call.settled'").get().n).toBe(2);
  });
  it("invalid request releases the reservation, no retry", async () => {
    const { d1, raw } = setup();
    const dispatch = vi.fn(async () => { throw new ProviderError("INVALID_REQUEST", "bad", 400); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res(raw)[0].status).toBe("released");
  });
  it("timeout = unknown_charge: reservation retained and still counts against caps", async () => {
    const { d1, raw } = setup({ account: { daily_unit_cap: 1 } });
    await expect(governedCall(env, d1, req(1), vi.fn(async () => { throw new ProviderError("TIMEOUT", "t", 504); }))).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(res(raw)[0].status).toBe("unknown_charge");
    await expect(governedCall(env, d1, req(1), okDispatch())).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });
});

describe("gateway: no account rotation; outage-only compliant fallback", () => {
  function twoAccounts(fallbackRule: boolean, termsOk = 1) {
    const s = setup({ policy: { fallback_mode: "approved_account_pool" }, account: { multi_account_terms_ok: termsOk } });
    addAccount(s.raw, "pacc_second000001", "TAVILY_API_KEY_2", 20, { multi_account_terms_ok: termsOk });
    addSnapshot(s.raw, "pacc_second000001");
    if (fallbackRule) s.raw.prepare("INSERT INTO fallback_rules (id,capability,primary_account_id,fallback_account_id,reason,approved_by,expires_at) VALUES ('fbr_rule00000001','search','pacc_primary000001','pacc_second000001','test outage fallback','usr_owner000001',?)").run(inDays(10));
    return s;
  }
  const usedAccounts = (dispatch: ReturnType<typeof vi.fn>) => dispatch.mock.calls.map((c) => (c[0] as DispatchTicket).accountId);

  it("429 opens the breaker honoring Retry-After and never rotates", async () => {
    const { d1, raw } = twoAccounts(true);
    const dispatch = vi.fn(async () => { throw new ProviderError("RATE_LIMITED", "429", 429, 120); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(usedAccounts(dispatch)).toEqual(["pacc_primary000001"]);
    const br = raw.prepare("SELECT * FROM circuit_breakers WHERE account_id='pacc_primary000001'").get();
    expect(br.error_class).toBe("rate_limited");
    expect(Date.parse(br.open_until) - Date.now()).toBeGreaterThan(100_000);
    // Next call is blocked on the primary; it does NOT silently move to the second account.
    const next = okDispatch();
    await expect(governedCall(env, d1, req(), next)).rejects.toMatchObject({ code: "CIRCUIT_OPEN" });
    expect(next).not.toHaveBeenCalled();
  });
  it("credential denial (ban/suspension) auto-pauses the account and never rotates", async () => {
    const { d1, raw } = twoAccounts(true);
    const dispatch = vi.fn(async () => { throw new ProviderError("NOT_CONFIGURED", "403", 502); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(usedAccounts(dispatch)).toEqual(["pacc_primary000001"]);
    expect(raw.prepare("SELECT account_status FROM provider_accounts WHERE id='pacc_primary000001'").get().account_status).toBe("paused");
    expect(raw.prepare("SELECT error_class FROM circuit_breakers WHERE account_id='pacc_primary000001'").get().error_class).toBe("auth_denied");
    // The auto-paused primary stays primary: the next call is blocked instead of moving to the second account.
    const next = okDispatch();
    await expect(governedCall(env, d1, req(), next)).rejects.toMatchObject({ code: "NO_ELIGIBLE_ACCOUNT" });
    raw.exec("DELETE FROM circuit_breakers");
    await expect(governedCall(env, d1, req(), next)).rejects.toMatchObject({ code: "NO_ELIGIBLE_ACCOUNT" });
    expect(next).not.toHaveBeenCalled();
    // Only an explicit owner action (disable the banned account) changes which account is selected.
    raw.exec("UPDATE provider_accounts SET account_status='disabled' WHERE id='pacc_primary000001'");
    expect((await governedCall(env, d1, req(), next)).accountId).toBe("pacc_second000001");
  });
  it("provider quota exhaustion marks the account exhausted and never rotates", async () => {
    const { d1, raw } = twoAccounts(true);
    const dispatch = vi.fn(async () => { throw new ProviderError("QUOTA_EXHAUSTED", "402", 503); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });
    expect(usedAccounts(dispatch)).toEqual(["pacc_primary000001"]);
    expect(raw.prepare("SELECT account_status FROM provider_accounts WHERE id='pacc_primary000001'").get().account_status).toBe("exhausted");
  });
  it("outage WITHOUT an approved rule stops", async () => {
    const { d1 } = twoAccounts(false);
    const dispatch = vi.fn(async () => { throw new ProviderError("UPSTREAM_ERROR", "503", 502); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    expect(usedAccounts(dispatch)).toEqual(["pacc_primary000001"]);
  });
  it("outage WITH a rule but without multi-account terms confirmation stops", async () => {
    const { d1 } = twoAccounts(true, 0);
    const dispatch = vi.fn(async () => { throw new ProviderError("UPSTREAM_ERROR", "503", 502); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toThrow();
    expect(usedAccounts(dispatch)).toEqual(["pacc_primary000001"]);
  });
  it("outage WITH approved rule falls back exactly once, idempotently and audited", async () => {
    const { d1, raw } = twoAccounts(true);
    const dispatch = vi.fn(async (t: DispatchTicket) => { if (t.accountId === "pacc_primary000001") throw new ProviderError("UPSTREAM_ERROR", "503", 502); return { value: "ok", unitsActual: 1 }; });
    const out = await governedCall(env, d1, req(), dispatch);
    expect(out.fallbackUsed).toBe(true);
    expect(out.accountId).toBe("pacc_second000001");
    expect(usedAccounts(dispatch)).toEqual(["pacc_primary000001", "pacc_second000001"]);
    const rows = res(raw);
    expect(rows.map((r) => r.status)).toEqual(["released", "settled"]);
    expect(rows[1].fallback_of).toBe(rows[0].id);
    expect(rows[1].idempotency_key).toBe(`${rows[0].idempotency_key}:fb`);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='provider.fallback.attempt'").get().n).toBe(1);
  });
  it("fallback never chains: second outage stops", async () => {
    const { d1 } = twoAccounts(true);
    const dispatch = vi.fn(async () => { throw new ProviderError("UPSTREAM_ERROR", "503", 502); });
    await expect(governedCall(env, d1, req(), dispatch)).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
  it("schema makes rate-limit/ban fallback rules unrepresentable", () => {
    const { raw } = twoAccounts(false);
    expect(() => raw.prepare("INSERT INTO fallback_rules (id,capability,primary_account_id,fallback_account_id,trigger_kind,reason,approved_by,expires_at) VALUES ('fbr_x0000000001','search','pacc_primary000001','pacc_second000001','rate_limited','x','usr_owner000001',?)").run(inDays(1))).toThrow();
  });
});

describe("gateway: paid usage requires scoped, unexpired owner approval with spend cap", () => {
  function paid(approval: "none" | "active" | "expired", maxSpend = 1000) {
    const s = setup({ policy: { allow_paid_usage: 1, per_run_cost_usd_micros: 1000, daily_cost_usd_micros: 10_000, monthly_cost_usd_micros: 100_000 }, account: { unit_price_usd_micros: 400, daily_cost_usd_micros: 10_000, monthly_cost_usd_micros: 100_000 } });
    if (approval !== "none") s.raw.prepare("INSERT INTO provider_approvals (id,provider_id,account_id,capability,kind,max_spend_usd_micros,starts_at,expires_at,reason,approved_by) VALUES ('papr_000000000001','tavily','pacc_primary000001','search','paid_usage',?,?,?,'pilot','usr_owner000001')")
      .run(maxSpend, hoursAgo(1), approval === "active" ? inDays(5) : hoursAgo(0.5));
    return s;
  }
  it("blocked without approval", async () => { const { d1 } = paid("none"); await expect(governedCall(env, d1, req(1), okDispatch())).rejects.toMatchObject({ code: "PAID_APPROVAL_REQUIRED" }); });
  it("blocked with expired approval", async () => { const { d1 } = paid("expired"); await expect(governedCall(env, d1, req(1), okDispatch())).rejects.toMatchObject({ code: "PAID_APPROVAL_REQUIRED" }); });
  it("allowed within approved spend, blocked beyond it", async () => {
    const { d1 } = paid("active", 1000);
    const out = await governedCall(env, d1, req(1), okDispatch(1));
    expect(out.costActualUsdMicros).toBe(400);
    await governedCall(env, d1, req(1), okDispatch(1));
    await expect(governedCall(env, d1, req(1), okDispatch(1))).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });
});

describe("no bypass: adapters refuse to run without a gateway-minted ticket", () => {
  const forged = { reservationId: "x", providerId: "tavily", accountId: "x", credential: SECRET, binding: undefined } as DispatchTicket;
  it("tavily/firecrawl/actors/workers-ai reject forged or missing tickets before fetch", async () => {
    await expect(tavilySearch(forged, "q", { maxResults: 1, depth: "basic" })).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    await expect(firecrawlScrape(undefined as never, "https://example.com")).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    await expect(runActor({ ...forged, providerId: "apify" } as DispatchTicket, "apify", "a~b", {}, { maxItems: 1, maxChargeUsd: 0.01, idempotencyKey: "k" })).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    const ai = { run: vi.fn() };
    await expect(new WorkersAiProvider(ai as never).run({ profile: "classification", modelId: "m", messages: [], maxOutputTokens: 1, temperature: 0, jsonMode: false })).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    expect(ai.run).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("a ticket is single-use and provider-bound", async () => {
    const { d1 } = setup();
    let leaked: DispatchTicket | undefined;
    await governedCall(env, d1, req(), async (t) => { leaked = t; expect(() => assertTicket(t, "firecrawl")).toThrow(); return { value: 1, unitsActual: 1 }; });
    expect(() => assertTicket(leaked, "tavily")).toThrow();
  });
  it("real adapter path through the gateway calls fetch exactly once with the server-side credential", async () => {
    const { d1 } = setup();
    const out = await governedCall(env, d1, req(1), async (t) => { const r = await tavilySearch(t, "kebutuhan aplikasi kasir", { maxResults: 1, depth: "basic" }); return { value: r, unitsActual: r.creditsUsed }; });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({ authorization: `Bearer ${SECRET}` });
    expect(out.unitsActual).toBe(1);
  });
  it("real inference through the gateway is blocked without policy (no env.AI call)", async () => {
    const { d1 } = makeD1();
    const ai = { run: vi.fn() };
    await expect(runInference({ APP_ENV: "test", AI: ai } as never, d1, "classification", [{ role: "user", content: "x" }], { promptVersion: "t1" })).rejects.toMatchObject({ code: "PROVIDER_DISABLED" });
    expect(ai.run).not.toHaveBeenCalled();
  });
  it("static scan: provider adapters are only invoked inside governedCall dispatchers", () => {
    const root = path.resolve(__dirname, "../apps/api/src");
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && files.push(p); } };
    walk(root);
    const adapterFiles = ["providers/tavily.ts", "providers/firecrawl.ts", "providers/actors.ts", "providers/net.ts", "inference/groq.ts", "inference/workersai.ts"].map((f) => path.join(root, f));
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!adapterFiles.includes(f)) {
        expect(src, f).not.toMatch(/api\.tavily\.com|api\.firecrawl\.dev|api\.apify\.com|api\.scrape\.ly|api\.groq\.com/);
        expect(src, f).not.toMatch(/env\.AI\??\.run|\.AI\.run\(/);
      }
      for (const fn of ["tavilySearch(", "firecrawlScrape(", "runActor("]) {
        let i = src.indexOf(fn);
        while (i >= 0) {
          const before = src.slice(Math.max(0, i - 600), i);
          const isDecl = /export async function\s*$/.test(src.slice(Math.max(0, i - 30), i));
          if (!isDecl) expect(before, `${f}: ${fn} outside governedCall`).toMatch(/governedCall\(/);
          i = src.indexOf(fn, i + 1);
        }
      }
    }
    for (const f of adapterFiles.filter((f) => !f.endsWith("net.ts"))) expect(readFileSync(f, "utf8"), f).toMatch(/assertTicket\(/);
  });
});

describe("secret redaction", () => {
  it("gateway status, audit and usage rows never contain secret values", async () => {
    const { d1, raw } = setup();
    await governedCall(env, d1, req(), okDispatch());
    await expect(governedCall(env, d1, req(), vi.fn(async () => { throw new ProviderError("UPSTREAM_ERROR", "x", 502); }))).rejects.toThrow();
    const status = await gatewayStatus(env, d1);
    const dump = JSON.stringify([status, raw.prepare("SELECT * FROM audit_events").all(), raw.prepare("SELECT * FROM provider_usage").all(), raw.prepare("SELECT * FROM usage_reservations").all()]);
    expect(dump).not.toContain(SECRET);
    expect(status[0]).toMatchObject({ credentialPresent: true, eligible: true });
  });
});

describe("production safety: migration 0008 not applied", () => {
  it("blocks every call (no dispatch) when the runtime schema is missing", async () => {
    const legacy = { prepare: (sql: string) => ({ bind: () => legacy.prepare(sql), first: async () => { if (/usage_reservations|capabilities_json/.test(sql)) throw new Error("no such table"); return null; }, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }), batch: async () => [] };
    const dispatch = okDispatch();
    await expect(governedCall(env, legacy as never, req(), dispatch)).rejects.toMatchObject({ code: "SCHEMA_NOT_MIGRATED", status: 503 });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
