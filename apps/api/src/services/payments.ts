import type { Env } from "../env";
import type { Principal } from "../auth/principal";
import { paymentTransitionAllowed } from "../domain/lifecycle";
import { postJournal, type JournalLine } from "../ledger/ledger";
import { digestHex } from "../lib/crypto";
import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { redact } from "../lib/redact";
import { gateways, liveEnabled } from "../payments/registry";
import type { CanonicalPaymentStatus, GatewayId, NormalizedWebhook } from "../payments/types";
import { GatewayError, parseBody } from "../payments/types";
import { audit, auditStatement } from "./audit";
import { activateSubscriptionForIntent } from "./billing";
import { invoiceForIntent, invoiceStatement } from "./invoices";

export interface IntentRow { id: string; purpose?: string; org_id: string; user_id: string; offer_id: string | null; provider: string; mode: string; merchant_order_id: string; provider_transaction_id: string | null; amount: number; currency: string; status: string }

export const isProductionEnv = (env: Env) => (env.APP_ENV ?? "production") === "production";

/** Creates a payment intent + project invoice for an ACCEPTED quote. Amount is always derived server-side from the frozen quote. */
export async function createIntent(env: Env, d: D1Database, p: Principal, args: { offerId: string; provider: GatewayId; paymentMethod?: string | null; idempotencyKey: string | null; origin: string; requestId: string; customer: { name: string; email: string; phone?: string | null } }) {
  if (args.idempotencyKey) {
    const existing = await d.prepare("SELECT id,merchant_order_id,provider,mode,amount,currency,status,checkout_url FROM payment_intents WHERE user_id=? AND idempotency_key=?").bind(p.userId, args.idempotencyKey).first();
    if (existing) return { ...existing, replayed: true };
  }
  const offer = await d.prepare("SELECT id,customer_org_id,status,price_minor,tax_minor,currency,title,version,service_layer,accepted_snapshot_hash,snapshot_hash FROM offers WHERE id=?").bind(args.offerId)
    .first<{ id: string; customer_org_id: string | null; status: string; price_minor: number; tax_minor: number; currency: string; title: string; version: number; service_layer: string; accepted_snapshot_hash: string | null; snapshot_hash: string | null }>();
  if (!offer || !offer.customer_org_id || !p.orgIds.includes(offer.customer_org_id)) fail(404, "OFFER_NOT_FOUND");
  if (offer!.status !== "accepted") fail(409, "OFFER_NOT_ACCEPTED", "Accept the quote terms before paying.");
  if (offer!.accepted_snapshot_hash && offer!.snapshot_hash && offer!.accepted_snapshot_hash !== offer!.snapshot_hash) fail(409, "QUOTE_INTEGRITY_ERROR");
  const open = await d.prepare("SELECT id FROM payment_intents WHERE offer_id=? AND status IN ('CREATED','PENDING','SUCCEEDED','REFUND_PENDING','RECONCILIATION_REQUIRED')").bind(offer!.id).first();
  if (open) fail(409, "PAYMENT_ALREADY_OPEN", "An open or completed payment already exists for this quote.");
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
  const mode = live ? "live" : "mock";
  const kind = offer!.service_layer === "managed" ? "managed" : "project";
  await d.batch([
    d.prepare(`INSERT INTO payment_intents (id,org_id,user_id,offer_id,provider,mode,merchant_order_id,provider_transaction_id,provider_reference,amount,currency,description,status,checkout_url,idempotency_key,purpose)
      VALUES (?,?,?,?,?,?,?,?,?,?,'IDR',?,?,?,?,?)`).bind(intentId, offer!.customer_org_id, p.userId, offer!.id, live ? args.provider : "mock", mode, orderId,
      result.providerTransactionId, result.reference, amount, offer!.title.slice(0, 120), "PENDING", result.checkoutUrl, args.idempotencyKey, kind === "managed" ? "managed" : "offer"),
    invoiceStatement(d, { orgId: offer!.customer_org_id!, kind, offerId: offer!.id, paymentIntentId: intentId, description: `${offer!.title} (v${offer!.version})`, subtotal: offer!.price_minor, tax: offer!.tax_minor, mode }),
    auditStatement(d, { requestId: args.requestId, actorUserId: p.userId, action: "payment_intent.created", resourceType: "payment_intent", resourceId: intentId, orgId: offer!.customer_org_id, metadata: { provider: args.provider, mode, amount } }),
  ]);
  return { id: intentId, merchant_order_id: orderId, provider: live ? args.provider : "mock", mode, amount, currency: "IDR", status: "PENDING", checkout_url: result.checkoutUrl,
    notice: live ? null : "MODE UJI — tidak ada tagihan nyata. Pembayaran live terkunci sampai pemilik mengaktifkannya." };
}

