/**
 * DAYANEXA Provider Runtime Gateway — the ONLY path for outbound metered provider calls.
 *
 * resolve policy → select the primary account → eligibility (terms, credential, breaker, region,
 * caps, price, paid approval, fresh quota) → ATOMIC reservation (single INSERT…SELECT…WHERE) →
 * dispatch with a single-use ticket → settle / release / unknown_charge → breaker + audit.
 *
 * Adapters refuse to run without a ticket that only this module can mint (assertTicket), and
 * they read the credential from the ticket, so routes never touch secrets and cannot bypass this.
 * Fallback: only on upstream outage, only through an active owner-approved rule, at most once.
 * 429, auth denial (ban/suspension), quota exhaustion and invalid requests NEVER rotate accounts.
 */
import type { Env } from "../env";
import { newId, nowIso, thisMonth, today } from "../lib/ids";
import { auditStatement } from "../services/audit";
import { ProviderError } from "./types";

export type GatewayErrorCode =
  | "SCHEMA_NOT_MIGRATED" | "POLICY_MISSING" | "POLICY_DISABLED" | "POLICY_UNIT_MISMATCH" | "NO_ELIGIBLE_ACCOUNT" | "TERMS_NOT_REVIEWED"
  | "CREDENTIAL_MISSING" | "CREDENTIAL_BINDING_INVALID" | "CIRCUIT_OPEN" | "CAP_NOT_CONFIGURED" | "UNIT_MISMATCH"
  | "PRICE_UNKNOWN" | "PAID_APPROVAL_REQUIRED" | "QUOTA_UNKNOWN" | "QUOTA_STALE" | "QUOTA_EXHAUSTED"
  | "BUDGET_EXCEEDED" | "CONCURRENCY_LIMIT" | "PER_REQUEST_CAP" | "REGION_INCOMPATIBLE" | "IDEMPOTENCY_CONFLICT"
  | "RESERVATION_RACE_LOST";

const STATUS: Record<GatewayErrorCode, number> = {
  SCHEMA_NOT_MIGRATED: 503, POLICY_MISSING: 423, POLICY_DISABLED: 423, POLICY_UNIT_MISMATCH: 423, NO_ELIGIBLE_ACCOUNT: 423, TERMS_NOT_REVIEWED: 423,
  CREDENTIAL_MISSING: 503, CREDENTIAL_BINDING_INVALID: 423, CIRCUIT_OPEN: 429, CAP_NOT_CONFIGURED: 423, UNIT_MISMATCH: 423,
  PRICE_UNKNOWN: 423, PAID_APPROVAL_REQUIRED: 403, QUOTA_UNKNOWN: 423, QUOTA_STALE: 423, QUOTA_EXHAUSTED: 429,
  BUDGET_EXCEEDED: 429, CONCURRENCY_LIMIT: 429, PER_REQUEST_CAP: 422, REGION_INCOMPATIBLE: 423, IDEMPOTENCY_CONFLICT: 409,
  RESERVATION_RACE_LOST: 409,
};
export class GatewayError extends Error {
  status: number;
  constructor(public code: GatewayErrorCode, message?: string, public retryAfterSeconds?: number) { super(message ?? code); this.status = STATUS[code]; }
}

// ---------- Tickets (unforgeable, single use) ----------
export interface DispatchTicket {
  readonly reservationId: string; readonly providerId: string; readonly accountId: string;
  readonly credential: string | undefined; readonly binding: unknown;
}
const issued = new WeakSet<object>();
/** Adapters call this first. Throws (before any network I/O) if the call did not come through the gateway. */
export function assertTicket(ticket: DispatchTicket | undefined, providerId: string): DispatchTicket {
  if (!ticket || typeof ticket !== "object" || !issued.has(ticket) || ticket.providerId !== providerId)
    throw new ProviderError("GATEWAY_REQUIRED", `${providerId} must be called through the Provider Runtime Gateway`, 500);
  return ticket;
}

