/**
 * Member Discovery Entitlement (docs/31 §2, §12.4).
 * - Policy is plan-scoped and versioned (discovery_policies); never email-scoped.
 * - One ledger row per CAMPAIGN (discovery_entitlements.campaign_id UNIQUE); child jobs never create rows,
 *   so selecting many channels cannot multiply the allowance.
 * - Counted states: reserved + consumed inside the rolling window. Pre-dispatch rejection releases the row.
 * - Reservation is ONE conditional INSERT…SELECT…WHERE, so concurrent starts cannot overspend.
 * - Program budget (discovery_program_budgets) is DAYANEXA's owner-approved allocation; campaign envelopes
 *   reserve against it atomically. No budget row → no funded route → entitlement stays pending, not fulfilled.
 */
import { currentSubscription } from "../services/billing";
import { parseSqlTime, sqlTime } from "../services/entitlements";
import { newId, nowIso, thisMonth } from "../lib/ids";

type Row = Record<string, any>;
const DAY = 86_400_000;
const COUNTED = "('reserved','consumed')";
const USED = "COALESCE(SUM(CASE WHEN status='settled' THEN COALESCE(units_actual,0) WHEN status='reserved' THEN units_reserved ELSE 0 END),0)";

export async function activePolicy(d: D1Database, planCode: string): Promise<Row | null> {
  return (await d.prepare("SELECT * FROM discovery_policies WHERE plan_code=? AND status='active' ORDER BY version DESC LIMIT 1").bind(planCode).first<Row>()) ?? null;
}

export interface BudgetView { id: string; providerId: string; unitType: string; monthCap: number; perOrgCap: number; monthUsed: number; orgUsed: number; headroomPct: number; orgRemaining: number; bonusEnabled: boolean; fundingClass: string; expiresAt: string }

/** Active, unexpired program budgets (latest per provider/unit) with month and per-org usage. */
export async function activeBudgets(d: D1Database, orgId: string | null): Promise<BudgetView[]> {
  const now = nowIso(), month = thisMonth();
  const rows = (await d.prepare("SELECT * FROM discovery_program_budgets WHERE status='active' AND starts_at<=? AND expires_at>? ORDER BY created_at DESC").bind(now, now).all<Row>()).results ?? [];
  const seen = new Set<string>(); const out: BudgetView[] = [];
  for (const b of rows) {
    const k = `${b.provider_id}|${b.unit_type}`; if (seen.has(k)) continue; seen.add(k);
    const m = await d.prepare(`SELECT ${USED} AS u FROM discovery_envelopes WHERE budget_id=? AND month=?`).bind(b.id, month).first<{ u: number }>();
    const o = orgId ? await d.prepare(`SELECT ${USED} AS u FROM discovery_envelopes WHERE budget_id=? AND month=? AND org_id=?`).bind(b.id, month, orgId).first<{ u: number }>() : { u: 0 };
    const monthUsed = Number(m?.u ?? 0), orgUsed = Number(o?.u ?? 0);
    out.push({ id: b.id, providerId: b.provider_id, unitType: b.unit_type, monthCap: Number(b.month_units_cap), perOrgCap: Number(b.per_org_month_units_cap), monthUsed, orgUsed,
      headroomPct: Math.max(0, Math.round((1 - monthUsed / Number(b.month_units_cap)) * 100)), orgRemaining: Math.max(0, Number(b.per_org_month_units_cap) - orgUsed),
      bonusEnabled: Boolean(b.bonus_enabled), fundingClass: b.funding_class, expiresAt: b.expires_at });
  }
  return out;
}

/** The conditional bonus is funded only when every provider in scope has a bonus-enabled budget with headroom. */
export function bonusFunded(policy: Row, budgets: BudgetView[], providers: string[] | null): boolean {
  if (!(policy.conditional_bonus_campaigns > 0)) return false;
  const ok = (b: BudgetView) => b.bonusEnabled && b.headroomPct >= Number(policy.bonus_min_headroom_pct);
  if (providers === null) return budgets.some(ok);
  if (!providers.length) return false;
  return providers.every((p) => budgets.some((b) => b.providerId === p && ok(b)));
}

