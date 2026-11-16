import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { list } from "../lib/http";

export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
  const incoming = c.req.header("cf-ray") || c.req.header("x-request-id");
  c.set("requestId", (incoming && /^[\w-]{6,64}$/.test(incoming) ? incoming : crypto.randomUUID()));
  await next();
  c.header("x-request-id", c.get("requestId"));
  c.header("x-content-type-options", "nosniff");
  c.header("referrer-policy", "strict-origin-when-cross-origin");
  c.header("x-frame-options", "DENY");
  c.header("cache-control", c.res.headers.get("cache-control") ?? "no-store");
};

/** Strict CORS: exact-origin allowlist; credentials never sent cross-origin. */
export const strictCors: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origin = c.req.header("origin");
  const allowed = list(c.env.PUBLIC_ORIGINS);
  const ok = origin && allowed.includes(origin);
  if (c.req.method === "OPTIONS") {
    if (!ok) return c.body(null, 403);
    return c.body(null, 204, {
      "access-control-allow-origin": origin!,
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,idempotency-key",
      "access-control-max-age": "600",
      vary: "Origin",
    });
  }
  await next();
  if (ok) { c.header("access-control-allow-origin", origin!); c.header("vary", "Origin"); }
};

/** Rejects oversized bodies before parsing (webhooks/uploads have their own limits). */
export const bodyLimit = (maxBytes: number): MiddlewareHandler<AppEnv> => async (c, next) => {
  const length = Number(c.req.header("content-length") ?? "0");
  if (length > maxBytes) return c.json({ error: { code: "PAYLOAD_TOO_LARGE" } }, 413);
  await next();
};
