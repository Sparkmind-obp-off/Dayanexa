import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requirePermission } from "../middleware/auth";
import { PLATFORM_ROLES } from "../auth/principal";
import { many, mustFind, one } from "../lib/db";
import { fail } from "../lib/http";
import { body, idParam, optText, text } from "../lib/validate";
import { gateways } from "../payments/registry";
import type { GatewayId } from "../payments/types";
import { GatewayError } from "../payments/types";
import { audit, auditStatement } from "../services/audit";
import { inferenceStatus } from "../inference/service";
import { providerRegistry } from "../providers/registry";
import { D, notify, P, page, RID } from "./helpers";

export const governance = new Hono<AppEnv>();

governance.get("/approvals", requirePermission("governance:read"), async (c) => {
  const status = c.req.query("status") ?? "pending";
  return c.json({ items: await many(D(c), "SELECT a.*, u.display_name AS requested_by_name FROM approvals a LEFT JOIN users u ON u.id=a.requested_by WHERE a.status=? ORDER BY a.created_at DESC LIMIT 200", status) });
});
/** Separation of duties: the requester can never approve their own request. */
governance.post("/approvals/:id/decide", requirePermission("approval:decide"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const input = await body(c, z.object({ decision: z.enum(["approved", "rejected"]), note: text(1000, 3) }));
  const a = await mustFind<{ status: string; action: string; resource_id: string; requested_by: string; payload_json: string }>(d, "SELECT status,action,resource_id,requested_by,payload_json FROM approvals WHERE id=?", "APPROVAL_NOT_FOUND", id);
  if (a.status !== "pending") fail(409, "APPROVAL_CLOSED");
  if (a.requested_by === p.userId) fail(403, "SELF_APPROVAL_FORBIDDEN", "Separation of duties: another authorized user must decide.");
  const decide = d.prepare("UPDATE approvals SET status=?, decided_by=?, decision_note=?, decided_at=datetime('now') WHERE id=? AND status='pending'").bind(input.decision, p.userId, input.note, id);
  const effects: D1PreparedStatement[] = [];
  let sideNote: string | null = null;
  if (a.action === "offer.publish") {
    effects.push(d.prepare(`UPDATE offers SET status=? WHERE id=? AND status='authorization_pending'`).bind(input.decision === "approved" ? "published" : "draft", a.resource_id));
  } else if (a.action === "payout.release") {
    effects.push(d.prepare("UPDATE payout_requests SET status=?, updated_at=datetime('now') WHERE id=? AND status='approval_pending'").bind(input.decision === "approved" ? "approved" : "rejected", a.resource_id));
  } else if (a.action === "refund.submit") {
    effects.push(d.prepare("UPDATE refunds SET status=?, updated_at=datetime('now') WHERE id=? AND status='approval_pending'").bind(input.decision === "approved" ? "approved" : "rejected", a.resource_id));
  }
  await d.batch([decide, ...effects, auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: `approval.${input.decision}`, resourceType: "approval", resourceId: id, metadata: { action: a.action, resource: a.resource_id } })]);
  // Refund execution happens only after approval, only for gateways whose capability says refund is supported.
  if (a.action === "refund.submit" && input.decision === "approved") {
    const r = await one<{ amount: number; reason: string; merchant_order_id: string; provider: string; pid: string }>(d, "SELECT r.amount,r.reason,pi.merchant_order_id,pi.provider,pi.id AS pid FROM refunds r JOIN payment_intents pi ON pi.id=r.payment_intent_id WHERE r.id=?", a.resource_id);
    if (r) {
      try {
        const g = gateways[r.provider as GatewayId];
        const out = await g.requestRefund(c.env, r.merchant_order_id, r.amount, r.reason);
        await d.batch([
          d.prepare("UPDATE refunds SET status='submitted', provider_refund_id=?, updated_at=datetime('now') WHERE id=?").bind(out.providerRefundId, a.resource_id),
          d.prepare("UPDATE payment_intents SET status='REFUND_PENDING', updated_at=datetime('now') WHERE id=? AND status='SUCCEEDED'").bind(r.pid),
        ]);
        sideNote = "Refund submitted to gateway; final status arrives via verified webhook.";
      } catch (error) {
        await d.prepare("UPDATE refunds SET status='failed', updated_at=datetime('now') WHERE id=?").bind(a.resource_id).run();
        sideNote = `Refund not executed: ${error instanceof GatewayError ? error.message : "gateway error"}. Handle manually.`;
      }
    }
  }
  await notify(d, a.requested_by, "approval.decided", `Approval ${input.decision}: ${a.action}`, input.note, null);
  return c.json({ ok: true, decision: input.decision, note: sideNote });
});

