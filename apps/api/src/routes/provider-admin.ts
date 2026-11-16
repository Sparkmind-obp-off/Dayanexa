import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requirePermission } from "../middleware/auth";
import { body, idParam, optText, text } from "../lib/validate";
import { many, one } from "../lib/db";
import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { audit } from "../services/audit";
import { D, P, RID } from "./helpers";

export const providerAdmin = new Hono<AppEnv>();
providerAdmin.use("*", requirePermission("provider:admin"));

providerAdmin.get("/admin/provider-policies", async (c) => c.json({ items: await many(D(c), "SELECT * FROM provider_policies ORDER BY provider_id") }));
providerAdmin.patch("/admin/provider-policies/:providerId", async (c) => {
  const providerId = c.req.param("providerId");
  const input = await body(c, z.object({
    enabled: z.boolean().optional(), allowPaidUsage: z.boolean().optional(),
    dailyUnitCap: z.number().finite().min(0).optional(), monthlyUnitCap: z.number().finite().min(0).optional(),
    dailyCostUsdMicros: z.number().int().min(0).optional(), monthlyCostUsdMicros: z.number().int().min(0).optional(),
    perRunCostUsdMicros: z.number().int().min(0).optional(), unitType: text(40,1).optional(),
    fallbackMode: z.enum(["stop","approved_account_pool"]).optional(),
  }));
  const current = await one<any>(D(c), "SELECT * FROM provider_policies WHERE provider_id=?", providerId);
  const v = {
    enabled: input.enabled === undefined ? Number(current?.enabled ?? 0) : Number(input.enabled),
    paid: input.allowPaidUsage === undefined ? Number(current?.allow_paid_usage ?? 0) : Number(input.allowPaidUsage),
    daily: input.dailyUnitCap ?? Number(current?.daily_unit_cap ?? 0),
    monthly: input.monthlyUnitCap ?? Number(current?.monthly_unit_cap ?? 0),
    dailyCost: input.dailyCostUsdMicros ?? Number(current?.daily_cost_usd_micros ?? 0),
    monthlyCost: input.monthlyCostUsdMicros ?? Number(current?.monthly_cost_usd_micros ?? 0),
    runCost: input.perRunCostUsdMicros ?? Number(current?.per_run_cost_usd_micros ?? 0),
    unit: input.unitType ?? current?.unit_type ?? "requests",
    fallback: input.fallbackMode ?? current?.fallback_mode ?? "stop",
  };
  await D(c).prepare(`INSERT INTO provider_policies (provider_id,enabled,allow_paid_usage,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,per_run_cost_usd_micros,unit_type,fallback_mode,updated_by,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(provider_id) DO UPDATE SET enabled=excluded.enabled,allow_paid_usage=excluded.allow_paid_usage,daily_unit_cap=excluded.daily_unit_cap,monthly_unit_cap=excluded.monthly_unit_cap,daily_cost_usd_micros=excluded.daily_cost_usd_micros,monthly_cost_usd_micros=excluded.monthly_cost_usd_micros,per_run_cost_usd_micros=excluded.per_run_cost_usd_micros,unit_type=excluded.unit_type,fallback_mode=excluded.fallback_mode,updated_by=excluded.updated_by,updated_at=datetime('now')`)
    .bind(providerId,v.enabled,v.paid,v.daily,v.monthly,v.dailyCost,v.monthlyCost,v.runCost,v.unit,v.fallback,P(c).userId).run();
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.policy.updated", resourceType: "provider_policy", resourceId: providerId, metadata: v });
  return c.json({ ok: true, policy: await one(D(c), "SELECT * FROM provider_policies WHERE provider_id=?", providerId) });
});

