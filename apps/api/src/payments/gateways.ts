import { digestHex, md5Hex, safeEqual } from "./crypto";
import type { GatewayEnv, GatewayId, GatewayResult, NormalizedWebhook, PaymentGateway, PaymentRequest } from "./types";

const json = (value: unknown) => JSON.stringify(value);
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const str = (value: unknown) => value == null ? "" : String(value);
const statusFrom = (value: unknown): NormalizedWebhook["status"] => {
  const status = str(value).toLowerCase();
  if (["paid","settlement","capture","success","succeeded","2"].includes(status)) return "succeeded";
  if (["expire","expired","7"].includes(status)) return "expired";
  if (["deny","cancel","failure","failed","3","8"].includes(status)) return "failed";
  if (["refund","reversal","4"].includes(status)) return "reversed";
  return "pending";
};
async function postJson(url: string, headers: Record<string,string>, body: unknown): Promise<Record<string,unknown>> {
  const response = await fetch(url, { method:"POST", headers:{"content-type":"application/json",...headers}, body:json(body) });
  const text = await response.text();
  let parsed: Record<string,unknown>;
  try { parsed = record(JSON.parse(text)); } catch { throw new Error("GATEWAY_INVALID_RESPONSE"); }
  if (!response.ok) throw new Error(`GATEWAY_HTTP_${response.status}`);
  return parsed;
}

export class DuitkuGateway implements PaymentGateway {
  id: GatewayId = "duitku";
  isConfigured(env: GatewayEnv) { return Boolean(env.DUITKU_MERCHANT_CODE && env.DUITKU_API_KEY && env.DUITKU_BASE_URL); }
  async createPayment(env: GatewayEnv, request: PaymentRequest): Promise<GatewayResult> {
    if (!this.isConfigured(env)) throw new Error("GATEWAY_NOT_CONFIGURED");
    const merchantCode = env.DUITKU_MERCHANT_CODE!;
    const apiKey = env.DUITKU_API_KEY!;
    const signature = md5Hex(merchantCode + request.amount + request.orderId + apiKey);
    const result = await postJson(env.DUITKU_BASE_URL!.replace(/\/$/,"") + "/webapi/api/merchant/v2/inquiry", {}, {
      merchantCode, paymentAmount: request.amount, paymentMethod: request.paymentMethod || "VC", merchantOrderId: request.orderId,
      productDetails: request.description, customerVaName: request.customer.name, email: request.customer.email,
      phoneNumber: request.customer.phone ?? "", callbackUrl: request.callbackUrl, returnUrl: request.returnUrl,
      signature, expiryPeriod: 60
    });
    return { provider:this.id, providerTransactionId:str(result.reference), checkoutUrl:str(result.paymentUrl) || undefined, reference:str(result.reference), status:"pending" };
  }
  async verifyWebhook(env: GatewayEnv, _headers: Headers, payload: Record<string,unknown>) {
    if (!env.DUITKU_MERCHANT_CODE || !env.DUITKU_API_KEY) return false;
    const expected = md5Hex(env.DUITKU_MERCHANT_CODE + str(payload.amount) + str(payload.merchantOrderId) + env.DUITKU_API_KEY);
    return safeEqual(expected, str(payload.signature).toLowerCase());
  }
  normalizeWebhook(payload: Record<string,unknown>): NormalizedWebhook {
    const orderId=str(payload.merchantOrderId);
    return { eventId:str(payload.reference || payload.merchantOrderId), orderId, providerTransactionId:str(payload.reference), status:statusFrom(payload.resultCode), eventType:"duitku.payment" };
  }
}

export class XenditGateway implements PaymentGateway {
  id: GatewayId = "xendit";
  isConfigured(env: GatewayEnv) { return Boolean(env.XENDIT_SECRET_KEY); }
  async createPayment(env: GatewayEnv, request: PaymentRequest): Promise<GatewayResult> {
    if (!env.XENDIT_SECRET_KEY) throw new Error("GATEWAY_NOT_CONFIGURED");
    const base=(env.XENDIT_BASE_URL || "https://api.xendit.co").replace(/\/$/,"");
    const auth=btoa(env.XENDIT_SECRET_KEY + ":");
    const result=await postJson(base+"/v2/invoices", {authorization:"Basic "+auth}, {
      external_id:request.orderId, amount:request.amount, currency:request.currency, description:request.description,
      payer_email:request.customer.email, invoice_duration:3600,
      success_redirect_url:request.returnUrl, failure_redirect_url:request.returnUrl,
      metadata:{dayanexa_order_id:request.orderId}
    });
    return {provider:this.id,providerTransactionId:str(result.id),checkoutUrl:str(result.invoice_url),reference:str(result.external_id),status:"pending"};
  }
  async verifyWebhook(env: GatewayEnv, headers: Headers) {
    const token=headers.get("x-callback-token") || "";
    return Boolean(env.XENDIT_CALLBACK_TOKEN && env.XENDIT_CALLBACK_TOKEN.length && safeEqual(env.XENDIT_CALLBACK_TOKEN, token));
  }
  normalizeWebhook(payload: Record<string,unknown>): NormalizedWebhook {
    return {eventId:str(payload.id || payload.external_id),orderId:str(payload.external_id),providerTransactionId:str(payload.id),status:statusFrom(payload.status),eventType:"xendit.invoice"};
  }
}