// ---------- Types ----------
export interface GatewayRequest {
  providerId: string; capability: string; purpose: string;
  unitType: string; estimatedUnits: number;
  idempotencyKey: string;
  orgId?: string | null; userId?: string | null; missionId?: string | null; taskRef?: string | null;
  dataRegion?: string | null;
  /** Optional caller-side hard caps (never raise server caps, only lower them). */
  maxCostUsdMicros?: number; missionBudgetUsdMicros?: number;
  /** For cost-denominated providers (Apify) the reserved cost is explicit. */
  reserveCostUsdMicros?: number;
  requestId?: string;
}
export interface DispatchResult<T> { value: T; unitsActual: number; costActualUsdMicros?: number; providerRequestId?: string | null; usageEstimated?: boolean }
export interface GatewayOutcome<T> extends DispatchResult<T> { reservationId: string; accountId: string; accountLabel: string; fallbackUsed: boolean; costActualUsdMicros: number }

type Row = Record<string, any>;
const ACTIVE = "('reserved','settled','unknown_charge')";
const UNITS = "COALESCE(SUM(CASE WHEN status='settled' THEN COALESCE(units_actual,0) ELSE units_reserved END),0)";
const COST = "COALESCE(SUM(CASE WHEN status='settled' THEN COALESCE(cost_actual_usd_micros,0) ELSE cost_reserved_usd_micros END),0)";

export const BINDING_PREFIX: Record<string, string> = {
  "workers-ai": "AI", groq: "GROQ_API_KEY", tavily: "TAVILY_API_KEY", firecrawl: "FIRECRAWL_API_KEY", apify: "APIFY_API_TOKEN", scrapely: "SCRAPELY_API_KEY",
};
/** Only these binding names can ever be read; a Tavily account cannot point at, e.g., CLERK_SECRET_KEY. */
export function bindingAllowed(providerId: string, binding: string): boolean {
  const prefix = BINDING_PREFIX[providerId];
  if (!prefix) return false;
  return prefix === "AI" ? binding === "AI" : new RegExp(`^${prefix}(_[23])?$`).test(binding);
}
function resolveCredential(env: Env, account: Row): { credential: string | undefined; binding: unknown } {
  if (!bindingAllowed(account.provider_id, account.secret_binding)) throw new GatewayError("CREDENTIAL_BINDING_INVALID", "Account credential reference is not an allowed binding for this provider.");
  const value = (env as unknown as Record<string, unknown>)[account.secret_binding];
  if (!value) throw new GatewayError("CREDENTIAL_MISSING", "Provider credential is not configured.");
  return account.secret_binding === "AI" ? { credential: undefined, binding: value } : { credential: String(value), binding: undefined };
}

const hasCapability = (account: Row, capability: string) => {
  try { const caps = JSON.parse(account.capabilities_json ?? "[]"); return Array.isArray(caps) && caps.includes(capability); } catch { return false; }
};

async function sumUnits(d: D1Database, where: string, ...params: unknown[]) {
  const r = await d.prepare(`SELECT ${UNITS} AS u, ${COST} AS c FROM usage_reservations WHERE status IN ${ACTIVE} AND ${where}`).bind(...params).first<{ u: number; c: number }>();
  return { units: Number(r?.u ?? 0), cost: Number(r?.c ?? 0) };
}

export async function latestSnapshot(d: D1Database, accountId: string, unitType: string): Promise<Row | null> {
  return (await d.prepare("SELECT * FROM quota_snapshots WHERE account_id=? AND unit_type=? ORDER BY verified_at DESC, created_at DESC LIMIT 1").bind(accountId, unitType).first<Row>()) ?? null;
}
function windowFilter(snapshot: Row): { sql: string; params: unknown[] } {
  if (snapshot.window_kind === "day") return { sql: "day=?", params: [today()] };
  if (snapshot.window_kind === "month") return { sql: "month=?", params: [thisMonth()] };
  return { sql: "1=1", params: [] };
}

export interface Evaluation {
  ok: boolean; code?: GatewayErrorCode; message?: string; retryAfterSeconds?: number;
  costUsdMicros: number; quotaRemaining: number | null; snapshot: Row | null;
  usage: { accountDayUnits: number; accountMonthUnits: number; providerDayUnits: number; providerMonthUnits: number; inFlight: number };
  approval: Row | null;
}

