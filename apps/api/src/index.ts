import { authenticate } from "./auth/clerk";
import { gateways } from "./payments/gateways";
import type { GatewayEnv, GatewayId, PaymentRequest } from "./payments/types";

interface Env extends GatewayEnv {
  DB: D1Database;
  APP_ENV?: string;
  PAYMENTS_MODE?: "mock" | "live";
  PAYMENT_LIVE_ENABLED?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  PUBLIC_API_ORIGIN?: string;
}
const corsHeaders=(origin:string,env:Env)=>({
  "access-control-allow-origin":env.PUBLIC_API_ORIGIN && origin===env.PUBLIC_API_ORIGIN ? origin : "null",
  "access-control-allow-methods":"GET,POST,OPTIONS",
  "access-control-allow-headers":"authorization,content-type",
  "vary":"Origin"
});
const response=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}});
const allowedProviders:GatewayId[]=["duitku","xendit","midtrans","faspay"];
const id=()=>crypto.randomUUID();

async function getInternalUser(env:Env,clerkUserId:string) {
  const userId=id();
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, clerk_user_id) VALUES (?, ?)").bind(userId,clerkUserId).run();
  const user=await env.DB.prepare("SELECT id,status FROM users WHERE clerk_user_id=?").bind(clerkUserId).first<{id:string;status:string}>();
  if (!user || user.status!=="active") throw new Error("USER_NOT_ACTIVE");
  await env.DB.prepare("UPDATE users SET last_seen_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(user.id).run();
  return user.id;
}