providerAdmin.get("/admin/provider-accounts", async (c) => c.json({ items: await many(D(c), "SELECT id,provider_id,label,secret_binding,ownership_status,account_status,plan_name,billing_mode,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,quota_reset_at,terms_reviewed_at,notes,updated_at FROM provider_accounts ORDER BY provider_id,label") }));
providerAdmin.post("/admin/provider-accounts", async (c) => {
  const input = await body(c, z.object({
    providerId: z.enum(["apify","scrapely","tavily","firecrawl","groq"]),
    label: text(100,2), secretBinding: z.enum(["APIFY_API_TOKEN","APIFY_API_TOKEN_2","APIFY_API_TOKEN_3","SCRAPELY_API_KEY","SCRAPELY_API_KEY_2","SCRAPELY_API_KEY_3","TAVILY_API_KEY","TAVILY_API_KEY_2","FIRECRAWL_API_KEY","FIRECRAWL_API_KEY_2","GROQ_API_KEY","GROQ_API_KEY_2"]),
    ownershipStatus: z.enum(["authorized","pending","revoked"]).default("pending"),
    accountStatus: z.enum(["active","paused","exhausted","disabled"]).default("paused"),
    planName: text(60,1).default("unknown"), billingMode: z.enum(["free","prepaid","subscription","payg"]).default("free"),
    dailyUnitCap: z.number().finite().min(0).default(0), monthlyUnitCap: z.number().finite().min(0).default(0),
    dailyCostUsdMicros: z.number().int().min(0).default(0), monthlyCostUsdMicros: z.number().int().min(0).default(0),
    quotaResetAt: optText(40), termsReviewedAt: optText(40), notes: optText(1000),
  }));
  const id = newId("pacc");
  try {
    await D(c).prepare("INSERT INTO provider_accounts (id,provider_id,label,secret_binding,ownership_status,account_status,plan_name,billing_mode,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,quota_reset_at,terms_reviewed_at,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,input.providerId,input.label,input.secretBinding,input.ownershipStatus,input.accountStatus,input.planName,input.billingMode,input.dailyUnitCap,input.monthlyUnitCap,input.dailyCostUsdMicros,input.monthlyCostUsdMicros,input.quotaResetAt,input.termsReviewedAt,input.notes,P(c).userId).run();
  } catch { fail(409,"PROVIDER_ACCOUNT_EXISTS","Binding akun sudah terdaftar untuk provider tersebut."); }
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.account.created", resourceType: "provider_account", resourceId: id, metadata: { providerId: input.providerId, label: input.label, secretBinding: input.secretBinding, ownershipStatus: input.ownershipStatus } });
  return c.json({ id },201);
});
providerAdmin.patch("/admin/provider-accounts/:id", async (c) => {
  const input = await body(c, z.object({ ownershipStatus: z.enum(["authorized","pending","revoked"]).optional(), accountStatus: z.enum(["active","paused","exhausted","disabled"]).optional(), planName: text(60,1).optional(), billingMode: z.enum(["free","prepaid","subscription","payg"]).optional(), dailyUnitCap: z.number().finite().min(0).optional(), monthlyUnitCap: z.number().finite().min(0).optional(), dailyCostUsdMicros: z.number().int().min(0).optional(), monthlyCostUsdMicros: z.number().int().min(0).optional(), quotaResetAt: optText(40), termsReviewedAt: optText(40), notes: optText(1000) }));
  const old = await one<any>(D(c),"SELECT * FROM provider_accounts WHERE id=?",idParam(c));
  if(!old) fail(404,"PROVIDER_ACCOUNT_NOT_FOUND");
  const next = { ownershipStatus: input.ownershipStatus ?? old.ownership_status, accountStatus: input.accountStatus ?? old.account_status, planName: input.planName ?? old.plan_name, billingMode: input.billingMode ?? old.billing_mode, dailyUnitCap: input.dailyUnitCap ?? old.daily_unit_cap, monthlyUnitCap: input.monthlyUnitCap ?? old.monthly_unit_cap, dailyCostUsdMicros: input.dailyCostUsdMicros ?? old.daily_cost_usd_micros, monthlyCostUsdMicros: input.monthlyCostUsdMicros ?? old.monthly_cost_usd_micros, quotaResetAt: input.quotaResetAt === undefined ? old.quota_reset_at : input.quotaResetAt, termsReviewedAt: input.termsReviewedAt === undefined ? old.terms_reviewed_at : input.termsReviewedAt, notes: input.notes === undefined ? old.notes : input.notes };
  await D(c).prepare("UPDATE provider_accounts SET ownership_status=?,account_status=?,plan_name=?,billing_mode=?,daily_unit_cap=?,monthly_unit_cap=?,daily_cost_usd_micros=?,monthly_cost_usd_micros=?,quota_reset_at=?,terms_reviewed_at=?,notes=?,updated_at=datetime('now') WHERE id=?")
    .bind(next.ownershipStatus,next.accountStatus,next.planName,next.billingMode,next.dailyUnitCap,next.monthlyUnitCap,next.dailyCostUsdMicros,next.monthlyCostUsdMicros,next.quotaResetAt,next.termsReviewedAt,next.notes,idParam(c)).run();
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.account.updated", resourceType: "provider_account", resourceId: idParam(c), metadata: next });
  return c.json({ ok: true });
});

providerAdmin.get("/admin/actors", async (c) => c.json({ items: await many(D(c), "SELECT * FROM actor_registry ORDER BY provider_id,display_name") }));
providerAdmin.post("/admin/actors", async (c) => {
  const input = await body(c, z.object({ providerId:z.enum(["apify","scrapely"]), actorId:text(160,3), displayName:text(120,2), sourcePlatform:text(120,2), purpose:text(1000,10), inputSchema:z.record(z.string(),z.unknown()).default({}), outputMapping:z.record(z.string(),z.unknown()).default({}), pricingModel:text(80,2).default("unknown"), termsReviewedAt:optText(40), privacyReviewedAt:optText(40), perRunCostUsdMicros:z.number().int().min(0).default(0), dailyCostUsdMicros:z.number().int().min(0).default(0), monthlyCostUsdMicros:z.number().int().min(0).default(0), maxItems:z.number().int().min(1).max(500).default(10), timeoutSeconds:z.number().int().min(1).max(3600).default(120), concurrencyLimit:z.number().int().min(1).max(100).default(1) }));
  const id=newId("actr");
  try { await D(c).prepare("INSERT INTO actor_registry (id,provider_id,actor_id,display_name,source_platform,purpose,input_schema_json,output_mapping_json,pricing_model,terms_reviewed_at,privacy_reviewed_at,per_run_cost_usd_micros,daily_cost_usd_micros,monthly_cost_usd_micros,max_items,timeout_seconds,concurrency_limit,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,input.providerId,input.actorId,input.displayName,input.sourcePlatform,input.purpose,JSON.stringify(input.inputSchema),JSON.stringify(input.outputMapping),input.pricingModel,input.termsReviewedAt,input.privacyReviewedAt,input.perRunCostUsdMicros,input.dailyCostUsdMicros,input.monthlyCostUsdMicros,input.maxItems,input.timeoutSeconds,input.concurrencyLimit,P(c).userId).run(); }
  catch { fail(409,"ACTOR_ALREADY_REGISTERED"); }
  await audit(D(c),{requestId:RID(c),actorUserId:P(c).userId,action:"actor.registry.created",resourceType:"actor_registry",resourceId:id,metadata:{providerId:input.providerId,actorId:input.actorId,displayName:input.displayName}});
  return c.json({id},201);
});
providerAdmin.patch("/admin/actors/:id", async (c) => {
  const input=await body(c,z.object({status:z.enum(["draft","review","approved","paused","rejected"]),reviewNote:optText(1000)}));
  const old=await one<any>(D(c),"SELECT * FROM actor_registry WHERE id=?",idParam(c)); if(!old) fail(404,"ACTOR_NOT_FOUND");
  if(input.status==="approved" && (!old.terms_reviewed_at || !old.privacy_reviewed_at)) fail(422,"ACTOR_REVIEW_REQUIRED","Terms dan privacy harus ditinjau sebelum Actor disetujui.");
  await D(c).prepare("UPDATE actor_registry SET status=?,reviewed_by=?,reviewed_at=CASE WHEN ?='approved' THEN datetime('now') ELSE reviewed_at END,updated_at=datetime('now') WHERE id=?").bind(input.status,P(c).userId,input.status,idParam(c)).run();
  await audit(D(c),{requestId:RID(c),actorUserId:P(c).userId,action:"actor.registry.status",resourceType:"actor_registry",resourceId:idParam(c),metadata:{from:old.status,to:input.status,note:input.reviewNote??null}});
  return c.json({ok:true});
});