/** Non-mutating eligibility evaluation. Used for the pre-check and for the Admin Control Center status view. */
export async function evaluateAccount(env: Env, d: D1Database, policy: Row | null, account: Row, req: Pick<GatewayRequest, "providerId" | "capability" | "unitType" | "estimatedUnits" | "dataRegion" | "maxCostUsdMicros" | "missionId" | "missionBudgetUsdMicros" | "reserveCostUsdMicros">): Promise<Evaluation> {
  const now = Date.now();
  const empty = { accountDayUnits: 0, accountMonthUnits: 0, providerDayUnits: 0, providerMonthUnits: 0, inFlight: 0 };
  const deny = (code: GatewayErrorCode, message: string, extra: Partial<Evaluation> = {}): Evaluation =>
    ({ ok: false, code, message, costUsdMicros: 0, quotaRemaining: null, snapshot: null, usage: empty, approval: null, ...extra });

  if (!policy) return deny("POLICY_MISSING", `No provider policy for ${req.providerId}; provider is disabled until the owner configures it.`);
  if (!policy.enabled) return deny("POLICY_DISABLED", `Provider ${req.providerId} is disabled by policy.`);
  if (policy.unit_type !== req.unitType) return deny("POLICY_UNIT_MISMATCH", `Policy unit '${policy.unit_type}' does not match metered unit '${req.unitType}'.`);
  if (!(policy.daily_unit_cap > 0) || !(policy.monthly_unit_cap > 0)) return deny("CAP_NOT_CONFIGURED", "Provider daily/monthly unit caps are not configured (0 = blocked).");
  if (account.provider_id !== req.providerId) return deny("NO_ELIGIBLE_ACCOUNT", "Account belongs to another provider.");
  if (account.ownership_status !== "authorized") return deny("NO_ELIGIBLE_ACCOUNT", "Account is not independently authorized.");
  if (account.account_status !== "active") return deny("NO_ELIGIBLE_ACCOUNT", `Account status is ${account.account_status}.`);
  if (!hasCapability(account, req.capability)) return deny("NO_ELIGIBLE_ACCOUNT", `Account is not approved for capability '${req.capability}'.`);
  if (!account.terms_reviewed_at) return deny("TERMS_NOT_REVIEWED", "Provider terms have not been reviewed for this account.");
  try { resolveCredential(env, account); } catch (e) { return deny((e as GatewayError).code, (e as GatewayError).message); }
  const br = await d.prepare("SELECT * FROM circuit_breakers WHERE account_id=?").bind(account.id).first<Row>();
  if (br?.open_until && Date.parse(br.open_until) > now)
    return deny("CIRCUIT_OPEN", `Circuit open (${br.error_class ?? "error"}) until ${br.open_until}.`, { retryAfterSeconds: Math.ceil((Date.parse(br.open_until) - now) / 1000) });
  if (req.dataRegion && account.data_region !== "global" && account.data_region !== req.dataRegion) return deny("REGION_INCOMPATIBLE", "Account data region is incompatible with this task.");
  if (account.unit_type !== req.unitType) return deny("UNIT_MISMATCH", `Account unit '${account.unit_type}' does not match '${req.unitType}'.`);
  if (!(account.per_request_unit_cap > 0) || !(account.daily_unit_cap > 0) || !(account.monthly_unit_cap > 0)) return deny("CAP_NOT_CONFIGURED", "Account per-request/daily/monthly unit caps must all be > 0.");
  if (!(req.estimatedUnits > 0)) return deny("PER_REQUEST_CAP", "Estimated units must be positive.");
  if (req.estimatedUnits > account.per_request_unit_cap) return deny("PER_REQUEST_CAP", `Request needs ${req.estimatedUnits} ${req.unitType}; per-request cap is ${account.per_request_unit_cap}.`);
  if (account.unit_price_usd_micros === null || account.unit_price_usd_micros === undefined) return deny("PRICE_UNKNOWN", "Unit price is unknown; fail closed.");
  const cost = req.reserveCostUsdMicros ?? Math.ceil(req.estimatedUnits * Number(account.unit_price_usd_micros));
  if (req.maxCostUsdMicros !== undefined && cost > req.maxCostUsdMicros) return deny("BUDGET_EXCEEDED", "Reservation exceeds the task cost cap.");

  let approval: Row | null = null;
  if (cost > 0) {
    if (!policy.allow_paid_usage) return deny("PAID_APPROVAL_REQUIRED", "Paid usage is disabled by provider policy.", { costUsdMicros: cost });
    if (policy.per_run_cost_usd_micros > 0 && cost > policy.per_run_cost_usd_micros) return deny("BUDGET_EXCEEDED", "Reservation exceeds per-run cost cap.", { costUsdMicros: cost });
    if (!(policy.per_run_cost_usd_micros > 0)) return deny("CAP_NOT_CONFIGURED", "Per-run cost cap must be set for paid usage.", { costUsdMicros: cost });
    approval = await d.prepare(`SELECT * FROM provider_approvals WHERE account_id=? AND capability=? AND kind='paid_usage' AND status='active' AND starts_at<=? AND expires_at>? ORDER BY expires_at DESC LIMIT 1`)
      .bind(account.id, req.capability, nowIso(), nowIso()).first<Row>() ?? null;
    if (!approval) return deny("PAID_APPROVAL_REQUIRED", "No active, unexpired owner approval for paid usage on this account/capability.", { costUsdMicros: cost });
    const spent = await sumUnits(d, "account_id=? AND capability=? AND created_at>=?", account.id, req.capability, approval.starts_at);
    if (spent.cost + cost > approval.max_spend_usd_micros) return deny("BUDGET_EXCEEDED", "Approved paid-spend cap reached.", { costUsdMicros: cost, approval });
  }

  const snapshot = await latestSnapshot(d, account.id, req.unitType);
  if (!snapshot || snapshot.source === "unknown" || snapshot.source === "estimated") return deny("QUOTA_UNKNOWN", "No verified quota snapshot (provider API, dashboard or official source) for this account; fail closed.");
  const ageHours = (now - Date.parse(snapshot.verified_at)) / 3_600_000;
  if (!(ageHours <= account.quota_max_age_hours)) return deny("QUOTA_STALE", `Quota snapshot is ${ageHours.toFixed(1)}h old (max ${account.quota_max_age_hours}h). Refresh before use.`, { snapshot });
  if (snapshot.reset_at && Date.parse(snapshot.reset_at) <= now) return deny("QUOTA_STALE", "Quota window has reset since the snapshot; verify the new allowance.", { snapshot });
  const win = windowFilter(snapshot);
  const sinceSnap = await sumUnits(d, `account_id=? AND unit_type=? AND created_at>=? AND ${win.sql}`, account.id, req.unitType, snapshot.verified_at, ...win.params);
  const quotaRemaining = Number(snapshot.allowance_units) - Number(snapshot.used_units_reported) - sinceSnap.units;

  const aDay = await sumUnits(d, "account_id=? AND day=?", account.id, today());
  const aMonth = await sumUnits(d, "account_id=? AND month=?", account.id, thisMonth());
  const pDay = await sumUnits(d, "provider_id=? AND day=?", req.providerId, today());
  const pMonth = await sumUnits(d, "provider_id=? AND month=?", req.providerId, thisMonth());
  const inFlight = Number((await d.prepare("SELECT COUNT(*) AS n FROM usage_reservations WHERE account_id=? AND status='reserved'").bind(account.id).first<{ n: number }>())?.n ?? 0);
  const usage = { accountDayUnits: aDay.units, accountMonthUnits: aMonth.units, providerDayUnits: pDay.units, providerMonthUnits: pMonth.units, inFlight };
  const base = { costUsdMicros: cost, quotaRemaining, snapshot, usage, approval };
  const u = req.estimatedUnits;
  if (quotaRemaining < u) return { ok: false, code: "QUOTA_EXHAUSTED", message: `Provider allowance remaining ${quotaRemaining} < ${u} ${req.unitType}.`, ...base };
  if (aDay.units + u > account.daily_unit_cap || aMonth.units + u > account.monthly_unit_cap) return { ok: false, code: "BUDGET_EXCEEDED", message: "Account daily/monthly unit cap reached.", ...base };
  if (pDay.units + u > policy.daily_unit_cap || pMonth.units + u > policy.monthly_unit_cap) return { ok: false, code: "BUDGET_EXCEEDED", message: "Provider daily/monthly unit cap reached.", ...base };
  if (cost > 0 && (aDay.cost + cost > account.daily_cost_usd_micros || aMonth.cost + cost > account.monthly_cost_usd_micros || pDay.cost + cost > policy.daily_cost_usd_micros || pMonth.cost + cost > policy.monthly_cost_usd_micros))
    return { ok: false, code: "BUDGET_EXCEEDED", message: "Daily/monthly hard spend cap reached.", ...base };
  if (req.missionId && req.missionBudgetUsdMicros !== undefined) {
    const m = await sumUnits(d, "mission_id=?", req.missionId);
    if (m.cost + cost > req.missionBudgetUsdMicros) return { ok: false, code: "BUDGET_EXCEEDED", message: "Mission provider budget reached.", ...base };
  }
  if (inFlight >= account.concurrency_limit) return { ok: false, code: "CONCURRENCY_LIMIT", message: "Account concurrency limit reached.", ...base };
  return { ok: true, ...base };
}

