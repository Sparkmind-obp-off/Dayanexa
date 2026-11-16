import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { fail } from "../lib/http";

/** Fixed-window limiter persisted in D1 so limits hold across isolates. Use on expensive/mutating routes. */
export const rateLimit = (name: string, limit: number, windowSeconds: number): MiddlewareHandler<AppEnv> => async (c, next) => {
  const d = c.env.DB;
  if (d) {
    const principal = c.get("principal");
    const who = principal?.userId ?? c.req.header("cf-connecting-ip") ?? "anon";
    const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
    const key = `${name}:${who}`;
    const row = await d.prepare(`INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
      ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, windowStart).first<{ count: number }>();
    if ((row?.count ?? 0) > limit) {
      c.header("retry-after", String(windowStart + windowSeconds - Math.floor(Date.now() / 1000)));
      fail(429, "RATE_LIMITED", `Limit ${limit} per ${windowSeconds}s for ${name}.`);
    }
  }
  await next();
};
