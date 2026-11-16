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
import { bindingAllowed, gatewayStatus } from "../providers/gateway";

export const providerAdmin = new Hono<AppEnv>();
const PROVIDERS = ["workers-ai","groq","tavily","firecrawl","apify","scrapely"] as const;
const BINDINGS = ["AI","APIFY_API_TOKEN","APIFY_API_TOKEN_2","APIFY_API_TOKEN_3","SCRAPELY_API_KEY","SCRAPELY_API_KEY_2","SCRAPELY_API_KEY_3","TAVILY_API_KEY","TAVILY_API_KEY_2","TAVILY_API_KEY_3","FIRECRAWL_API_KEY","FIRECRAWL_API_KEY_2","FIRECRAWL_API_KEY_3","GROQ_API_KEY","GROQ_API_KEY_2","GROQ_API_KEY_3"] as const;
const UNIT = z.string().regex(/^[a-z_]{3,30}$/);
const runtimeFields = {
  capabilities: z.array(z.string().regex(/^[a-z][a-z0-9:_./~-]{1,120}$/)).max(50).optional(),
  priority: z.number().int().min(1).max(1000).optional(), concurrencyLimit: z.number().int().min(1).max(100).optional(),
  perRequestUnitCap: z.number().finite().min(0).optional(), unitType: UNIT.optional(),
  unitPriceUsdMicros: z.number().int().min(0).nullable().optional(), dataRegion: z.string().regex(/^[a-z0-9-]{2,20}$/).optional(),
  multiAccountTermsOk: z.boolean().optional(), quotaMaxAgeHours: z.number().int().min(1).max(744).optional(),
};
/** ISO timestamp in the future and not further than `days` away. */
function futureWithin(value: string | null | undefined, days: number, field: string): string {
  const t = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(t) || t <= Date.now() || t > Date.now() + days * 86_400_000) fail(422, "INVALID_EXPIRY", `${field} wajib ISO di masa depan, maksimal ${days} hari.`);
  return new Date(t).toISOString();
}
// Scoped to /admin/* on purpose: this router is mounted at "/" next to other routers, and a "*"
// middleware here would also gate every sibling router mounted after it (regression-tested).
providerAdmin.use("/admin/*", requirePermission("provider:admin"));

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