/** Atomic reservation: every cap is re-checked inside ONE statement, so concurrent callers cannot overspend. */
async function reserve(d: D1Database, policy: Row, account: Row, ev: Evaluation, req: GatewayRequest, key: string, fallbackOf: string | null): Promise<string> {
  const id = newId("ures"), u = req.estimatedUnits, cost = ev.costUsdMicros, day = today(), month = thisMonth(), snap = ev.snapshot!;
  const win = windowFilter(snap);
  const conds: string[] = []; const params: unknown[] = [];
  const add = (sql: string, ...p: unknown[]) => { conds.push(sql); params.push(...p); };
  const S = (where: string, col = UNITS) => `(SELECT ${col} FROM usage_reservations WHERE status IN ${ACTIVE} AND ${where})`;
  add(`(SELECT COUNT(*) FROM usage_reservations WHERE account_id=? AND status='reserved') < ?`, account.id, account.concurrency_limit);
  add(`${S("account_id=? AND day=?")} + ? <= ?`, account.id, day, u, account.daily_unit_cap);
  add(`${S("account_id=? AND month=?")} + ? <= ?`, account.id, month, u, account.monthly_unit_cap);
  add(`${S("provider_id=? AND day=?")} + ? <= ?`, req.providerId, day, u, policy.daily_unit_cap);
  add(`${S("provider_id=? AND month=?")} + ? <= ?`, req.providerId, month, u, policy.monthly_unit_cap);
  add(`${S(`account_id=? AND unit_type=? AND created_at>=? AND ${win.sql}`)} + ? <= ?`, account.id, req.unitType, snap.verified_at, ...win.params, u, Number(snap.allowance_units) - Number(snap.used_units_reported));
  if (cost > 0) {
    add(`${S("account_id=? AND day=?", COST)} + ? <= ?`, account.id, day, cost, account.daily_cost_usd_micros);
    add(`${S("account_id=? AND month=?", COST)} + ? <= ?`, account.id, month, cost, account.monthly_cost_usd_micros);
    add(`${S("provider_id=? AND day=?", COST)} + ? <= ?`, req.providerId, day, cost, policy.daily_cost_usd_micros);
    add(`${S("provider_id=? AND month=?", COST)} + ? <= ?`, req.providerId, month, cost, policy.monthly_cost_usd_micros);
    add(`${S("account_id=? AND capability=? AND created_at>=?", COST)} + ? <= ?`, account.id, req.capability, ev.approval!.starts_at, cost, ev.approval!.max_spend_usd_micros);
    if (req.missionId && req.missionBudgetUsdMicros !== undefined) add(`${S("mission_id=?", COST)} + ? <= ?`, req.missionId, cost, req.missionBudgetUsdMicros);
  }
  const res = await d.prepare(`INSERT INTO usage_reservations (id,idempotency_key,provider_id,account_id,capability,unit_type,units_reserved,cost_reserved_usd_micros,status,org_id,user_id,mission_id,task_ref,purpose,fallback_of,day,month,created_at)
    SELECT ?,?,?,?,?,?,?,?,'reserved',?,?,?,?,?,?,?,?,? WHERE ${conds.join(" AND ")}`)
    .bind(id, key, req.providerId, account.id, req.capability, req.unitType, u, cost, req.orgId ?? null, req.userId ?? null, req.missionId ?? null, req.taskRef ?? null, req.purpose, fallbackOf, day, month, nowIso(), ...params).run();
  if (!res.meta.changes) throw new GatewayError("RESERVATION_RACE_LOST", "Budget or concurrency changed concurrently; reservation refused. Nothing was sent to the provider.");
  return id;
}

