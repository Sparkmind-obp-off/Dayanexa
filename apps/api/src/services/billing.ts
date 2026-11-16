import type { Env } from "../env";
import type { Principal } from "../auth/principal";
import { planByCode, type PlanCode } from "../domain/plans";
import { postJournal } from "../ledger/ledger";
import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { gateways, liveEnabled } from "../payments/registry";
import type { GatewayId } from "../payments/types";
import { GatewayError } from "../payments/types";
import { audit, auditStatement } from "./audit";

export interface SubRow { id: string; plan_code: PlanCode; status: string; current_period_start: string | null; current_period_end: string | null; cancel_at_period_end: number }

/** Effective plan: latest active, unexpired paid subscription, else Free. */
export async function currentSubscription(d: D1Database, orgId: string) {
  const row = await d.prepare(`SELECT id,plan_code,status,current_period_start,current_period_end,cancel_at_period_end FROM subscriptions
    WHERE org_id=? AND status='active' AND (current_period_end IS NULL OR current_period_end > datetime('now')) ORDER BY created_at DESC LIMIT 1`).bind(orgId).first<SubRow>();
  return { subscription: row ?? null, plan: planByCode(row?.plan_code ?? "free") };
}

export async function usageThisMonth(d: D1Database, orgId: string) {
  const r = await d.prepare(`SELECT
      (SELECT COUNT(*) FROM demands WHERE org_id=? AND origin='customer' AND created_at >= datetime('now','start of month')) AS requests,
      (SELECT COUNT(*) FROM inference_traces WHERE org_id=? AND status='success' AND created_at >= datetime('now','start of month')) AS ai`).bind(orgId, orgId).first<{ requests: number; ai: number }>();
  return { requests: r?.requests ?? 0, aiAssists: r?.ai ?? 0 };
}

export async function assertRequestQuota(d: D1Database, orgId: string) {
  const { plan } = await currentSubscription(d, orgId);
  const usage = await usageThisMonth(d, orgId);
  if (usage.requests >= plan.limits.requestsPerMonth) fail(402, "PLAN_LIMIT_REACHED", `Paket ${plan.name} mengizinkan ${plan.limits.requestsPerMonth} permintaan per bulan. Upgrade paket untuk menambah kuota.`);
}

