import { Hono } from "hono";
import type { AppEnv } from "../env";
import { verifySvixSignature } from "../auth/svix";
import { profileFromClerkUser } from "../auth/clerk";
import { digestHex } from "../lib/crypto";
import { db } from "../lib/db";
import { audit } from "../services/audit";
import { processWebhook } from "../services/payments";
import { GATEWAY_IDS, type GatewayId } from "../payments/types";

export const webhooks = new Hono<AppEnv>();

/** Clerk lifecycle webhooks (Svix). Raw-body signature, replay window, idempotent by svix-id. */
webhooks.post("/webhooks/clerk", async (c) => {
  const raw = await c.req.text();
  if (raw.length > 512_000) return c.json({ error: { code: "PAYLOAD_TOO_LARGE" } }, 413);
  if (!c.env.CLERK_WEBHOOK_SECRET) return c.json({ error: { code: "WEBHOOK_NOT_CONFIGURED" } }, 503);
  const svixId = await verifySvixSignature(c.env.CLERK_WEBHOOK_SECRET, c.req.raw.headers, raw);
  const d = db(c.env);
  if (!svixId) {
    await audit(d, { requestId: c.get("requestId"), actorType: "provider", action: "clerk_webhook.rejected", resourceType: "identity_webhook", outcome: "denied" });
    return c.json({ error: { code: "INVALID_SIGNATURE" } }, 401);
  }
  const event = JSON.parse(raw) as { type: string; data: Record<string, unknown> };
  const clerkUserId = typeof event.data?.id === "string" ? event.data.id : null;
  const inserted = await d.prepare("INSERT OR IGNORE INTO identity_webhook_events (id,event_type,clerk_user_id,payload_hash,outcome) VALUES (?,?,?,?, 'received')")
    .bind(svixId, event.type, clerkUserId, await digestHex("SHA-256", raw)).run();
  if (inserted.meta.changes === 0) return c.json({ ok: true, duplicate: true });
  let outcome = "ignored";
  if (clerkUserId && (event.type === "user.updated" || event.type === "user.created")) {
    const prof = profileFromClerkUser(event.data);
    const r = await d.prepare("UPDATE users SET email=?, email_verified=?, display_name=COALESCE(?,display_name), status=CASE WHEN ? THEN 'suspended' WHEN status='suspended' AND NOT ? THEN 'active' ELSE status END, last_synced_at=datetime('now'), updated_at=datetime('now') WHERE clerk_user_id=?")
      .bind(prof.email, prof.emailVerified ? 1 : 0, prof.displayName, prof.banned ? 1 : 0, prof.banned ? 1 : 0, clerkUserId).run();
    outcome = r.meta.changes ? "synced" : "no_local_user";
  } else if (clerkUserId && event.type === "user.deleted") {
    const r = await d.prepare("UPDATE users SET status='closed', email=NULL, display_name=NULL, deleted_at=datetime('now'), updated_at=datetime('now') WHERE clerk_user_id=?").bind(clerkUserId).run();
    outcome = r.meta.changes ? "closed" : "no_local_user";
  }
  await d.prepare("UPDATE identity_webhook_events SET outcome=? WHERE id=?").bind(outcome, svixId).run();
  await audit(d, { requestId: c.get("requestId"), actorType: "provider", action: `clerk.${event.type}`, resourceType: "user", resourceId: clerkUserId, metadata: { outcome } });
  return c.json({ ok: true, outcome });
});

/** Payment gateway webhooks. Browser redirects are never treated as payment proof. */
webhooks.post("/payments/webhooks/:provider", async (c) => {
  const provider = c.req.param("provider") as GatewayId;
  if (!GATEWAY_IDS.includes(provider)) return c.json({ error: { code: "UNKNOWN_PROVIDER" } }, 404);
  const raw = await c.req.text();
  if (raw.length > 256_000) return c.json({ error: { code: "PAYLOAD_TOO_LARGE" } }, 413);
  const result = await processWebhook(c.env, db(c.env), provider, c.req.raw.headers, raw, c.get("requestId"));
  if (result.outcome === "invalid_signature" || result.outcome === "unconfigured") return c.json({ error: { code: result.outcome.toUpperCase() } }, 401);
  return c.json({ accepted: true, outcome: result.outcome });
});