providerAdmin.get("/admin/provider-accounts", async (c) => c.json({ items: await many(D(c), "SELECT id,provider_id,label,secret_binding,ownership_status,account_status,plan_name,billing_mode,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,quota_reset_at,terms_reviewed_at,notes,updated_at,capabilities_json,priority,concurrency_limit,per_request_unit_cap,unit_type,unit_price_usd_micros,data_region,multi_account_terms_ok,quota_max_age_hours FROM provider_accounts ORDER BY provider_id,label") }));
providerAdmin.post("/admin/provider-accounts", async (c) => {
  const input = await body(c, z.object({
    providerId: z.enum(PROVIDERS),
    label: text(100,2), secretBinding: z.enum(BINDINGS),
    ...runtimeFields,
    ownershipStatus: z.enum(["authorized","pending","revoked"]).default("pending"),
    accountStatus: z.enum(["active","paused","exhausted","disabled"]).default("paused"),
    planName: text(60,1).default("unknown"), billingMode: z.enum(["free","prepaid","subscription","payg"]).default("free"),
    dailyUnitCap: z.number().finite().min(0).default(0), monthlyUnitCap: z.number().finite().min(0).default(0),
    dailyCostUsdMicros: z.number().int().min(0).default(0), monthlyCostUsdMicros: z.number().int().min(0).default(0),
    quotaResetAt: optText(40), termsReviewedAt: optText(40), notes: optText(1000),
  }));
  if (!bindingAllowed(input.providerId, input.secretBinding)) fail(422,"CREDENTIAL_BINDING_INVALID","Binding secret tidak cocok dengan provider.");
  const id = newId("pacc");
  try {
    await D(c).prepare("INSERT INTO provider_accounts (id,provider_id,label,secret_binding,ownership_status,account_status,plan_name,billing_mode,daily_unit_cap,monthly_unit_cap,daily_cost_usd_micros,monthly_cost_usd_micros,quota_reset_at,terms_reviewed_at,notes,created_by,capabilities_json,priority,concurrency_limit,per_request_unit_cap,unit_type,unit_price_usd_micros,data_region,multi_account_terms_ok,quota_max_age_hours) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,input.providerId,input.label,input.secretBinding,input.ownershipStatus,input.accountStatus,input.planName,input.billingMode,input.dailyUnitCap,input.monthlyUnitCap,input.dailyCostUsdMicros,input.monthlyCostUsdMicros,input.quotaResetAt,input.termsReviewedAt,input.notes,P(c).userId,
        JSON.stringify(input.capabilities ?? []),input.priority ?? 100,input.concurrencyLimit ?? 1,input.perRequestUnitCap ?? 0,input.unitType ?? "requests",input.unitPriceUsdMicros ?? null,input.dataRegion ?? "global",input.multiAccountTermsOk ? 1 : 0,input.quotaMaxAgeHours ?? 48).run();
  } catch { fail(409,"PROVIDER_ACCOUNT_EXISTS","Binding akun sudah terdaftar untuk provider tersebut."); }
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.account.created", resourceType: "provider_account", resourceId: id, metadata: { providerId: input.providerId, label: input.label, secretBinding: input.secretBinding, ownershipStatus: input.ownershipStatus } });
  return c.json({ id },201);
});
providerAdmin.patch("/admin/provider-accounts/:id", async (c) => {
  const input = await body(c, z.object({ ownershipStatus: z.enum(["authorized","pending","revoked"]).optional(), accountStatus: z.enum(["active","paused","exhausted","disabled"]).optional(), planName: text(60,1).optional(), billingMode: z.enum(["free","prepaid","subscription","payg"]).optional(), dailyUnitCap: z.number().finite().min(0).optional(), monthlyUnitCap: z.number().finite().min(0).optional(), dailyCostUsdMicros: z.number().int().min(0).optional(), monthlyCostUsdMicros: z.number().int().min(0).optional(), quotaResetAt: optText(40), termsReviewedAt: optText(40), notes: optText(1000), ...runtimeFields }));
  const old = await one<any>(D(c),"SELECT * FROM provider_accounts WHERE id=?",idParam(c));
  if(!old) fail(404,"PROVIDER_ACCOUNT_NOT_FOUND");
  const next = { ownershipStatus: input.ownershipStatus ?? old.ownership_status, accountStatus: input.accountStatus ?? old.account_status, planName: input.planName ?? old.plan_name, billingMode: input.billingMode ?? old.billing_mode, dailyUnitCap: input.dailyUnitCap ?? old.daily_unit_cap, monthlyUnitCap: input.monthlyUnitCap ?? old.monthly_unit_cap, dailyCostUsdMicros: input.dailyCostUsdMicros ?? old.daily_cost_usd_micros, monthlyCostUsdMicros: input.monthlyCostUsdMicros ?? old.monthly_cost_usd_micros, quotaResetAt: input.quotaResetAt === undefined ? old.quota_reset_at : input.quotaResetAt, termsReviewedAt: input.termsReviewedAt === undefined ? old.terms_reviewed_at : input.termsReviewedAt, notes: input.notes === undefined ? old.notes : input.notes };
  await D(c).prepare("UPDATE provider_accounts SET ownership_status=?,account_status=?,plan_name=?,billing_mode=?,daily_unit_cap=?,monthly_unit_cap=?,daily_cost_usd_micros=?,monthly_cost_usd_micros=?,quota_reset_at=?,terms_reviewed_at=?,notes=?,updated_at=datetime('now') WHERE id=?")
    .bind(next.ownershipStatus,next.accountStatus,next.planName,next.billingMode,next.dailyUnitCap,next.monthlyUnitCap,next.dailyCostUsdMicros,next.monthlyCostUsdMicros,next.quotaResetAt,next.termsReviewedAt,next.notes,idParam(c)).run();
  const rt = { capabilities_json: input.capabilities === undefined ? old.capabilities_json : JSON.stringify(input.capabilities), priority: input.priority ?? old.priority, concurrency_limit: input.concurrencyLimit ?? old.concurrency_limit,
    per_request_unit_cap: input.perRequestUnitCap ?? old.per_request_unit_cap, unit_type: input.unitType ?? old.unit_type, unit_price_usd_micros: input.unitPriceUsdMicros === undefined ? old.unit_price_usd_micros : input.unitPriceUsdMicros,
    data_region: input.dataRegion ?? old.data_region, multi_account_terms_ok: input.multiAccountTermsOk === undefined ? old.multi_account_terms_ok : (input.multiAccountTermsOk ? 1 : 0), quota_max_age_hours: input.quotaMaxAgeHours ?? old.quota_max_age_hours };
  await D(c).prepare("UPDATE provider_accounts SET capabilities_json=?,priority=?,concurrency_limit=?,per_request_unit_cap=?,unit_type=?,unit_price_usd_micros=?,data_region=?,multi_account_terms_ok=?,quota_max_age_hours=? WHERE id=?")
    .bind(rt.capabilities_json,rt.priority,rt.concurrency_limit,rt.per_request_unit_cap,rt.unit_type,rt.unit_price_usd_micros,rt.data_region,rt.multi_account_terms_ok,rt.quota_max_age_hours,idParam(c)).run();
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.account.updated", resourceType: "provider_account", resourceId: idParam(c), metadata: { before: { status: old.account_status, ownership: old.ownership_status, caps: [old.daily_unit_cap, old.monthly_unit_cap], price: old.unit_price_usd_micros, capabilities: old.capabilities_json }, after: { ...next, ...rt } } });
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
  const input=await body(c,z.object({status:z.enum(["draft","review","approved","paused","rejected"]),reviewNote:optText(1000),approvalExpiresAt:optText(40)}));
  const old=await one<any>(D(c),"SELECT * FROM actor_registry WHERE id=?",idParam(c)); if(!old) fail(404,"ACTOR_NOT_FOUND");
  if(input.status==="approved" && (!old.terms_reviewed_at || !old.privacy_reviewed_at)) fail(422,"ACTOR_REVIEW_REQUIRED","Terms dan privacy harus ditinjau sebelum Actor disetujui.");
  if(input.status==="approved" && !(old.per_run_cost_usd_micros>0)) fail(422,"ACTOR_COST_CAP_MISSING","Cap biaya per run wajib > 0 sebelum disetujui.");
  if(input.status==="approved") futureWithin(input.approvalExpiresAt, 180, "approvalExpiresAt");
  await D(c).prepare("UPDATE actor_registry SET status=?,reviewed_by=?,reviewed_at=CASE WHEN ?='approved' THEN datetime('now') ELSE reviewed_at END,approval_expires_at=CASE WHEN ?='approved' THEN ? ELSE approval_expires_at END,version=version+CASE WHEN ?='approved' THEN 1 ELSE 0 END,updated_at=datetime('now') WHERE id=?").bind(input.status,P(c).userId,input.status,input.status,input.approvalExpiresAt,input.status,idParam(c)).run();
  await audit(D(c),{requestId:RID(c),actorUserId:P(c).userId,action:"actor.registry.status",resourceType:"actor_registry",resourceId:idParam(c),metadata:{from:old.status,to:input.status,note:input.reviewNote??null}});
  return c.json({ok:true});
});