/** Splits a verified receipt into revenue-side (unearned) and tax payable. Gross checkout is never revenue. */
async function receiptLines(d: D1Database, intent: IntentRow): Promise<JournalLine[]> {
  const inv = await invoiceForIntent(d, intent.id);
  const tax = inv && inv.total_minor === intent.amount ? inv.tax_minor : 0;
  const lines: JournalLine[] = [{ accountId: "acct-gateway-clearing", direction: "debit", amount: intent.amount }, { accountId: "acct-unearned-revenue", direction: "credit", amount: intent.amount - tax }];
  if (tax > 0) lines.push({ accountId: "acct-tax-payable", direction: "credit", amount: tax });
  return lines;
}

/**
 * The ONLY path that changes a payment's canonical status (webhook, provider reconciliation, approved manual resolution, sandbox simulator).
 * Enforces out-of-order protection, posts the receipt journal on verified success, marks the invoice and activates subscriptions.
 */
export async function applyPaymentStatus(d: D1Database, intent: IntentRow, target: string, ctx: { actor: string | null; requestId: string; source: string; providerTransactionId?: string | null; note?: string | null }) {
  if (!paymentTransitionAllowed(intent.status, target)) return { applied: false, status: intent.status };
  const upd = await d.prepare("UPDATE payment_intents SET status=?, provider_transaction_id=COALESCE(provider_transaction_id,?), verified_at=CASE WHEN ?='SUCCEEDED' THEN datetime('now') ELSE verified_at END, updated_at=datetime('now') WHERE id=? AND status=?")
    .bind(target, ctx.providerTransactionId ?? null, target, intent.id, intent.status).run();
  if (upd.meta.changes !== 1) return { applied: false, status: intent.status };
  const sandbox = intent.mode !== "live";
  if (target === "SUCCEEDED") {
    await postJournal(d, { sourceType: "payment_succeeded", sourceId: intent.id, createdBy: ctx.actor, description: `${sandbox ? "[SANDBOX] " : ""}Verified payment ${intent.merchant_order_id} via ${ctx.source}`, lines: await receiptLines(d, intent) });
    await d.prepare("UPDATE invoices SET status='paid', paid_at=datetime('now') WHERE payment_intent_id=? AND status='issued'").bind(intent.id).run();
    if (intent.purpose === "subscription") await activateSubscriptionForIntent(d, intent);
  }
  if (target === "REFUNDED") await postRefundJournal(d, intent);
  await audit(d, { requestId: ctx.requestId, actorUserId: ctx.actor, actorType: ctx.actor ? "user" : "provider", action: "payment.status_changed", resourceType: "payment_intent", resourceId: intent.id, orgId: intent.org_id, metadata: { from: intent.status, to: target, source: ctx.source, note: ctx.note ?? null, sandbox } });
  return { applied: true, status: target };
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
  if (target === "SUCCEEDED" && !(await confirmWithProvider(env, provider, intent))) target = "RECONCILIATION_REQUIRED";
  const res = await applyPaymentStatus(d, intent, target, { actor: null, requestId, source: `webhook:${provider}`, providerTransactionId: normalized.providerTransactionId });
  if (!res.applied) { await setOutcome(`ignored:${intent.status}->${target}`); return { outcome: "ignored_regression", status: intent.status }; }
  await setOutcome(mismatch ? `reconciliation:${mismatch}` : `applied:${target}`);
  return { outcome: target === "RECONCILIATION_REQUIRED" ? "reconciliation_required" : "applied", status: target };
}

export function reconcileMismatch(intent: Pick<IntentRow, "merchant_order_id" | "amount" | "currency">, n: Pick<NormalizedWebhook, "orderId" | "amount" | "currency" | "status">): string | null {
  if (n.orderId !== intent.merchant_order_id) return "order";
  if (n.amount !== null && n.amount !== intent.amount) return "amount";
  if (n.status === "SUCCEEDED" && n.amount === null) return "amount_missing";
  if (n.currency && n.currency.toUpperCase() !== intent.currency) return "currency";
  return null;
}

