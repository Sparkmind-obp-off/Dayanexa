import { Hono } from "hono";
import type { AppEnv } from "./env";
import { ApiError } from "./lib/http";
import { requireAuth } from "./middleware/auth";
import { bodyLimit, requestContext, strictCors } from "./middleware/security";
import { commerce } from "./routes/commerce";
import { billing } from "./routes/billing";
import { governance } from "./routes/governance";
import { intel } from "./routes/intel";
import { me } from "./routes/me";
import { metrics } from "./routes/metrics";
import { ops } from "./routes/ops";
import { providerAdmin } from "./routes/provider-admin";
import { publicRoutes } from "./routes/public";
import { webhooks } from "./routes/webhooks";

export function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestContext);
  app.use("/api/*", strictCors);

  // Public + signed webhooks (no session; verified by signature).
  app.route("/api/v1", publicRoutes);
  app.route("/api/v1", webhooks);

  // Everything else under /api/v1 requires a verified Clerk Production session.
  const secured = new Hono<AppEnv>();
  secured.use("*", bodyLimit(64 * 1024 * 1024 / 3));
  secured.use("*", requireAuth);
  secured.route("/", me);
  secured.route("/", intel);
  secured.route("/", ops);
  secured.route("/", providerAdmin);
  secured.route("/", commerce);
  secured.route("/", billing);
  secured.route("/", governance);
  secured.route("/", metrics);
  app.route("/api/v1", secured);

  app.notFound((c) => (c.req.path.startsWith("/api/") ? c.json({ error: { code: "NOT_FOUND" } }, 404) : c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text("Not found", 404)));
  app.onError((err, c) => {
    const requestId = c.get("requestId");
    if (err instanceof ApiError) return c.json({ error: { code: err.code, message: err.message, details: err.details ?? undefined }, requestId }, err.status as 400);
    console.error(JSON.stringify({ level: "error", requestId, path: c.req.path, message: err instanceof Error ? err.message : String(err) }));
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected error." }, requestId }, 500);
  });
  return app;
}

const app = createApp();
export default app;