type ErrorClass = "rate_limited" | "auth_denied" | "quota" | "invalid" | "timeout" | "outage" | "unknown";
export function classifyError(error: unknown): { cls: ErrorClass; code: string; retryAfterSeconds?: number } {
  const code = (error as { code?: string })?.code ?? "UNKNOWN";
  const retryAfterSeconds = (error as { retryAfterSeconds?: number })?.retryAfterSeconds;
  switch (code) {
    case "RATE_LIMITED": return { cls: "rate_limited", code, retryAfterSeconds };
    case "NOT_CONFIGURED": case "PROVIDER_NOT_CONFIGURED": case "AUTH_DENIED": return { cls: "auth_denied", code };
    case "QUOTA_EXHAUSTED": return { cls: "quota", code };
    case "INVALID_REQUEST": case "BLOCKED_TARGET": case "INVALID_INPUT": case "MODEL_UNAVAILABLE": case "PROVIDER_DISABLED": return { cls: "invalid", code };
    case "TIMEOUT": return { cls: "timeout", code };
    case "UPSTREAM_ERROR": case "PROVIDER_ERROR": return { cls: "outage", code };
    default: return { cls: "unknown", code };
  }
}

async function setBreaker(d: D1Database, accountId: string, cls: "outage" | "rate_limited" | "auth_denied", code: string, retryAfterSeconds?: number) {
  const row = await d.prepare("SELECT failures FROM circuit_breakers WHERE account_id=?").bind(accountId).first<{ failures: number }>();
  let failures = (row?.failures ?? 0) + 1, openUntil: string | null = null;
  if (cls === "rate_limited") { openUntil = new Date(Date.now() + Math.min(Math.max(retryAfterSeconds ?? 60, 1), 3600) * 1000).toISOString(); }
  else if (cls === "auth_denied") { openUntil = new Date(Date.now() + 3_600_000).toISOString(); }
  else if (failures >= 3) { openUntil = new Date(Date.now() + 60_000).toISOString(); failures = 0; }
  await d.prepare(`INSERT INTO circuit_breakers (account_id,failures,open_until,error_class,last_error_code,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(account_id) DO UPDATE SET failures=excluded.failures, open_until=COALESCE(excluded.open_until, circuit_breakers.open_until), error_class=excluded.error_class, last_error_code=excluded.last_error_code, updated_at=excluded.updated_at`)
    .bind(accountId, failures, openUntil, cls, code, nowIso()).run();
}

