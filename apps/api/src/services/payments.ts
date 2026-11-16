import type { Env } from "../env";
import type { Principal } from "../auth/principal";
import { paymentTransitionAllowed } from "../domain/lifecycle";
import { postJournal } from "../ledger/ledger";
import { digestHex } from "../lib/crypto";
import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { redact } from "../lib/redact";
import { gateways, liveEnabled } from "../payments/registry";
import type { CanonicalPaymentStatus, GatewayId, NormalizedWebhook } from "../payments/types";
import { GatewayError, parseBody } from "../payments/types";
import { audit, auditStatement } from "./audit";
import { activateSubscriptionForIntent } from "./billing";

interface IntentRow { id: string; purpose?: string; org_id: string; user_id: string; offer_id: string | null; provider: string; mode: string; merchant_order_id: string; provider_transaction_id: string | null; amount: number; currency: string; status: string }

/** Creates a payment intent for an ACCEPTED offer. Amount is always derived server-side from the offer. */
export async function createIntent(env: Env, d: D1Database, p: Principal, args: { offerId: string; provider: GatewayId; paymentMethod?: string | null; idempotencyKey: string | null; origin: string; requestId: string; customer: { name: string; email: string; phone?: string | null } }) {
  if (args.idempotencyKey) {
    const existing = await d.prepare("SELECT id,merchant_order_id,provider,mode,amount,currency,status,checkout_url FROM payment_intents WHERE user_id=? AND idempotency_key=?").bind(p.userId, args.idempotencyKey).first();
    if (existing) return { ...existing, replayed: true };
  }
  const offer = await d.prepare("SELECT id,customer_org_id,status,price_minor,tax_minor,currency,title FROM offers WHERE id=?").bind(args.offerId).first<{ id: string; customer_org_id: string | null; status: string; price_minor: number; tax_minor: number; currency: string; title: string }>();
  if (!offer || !offer.customer_org_id || !p.orgIds.includes(offer.customer_org_id)) fail(404, "OFFER_NOT_FOUND");
  if (offer!.status !== "accepted") fail(409, "OFFER_NOT_ACCEPTED", "Accept the offer terms before paying.");
  const open = await d.prepare("SELECT id FROM payment_intents WHERE offer_id=? AND status IN ('PENDING','SUCCEEDED','REFUND_PENDING','RECONCILIATION_REQUIRED')").bind(offer!.id).first();
  if (open) fail(409, "PAYMENT_ALREADY_OPEN", "An open or completed payment already exists for this offer.");
  const amount = offer!.price_minor + offer!.tax_minor;
  if (!Number.isSafeInteger(amount) || amount < 1000) fail(400, "AMOUNT_TOO_SMALL", "Minimum payable amount is IDR 1,000.");
  const live = liveEnabled(env);
  if (env.PAYMENTS_MODE === "live" && !live) fail(423, "LIVE_PAYMENTS_LOCKED");
  const gateway = gateways[args.provider];
  if (live && !gateway.isConfigured(env)) fail(409, "GATEWAY_NOT_CONFIGURED");
  const intentId = newId("pay");
  const orderId = "DX" + intentId.slice(4).toUpperCase();
  let result = { providerTransactionId: null as string | null, checkoutUrl: null as string | null, reference: null as string | null, status: "PENDING" as CanonicalPaymentStatus };
  if (live) {
    try {
      result = await gateway.createPaymentIntent(env, { orderId, amount, currency: "IDR", description: offer!.title.slice(0, 120), customer: args.customer, paymentMethod: args.paymentMethod,
        callbackUrl: `${args.origin}/api/v1/payments/webhooks/${args.provider}`, returnUrl: `${args.origin}/app/requests?payment=${intentId}`, expiryMinutes: 60 });
    } catch (error) {
      await audit(d, { requestId: args.requestId, actorUserId: p.userId, action: "payment_intent.create", resourceType: "offer", resourceId: offer!.id, outcome: "failure", metadata: { provider: args.provider, error: error instanceof GatewayError ? error.code : "GATEWAY_ERROR" } });
      fail(502, error instanceof GatewayError ? error.code : "GATEWAY_ERROR", "Payment gateway request failed.");
    }
  }
  await d.batch([
    d.prepare(`INSERT INTO payment_intents (id,org_id,user_id,offer_id,provider,mode,merchant_order_id,provider_transaction_id,provider_reference,amount,currency,description,status,checkout_url,idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,'IDR',?,?,?,?)`).bind(intentId, offer!.customer_org_id, p.userId, offer!.id, live ? args.provider : "mock", live ? "live" : "mock", orderId,
      result.providerTransactionId, result.reference, amount, offer!.title.slice(0, 120), "PENDING", result.checkoutUrl, args.idempotencyKey),
    auditStatement(d, { requestId: args.requestId, actorUserId: p.userId, action: "payment_intent.created", resourceType: "payment_intent", resourceId: intentId, orgId: offer!.customer_org_id, metadata: { provider: args.provider, mode: live ? "live" : "mock", amount } }),
  ]);
  return { id: intentId, merchant_order_id: orderId, provider: live ? args.provider : "mock", mode: live ? "live" : "mock", amount, currency: "IDR", status: "PENDING", checkout_url: result.checkoutUrl,
    notice: live ? null : "MOCK MODE — no real charge is created. Live payments are locked until the owner enables them." };
}