async function confirmWithProvider(env: Env, provider: GatewayId, intent: IntentRow): Promise<boolean> {
  const gateway = gateways[provider];
  if (!gateway.getProviderCapabilities(env).statusInquiry) return true; // signed callback is the only available proof (recorded in capabilities)
  try {
    const s = await gateway.getPaymentStatus(env, intent.merchant_order_id, intent.provider_transaction_id);
    return s.status === "SUCCEEDED" && (s.amount === null || s.amount === intent.amount);
  } catch { return false; }
}

async function postRefundJournal(d: D1Database, intent: IntentRow) {
  const recognized = await d.prepare("SELECT 1 AS x FROM ledger_journals WHERE source_type IN ('revenue_recognized','subscription_revenue') AND source_id=?").bind(intent.id).first();
  const inv = await invoiceForIntent(d, intent.id);
  const tax = inv && inv.total_minor === intent.amount ? inv.tax_minor : 0;
  const revenueAccount = intent.purpose === "subscription" ? "acct-subscription-revenue" : intent.purpose === "managed" ? "acct-managed-revenue" : "acct-platform-revenue";
  const lines: JournalLine[] = [{ accountId: recognized ? revenueAccount : "acct-unearned-revenue", direction: "debit", amount: intent.amount - tax }, { accountId: "acct-gateway-clearing", direction: "credit", amount: intent.amount }];
  if (tax > 0) lines.push({ accountId: "acct-tax-payable", direction: "debit", amount: tax });
  await postJournal(d, { sourceType: "payment_refunded", sourceId: intent.id, description: `Refund of ${intent.merchant_order_id}`, lines });
  await d.prepare("UPDATE invoices SET status='refunded' WHERE payment_intent_id=?").bind(intent.id).run();
}

/** Revenue recognized only on verified payment + explicit customer acceptance. Tax is never revenue. */
export async function recognizeRevenueForOffer(d: D1Database, offerId: string, actor: string | null) {
  const intent = await d.prepare("SELECT id,amount,merchant_order_id,purpose,mode FROM payment_intents WHERE offer_id=? AND purpose IN ('offer','managed') AND status='SUCCEEDED'").bind(offerId)
    .first<{ id: string; amount: number; merchant_order_id: string; purpose: string; mode: string }>();
  if (!intent) return null;
  const inv = await invoiceForIntent(d, intent.id);
  const net = intent.amount - (inv && inv.total_minor === intent.amount ? inv.tax_minor : 0);
  return postJournal(d, { sourceType: "revenue_recognized", sourceId: intent.id, createdBy: actor, description: `${intent.mode !== "live" ? "[SANDBOX] " : ""}Revenue recognized on acceptance (${intent.merchant_order_id})`,
    lines: [{ accountId: "acct-unearned-revenue", direction: "debit", amount: net }, { accountId: intent.purpose === "managed" ? "acct-managed-revenue" : "acct-platform-revenue", direction: "credit", amount: net }] });
}

/** Re-queries the provider for a live intent and applies the verified status (operator reconciliation). */
export async function reconcileIntent(env: Env, d: D1Database, intentId: string, actor: string, requestId: string) {
  const intent = await d.prepare("SELECT * FROM payment_intents WHERE id=?").bind(intentId).first<IntentRow>();
  if (!intent) fail(404, "PAYMENT_NOT_FOUND");
  if (intent!.mode !== "live") fail(409, "MOCK_PAYMENT", "Sandbox intents have no provider record; use an approved manual resolution.");
  const gateway = gateways[intent!.provider as GatewayId];
  let s;
  try { s = await gateway.getPaymentStatus(env, intent!.merchant_order_id, intent!.provider_transaction_id); }
  catch (error) { fail(502, error instanceof GatewayError ? error.code : "GATEWAY_ERROR"); }
  const amountOk = s!.amount === null || s!.amount === intent!.amount;
  const target = !amountOk ? "RECONCILIATION_REQUIRED" : s!.status === "UNKNOWN" ? intent!.status : s!.status;
  const res = target !== intent!.status ? await applyPaymentStatus(d, intent!, target, { actor, requestId, source: "provider_reconciliation", providerTransactionId: s!.providerTransactionId }) : { applied: false, status: intent!.status };
  await audit(d, { requestId, actorUserId: actor, action: "payment.reconciled", resourceType: "payment_intent", resourceId: intent!.id, metadata: { providerStatus: s!.status, amountOk, applied: res.applied } });
  return { providerStatus: s!.status, amountMatches: amountOk, status: res.status };
}