async function recordLegacyUsage(d: D1Database, req: GatewayRequest, accountId: string | null, reservationId: string | null, status: "success" | "failure" | "denied", units: number, cost: number, errorCode: string | null, providerRequestId: string | null, estimated = true) {
  await d.prepare(`INSERT INTO provider_usage (id,provider_id,operation,org_id,user_id,units,unit_type,usage_estimated,estimated_cost_usd_micros,status,error_code,provider_request_id,latency_ms,day,account_id,reservation_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(newId("pus"), req.providerId, req.capability, req.orgId ?? null, req.userId ?? null, units, req.unitType, estimated ? 1 : 0, cost, status, errorCode, providerRequestId, null, today(), accountId, reservationId).run();
}

async function loadPrimary(d: D1Database, providerId: string, capability: string): Promise<Row | null> {
  // Deterministic primary = highest priority authorized+active account approved for this capability.
  // We deliberately DO NOT iterate to the next account when the primary is exhausted/limited: that would be rotation.
  // Paused/exhausted accounts STAY primary (and therefore block) — only an explicit owner action
  // (account_status='disabled', revoked ownership or a priority change) removes an account from selection.
  const rows = (await d.prepare("SELECT * FROM provider_accounts WHERE provider_id=? AND ownership_status='authorized' AND account_status IN ('active','paused','exhausted') ORDER BY priority ASC, id ASC").bind(providerId).all<Row>()).results ?? [];
  return rows.find((a) => hasCapability(a, capability)) ?? null;
}

/** Executes one governed provider call. `dispatch` receives a ticket and must pass it to the adapter. */
export async function governedCall<T>(env: Env, d: D1Database, req: GatewayRequest, dispatch: (ticket: DispatchTicket) => Promise<DispatchResult<T>>): Promise<GatewayOutcome<T>> {
  if (!/^[\w:.-]{8,120}$/.test(req.idempotencyKey)) throw new GatewayError("IDEMPOTENCY_CONFLICT", "Invalid idempotency key.");
  // Fail closed (no provider call, no partial writes) if migration 0008 has not been applied to this database.
  try { await d.prepare("SELECT 1 FROM usage_reservations LIMIT 1").first(); await d.prepare("SELECT capabilities_json FROM provider_accounts LIMIT 1").first(); }
  catch { throw new GatewayError("SCHEMA_NOT_MIGRATED", "Provider runtime schema (D1 migration 0008) is not applied; all provider calls are blocked until the owner approves the migration."); }
  const existing = await d.prepare("SELECT status FROM usage_reservations WHERE idempotency_key=?").bind(req.idempotencyKey).first<{ status: string }>();
  if (existing) throw new GatewayError("IDEMPOTENCY_CONFLICT", `A call with this idempotency key already exists (${existing.status}). Not re-sent.`);

  const policy = await d.prepare("SELECT * FROM provider_policies WHERE provider_id=?").bind(req.providerId).first<Row>() ?? null;
  const primary = await loadPrimary(d, req.providerId, req.capability);
  const deny = async (code: GatewayErrorCode, message: string, accountId: string | null, retryAfter?: number): Promise<never> => {
    await recordLegacyUsage(d, req, accountId, null, "denied", 0, 0, code, null);
    throw new GatewayError(code, message, retryAfter);
  };
  if (!policy) return deny("POLICY_MISSING", `No provider policy for ${req.providerId}.`, null);
  if (!primary) return deny(policy.enabled ? "NO_ELIGIBLE_ACCOUNT" : "POLICY_DISABLED", policy.enabled ? `No authorized, active account is approved for '${req.capability}'.` : `Provider ${req.providerId} is disabled by policy.`, null);

  const attempt = async (account: Row, key: string, fallbackOf: string | null): Promise<GatewayOutcome<T>> => {
    const ev = await evaluateAccount(env, d, policy, account, req);
    if (!ev.ok) return deny(ev.code!, ev.message!, account.id, ev.retryAfterSeconds);
    const reservationId = await reserve(d, policy, account, ev, req, key, fallbackOf);
    const cred = resolveCredential(env, account);
    const ticket: DispatchTicket = Object.freeze({ reservationId, providerId: req.providerId, accountId: account.id, credential: cred.credential, binding: cred.binding });
    issued.add(ticket);
    let result: DispatchResult<T>;
    try {
      result = await dispatch(ticket);
    } catch (error) {
      const k = classifyError(error);
      const status = k.cls === "timeout" || k.cls === "unknown" ? "unknown_charge" : "released";
      await d.batch([
        d.prepare("UPDATE usage_reservations SET status=?, error_code=?, settled_at=? WHERE id=? AND status='reserved'").bind(status, k.code, nowIso(), reservationId),
        auditStatement(d, { requestId: req.requestId, actorUserId: req.userId ?? null, actorType: "system", action: "provider.call.failed", resourceType: "usage_reservation", resourceId: reservationId, orgId: req.orgId ?? null, outcome: "failure", metadata: { providerId: req.providerId, accountId: account.id, capability: req.capability, errorClass: k.cls, code: k.code, reservation: status } }),
      ]);
      await recordLegacyUsage(d, req, account.id, reservationId, "failure", 0, 0, k.code, null);
      if (k.cls === "rate_limited" || k.cls === "auth_denied" || k.cls === "outage") await setBreaker(d, account.id, k.cls, k.code, k.retryAfterSeconds);
      if (k.cls === "auth_denied") await d.prepare("UPDATE provider_accounts SET account_status='paused', notes=COALESCE(notes,'') || ? , updated_at=datetime('now') WHERE id=?").bind(` [auto-paused ${nowIso()}: provider denied credential]`, account.id).run();
      if (k.cls === "quota") await d.prepare("UPDATE provider_accounts SET account_status='exhausted', updated_at=datetime('now') WHERE id=?").bind(account.id).run();
      // Outage-only, rule-gated, single fallback. Everything else stops here.
      if (k.cls === "outage" && !fallbackOf && policy.fallback_mode === "approved_account_pool" && account.multi_account_terms_ok) {
        const rule = await d.prepare(`SELECT r.*, a.id AS fb_id FROM fallback_rules r JOIN provider_accounts a ON a.id=r.fallback_account_id
          WHERE r.primary_account_id=? AND r.capability=? AND r.status='active' AND r.trigger_kind='upstream_error' AND r.expires_at>? AND a.provider_id=? AND a.multi_account_terms_ok=1
          ORDER BY r.priority ASC LIMIT 1`).bind(account.id, req.capability, nowIso(), req.providerId).first<Row>();
        if (rule) {
          const fb = await d.prepare("SELECT * FROM provider_accounts WHERE id=?").bind(rule.fb_id).first<Row>();
          if (fb) {
            await auditStatement(d, { requestId: req.requestId, actorType: "system", action: "provider.fallback.attempt", resourceType: "fallback_rule", resourceId: rule.id, metadata: { from: account.id, to: fb.id, capability: req.capability, trigger: k.code } }).run();
            return attempt(fb, `${req.idempotencyKey}:fb`, reservationId);
          }
        }
      }
      throw error;
    } finally {
      issued.delete(ticket);
    }
    const price = Number(account.unit_price_usd_micros ?? 0);
    const unitsActual = Math.max(0, Number(result.unitsActual) || 0);
    const costActual = Math.max(0, Math.round(result.costActualUsdMicros ?? unitsActual * price));
    const exception = unitsActual > req.estimatedUnits || costActual > ev.costUsdMicros ? "actual_exceeds_reservation" : null;
    await d.batch([
      d.prepare("UPDATE usage_reservations SET status='settled', units_actual=?, cost_actual_usd_micros=?, provider_request_id=?, exception=?, settled_at=? WHERE id=?").bind(unitsActual, costActual, result.providerRequestId ?? null, exception, nowIso(), reservationId),
      d.prepare("DELETE FROM circuit_breakers WHERE account_id=?").bind(account.id),
      auditStatement(d, { requestId: req.requestId, actorUserId: req.userId ?? null, actorType: "system", action: "provider.call.settled", resourceType: "usage_reservation", resourceId: reservationId, orgId: req.orgId ?? null, metadata: { providerId: req.providerId, accountId: account.id, capability: req.capability, reserved: req.estimatedUnits, actual: unitsActual, unit: req.unitType, costUsdMicros: costActual, exception, fallbackOf } }),
    ]);
    await recordLegacyUsage(d, req, account.id, reservationId, "success", unitsActual, costActual, null, result.providerRequestId ?? null, result.usageEstimated ?? true);
    return { ...result, unitsActual, costActualUsdMicros: costActual, reservationId, accountId: account.id, accountLabel: account.label, fallbackUsed: Boolean(fallbackOf) };
  };
  return attempt(primary, req.idempotencyKey, null);
}

/** Admin view: evaluation per account for a representative 1-unit request (no reservation is made). */
export async function gatewayStatus(env: Env, d: D1Database) {
  const policies = (await d.prepare("SELECT * FROM provider_policies").all<Row>()).results ?? [];
  const accounts = (await d.prepare("SELECT * FROM provider_accounts ORDER BY provider_id, priority, id").all<Row>()).results ?? [];
  const out = [];
  for (const a of accounts) {
    const policy = policies.find((p) => p.provider_id === a.provider_id) ?? null;
    let caps: string[] = []; try { caps = JSON.parse(a.capabilities_json ?? "[]"); } catch { /* none */ }
    const capability = caps[0] ?? "(none)";
    const ev = await evaluateAccount(env, d, policy, a, { providerId: a.provider_id, capability, unitType: a.unit_type, estimatedUnits: 1 });
    out.push({ accountId: a.id, providerId: a.provider_id, label: a.label, capability, unitType: a.unit_type, eligible: ev.ok, code: ev.code ?? null, reason: ev.message ?? null,
      quotaRemaining: ev.quotaRemaining, snapshotSource: ev.snapshot?.source ?? null, snapshotVerifiedAt: ev.snapshot?.verified_at ?? null, usage: ev.usage,
      credentialPresent: bindingAllowed(a.provider_id, a.secret_binding) && Boolean((env as unknown as Record<string, unknown>)[a.secret_binding]) });
  }
  return out;
}