export async function memberDiscoveryStatus(d: D1Database, orgId: string, userId: string, nowMs = Date.now()) {
  const { plan } = await currentSubscription(d, orgId);
  const policy = await activePolicy(d, plan.code);
  if (!policy) return { eligible: false, state: "no_policy" as const, plan: plan.code, policy: null, used: 0, remaining: 0, guaranteedRemaining: 0, bonusRemaining: 0, bonusFunded: false, fundedRoute: false, nextResetAt: null, windowStart: null, history: [], budgets: [] };
  const periodMs = Number(policy.period_days) * DAY;
  const since = sqlTime(nowMs - periodMs);
  const counted = (await d.prepare(`SELECT id,campaign_id,kind,state,created_at,consumed_at FROM discovery_entitlements WHERE org_id=? AND user_id=? AND state IN ${COUNTED} AND created_at>=? ORDER BY created_at`).bind(orgId, userId, since).all<Row>()).results ?? [];
  const history = (await d.prepare("SELECT e.campaign_id,e.kind,e.state,e.reason,e.policy_version,e.created_at,e.consumed_at,c.title FROM discovery_entitlements e LEFT JOIN discovery_campaigns c ON c.id=e.campaign_id WHERE e.org_id=? AND e.user_id=? ORDER BY e.created_at DESC LIMIT 20").bind(orgId, userId).all<Row>()).results ?? [];
  const budgets = await activeBudgets(d, orgId);
  const g = Number(policy.guaranteed_campaigns), bonus = Number(policy.conditional_bonus_campaigns);
  const funded = bonusFunded(policy, budgets, null);
  const used = counted.length;
  const guaranteedRemaining = Math.max(0, g - used);
  const bonusRemaining = funded ? Math.max(0, g + bonus - Math.max(used, g)) : 0;
  const remaining = guaranteedRemaining + bonusRemaining;
  const fundedRoute = budgets.length > 0;
  const nextResetAt = counted.length ? new Date(parseSqlTime(counted[0].created_at) + periodMs).toISOString() : null;
  const state = remaining > 0 ? (fundedRoute ? "available" : "pending_capacity") : "exhausted";
  return {
    eligible: true, state, plan: plan.code,
    policy: { id: policy.id, version: policy.version, periodDays: policy.period_days, guaranteed: g, conditionalBonus: bonus, maxChannels: policy.max_channels, maxItemsPerJob: policy.max_items_per_job, maxAttemptsPerJob: policy.max_attempts_per_job },
    used, remaining, guaranteedRemaining, bonusRemaining, bonusFunded: funded, fundedRoute, nextResetAt, windowStart: new Date(nowMs - periodMs).toISOString(),
    bonusReason: bonus > 0 && !funded ? "Kampanye bonus hanya tersedia bila kapasitas penyedia bersama dan anggaran program yang disetujui masih longgar." : null,
    history, budgets: budgets.map((b) => ({ providerId: b.providerId, unitType: b.unitType, headroomPct: b.headroomPct, orgRemaining: b.orgRemaining })),
  };
}

/**
 * Atomically reserve ONE campaign entitlement. Re-uses the campaign's existing row (retry of the same campaign
 * never creates a second entitlement). Returns null when the allowance is exhausted.
 */
