import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { currentSubscription } from "./billing";

/**
 * Single entitlement window used by BOTH the API and the UI (V2 fix for calendar-month vs 30-day mismatch).
 * - Paid plan: the active subscription period [current_period_start, current_period_end).
 * - Free plan: rolling 30-day cycles anchored at the organization's creation time.
 * Counters come only from usage_events, so UI and enforcement can never disagree.
 */
export const PERIOD_DAYS = 30;
const DAY = 86_400_000;

export const sqlTime = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
export const parseSqlTime = (s: string) => Date.parse(s.includes("T") ? s : s.replace(" ", "T") + "Z");

export function computeWindow(anchorMs: number, nowMs: number, periodDays = PERIOD_DAYS) {
  const p = periodDays * DAY;
  const n = Math.max(0, Math.floor((nowMs - anchorMs) / p));
  const start = anchorMs + n * p;
  return { start, end: start + p };
}

export type UsageKind = "request" | "ai_assist";

export async function entitlements(d: D1Database, orgId: string, nowMs = Date.now()) {
  const { subscription, plan } = await currentSubscription(d, orgId);
  let start: number, end: number, basis: "subscription_period" | "rolling_30_days";
  if (subscription && plan.code !== "free" && subscription.current_period_start && subscription.current_period_end) {
    start = parseSqlTime(subscription.current_period_start); end = parseSqlTime(subscription.current_period_end); basis = "subscription_period";
  } else {
    const org = await d.prepare("SELECT created_at FROM organizations WHERE id=?").bind(orgId).first<{ created_at: string }>();
    ({ start, end } = computeWindow(org ? parseSqlTime(org.created_at) : nowMs, nowMs));
    basis = "rolling_30_days";
  }
  const r = await d.prepare("SELECT COALESCE(SUM(kind='request'),0) AS requests, COALESCE(SUM(kind='ai_assist'),0) AS ai FROM usage_events WHERE org_id=? AND created_at>=? AND created_at<?")
    .bind(orgId, sqlTime(start), sqlTime(end)).first<{ requests: number; ai: number }>();
  return {
    plan, subscription,
    window: { start: new Date(start).toISOString(), resetsAt: new Date(end).toISOString(), basis, periodDays: PERIOD_DAYS },
    usage: { requests: Number(r?.requests ?? 0), aiAssists: Number(r?.ai ?? 0) },
  };
}

/** Server-side quota enforcement. Hidden/disabled buttons are never the control. */
export async function assertEntitlement(d: D1Database, orgId: string, kind: UsageKind) {
  const ent = await entitlements(d, orgId);
  const limit = kind === "request" ? ent.plan.limits.requestsPerMonth : ent.plan.limits.aiAssistsPerMonth;
  const used = kind === "request" ? ent.usage.requests : ent.usage.aiAssists;
  if (limit <= 0) fail(402, "PLAN_FEATURE_REQUIRED", kind === "ai_assist" ? "Bantuan AI tersedia di paket Pro dan Plus." : `Paket ${ent.plan.name} tidak mencakup fitur ini.`);
  if (used >= limit) fail(402, "PLAN_LIMIT_REACHED", `Kuota ${kind === "request" ? "permintaan" : "bantuan AI"} paket ${ent.plan.name} (${limit} per ${PERIOD_DAYS} hari) habis. Reset pada ${ent.window.resetsAt}.`, { resetsAt: ent.window.resetsAt, limit, used });
  return ent;
}

export const usageStatement = (d: D1Database, orgId: string, userId: string | null, kind: UsageKind, refId: string | null) =>
  d.prepare("INSERT INTO usage_events (id,org_id,user_id,kind,ref_id) VALUES (?,?,?,?,?)").bind(newId("use"), orgId, userId, kind, refId);
