import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env";
import { verifySession } from "../auth/clerk";
import { db } from "../lib/db";
import { fail } from "../lib/http";
import { resolvePrincipal } from "../services/identity";
import { assertCan, type Permission } from "../auth/policy";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!c.env.CLERK_JWT_KEY) fail(503, "AUTH_NOT_CONFIGURED", "Clerk Production verification key is not configured.");
  const session = await verifySession(token, c.env);
  if (!session) fail(401, "UNAUTHENTICATED");
  c.set("principal", await resolvePrincipal(c.env, db(c.env), session!.clerkUserId, c.get("requestId")));
  await next();
};

export const requirePermission = (permission: Permission): MiddlewareHandler<AppEnv> => async (c, next) => {
  assertCan(c.get("principal"), permission);
  await next();
};
