import type { TransitionMap } from "../domain/lifecycle";
import { isAllowed } from "../domain/lifecycle";
import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { auditStatement } from "./audit";

const TABLES = { demand: "demands", opportunity: "opportunities", mission: "missions" } as const;
export type LifecycleEntity = keyof typeof TABLES;

/** Validated, auditable, optimistic-concurrency state transition. */
export async function transition(d: D1Database, args: {
  entity: LifecycleEntity; id: string; to: string; map: TransitionMap; actorUserId: string | null;
  reason?: string | null; requestId?: string; orgId?: string | null; idempotencyKey?: string | null; extraSql?: D1PreparedStatement[];
}): Promise<{ from: string; to: string }> {
  const table = TABLES[args.entity];
  const row = await d.prepare(`SELECT status FROM ${table} WHERE id=?`).bind(args.id).first<{ status: string }>();
  if (!row) fail(404, `${args.entity.toUpperCase()}_NOT_FOUND`);
  const from = row!.status;
  if (args.idempotencyKey) {
    const seen = await d.prepare("SELECT to_state FROM lifecycle_transitions WHERE idempotency_key=?").bind(args.idempotencyKey).first<{ to_state: string }>();
    if (seen) return { from, to: seen.to_state };
  }
  if (!isAllowed(args.map, from, args.to)) fail(409, "INVALID_TRANSITION", `${args.entity}: ${from} → ${args.to} is not allowed.`);
  const updated = await d.prepare(`UPDATE ${table} SET status=?, updated_at=datetime('now') WHERE id=? AND status=?`).bind(args.to, args.id, from).run();
  if (updated.meta.changes !== 1) fail(409, "CONCURRENT_MODIFICATION", "State changed concurrently; reload and retry.");
  await d.batch([
    d.prepare(`INSERT INTO lifecycle_transitions (id,entity_type,entity_id,from_state,to_state,reason,actor_user_id,correlation_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(newId("trn"), args.entity, args.id, from, args.to, args.reason ?? null, args.actorUserId, args.requestId ?? null, args.idempotencyKey ?? null),
    auditStatement(d, { requestId: args.requestId, actorUserId: args.actorUserId, action: `${args.entity}.transition`, resourceType: args.entity, resourceId: args.id, orgId: args.orgId, metadata: { from, to: args.to, reason: args.reason } }),
    ...(args.extraSql ?? []),
  ]);
  return { from, to: args.to };
}

export async function history(d: D1Database, entity: LifecycleEntity, id: string) {
  const res = await d.prepare("SELECT from_state,to_state,reason,actor_user_id,created_at FROM lifecycle_transitions WHERE entity_type=? AND entity_id=? ORDER BY created_at, rowid").bind(entity, id).all();
  return res.results ?? [];
}
