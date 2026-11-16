import type { Env } from "../../env";
import { digestHex, safeEqual } from "../../lib/crypto";
import type { CanonicalPaymentStatus, GatewayCapabilities, NormalizedWebhook, PaymentGateway, PaymentIntentRequest, PaymentIntentResult, PaymentStatusResult } from "../types";
import { GatewayError, idrFromProvider } from "../types";

/** Midtrans Snap + Core status/refund. Notification signature SHA512(order_id+status_code+gross_amount+ServerKey) (docs reviewed 2026-11-15). */
const snapBase = (env: Env) => (env.MIDTRANS_BASE_URL || "https://app.sandbox.midtrans.com").replace(/\/$/, "");
const apiBase = (env: Env) => (env.MIDTRANS_API_BASE_URL || "https://api.sandbox.midtrans.com").replace(/\/$/, "");
const auth = (env: Env) => "Basic " + btoa(`${env.MIDTRANS_SERVER_KEY}:`);

export function midtransStatus(transactionStatus: string, fraudStatus?: string | null): CanonicalPaymentStatus {
  const t = transactionStatus.toLowerCase();
  if (t === "settlement") return "SUCCEEDED";
  if (t === "capture") return !fraudStatus || fraudStatus.toLowerCase() === "accept" ? "SUCCEEDED" : "PENDING";
  if (t === "pending" || t === "authorize") return "PENDING";
  if (t === "deny" || t === "cancel" || t === "failure") return "FAILED";
  if (t === "expire") return "EXPIRED";
  if (t === "refund") return "REFUNDED";
  if (t === "partial_refund") return "REFUND_PENDING";
  return "UNKNOWN";
}
export const midtransSignature = (orderId: string, statusCode: string, grossAmount: string, serverKey: string) =>
  digestHex("SHA-512", `${orderId}${statusCode}${grossAmount}${serverKey}`);

export class MidtransGateway implements PaymentGateway {
  id = "midtrans" as const;
  isConfigured(env: Env) { return Boolean(env.MIDTRANS_SERVER_KEY); }
  getProviderCapabilities(): GatewayCapabilities {
    return { collection: true, statusInquiry: true, webhook: true, refund: true, settlementReport: false, payout: false, split: false,
      verification: "official-docs-reviewed", notes: "Refund availability depends on payment method; requires owner approval per refund. Sandbox contract test pending merchant credentials." };
  }
  async createPaymentIntent(env: Env, req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const res = await fetch(`${snapBase(env)}/snap/v1/transactions`, {
      method: "POST", headers: { authorization: auth(env), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ transaction_details: { order_id: req.orderId, gross_amount: req.amount },
        customer_details: { first_name: req.customer.name, email: req.customer.email || undefined, phone: req.customer.phone || undefined },
        callbacks: { finish: req.returnUrl }, expiry: { unit: "minutes", duration: req.expiryMinutes } }),
    });
    const b = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok || !b.redirect_url) throw new GatewayError("GATEWAY_REJECTED", `Midtrans Snap failed (HTTP ${res.status})`);
    return { providerTransactionId: null, checkoutUrl: b.redirect_url, reference: b.token ?? null, status: "PENDING" };
  }
  async getPaymentStatus(env: Env, orderId: string): Promise<PaymentStatusResult> {
    const res = await fetch(`${apiBase(env)}/v2/${encodeURIComponent(orderId)}/status`, { headers: { authorization: auth(env), accept: "application/json" } });
    const b = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok) throw new GatewayError("GATEWAY_HTTP_" + res.status);
    return { orderId, status: midtransStatus(b.transaction_status ?? "", b.fraud_status), amount: idrFromProvider(b.gross_amount), currency: b.currency ?? "IDR", providerTransactionId: b.transaction_id ?? null };
  }
  async verifyAndNormalizeWebhook(env: Env, _headers: Headers, rawBody: string): Promise<NormalizedWebhook | null> {
    if (!env.MIDTRANS_SERVER_KEY) return null;
    let p: Record<string, string>;
    try { p = JSON.parse(rawBody); } catch { return null; }
    if (!p.order_id || !p.status_code || !p.gross_amount || !p.signature_key) return null;
    const expected = await midtransSignature(p.order_id, p.status_code, p.gross_amount, env.MIDTRANS_SERVER_KEY);
    if (!safeEqual(expected, String(p.signature_key).toLowerCase())) return null;
    return { eventId: `${p.transaction_id || p.order_id}:${p.transaction_status}:${p.status_code}`, orderId: p.order_id, providerTransactionId: p.transaction_id || null,
      status: midtransStatus(p.transaction_status ?? "", p.fraud_status), amount: idrFromProvider(p.gross_amount), currency: p.currency || "IDR", merchantId: p.merchant_id || null, eventType: "midtrans.notification" };
  }
  async requestRefund(env: Env, orderId: string, amount: number, reason: string) {
    const res = await fetch(`${apiBase(env)}/v2/${encodeURIComponent(orderId)}/refund`, {
      method: "POST", headers: { authorization: auth(env), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refund_key: `rf-${orderId}-${amount}`, amount, reason: reason.slice(0, 200) }),
    });
    const b = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok || (b.status_code && !b.status_code.startsWith("2"))) throw new GatewayError("REFUND_REJECTED", `Midtrans refund failed (${b.status_code ?? res.status})`);
    return { providerRefundId: b.refund_key ?? null, status: "submitted" };
  }
  async getSettlementReport(): Promise<never> { throw new GatewayError("UNSUPPORTED", "Midtrans settlement reports are dashboard exports; not available via approved API scope."); }
  async createPayoutRequest(): Promise<never> { throw new GatewayError("UNSUPPORTED", "Midtrans payout (Iris) not approved."); }
}
