import type { Context } from "hono";
import type { AppEnv } from "../env";
import { db } from "../lib/db";
import { can } from "../auth/policy";
import type { Principal } from "../auth/principal";

export type Ctx = Context<AppEnv>;
export const P = (c: Ctx): Principal => c.get("principal");
export const D = (c: Ctx) => db(c.env);
export const RID = (c: Ctx) => c.get("requestId");
export const isStaff = (p: Principal) => can(p, "workspace:read");
export const page = (c: Ctx) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);
  return { limit, offset };
};
/** SQL fragment + params restricting rows to the caller's orgs unless they are platform staff. */
export const orgScope = (p: Principal, column = "org_id") =>
  isStaff(p) ? { sql: "1=1", params: [] as unknown[] } : { sql: `${column} IN (${p.orgIds.map(() => "?").join(",")})`, params: [...p.orgIds] as unknown[] };
export async function notify(d: D1Database, userId: string, kind: string, title: string, body: string | null, link: string | null) {
  const { newId } = await import("../lib/ids");
  await d.prepare("INSERT INTO notifications (id,user_id,kind,title,body,link) VALUES (?,?,?,?,?,?)").bind(newId("ntf"), userId, kind, title, body, link).run();
}
