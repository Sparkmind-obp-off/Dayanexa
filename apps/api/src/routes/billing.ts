import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/ratelimit";
import { many } from "../lib/db";
import { fail } from "../lib/http";
import { body, optText, text } from "../lib/validate";
import { GATEWAY_IDS } from "../payments/types";
import { audit } from "../services/audit";
import { subscribe } from "../services/billing";
import { entitlements } from "../services/entitlements";
import { D, P, RID } from "./helpers";

export const billing = new Hono<AppEnv>();

billing.get("/billing", async (c) => {
  const p = P(c), d = D(c);
  const [ent, history, invoices] = await Promise.all([
    entitlements(d, p.primaryOrgId),
    many(d, "SELECT s.id,s.plan_code,s.status,s.current_period_start,s.current_period_end,s.cancel_at_period_end,s.created_at,pi.status AS payment_status,pi.mode,pi.amount,pi.checkout_url FROM subscriptions s LEFT JOIN payment_intents pi ON pi.id=s.payment_intent_id WHERE s.org_id=? ORDER BY s.created_at DESC LIMIT 20", p.primaryOrgId),
    many(d, "SELECT id,number,description,subtotal_minor,tax_minor,total_minor,mode,status,issued_at,paid_at FROM invoices WHERE org_id=? AND kind='subscription' ORDER BY issued_at DESC LIMIT 50", p.primaryOrgId),
  ]);
  return c.json({ plan: ent.plan, subscription: ent.subscription, usage: ent.usage, window: ent.window, history, invoices, autoRenewal: false,
    note: "Langganan = akses platform & kuota per 30 hari, tanpa perpanjangan otomatis. Proyek ditagih terpisah melalui penawaran." });
});
billing.post("/billing/subscribe", rateLimit("subscribe", 6, 300), async (c) => {
  const p = P(c);
  const input = await body(c, z.object({ plan: z.enum(["free", "pro", "plus"]), provider: z.enum(GATEWAY_IDS as [string, ...string[]]).default("midtrans"), customerName: text(120, 2), customerPhone: optText(30) }));
  const idem = c.req.header("idempotency-key") ?? null;
  if (idem && !/^[\w-]{8,80}$/.test(idem)) fail(400, "INVALID_IDEMPOTENCY_KEY");
  return c.json(await subscribe(c.env, D(c), p, { planCode: input.plan, provider: input.provider as never, customerName: input.customerName, customerPhone: input.customerPhone, origin: new URL(c.req.url).origin, requestId: RID(c), idempotencyKey: idem }), 201);
});
billing.post("/billing/cancel", async (c) => {
  const p = P(c);
  const r = await D(c).prepare("UPDATE subscriptions SET cancel_at_period_end=1, updated_at=datetime('now') WHERE org_id=? AND status='active' AND plan_code!='free'").bind(p.primaryOrgId).run();
  if (!r.meta.changes) fail(409, "NO_PAID_SUBSCRIPTION");
  await audit(D(c), { requestId: RID(c), actorUserId: p.userId, action: "subscription.cancel_requested", resourceType: "subscription", orgId: p.primaryOrgId });
  return c.json({ ok: true, note: "Langganan berakhir di akhir periode berjalan; tidak ada perpanjangan otomatis." });
});
billing.get("/subscriptions", requirePermission("ledger:read"), async (c) => c.json({ items: await many(D(c), "SELECT s.*, o.name AS org_name, pi.status AS payment_status, pi.mode FROM subscriptions s JOIN organizations o ON o.id=s.org_id LEFT JOIN payment_intents pi ON pi.id=s.payment_intent_id ORDER BY s.created_at DESC LIMIT 200") }));