export type WebhookOutcome = "invalid_signature" | "duplicate" | "unknown_order" | "applied" | "ignored_regression" | "reconciliation_required" | "unconfigured";

/** Verifies, records immutably, deduplicates, reconciles and applies a gateway webhook. Never trusts redirects. */
export async function processWebhook(env: Env, d: D1Database, provider: GatewayId, headers: Headers, rawBody: string, requestId: string): Promise<{ outcome: WebhookOutcome; status?: string }> {
  const gateway = gateways[provider];
  const normalized = await gateway.verifyAndNormalizeWebhook(env, headers, rawBody);
  if (!normalized) {
    await audit(d, { requestId, actorType: "provider", action: "payment_webhook.rejected", resourceType: "payment_webhook", resourceId: provider, outcome: "denied", metadata: { reason: gateway.isConfigured(env) ? "signature" : "unconfigured" } });
    return { outcome: gateway.isConfigured(env) ? "invalid_signature" : "unconfigured" };
  }
  const payloadHash = await digestHex("SHA-256", rawBody);
  const redacted = JSON.stringify(redact(parseBody(rawBody, headers.get("content-type"))));
  const eventRowId = newId("pev");
  const inserted = await d.prepare(`INSERT OR IGNORE INTO payment_events (id,provider,provider_event_id,merchant_order_id,event_type,normalized_status,amount,currency,payload_hash,payload_redacted_json,processing_outcome)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'received')`).bind(eventRowId, provider, normalized.eventId, normalized.orderId, normalized.eventType, normalized.status, normalized.amount, normalized.currency, payloadHash, redacted).run();
  if (inserted.meta.changes === 0) return { outcome: "duplicate" };
  const setOutcome = (o: string) => d.prepare("UPDATE payment_events SET processing_outcome=?, processed_at=datetime('now') WHERE id=?").bind(o, eventRowId).run();

  const intent = await d.prepare("SELECT * FROM payment_intents WHERE merchant_order_id=? AND provider=? AND mode='live'").bind(normalized.orderId, provider).first<IntentRow>();
  if (!intent) { await setOutcome("unknown_order"); return { outcome: "unknown_order" }; }

  let target: string = normalized.status === "UNKNOWN" ? "RECONCILIATION_REQUIRED" : normalized.status;
  const mismatch = reconcileMismatch(intent, normalized);
  if (mismatch) target = "RECONCILIATION_REQUIRED";
  if (target === "SUCCEEDED") {
    const confirmed = await confirmWithProvider(env, provider, intent);
    if (!confirmed) target = "RECONCILIATION_REQUIRED";
  }
  if (!paymentTransitionAllowed(intent.status, target)) { await setOutcome(`ignored:${intent.status}->${target}`); return { outcome: "ignored_regression", status: intent.status }; }
  const upd = await d.prepare("UPDATE payment_intents SET status=?, provider_transaction_id=COALESCE(provider_transaction_id,?), verified_at=CASE WHEN ?='SUCCEEDED' THEN datetime('now') ELSE verified_at END, updated_at=datetime('now') WHERE id=? AND status=?")
    .bind(target, normalized.providerTransactionId, target, intent.id, intent.status).run();
  if (upd.meta.changes !== 1) { await setOutcome("concurrent"); return { outcome: "ignored_regression" }; }
  if (target === "SUCCEEDED") {
    await postJournal(d, { sourceType: "payment_succeeded", sourceId: intent.id, description: `Verified payment ${intent.merchant_order_id} via ${provider}`,
      lines: [{ accountId: "acct-gateway-clearing", direction: "debit", amount: intent.amount }, { accountId: "acct-unearned-revenue", direction: "credit", amount: intent.amount }] });
    if (intent.purpose === "subscription") await activateSubscriptionForIntent(d, intent);
  }
  if (target === "REFUNDED" && intent.status !== "REFUNDED") await postRefundJournal(d, intent);
  await setOutcome(mismatch ? `reconciliation:${mismatch}` : `applied:${target}`);
  await audit(d, { requestId, actorType: "provider", action: "payment.status_changed", resourceType: "payment_intent", resourceId: intent.id, orgId: intent.org_id, metadata: { from: intent.status, to: target, mismatch } });
  return { outcome: target === "RECONCILIATION_REQUIRED" ? "reconciliation_required" : "applied", status: target };
}