governance.get("/audit", requirePermission("governance:read"), async (c) => {
  const { limit, offset } = page(c);
  const resourceType = c.req.query("resourceType") ?? null;
  return c.json({ items: await many(D(c), "SELECT * FROM audit_events WHERE (? IS NULL OR resource_type=?) ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?", resourceType, resourceType, limit, offset) });
});
governance.get("/users", requirePermission("roles:manage"), async (c) => {
  const users = await many<Record<string, unknown>>(D(c), "SELECT id,email,email_verified,display_name,status,created_at,last_seen_at FROM users ORDER BY created_at DESC LIMIT 500");
  const roles = await many<{ user_id: string; role: string }>(D(c), "SELECT user_id,role FROM user_roles WHERE scope_type='platform'");
  const contributors = await many<{ user_id: string; status: string; headline: string }>(D(c), "SELECT user_id,status,headline FROM contributor_profiles");
  return c.json({ items: users.map((u) => ({ ...u, roles: roles.filter((r) => r.user_id === u.id).map((r) => r.role), contributor: contributors.find((x) => x.user_id === u.id) ?? null })) });
});
governance.post("/users/:id/roles", requirePermission("roles:manage"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const input = await body(c, z.object({ role: z.enum(PLATFORM_ROLES as [string, ...string[]]), action: z.enum(["grant", "revoke"]) }));
  await mustFind(d, "SELECT id FROM users WHERE id=?", "USER_NOT_FOUND", id);
  if (input.role === "member") fail(422, "MEMBER_ROLE_IMPLICIT");
  if (input.action === "revoke" && input.role === "owner") {
    const owners = await one<{ n: number }>(d, "SELECT COUNT(*) AS n FROM user_roles WHERE role='owner' AND scope_type='platform'");
    if ((owners?.n ?? 0) <= 1) fail(409, "LAST_OWNER", "Cannot remove the last platform owner.");
  }
  if (input.action === "grant") await d.prepare("INSERT OR IGNORE INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES (?,?,'platform','global',?)").bind(id, input.role, p.userId).run();
  else await d.prepare("DELETE FROM user_roles WHERE user_id=? AND role=? AND scope_type='platform'").bind(id, input.role).run();
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: `role.${input.action}`, resourceType: "user", resourceId: id, metadata: { role: input.role } });
  return c.json({ ok: true });
});
governance.post("/users/:id/status", requirePermission("roles:manage"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const { status, reason } = await body(c, z.object({ status: z.enum(["active", "suspended"]), reason: text(500, 3) }));
  if (id === p.userId) fail(409, "CANNOT_CHANGE_OWN_STATUS");
  const r = await d.prepare("UPDATE users SET status=?, updated_at=datetime('now') WHERE id=? AND status IN ('active','suspended')").bind(status, id).run();
  if (!r.meta.changes) fail(404, "USER_NOT_FOUND");
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: `user.${status}`, resourceType: "user", resourceId: id, metadata: { reason } });
  return c.json({ ok: true });
});
governance.post("/contributors/:id/verify", requirePermission("roles:manage"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const { status, note } = await body(c, z.object({ status: z.enum(["verified", "suspended"]), note: optText(500) }));
  const r = await d.prepare("UPDATE contributor_profiles SET status=?, verified_by=?, updated_at=datetime('now') WHERE user_id=?").bind(status, p.userId, id).run();
  if (!r.meta.changes) fail(404, "CONTRIBUTOR_NOT_FOUND");
  if (status === "verified") await d.prepare("INSERT OR IGNORE INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES (?,'contributor','platform','global',?)").bind(id, p.userId).run();
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: `contributor.${status}`, resourceType: "user", resourceId: id, metadata: { note } });
  await notify(d, id, "contributor.status", `Contributor profile ${status}`, note, "/app/contributor");
  return c.json({ ok: true });
});
governance.get("/disputes", requirePermission("governance:read"), async (c) => c.json({ items: await many(D(c), "SELECT ds.*, m.title AS mission_title FROM disputes ds LEFT JOIN missions m ON m.id=ds.mission_id ORDER BY ds.created_at DESC LIMIT 200") }));
governance.post("/disputes/:id/resolve", requirePermission("approval:decide"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const { status, resolution } = await body(c, z.object({ status: z.enum(["resolved", "rejected"]), resolution: text(2000, 5) }));
  const r = await d.prepare("UPDATE disputes SET status=?, resolution=?, resolved_by=?, resolved_at=datetime('now') WHERE id=? AND status='open'").bind(status, resolution, p.userId, id).run();
  if (!r.meta.changes) fail(409, "DISPUTE_NOT_OPEN");
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: `dispute.${status}`, resourceType: "dispute", resourceId: id });
  return c.json({ ok: true, note: "Resolve the mission state separately (rework → EXECUTING, accept, or cancel)." });
});

// ---------- Provider registry & AI governance ----------
governance.get("/providers", requirePermission("workspace:read"), async (c) => {
  const d = D(c);
  const usage = await many(d, `SELECT provider_id, day, status, SUM(units) AS units, unit_type, COUNT(*) AS calls, SUM(estimated_cost_usd_micros) AS cost_usd_micros
    FROM provider_usage WHERE day >= date('now','-30 days') GROUP BY provider_id, day, status, unit_type ORDER BY day DESC LIMIT 300`);
  return c.json({ providers: providerRegistry(c.env), usage });
});
governance.get("/ai/status", requirePermission("workspace:read"), async (c) => {
  const d = D(c);
  const totals = await one(d, `SELECT COALESCE(SUM(CASE WHEN day=date('now') THEN estimated_neurons END),0) AS neurons_today,
      COALESCE(SUM(CASE WHEN month=strftime('%Y-%m','now') THEN estimated_neurons END),0) AS neurons_month,
      SUM(CASE WHEN day=date('now') THEN 1 ELSE 0 END) AS calls_today FROM inference_traces WHERE provider_id='workers-ai'`);
  const traces = await many(d, "SELECT id,provider_id,model_id,task_profile,prompt_version,policy_decision,status,error_code,input_chars,output_chars,input_tokens,output_tokens,estimated_neurons,usage_estimated,latency_ms,created_at FROM inference_traces ORDER BY created_at DESC LIMIT 50");
  return c.json({ status: inferenceStatus(c.env), totals, traces });
});
