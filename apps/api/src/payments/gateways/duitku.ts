import type { Env } from "../../env";
import { hmacHex, safeEqual } from "../../lib/crypto";
import type { GatewayCapabilities, NormalizedWebhook, PaymentGateway, PaymentIntentRequest, PaymentIntentResult, PaymentStatusResult } from "../types";
import { GatewayError, idrFromProvider, parseBody, unsupported } from "../types";

/** Duitku POP/API v2. Signatures: HMAC-SHA256 hex (docs.duitku.com, reviewed 2026-11-15; MD5 is obsolete). */
const base = (env: Env) => (env.DUITKU_BASE_URL || "https://sandbox.duitku.com").replace(/\/$/, "");
export const duitkuSign = {
  inquiry: (key: string, merchantCode: string, orderId: string, amount: number) => hmacHex("SHA-256", key, `${merchantCode}${orderId}${amount}`),
  callback: (key: string, merchantCode: string, amount: string, orderId: string) => hmacHex("SHA-256", key, `${merchantCode}${amount}${orderId}`),
  status: (key: string, merchantCode: string, orderId: string) => hmacHex("SHA-256", key, `${merchantCode}${orderId}`),
};
const statusFromResult = (code: string) => code === "00" ? "SUCCEEDED" : code === "01" ? "FAILED" : "UNKNOWN";

export class DuitkuGateway implements PaymentGateway {
  id = "duitku" as const;
  isConfigured(env: Env) { return Boolean(env.DUITKU_MERCHANT_CODE && env.DUITKU_API_KEY); }
  getProviderCapabilities(): GatewayCapabilities {
    return { collection: true, statusInquiry: true, webhook: true, refund: false, settlementReport: false, payout: false, split: false,
      verification: "official-docs-reviewed", notes: "Refund/disbursement are separate merchant products; not enabled. Sandbox contract test pending merchant credentials." };
  }
  async createPaymentIntent(env: Env, req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const merchantCode = env.DUITKU_MERCHANT_CODE!, key = env.DUITKU_API_KEY!;
    const res = await fetch(`${base(env)}/webapi/api/merchant/v2/inquiry`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchantCode, paymentAmount: req.amount, paymentMethod: req.paymentMethod || "VC", merchantOrderId: req.orderId,
        productDetails: req.description, email: req.customer.email, phoneNumber: req.customer.phone ?? "", customerVaName: req.customer.name,
        callbackUrl: req.callbackUrl, returnUrl: req.returnUrl, expiryPeriod: req.expiryMinutes,
        signature: await duitkuSign.inquiry(key, merchantCode, req.orderId, req.amount) }),
    });
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok || body.statusCode !== "00") throw new GatewayError("GATEWAY_REJECTED", `Duitku inquiry failed (HTTP ${res.status})`);
    return { providerTransactionId: body.reference ?? null, checkoutUrl: body.paymentUrl ?? null, reference: body.reference ?? null, status: "PENDING" };
  }
  async getPaymentStatus(env: Env, orderId: string): Promise<PaymentStatusResult> {
    const merchantCode = env.DUITKU_MERCHANT_CODE!, key = env.DUITKU_API_KEY!;
    const res = await fetch(`${base(env)}/webapi/api/merchant/transactionStatus`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ merchantCode, merchantOrderId: orderId, signature: await duitkuSign.status(key, merchantCode, orderId) }),
    });
    const b = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok) throw new GatewayError("GATEWAY_HTTP_" + res.status);
    const status = b.statusCode === "00" ? "SUCCEEDED" : b.statusCode === "01" ? "PENDING" : b.statusCode === "02" ? "FAILED" : "UNKNOWN";
    return { orderId, status, amount: idrFromProvider(b.amount), currency: "IDR", providerTransactionId: b.reference ?? null };
  }
  async verifyAndNormalizeWebhook(env: Env, headers: Headers, rawBody: string): Promise<NormalizedWebhook | null> {
    if (!this.isConfigured(env)) return null;
    const p = parseBody(rawBody, headers.get("content-type"));
    if (!p.merchantCode || !p.amount || !p.merchantOrderId || !p.signature) return null;
    if (p.merchantCode !== env.DUITKU_MERCHANT_CODE) return null;
    const expected = await duitkuSign.callback(env.DUITKU_API_KEY!, p.merchantCode, p.amount, p.merchantOrderId);
    if (!safeEqual(expected, String(p.signature).toLowerCase())) return null;
    return { eventId: `${p.reference || p.merchantOrderId}:${p.resultCode}`, orderId: p.merchantOrderId, providerTransactionId: p.reference || null,
      status: statusFromResult(p.resultCode), amount: idrFromProvider(p.amount), currency: "IDR", merchantId: p.merchantCode, eventType: "duitku.callback" };
  }
  async requestRefund() { return unsupported("Duitku", "refund via API"); }
  async getSettlementReport() { return unsupported("Duitku", "settlement report via API"); }
  async createPayoutRequest(): Promise<never> { return unsupported("Duitku", "payout (disbursement product not approved)"); }
}