export async function reserveEntitlement(d: D1Database, a: { campaignId: string; orgId: string; userId: string; policy: Row; bonusFunded: boolean; nowMs?: number }): Promise<Row | null> {
  const nowMs = a.nowMs ?? Date.now();
  const since = sqlTime(nowMs - Number(a.policy.period_days) * DAY), now = sqlTime(nowMs);
  const g = Number(a.policy.guaranteed_campaigns);
  const limit = g + (a.bonusFunded ? Number(a.policy.conditional_bonus_campaigns) : 0);
  const count = `(SELECT COUNT(*) FROM discovery_entitlements WHERE org_id=? AND user_id=? AND state IN ${COUNTED} AND created_at>=?)`;
  const existing = await d.prepare("SELECT * FROM discovery_entitlements WHERE campaign_id=?").bind(a.campaignId).first<Row>();
  if (existing && (existing.state === "reserved" || existing.state === "consumed")) return existing;
  if (limit <= 0) return null;
  if (existing) {
    const r = await d.prepare(`UPDATE discovery_entitlements SET state='reserved', kind=CASE WHEN ${count} < ? THEN 'guaranteed' ELSE 'bonus' END, reason=NULL, created_at=?, updated_at=?
      WHERE campaign_id=? AND state='released' AND ${count} < ?`).bind(a.orgId, a.userId, since, g, now, now, a.campaignId, a.orgId, a.userId, since, limit).run();
    return r.meta.changes ? await d.prepare("SELECT * FROM discovery_entitlements WHERE campaign_id=?").bind(a.campaignId).first<Row>() : null;
  }
  const r = await d.prepare(`INSERT INTO discovery_entitlements (id,campaign_id,org_id,user_id,policy_id,policy_version,kind,state,created_at,updated_at)
    SELECT ?,?,?,?,?,?, CASE WHEN n < ? THEN 'guaranteed' ELSE 'bonus' END, 'reserved', ?, ? FROM (SELECT ${count} AS n) WHERE n < ?`)
    .bind(newId("dent"), a.campaignId, a.orgId, a.userId, a.policy.id, a.policy.version, g, now, now, a.orgId, a.userId, since, limit).run();
  return r.meta.changes ? await d.prepare("SELECT * FROM discovery_entitlements WHERE campaign_id=?").bind(a.campaignId).first<Row>() : null;
}

/** Accepted dispatch → consumed (idempotent; only from reserved). */
export const consumeEntitlementStatement = (d: D1Database, campaignId: string) =>
  d.prepare("UPDATE discovery_entitlements SET state='consumed', consumed_at=COALESCE(consumed_at,?), updated_at=? WHERE campaign_id=? AND state='reserved'").bind(sqlTime(Date.now()), sqlTime(Date.now()), campaignId);
/** Nothing accepted for dispatch → released; allowance preserved. */
export const releaseEntitlementStatement = (d: D1Database, campaignId: string, reason: string) =>
  d.prepare("UPDATE discovery_entitlements SET state='released', reason=?, updated_at=? WHERE campaign_id=? AND state='reserved'").bind(reason.slice(0, 300), sqlTime(Date.now()), campaignId);

/** Atomic envelope reservation against the program budget (global month cap AND per-org month cap). */
export async function reserveEnvelope(d: D1Database, a: { campaignId: string; orgId: string; budgetId: string; units: number }): Promise<string | null> {
  const id = newId("denv"), now = nowIso(), month = thisMonth();
  const r = await d.prepare(`INSERT INTO discovery_envelopes (id,campaign_id,org_id,budget_id,provider_id,unit_type,units_reserved,status,month,created_at)
    SELECT ?,?,?,b.id,b.provider_id,b.unit_type,?,'reserved',?,? FROM discovery_program_budgets b
    WHERE b.id=? AND b.status='active' AND b.starts_at<=? AND b.expires_at>?
      AND (SELECT ${USED} FROM discovery_envelopes WHERE budget_id=b.id AND month=?) + ? <= b.month_units_cap
      AND (SELECT ${USED} FROM discovery_envelopes WHERE budget_id=b.id AND month=? AND org_id=?) + ? <= b.per_org_month_units_cap`)
    .bind(id, a.campaignId, a.orgId, a.units, month, now, a.budgetId, now, now, month, a.units, month, a.orgId, a.units).run();
  return r.meta.changes ? id : null;
}