export class MidtransGateway implements PaymentGateway {
  id: GatewayId = "midtrans";
  isConfigured(env: GatewayEnv) { return Boolean(env.MIDTRANS_SERVER_KEY); }
  async createPayment(env: GatewayEnv, request: PaymentRequest): Promise<GatewayResult> {
    if (!env.MIDTRANS_SERVER_KEY) throw new Error("GATEWAY_NOT_CONFIGURED");
    const base=(env.MIDTRANS_BASE_URL || "https://app.sandbox.midtrans.com").replace(/\/$/,"");
    const auth=btoa(env.MIDTRANS_SERVER_KEY + ":");
    const result=await postJson(base+"/snap/v1/transactions",{authorization:"Basic "+auth},{
      transaction_details:{order_id:request.orderId,gross_amount:request.amount},
      customer_details:{first_name:request.customer.name,email:request.customer.email,phone:request.customer.phone},
      callbacks:{finish:request.returnUrl}
    });
    return {provider:this.id,providerTransactionId:request.orderId,checkoutUrl:str(result.redirect_url),reference:request.orderId,status:"pending"};
  }
  async verifyWebhook(env: GatewayEnv, _headers: Headers, payload: Record<string,unknown>) {
    if (!env.MIDTRANS_SERVER_KEY) return false;
    const expected=await digestHex("SHA-512",str(payload.order_id)+str(payload.status_code)+str(payload.gross_amount)+env.MIDTRANS_SERVER_KEY);
    return safeEqual(expected,str(payload.signature_key).toLowerCase());
  }
  normalizeWebhook(payload: Record<string,unknown>): NormalizedWebhook {
    return {eventId:str(payload.transaction_id || payload.order_id)+":"+str(payload.transaction_status),orderId:str(payload.order_id),providerTransactionId:str(payload.transaction_id),status:statusFrom(payload.transaction_status),eventType:"midtrans.transaction"};
  }
}

export class FaspayGateway implements PaymentGateway {
  id: GatewayId = "faspay";
  isConfigured(env: GatewayEnv) { return Boolean(env.FASPAY_MERCHANT_ID && env.FASPAY_MERCHANT_NAME && env.FASPAY_USER_ID && env.FASPAY_PASSWORD && env.FASPAY_PAYMENT_CHANNEL && env.FASPAY_DEBIT_ENDPOINT); }
  async createPayment(env: GatewayEnv, request: PaymentRequest): Promise<GatewayResult> {
    if (!this.isConfigured(env)) throw new Error("GATEWAY_NOT_CONFIGURED");
    const user=env.FASPAY_USER_ID!, password=env.FASPAY_PASSWORD!;
    const signature=await digestHex("SHA-1",md5Hex(user+password+request.orderId));
    const now=new Date();
    const date=(d:Date)=>d.toISOString().slice(0,19).replace("T"," ");
    const payload={
      request:"Post Data Transaction",merchant_id:env.FASPAY_MERCHANT_ID,merchant:env.FASPAY_MERCHANT_NAME,
      bill_no:request.orderId,bill_reff:request.orderId,bill_date:date(now),bill_expired:date(new Date(now.getTime()+60*60*1000)),
      bill_desc:request.description.slice(0,128),bill_currency:"IDR",bill_gross:String(request.amount),bill_miscfee:"0",
      bill_total:String(request.amount),payment_channel:env.FASPAY_PAYMENT_CHANNEL,pay_type:"1",
      cust_no:request.orderId,cust_name:request.customer.name,msisdn:request.customer.phone || "0000000000",
      email:request.customer.email,terminal:"10",reserve1:"",reserve2:"",signature
    };
    const result=await postJson(env.FASPAY_DEBIT_ENDPOINT!,{},payload);
    const code=str(result.response_code);
    if (code !== "00") throw new Error("FASPAY_REQUEST_REJECTED");
    return {provider:this.id,providerTransactionId:str(result.trx_id),checkoutUrl:str(result.redirect_url) || undefined,reference:str(result.trx_id),status:"pending"};
  }
  async verifyWebhook(env: GatewayEnv, _headers: Headers, payload: Record<string,unknown>) {
    if (!env.FASPAY_USER_ID || !env.FASPAY_PASSWORD) return false;
    const expected=await digestHex("SHA-1",md5Hex(env.FASPAY_USER_ID+env.FASPAY_PASSWORD+str(payload.bill_no)+str(payload.payment_status_code)));
    return safeEqual(expected,str(payload.signature).toLowerCase());
  }
  normalizeWebhook(payload: Record<string,unknown>): NormalizedWebhook {
    return {eventId:str(payload.trx_id)+":"+str(payload.payment_status_code),orderId:str(payload.bill_no),providerTransactionId:str(payload.trx_id),status:statusFrom(payload.payment_status_code),eventType:"faspay.payment_notification"};
  }
}

export const gateways: Record<GatewayId, PaymentGateway> = {
  duitku:new DuitkuGateway(),xendit:new XenditGateway(),midtrans:new MidtransGateway(),faspay:new FaspayGateway()
};