export function reconcileMismatch(intent: IntentRow, n: NormalizedWebhook): string | null {
  if (n.orderId !== intent.merchant_order_id) return "order";
  if (n.amount !== null && n.amount !== intent.amount) return "amount";
  if (n.status === "SUCCEEDED" && n.amount === null) return "amount_missing";
  if (n.currency && n.currency.toUpperCase() !== intent.currency) return "currency";
  return null;
}

async function confirmWithProvider(env: Env, provider: GatewayId, intent: IntentRow): Promise<boolean> {
  const gateway = gateways[provider];
  const caps = gateway.getProviderCapabilities(env);
  if (!caps.statusInquiry) return true; // signed callback is the only available proof; recorded as such in capabilities
  try {
    const s = await gateway.getPaymentStatus(env, intent.merchant_order_id, intent.provider_transaction_id);
    return s.status === "SUCCEEDED" && (s.amount === null || s.amount === intent.amount);
  } catch { return false; }
}

async function postRefundJournal(d: D1Database, intent: IntentRow) {
  const recognized = await d.prepare("SELECT id FROM ledger_journals WHERE source_type='revenue_recognized' AND source_id=?").bind(intent.id).first();
  await postJournal(d, { sourceType: "payment_refunded", sourceId: intent.id, description: `Refund of ${intent.merchant_order_id}`,
    lines: [{ accountId: recognized ? "acct-platform-revenue" : "acct-unearned-revenue", direction: "debit", amount: intent.amount }, { accountId: "acct-gateway-clearing", direction: "credit", amount: intent.amount }] });
}

/** Revenue is recognized only on verified payment + explicit customer acceptance. */
export async function recognizeRevenueForOffer(d: D1Database, offerId: string, actor: string | null) {
  const intent = await d.prepare("SELECT id,amount,merchant_order_id FROM payment_intents WHERE offer_id=? AND purpose='offer' AND mode='live' AND status='SUCCEEDED'").bind(offerId).first<{ id: string; amount: number; merchant_order_id: string }>();
  if (!intent) return null;
  return postJournal(d, { sourceType: "revenue_recognized", sourceId: intent.id, createdBy: actor, description: `Revenue recognized on acceptance (${intent.merchant_order_id})`,
    lines: [{ accountId: "acct-unearned-revenue", direction: "debit", amount: intent.amount }, { accountId: "acct-platform-revenue", direction: "credit", amount: intent.amount }] });
}

/** Re-queries the provider for a live intent and applies the verified status (operator reconciliation). */
export async function reconcileIntent(env: Env, d: D1Database, intentId: string, actor: string, requestId: string) {
  const intent = await d.prepare("SELECT * FROM payment_intents WHERE id=?").bind(intentId).first<IntentRow>();
  if (!intent) fail(404, "PAYMENT_NOT_FOUND");
  if (intent!.mode !== "live") fail(409, "MOCK_PAYMENT", "Mock intents have no provider record to reconcile.");
  const gateway = gateways[intent!.provider as GatewayId];
  let s;
  try { s = await gateway.getPaymentStatus(env, intent!.merchant_order_id, intent!.provider_transaction_id); }
  catch (error) { fail(502, error instanceof GatewayError ? error.code : "GATEWAY_ERROR"); }
  const amountOk = s!.amount === null || s!.amount === intent!.amount;
  const target = !amountOk ? "RECONCILIATION_REQUIRED" : s!.status === "UNKNOWN" ? intent!.status : s!.status;
  if (target !== intent!.status && paymentTransitionAllowed(intent!.status, target)) {
    await d.prepare("UPDATE payment_intents SET status=?, verified_at=CASE WHEN ?='SUCCEEDED' THEN datetime('now') ELSE verified_at END, updated_at=datetime('now') WHERE id=? AND status=?").bind(target, target, intent!.id, intent!.status).run();
    if (target === "SUCCEEDED") await postJournal(d, { sourceType: "payment_succeeded", sourceId: intent!.id, createdBy: actor, description: `Verified payment ${intent!.merchant_order_id} via reconciliation`,
      lines: [{ accountId: "acct-gateway-clearing", direction: "debit", amount: intent!.amount }, { accountId: "acct-unearned-revenue", direction: "credit", amount: intent!.amount }] });
    if (target === "SUCCEEDED" && intent!.purpose === "subscription") await activateSubscriptionForIntent(d, intent!);
  }
  await audit(d, { requestId, actorUserId: actor, action: "payment.reconciled", resourceType: "payment_intent", resourceId: intent!.id, metadata: { providerStatus: s!.status, amountOk, applied: target } });
  return { providerStatus: s!.status, amountMatches: amountOk, status: target };
}
