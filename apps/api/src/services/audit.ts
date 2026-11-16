import { newId } from "../lib/ids";
import { redact } from "../lib/redact";

export interface AuditInput {
  requestId?: string;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "provider" | "agent";
  action: string;
  resourceType: string;
  resourceId?: string | null;
  orgId?: string | null;
  outcome?: "success" | "denied" | "failure";
  metadata?: unknown;
}
export function auditStatement(d: D1Database, a: AuditInput): D1PreparedStatement {
  return d.prepare(`INSERT INTO audit_events (id,request_id,actor_user_id,actor_type,action,resource_type,resource_id,org_id,outcome,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(newId("aud"), a.requestId ?? null, a.actorUserId ?? null, a.actorType ?? "user", a.action,
    a.resourceType, a.resourceId ?? null, a.orgId ?? null, a.outcome ?? "success", JSON.stringify(redact(a.metadata ?? {})));
}
export async function audit(d: D1Database, a: AuditInput) { await auditStatement(d, a).run(); }