/** Subscribe: Free activates immediately; paid plans create a payment intent (amount from server plan table). */
export async function subscribe(env: Env, d: D1Database, p: Principal, args: { planCode: PlanCode; provider: GatewayId; customerName: string; customerPhone?: string | null; origin: string; requestId: string; idempotencyKey: string | null }) {
  const plan = planByCode(args.planCode);
  if (plan.code !== args.planCode) fail(400, "UNKNOWN_PLAN");
  const orgId = p.primaryOrgId;
  if (plan.priceMonthly === 0) {
    await d.batch([
      d.prepare("UPDATE subscriptions SET status='canceled', updated_at=datetime('now') WHERE org_id=? AND status IN ('active','pending')").bind(orgId),
      d.prepare("INSERT INTO subscriptions (id,org_id,user_id,plan_code,status,current_period_start) VALUES (?,?,?,'free','active',datetime('now'))").bind(newId("sub"), orgId, p.userId),
      auditStatement(d, { requestId: args.requestId, actorUserId: p.userId, action: "subscription.free_activated", resourceType: "subscription", orgId }),
    ]);
    return { plan: plan.code, status: "active", checkoutUrl: null, mode: "n/a" };
  }
  if (args.idempotencyKey) {
    const ex = await d.prepare("SELECT id,status,checkout_url,mode,amount FROM payment_intents WHERE user_id=? AND idempotency_key=?").bind(p.userId, args.idempotencyKey).first();
    if (ex) return { ...ex, replayed: true };
  }
  const pendingPaid = await d.prepare("SELECT id FROM payment_intents WHERE org_id=? AND purpose='subscription' AND status='PENDING' AND created_at > datetime('now','-1 hour')").bind(orgId).first();
  if (pendingPaid) fail(409, "SUBSCRIPTION_PAYMENT_PENDING", "Masih ada pembayaran langganan yang tertunda (maks. 1 jam).");
  const live = liveEnabled(env);
  if (env.PAYMENTS_MODE === "live" && !live) fail(423, "LIVE_PAYMENTS_LOCKED");
  const gateway = gateways[args.provider];
  if (live && !gateway.isConfigured(env)) fail(409, "GATEWAY_NOT_CONFIGURED");
  const intentId = newId("pay"), subId = newId("sub");
  const orderId = "DXS" + intentId.slice(4).toUpperCase();
  let checkoutUrl: string | null = null, providerTx: string | null = null, reference: string | null = null;
  if (live) {
    try {
      const r = await gateway.createPaymentIntent(env, { orderId, amount: plan.priceMonthly, currency: "IDR", description: `DAYANEXA ${plan.name} — ${plan.periodDays} hari`,
        customer: { name: args.customerName, email: p.email ?? "", phone: args.customerPhone }, callbackUrl: `${args.origin}/api/v1/payments/webhooks/${args.provider}`,
        returnUrl: `${args.origin}/app/billing?payment=${intentId}`, expiryMinutes: 60 });
      checkoutUrl = r.checkoutUrl; providerTx = r.providerTransactionId; reference = r.reference;
    } catch (error) {
      await audit(d, { requestId: args.requestId, actorUserId: p.userId, action: "subscription.checkout", resourceType: "subscription", outcome: "failure", metadata: { error: error instanceof GatewayError ? error.code : "GATEWAY_ERROR" } });
      fail(502, error instanceof GatewayError ? error.code : "GATEWAY_ERROR", "Payment gateway request failed.");
    }
  }
  await d.batch([
    d.prepare(`INSERT INTO payment_intents (id,org_id,user_id,offer_id,provider,mode,merchant_order_id,provider_transaction_id,provider_reference,amount,currency,description,status,checkout_url,idempotency_key,purpose,plan_code)
      VALUES (?,?,?,NULL,?,?,?,?,?,?,'IDR',?,'PENDING',?,?,'subscription',?)`).bind(intentId, orgId, p.userId, live ? args.provider : "mock", live ? "live" : "mock", orderId, providerTx, reference, plan.priceMonthly,
      `DAYANEXA ${plan.name}`, checkoutUrl, args.idempotencyKey, plan.code),
    d.prepare("INSERT INTO subscriptions (id,org_id,user_id,plan_code,status,payment_intent_id) VALUES (?,?,?,?,'pending',?)").bind(subId, orgId, p.userId, plan.code, intentId),
    auditStatement(d, { requestId: args.requestId, actorUserId: p.userId, action: "subscription.checkout_created", resourceType: "subscription", resourceId: subId, orgId, metadata: { plan: plan.code, mode: live ? "live" : "mock", amount: plan.priceMonthly } }),
  ]);
  return { id: intentId, subscriptionId: subId, plan: plan.code, amount: plan.priceMonthly, status: "PENDING", mode: live ? "live" : "mock", checkoutUrl,
    notice: live ? null : "MODE MOCK — tidak ada tagihan nyata. Langganan berbayar aktif hanya setelah pembayaran live terverifikasi oleh gateway." };
}

/** Called after a VERIFIED live subscription payment. Access granted = delivery → revenue recognized. */
export async function activateSubscriptionForIntent(d: D1Database, intent: { id: string; amount: number; merchant_order_id: string; org_id: string }) {
  const sub = await d.prepare("SELECT id,plan_code FROM subscriptions WHERE payment_intent_id=?").bind(intent.id).first<{ id: string; plan_code: string }>();
  if (!sub) return;
  const plan = planByCode(sub.plan_code);
  await d.batch([
    d.prepare("UPDATE subscriptions SET status='canceled', updated_at=datetime('now') WHERE org_id=? AND status='active' AND id!=?").bind(intent.org_id, sub.id),
    d.prepare(`UPDATE subscriptions SET status='active', current_period_start=datetime('now'), current_period_end=datetime('now','+'||?||' days'), updated_at=datetime('now') WHERE id=? AND status='pending'`).bind(plan.periodDays, sub.id),
  ]);
  await postJournal(d, { sourceType: "subscription_revenue", sourceId: intent.id, description: `Subscription ${plan.name} activated (${intent.merchant_order_id})`,
    lines: [{ accountId: "acct-unearned-revenue", direction: "debit", amount: intent.amount }, { accountId: "acct-platform-revenue", direction: "credit", amount: intent.amount }] });
}
