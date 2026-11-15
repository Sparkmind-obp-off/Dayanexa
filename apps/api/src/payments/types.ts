export type GatewayId = "duitku" | "xendit" | "midtrans" | "faspay";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "expired" | "reversed" | "unknown";

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: "IDR";
  description: string;
  customer: { name: string; email: string; phone?: string };
  paymentMethod?: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface GatewayResult {
  provider: GatewayId;
  providerTransactionId: string;
  checkoutUrl?: string;
  reference?: string;
  status: PaymentStatus;
}

export interface NormalizedWebhook {
  eventId: string;
  orderId: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  eventType: string;
}

export interface GatewayEnv {
  DUITKU_MERCHANT_CODE?: string;
  DUITKU_API_KEY?: string;
  DUITKU_BASE_URL?: string;
  XENDIT_SECRET_KEY?: string;
  XENDIT_BASE_URL?: string;
  MIDTRANS_SERVER_KEY?: string;
  MIDTRANS_BASE_URL?: string;
  FASPAY_MERCHANT_ID?: string;
  FASPAY_MERCHANT_NAME?: string;
  FASPAY_USER_ID?: string;
  FASPAY_PASSWORD?: string;
  FASPAY_PAYMENT_CHANNEL?: string;
  FASPAY_DEBIT_ENDPOINT?: string;
}

export interface PaymentGateway {
  id: GatewayId;
  isConfigured(env: GatewayEnv): boolean;
  createPayment(env: GatewayEnv, request: PaymentRequest): Promise<GatewayResult>;
  verifyWebhook(env: GatewayEnv, headers: Headers, payload: Record<string, unknown>): Promise<boolean>;
  normalizeWebhook(payload: Record<string, unknown>): NormalizedWebhook;
}
