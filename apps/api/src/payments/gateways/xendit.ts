import type { Env } from "../../env";
import { safeEqual } from "../../lib/crypto";
import type { CanonicalPaymentStatus, GatewayCapabilities, NormalizedWebhook, PaymentGateway, PaymentIntentRequest, PaymentIntentResult, PaymentStatusResult } from "../types";
import { GatewayError, unsupported } from "../types";

/** Xendit Invoice API (v2). Callback token verified separately from API secret. xenPlatform/split NOT enabled. */
const base = (env: Env) => (env.XENDIT_BASE_URL || "https://api.xendit.co").replace(/\/$/, "");
const auth = (env: Env) => "Basic " + btoa(`${env.XENDIT_SECRET_KEY}:`);
export const xenditStatus = (s: string): CanonicalPaymentStatus => {
  const v = s.toUpperCase();
  if (v === "PAID" || v === "SETTLED") return "SUCCEEDED";
  if (v === "EXPIRED") return "EXPIRED";
  if (v === "PENDING") return "PENDING";
  return "UNKNOWN";
};

export class XenditGateway implements PaymentGateway {
  id = "xendit" as const;
  isConfigured(env: Env) { return Boolean(env.XENDIT_SECRET_KEY && env.XENDIT_CALLBACK_TOKEN); }
  getProviderCapabilities(): GatewayCapabilities {
    return { collection: true, statusInquiry: true, webhook: true, refund: false, settlementReport: false, payout: false, split: false,
      verification: "known-contract-unverified", notes: "Invoice API per known contract; official docs crawl unavailable 2026-11-15 — sandbox contract test REQUIRED before activation. Refunds are per payment-method products. xenPlatform/subaccounts disabled pending eligibility." };
  }
  async createPaymentIntent(env: Env, req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const res = await fetch(`${base(env)}/v2/invoices`, {
      method: "POST", headers: { authorization: auth(env), "content-type": "application/json" },
      body: JSON.stringify({ external_id: req.orderId, amount: req.amount, currency: req.currency, description: req.description, payer_email: req.customer.email || undefined,
        invoice_duration: req.expiryMinutes * 60, success_redirect_url: req.returnUrl, failure_redirect_url: req.returnUrl, customer: { given_names: req.customer.name } }),
    });
    const b = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok) throw new GatewayError("GATEWAY_REJECTED", `Xendit invoice failed (HTTP ${res.status})`);
    return { providerTransactionId: b.id ?? null, checkoutUrl: b.invoice_url ?? null, reference: b.external_id ?? null, status: "PENDING" };
  }
  async getPaymentStatus(env: Env, orderId: string, providerTransactionId: string | null): Promise<PaymentStatusResult> {
    if (!providerTransactionId) throw new GatewayError("MISSING_PROVIDER_ID");
    const res = await fetch(`${base(env)}/v2/invoices/${encodeURIComponent(providerTransactionId)}`, { headers: { authorization: auth(env) } });
    const b = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) throw new GatewayError("GATEWAY_HTTP_" + res.status);
    if (b.external_id !== orderId) throw new GatewayError("ORDER_MISMATCH");
    return { orderId, status: xenditStatus(String(b.status ?? "")), amount: typeof b.amount === "number" ? b.amount : null, currency: String(b.currency ?? "IDR"), providerTransactionId };
  }
  async verifyAndNormalizeWebhook(env: Env, headers: Headers, rawBody: string): Promise<NormalizedWebhook | null> {
    if (!env.XENDIT_CALLBACK_TOKEN || !safeEqual(env.XENDIT_CALLBACK_TOKEN, headers.get("x-callback-token") ?? "")) return null;
    let p: Record<string, unknown>;
    try { p = JSON.parse(rawBody); } catch { return null; }
    if (typeof p.external_id !== "string" || typeof p.id !== "string") return null;
    const paid = typeof p.paid_amount === "number" ? p.paid_amount : typeof p.amount === "number" ? p.amount : null;
    return { eventId: `${p.id}:${p.status}`, orderId: p.external_id, providerTransactionId: p.id, status: xenditStatus(String(p.status ?? "")),
      amount: paid, currency: typeof p.currency === "string" ? p.currency : null, merchantId: typeof p.user_id === "string" ? p.user_id : null, eventType: "xendit.invoice" };
  }
  async requestRefund() { return unsupported("Xendit", "invoice refund (method-specific refund products not approved)"); }
  async getSettlementReport() { return unsupported("Xendit", "settlement report"); }
  async createPayoutRequest(): Promise<never> { return unsupported("Xendit", "payout (xenPlatform not approved)"); }
}
