import type { Env } from "../../env";
import { flag } from "../../lib/http";
import { digestHex, md5Hex, safeEqual } from "../../lib/crypto";
import type { CanonicalPaymentStatus, GatewayCapabilities, NormalizedWebhook, PaymentGateway, PaymentIntentRequest, PaymentIntentResult, PaymentStatusResult } from "../types";
import { GatewayError, idrFromProvider, parseBody, unsupported } from "../types";

/**
 * Faspay Debit. Endpoint, channels and callback format are MERCHANT-CONTRACT SPECIFIC.
 * Fails closed unless FASPAY_CONTRACT_VERIFIED=true after the owner supplies the approved merchant spec.
 */
export const faspaySignature = (user: string, password: string, ...parts: string[]) => digestHex("SHA-1", md5Hex(user + password + parts.join("")));
const status = (code: string): CanonicalPaymentStatus => ({ "2": "SUCCEEDED", "1": "PENDING", "3": "FAILED", "7": "EXPIRED", "8": "FAILED", "4": "REFUNDED" } as Record<string, CanonicalPaymentStatus>)[code] ?? "UNKNOWN";

export class FaspayGateway implements PaymentGateway {
  id = "faspay" as const;
  isConfigured(env: Env) {
    return Boolean(env.FASPAY_MERCHANT_ID && env.FASPAY_MERCHANT_NAME && env.FASPAY_USER_ID && env.FASPAY_PASSWORD && env.FASPAY_PAYMENT_CHANNEL && env.FASPAY_DEBIT_ENDPOINT && flag(env.FASPAY_CONTRACT_VERIFIED));
  }
  getProviderCapabilities(env: Env): GatewayCapabilities {
    return { collection: flag(env.FASPAY_CONTRACT_VERIFIED), statusInquiry: false, webhook: flag(env.FASPAY_CONTRACT_VERIFIED), refund: false, settlementReport: false, payout: false, split: false,
      verification: "merchant-spec-required", notes: "Adapter fails closed until the approved merchant API spec is supplied and FASPAY_CONTRACT_VERIFIED=true. Endpoint/fields are not invented." };
  }
  private guard(env: Env) { if (!this.isConfigured(env)) throw new GatewayError("GATEWAY_NOT_VERIFIED", "Faspay merchant contract not verified."); }
  async createPaymentIntent(env: Env, req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    this.guard(env);
    const now = new Date(), fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    const res = await fetch(env.FASPAY_DEBIT_ENDPOINT!, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Post Data Transaction", merchant_id: env.FASPAY_MERCHANT_ID, merchant: env.FASPAY_MERCHANT_NAME, bill_no: req.orderId, bill_reff: req.orderId,
        bill_date: fmt(now), bill_expired: fmt(new Date(now.getTime() + req.expiryMinutes * 60_000)), bill_desc: req.description.slice(0, 128), bill_currency: "IDR",
        bill_gross: String(req.amount), bill_miscfee: "0", bill_total: String(req.amount), payment_channel: env.FASPAY_PAYMENT_CHANNEL, pay_type: "1",
        cust_no: req.orderId, cust_name: req.customer.name, msisdn: req.customer.phone || "", email: req.customer.email, terminal: "10",
        signature: await faspaySignature(env.FASPAY_USER_ID!, env.FASPAY_PASSWORD!, req.orderId) }),
    });
    const b = await res.json().catch(() => ({})) as Record<string, string>;
    if (!res.ok || b.response_code !== "00") throw new GatewayError("GATEWAY_REJECTED", "Faspay rejected the request.");
    return { providerTransactionId: b.trx_id ?? null, checkoutUrl: b.redirect_url ?? null, reference: b.trx_id ?? null, status: "PENDING" };
  }
  async getPaymentStatus(): Promise<PaymentStatusResult> { return unsupported("Faspay", "status inquiry until merchant spec verified"); }
  async verifyAndNormalizeWebhook(env: Env, headers: Headers, rawBody: string): Promise<NormalizedWebhook | null> {
    if (!this.isConfigured(env)) return null;
    const p = parseBody(rawBody, headers.get("content-type"));
    if (!p.bill_no || !p.payment_status_code || !p.signature) return null;
    if (p.merchant_id && p.merchant_id !== env.FASPAY_MERCHANT_ID) return null;
    const expected = await faspaySignature(env.FASPAY_USER_ID!, env.FASPAY_PASSWORD!, p.bill_no, p.payment_status_code);
    if (!safeEqual(expected, String(p.signature).toLowerCase())) return null;
    return { eventId: `${p.trx_id}:${p.payment_status_code}`, orderId: p.bill_no, providerTransactionId: p.trx_id || null, status: status(p.payment_status_code),
      amount: idrFromProvider(p.payment_total ?? p.bill_total), currency: "IDR", merchantId: p.merchant_id || null, eventType: "faspay.notification" };
  }
  async requestRefund() { return unsupported("Faspay", "refund"); }
  async getSettlementReport() { return unsupported("Faspay", "settlement report"); }
  async createPayoutRequest(): Promise<never> { return unsupported("Faspay", "payout"); }
}