async function handle(request:Request,env:Env):Promise<Response> {
  const url=new URL(request.url);
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(request.headers.get("origin")||"",env)});
  if (url.pathname==="/health" && request.method==="GET") return response({ok:true,service:"dayanexa-api",environment:env.APP_ENV||"unknown",paymentsMode:env.PAYMENTS_MODE||"mock"});
  if (url.pathname==="/api/v1/payments/providers" && request.method==="GET") {
    const auth=await authenticate(request,env);
    if (!auth) return response({error:"UNAUTHORIZED"},401);
    return response({providers:allowedProviders.map(provider=>({id:provider,configured:gateways[provider].isConfigured(env),enabled:env.PAYMENTS_MODE==="live" && env.PAYMENT_LIVE_ENABLED==="true" && gateways[provider].isConfigured(env)})),mode:env.PAYMENTS_MODE||"mock"});
  }
  if (url.pathname==="/api/v1/payments/intents" && request.method==="POST") {
    const auth=await authenticate(request,env);
    if (!auth) return response({error:"UNAUTHORIZED"},401);
    let body:Record<string,unknown>;
    try { body=await request.json() as Record<string,unknown>; } catch { return response({error:"INVALID_JSON"},400); }
    const amount=Number(body.amount);
    const currency=String(body.currency||"IDR");
    const provider=String(body.provider||"mock");
    const description=String(body.description||"DAYANEXA order").slice(0,128);
    if (!Number.isSafeInteger(amount)||amount<1000||currency!=="IDR"||!allowedProviders.includes(provider as GatewayId)) return response({error:"INVALID_PAYMENT_REQUEST"},400);
    if (!env.DB) return response({error:"DATABASE_NOT_CONFIGURED"},503);
    let userId:string;
    try { userId=await getInternalUser(env,auth.clerkUserId); } catch { return response({error:"USER_NOT_ACTIVE"},403); }
    const orderId="DX-"+crypto.randomUUID().replace(/-/g,"").slice(0,20).toUpperCase();
    const intentId=id();
    const paymentRequest:PaymentRequest={
      orderId,amount,currency:"IDR",description,
      customer:{name:String(body.customerName||"DAYANEXA Customer"),email:String(body.customerEmail||"") ,phone:body.customerPhone?String(body.customerPhone):undefined},
      paymentMethod:body.paymentMethod?String(body.paymentMethod):undefined,
      callbackUrl:new URL("/api/v1/payments/webhooks/"+provider,url.origin).toString(),
      returnUrl:String(body.returnUrl||url.origin)
    };
    const live=env.PAYMENTS_MODE==="live" && env.PAYMENT_LIVE_ENABLED==="true";
    if (env.PAYMENTS_MODE==="live" && !live) return response({error:"LIVE_PAYMENTS_LOCKED"},423);
    if (live && !gateways[provider as GatewayId].isConfigured(env)) return response({error:"GATEWAY_NOT_CONFIGURED"},409);
    let result:{provider:string;providerTransactionId:string;checkoutUrl?:string;reference?:string;status:string};
    try {
      result=live
        ? await gateways[provider as GatewayId].createPayment(env,paymentRequest)
        : {provider:"mock",providerTransactionId:"mock-"+intentId,reference:"mock-"+orderId,status:"pending"};
    } catch (error) {
      const message=error instanceof Error?error.message:"GATEWAY_ERROR";
      return response({error:message.startsWith("GATEWAY_")||message==="FASPAY_REQUEST_REJECTED"?message:"GATEWAY_REQUEST_FAILED"},502);
    }
    await env.DB.prepare("INSERT INTO payment_intents (id,user_id,provider,merchant_order_id,provider_transaction_id,amount,currency,description,status,checkout_url,provider_reference) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(intentId,userId,result.provider,orderId,result.providerTransactionId,amount,currency,description,result.status,result.checkoutUrl||null,result.reference||null).run();
    await env.DB.prepare("INSERT INTO audit_events (id,actor_user_id,action,resource_type,resource_id,outcome,metadata_json) VALUES (?,?,?,?,?,?,?)")
      .bind(id(),userId,"payment_intent.created","payment_intent",intentId,"success",JSON.stringify({provider:result.provider,amount,currency})).run();
    return response({id:intentId,orderId,provider:result.provider,amount,currency,status:result.status,checkoutUrl:result.checkoutUrl||null,mode:live?"live":"mock"},201);
  }
  const webhookMatch=url.pathname.match(/^\/api\/v1\/payments\/webhooks\/(duitku|xendit|midtrans|faspay)$/);
  if (webhookMatch && request.method==="POST") {
    const provider=webhookMatch[1] as GatewayId;
    const raw=await request.text();
    let payload:Record<string,unknown>;
    try { payload=JSON.parse(raw) as Record<string,unknown>; } catch { return response({error:"INVALID_WEBHOOK"},400); }
    if (!await gateways[provider].verifyWebhook(env,request.headers,payload)) return response({error:"INVALID_WEBHOOK_SIGNATURE"},401);
    const normalized=gateways[provider].normalizeWebhook(payload);
    const eventId=id();
    const payloadHash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)).then(bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join(""));
    const inserted=await env.DB.prepare("INSERT OR IGNORE INTO payment_events (id,provider,provider_event_id,merchant_order_id,event_type,normalized_status,payload_hash,processed_at) VALUES (?,?,?,?,?,?,?,datetime('now'))")
      .bind(eventId,provider,normalized.eventId,normalized.orderId,normalized.eventType,normalized.status,payloadHash).run();
    if (inserted.meta.changes>0) {
      await env.DB.prepare("UPDATE payment_intents SET status=?,provider_transaction_id=COALESCE(?,provider_transaction_id),updated_at=datetime('now') WHERE provider=? AND merchant_order_id=?")
        .bind(normalized.status,normalized.providerTransactionId||null,provider,normalized.orderId).run();
    }
    return response({accepted:true,duplicate:inserted.meta.changes===0});
  }
  return response({error:"NOT_FOUND"},404);
}

export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const result=await handle(request,env);
    const origin=request.headers.get("origin")||"";
    const headers=new Headers(result.headers);
    const cors=corsHeaders(origin,env);
    for(const [key,value] of Object.entries(cors)) headers.set(key,value);
    return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
  }
};