// ---------- Provider Runtime Gateway controls (owner-only; every change audited) ----------
providerAdmin.get("/admin/gateway/status", async (c) => c.json({ items: await gatewayStatus(c.env, D(c)), note: "Evaluasi kelayakan untuk permintaan 1 unit; tidak membuat reservasi atau panggilan provider." }));

providerAdmin.get("/admin/quota-snapshots", async (c) => c.json({ items: await many(D(c), "SELECT q.*, a.label, a.provider_id FROM quota_snapshots q JOIN provider_accounts a ON a.id=q.account_id ORDER BY q.verified_at DESC LIMIT 200") }));
providerAdmin.post("/admin/quota-snapshots", async (c) => {
  const input = await body(c, z.object({ accountId: text(60, 5), unitType: UNIT, allowanceUnits: z.number().finite().min(0), usedUnitsReported: z.number().finite().min(0).default(0),
    windowKind: z.enum(["day","month","fixed"]), resetAt: optText(40), resetTimezone: text(40,1).default("UTC"),
    source: z.enum(["provider_api","account_dashboard","official_published"]), sourceNote: text(500, 5), verifiedAt: text(40, 10) }));
  const acc = await one<any>(D(c), "SELECT id, unit_type FROM provider_accounts WHERE id=?", input.accountId); if (!acc) fail(404, "PROVIDER_ACCOUNT_NOT_FOUND");
  const v = Date.parse(input.verifiedAt); if (!Number.isFinite(v) || v > Date.now() + 60_000) fail(422, "INVALID_VERIFIED_AT", "verifiedAt tidak boleh di masa depan.");
  if (input.usedUnitsReported > input.allowanceUnits) fail(422, "INVALID_QUOTA", "Pemakaian melebihi allowance.");
  const id = newId("qsn");
  await D(c).prepare("INSERT INTO quota_snapshots (id,account_id,unit_type,allowance_units,used_units_reported,window_kind,reset_at,reset_timezone,source,source_note,verified_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, input.accountId, input.unitType, input.allowanceUnits, input.usedUnitsReported, input.windowKind, input.resetAt, input.resetTimezone, input.source, input.sourceNote, new Date(v).toISOString(), P(c).userId).run();
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.quota.snapshot", resourceType: "quota_snapshot", resourceId: id, metadata: input });
  return c.json({ id }, 201);
});

providerAdmin.get("/admin/provider-approvals", async (c) => c.json({ items: await many(D(c), "SELECT * FROM provider_approvals ORDER BY created_at DESC LIMIT 200") }));
providerAdmin.post("/admin/provider-approvals", async (c) => {
  const input = await body(c, z.object({ accountId: text(60, 5), capability: z.string().regex(/^[a-z][a-z0-9:_./~-]{1,120}$/), maxSpendUsdMicros: z.number().int().min(1).max(1_000_000_000), startsAt: optText(40), expiresAt: text(40, 10), reason: text(1000, 10) }));
  const acc = await one<any>(D(c), "SELECT id, provider_id FROM provider_accounts WHERE id=?", input.accountId); if (!acc) fail(404, "PROVIDER_ACCOUNT_NOT_FOUND");
  const expires = futureWithin(input.expiresAt, 90, "expiresAt");
  const starts = input.startsAt ? new Date(Date.parse(input.startsAt)).toISOString() : new Date().toISOString();
  const id = newId("papr");
  await D(c).prepare("INSERT INTO provider_approvals (id,provider_id,account_id,capability,kind,max_spend_usd_micros,starts_at,expires_at,reason,approved_by) VALUES (?,?,?,?,'paid_usage',?,?,?,?,?)")
    .bind(id, acc.provider_id, input.accountId, input.capability, input.maxSpendUsdMicros, starts, expires, input.reason, P(c).userId).run();
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.approval.paid_usage.granted", resourceType: "provider_approval", resourceId: id, metadata: { ...input, startsAt: starts, expiresAt: expires } });
  return c.json({ id }, 201);
});
providerAdmin.post("/admin/provider-approvals/:id/revoke", async (c) => {
  const { reason } = await body(c, z.object({ reason: text(500, 5) }));
  const r = await D(c).prepare("UPDATE provider_approvals SET status='revoked', revoked_at=datetime('now') WHERE id=? AND status='active'").bind(idParam(c)).run();
  if (!r.meta.changes) fail(404, "APPROVAL_NOT_FOUND");
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.approval.revoked", resourceType: "provider_approval", resourceId: idParam(c), metadata: { reason } });
  return c.json({ ok: true });
});

providerAdmin.get("/admin/fallback-rules", async (c) => c.json({ items: await many(D(c), "SELECT * FROM fallback_rules ORDER BY created_at DESC LIMIT 200") }));
providerAdmin.post("/admin/fallback-rules", async (c) => {
  const input = await body(c, z.object({ capability: z.string().regex(/^[a-z][a-z0-9:_./~-]{1,120}$/), primaryAccountId: text(60, 5), fallbackAccountId: text(60, 5), priority: z.number().int().min(1).max(1000).default(100), reason: text(1000, 10), expiresAt: text(40, 10) }));
  const [a, b] = [await one<any>(D(c), "SELECT * FROM provider_accounts WHERE id=?", input.primaryAccountId), await one<any>(D(c), "SELECT * FROM provider_accounts WHERE id=?", input.fallbackAccountId)];
  if (!a || !b) fail(404, "PROVIDER_ACCOUNT_NOT_FOUND");
  if (a.id === b.id) fail(422, "FALLBACK_SAME_ACCOUNT");
  if (a.provider_id !== b.provider_id) fail(422, "FALLBACK_PROVIDER_MISMATCH", "Fallback hanya ke akun provider yang sama dan kompatibel.");
  if (!a.multi_account_terms_ok || !b.multi_account_terms_ok) fail(422, "FALLBACK_TERMS_NOT_CONFIRMED", "Kedua akun wajib dikonfirmasi bahwa terms provider mengizinkan multi-akun untuk tujuan ini.");
  if (b.ownership_status !== "authorized") fail(422, "FALLBACK_ACCOUNT_NOT_AUTHORIZED");
  const expires = futureWithin(input.expiresAt, 90, "expiresAt");
  const id = newId("fbr");
  await D(c).prepare("INSERT INTO fallback_rules (id,capability,primary_account_id,fallback_account_id,trigger_kind,priority,reason,approved_by,expires_at) VALUES (?,?,?,?,'upstream_error',?,?,?,?)")
    .bind(id, input.capability, a.id, b.id, input.priority, input.reason, P(c).userId, expires).run();
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.fallback_rule.created", resourceType: "fallback_rule", resourceId: id, metadata: { ...input, trigger: "upstream_error (outage only)", expiresAt: expires } });
  return c.json({ id, trigger: "upstream_error" }, 201);
});
providerAdmin.post("/admin/fallback-rules/:id/revoke", async (c) => {
  const { reason } = await body(c, z.object({ reason: text(500, 5) }));
  const r = await D(c).prepare("UPDATE fallback_rules SET status='revoked' WHERE id=? AND status='active'").bind(idParam(c)).run();
  if (!r.meta.changes) fail(404, "FALLBACK_RULE_NOT_FOUND");
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.fallback_rule.revoked", resourceType: "fallback_rule", resourceId: idParam(c), metadata: { reason } });
  return c.json({ ok: true });
});

providerAdmin.get("/admin/usage-reservations", async (c) => {
  const status = c.req.query("status");
  if (status && !["reserved","settled","released","unknown_charge"].includes(status)) fail(400, "INVALID_STATUS");
  return c.json({ items: await many(D(c), "SELECT r.*, a.label AS account_label FROM usage_reservations r LEFT JOIN provider_accounts a ON a.id=r.account_id WHERE (? IS NULL OR r.status=?) ORDER BY r.created_at DESC LIMIT 200", status ?? null, status ?? null),
    exceptions: await many(D(c), "SELECT status, exception, COUNT(*) AS n FROM usage_reservations WHERE status='unknown_charge' OR exception IS NOT NULL GROUP BY status, exception") });
});
/** Resolves an ambiguous (unknown_charge) reservation after checking the provider dashboard/run status. */
providerAdmin.post("/admin/usage-reservations/:id/resolve", async (c) => {
  const input = await body(c, z.object({ outcome: z.enum(["settled","released"]), unitsActual: z.number().finite().min(0).default(0), costActualUsdMicros: z.number().int().min(0).default(0), note: text(1000, 10) }));
  const r = await D(c).prepare("UPDATE usage_reservations SET status=?, units_actual=?, cost_actual_usd_micros=?, reconciled_by=?, reconciliation_note=?, settled_at=datetime('now') WHERE id=? AND status='unknown_charge'")
    .bind(input.outcome, input.outcome === "settled" ? input.unitsActual : 0, input.outcome === "settled" ? input.costActualUsdMicros : 0, P(c).userId, input.note, idParam(c)).run();
  if (!r.meta.changes) fail(409, "RESERVATION_NOT_UNKNOWN_CHARGE", "Hanya reservasi berstatus unknown_charge yang dapat direkonsiliasi manual.");
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.reservation.reconciled", resourceType: "usage_reservation", resourceId: idParam(c), metadata: input });
  return c.json({ ok: true });
});

providerAdmin.get("/admin/circuit-breakers", async (c) => c.json({ items: await many(D(c), "SELECT b.*, a.label, a.provider_id FROM circuit_breakers b JOIN provider_accounts a ON a.id=b.account_id ORDER BY b.updated_at DESC") }));
providerAdmin.post("/admin/circuit-breakers/:id/reset", async (c) => {
  const { reason } = await body(c, z.object({ reason: text(500, 10) }));
  const r = await D(c).prepare("DELETE FROM circuit_breakers WHERE account_id=?").bind(idParam(c)).run();
  if (!r.meta.changes) fail(404, "BREAKER_NOT_FOUND");
  await audit(D(c), { requestId: RID(c), actorUserId: P(c).userId, action: "provider.breaker.reset", resourceType: "provider_account", resourceId: idParam(c), metadata: { reason } });
  return c.json({ ok: true });
});
