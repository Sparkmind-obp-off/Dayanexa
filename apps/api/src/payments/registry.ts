import type { Env } from "../env";
import { flag } from "../lib/http";
import { DuitkuGateway } from "./gateways/duitku";
import { FaspayGateway } from "./gateways/faspay";
import { MidtransGateway } from "./gateways/midtrans";
import { XenditGateway } from "./gateways/xendit";
import type { GatewayId, PaymentGateway } from "./types";
import { GATEWAY_IDS } from "./types";

export const gateways: Record<GatewayId, PaymentGateway> = {
  duitku: new DuitkuGateway(), xendit: new XenditGateway(), midtrans: new MidtransGateway(), faspay: new FaspayGateway(),
};
/** Live requires BOTH switches; any other combination stays mock. */
export const liveEnabled = (env: Env) => env.PAYMENTS_MODE === "live" && flag(env.PAYMENT_LIVE_ENABLED);
export function paymentRegistry(env: Env) {
  const live = liveEnabled(env);
  return {
    mode: live ? "live" : "mock",
    liveLocked: !live,
    gateways: GATEWAY_IDS.map((id) => ({ id, configured: gateways[id].isConfigured(env), liveEnabled: live && gateways[id].isConfigured(env), capabilities: gateways[id].getProviderCapabilities(env) })),
  };
}
