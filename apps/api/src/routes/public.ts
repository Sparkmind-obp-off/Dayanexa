import { Hono } from "hono";
import type { AppEnv } from "../env";
import { many } from "../lib/db";
import { flag } from "../lib/http";
import { liveEnabled } from "../payments/registry";
import { verifyArtifactToken } from "../services/artifacts";
import { PLANS, SERVICE_PACKAGES } from "../domain/plans";

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/health", (c) => c.json({
  ok: true, service: "dayanexa-api", environment: c.env.APP_ENV ?? "unknown", time: new Date().toISOString(),
  bindings: { d1: Boolean(c.env.DB), workersAi: Boolean(c.env.AI), r2: Boolean(c.env.ARTIFACTS) },
  identity: { clerkVerificationKey: Boolean(c.env.CLERK_JWT_KEY), clerkSecret: Boolean(c.env.CLERK_SECRET_KEY), clerkWebhookSecret: Boolean(c.env.CLERK_WEBHOOK_SECRET) },
  payments: { mode: liveEnabled(c.env) ? "live" : "mock" },
  inference: { defaultProvider: c.env.INFERENCE_PROVIDER || "workers-ai", groqEnabled: flag(c.env.GROQ_ENABLED) },
}));

/** Public client configuration. Only values designed to be public (Clerk publishable key). */
publicRoutes.get("/config", (c) => c.json({ clerkPublishableKey: c.env.CLERK_PUBLISHABLE_KEY ?? null, environment: c.env.APP_ENV ?? "unknown", paymentsMode: liveEnabled(c.env) ? "live" : "mock" }));

/** Public catalog: only active products explicitly marked public. No fabricated items. */
publicRoutes.get("/catalog", async (c) => {
  if (!c.env.DB) return c.json({ items: [] });
  return c.json({ items: await many(c.env.DB, "SELECT id,name,kind,description FROM products WHERE status='active' AND is_public=1 ORDER BY created_at DESC LIMIT 100") });
});

publicRoutes.get("/artifacts/download", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!c.env.ARTIFACT_SIGNING_SECRET || !c.env.ARTIFACTS || !c.env.DB) return c.json({ error: { code: "NOT_CONFIGURED" } }, 503);
  const id = await verifyArtifactToken(c.env.ARTIFACT_SIGNING_SECRET, token);
  if (!id) return c.json({ error: { code: "LINK_INVALID_OR_EXPIRED" } }, 403);
  const art = await c.env.DB.prepare("SELECT r2_key,filename,content_type FROM artifacts WHERE id=?").bind(id).first<{ r2_key: string; filename: string; content_type: string }>();
  if (!art) return c.json({ error: { code: "NOT_FOUND" } }, 404);
  const obj = await c.env.ARTIFACTS.get(art.r2_key);
  if (!obj) return c.json({ error: { code: "NOT_FOUND" } }, 404);
  return new Response(obj.body, { headers: { "content-type": art.content_type, "content-disposition": `attachment; filename="${art.filename}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
});

publicRoutes.get("/plans", (c) => c.json({ currency: "IDR", plans: PLANS, servicePackages: SERVICE_PACKAGES, note: "Harga paket layanan bersifat indikatif (mulai dari). Harga final ditetapkan dalam penawaran tertulis." }));
