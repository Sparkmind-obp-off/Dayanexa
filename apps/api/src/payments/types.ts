import type { Env } from "../env";

export type GatewayId = "duitku" | "xendit" | "midtrans" | "faspay";
export const GATEWAY_IDS: GatewayId[] = ["duitku", "xendit", "midtrans", "faspay"];
export type CanonicalPaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "REFUND_PENDING" | "REFUNDED" | "DISPUTED" | "UNKNOWN";

export interface PaymentIntentRequest {
  orderId: string; amount: number; currency: "IDR"; description: string;
  customer: { name: string; email: string; phone?: string | null };
  paymentMethod?: string | null; callbackUrl: string; returnUrl: string; expiryMinutes: number;
}
export interface PaymentIntentResult { providerTransactionId: string | null; checkoutUrl: string | null; reference: string | null; status: CanonicalPaymentStatus; raw?: unknown }
export interface PaymentStatusResult { orderId: string; status: CanonicalPaymentStatus; amount: number | null; currency: string | null; providerTransactionId: string | null; raw?: unknown }
export interface NormalizedWebhook {
  eventId: string; orderId: string; providerTransactionId: string | null; status: CanonicalPaymentStatus;
  amount: number | null; currency: string | null; merchantId: string | null; eventType: string;
}
export interface GatewayCapabilities {
  collection: boolean; statusInquiry: boolean; webhook: boolean; refund: boolean; settlementReport: boolean; payout: boolean; split: boolean;
  verification: "official-docs-reviewed" | "known-contract-unverified" | "merchant-spec-required";
  notes: string;
}
export class GatewayError extends Error { constructor(public code: string, message?: string) { super(message ?? code); } }

/** Single normalized DAYANEXA payment interface. Unsupported operations throw UNSUPPORTED — never emulated. */
export interface PaymentGateway {
  id: GatewayId;
  isConfigured(env: Env): boolean;
  getProviderCapabilities(env: Env): GatewayCapabilities;
  createPaymentIntent(env: Env, req: PaymentIntentRequest): Promise<PaymentIntentResult>;
  getPaymentStatus(env: Env, orderId: string, providerTransactionId: string | null): Promise<PaymentStatusResult>;
  verifyAndNormalizeWebhook(env: Env, headers: Headers, rawBody: string): Promise<NormalizedWebhook | null>;
  requestRefund(env: Env, orderId: string, amount: number, reason: string): Promise<{ providerRefundId: string | null; status: string }>;
  getSettlementReport(env: Env, date: string): Promise<unknown>;
  createPayoutRequest(env: Env): Promise<never>;
}
export const unsupported = (gateway: string, op: string): never => { throw new GatewayError("UNSUPPORTED", `${gateway} does not support ${op} in DAYANEXA's approved scope.`); };
export const parseBody = (rawBody: string, contentType: string | null): Record<string, string> => {
  if ((contentType ?? "").includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(rawBody));
  try { const v = JSON.parse(rawBody); return v && typeof v === "object" ? v as Record<string, string> : {}; } catch { return Object.fromEntries(new URLSearchParams(rawBody)); }
};
/** Parses a provider decimal amount string ("10000.00") to integer IDR, rejecting fractional rupiah. */
export function idrFromProvider(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac && Number(frac) !== 0) return null;
  return Number(whole);
}
