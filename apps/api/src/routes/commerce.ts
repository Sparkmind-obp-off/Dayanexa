import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/ratelimit";
import { accountBalances, postJournal, reverseJournal, trialBalance } from "../ledger/ledger";
import { many, mustFind, one } from "../lib/db";
import { fail } from "../lib/http";
import { newId } from "../lib/ids";
import { body, idParam, moneyMinor, optText, text } from "../lib/validate";
import { paymentRegistry } from "../payments/registry";
import { GATEWAY_IDS } from "../payments/types";
import { audit, auditStatement } from "../services/audit";
import { applyPaymentStatus, createIntent, isProductionEnv, reconcileIntent, type IntentRow } from "../services/payments";
import { D, P, page, RID } from "./helpers";

export const commerce = new Hono<AppEnv>();

commerce.get("/payments/providers", (c) => c.json(paymentRegistry(c.env)));

/** Customer creates a payment intent for an accepted offer. Amount comes from the offer, never the client. */
commerce.post("/payments/intents", rateLimit("pay_intent", 10, 300), async (c) => {
  const p = P(c);
  const input = await body(c, z.object({ offerId: text(60, 5), provider: z.enum(GATEWAY_IDS as [string, ...string[]]), paymentMethod: optText(10), customerName: text(120, 2), customerPhone: optText(30) }));
  const idem = c.req.header("idempotency-key") ?? null;
  if (idem && !/^[\w-]{8,80}$/.test(idem)) fail(400, "INVALID_IDEMPOTENCY_KEY");
  const origin = new URL(c.req.url).origin;
  const result = await createIntent(c.env, D(c), p, { offerId: input.offerId, provider: input.provider as never, paymentMethod: input.paymentMethod, idempotencyKey: idem, origin, requestId: RID(c),
    customer: { name: input.customerName, email: p.email ?? "", phone: input.customerPhone } });
  return c.json(result, 201);
});
commerce.get("/payments/intents", requirePermission("ledger:read"), async (c) => {
  const { limit, offset } = page(c);
  const status = c.req.query("status");
  return c.json({ items: await many(D(c), `SELECT pi.*, o.title AS offer_title FROM payment_intents pi LEFT JOIN offers o ON o.id=pi.offer_id WHERE (? IS NULL OR pi.status=?) ORDER BY pi.created_at DESC LIMIT ? OFFSET ?`, status ?? null, status ?? null, limit, offset) });
});
commerce.get("/payments/events", requirePermission("ledger:read"), async (c) => {
  const { limit, offset } = page(c);
  return c.json({ items: await many(D(c), "SELECT id,provider,provider_event_id,merchant_order_id,event_type,normalized_status,amount,currency,payload_hash,processing_outcome,received_at,processed_at FROM payment_events ORDER BY received_at DESC LIMIT ? OFFSET ?", limit, offset) });
});
commerce.post("/payments/intents/:id/reconcile", requirePermission("ledger:write"), rateLimit("reconcile", 20, 60), async (c) => {
  return c.json(await reconcileIntent(c.env, D(c), idParam(c), P(c).userId, RID(c)));
});
/** Refunds are approval-gated; nothing is sent to a gateway without an approved decision. */
commerce.post("/payments/intents/:id/refunds", requirePermission("ledger:write"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const input = await body(c, z.object({ amount: moneyMinor.min(1), reason: text(1000, 5) }));
  const intent = await mustFind<{ status: string; amount: number; mode: string }>(d, "SELECT status,amount,mode FROM payment_intents WHERE id=?", "PAYMENT_NOT_FOUND", id);
  if (intent.mode !== "live" || intent.status !== "SUCCEEDED") fail(409, "NOT_REFUNDABLE", "Only verified live payments can be refunded.");
  if (input.amount > intent.amount) fail(422, "REFUND_EXCEEDS_PAYMENT");
  const rid = newId("rfd"), aid = newId("apr");
  await d.batch([
    d.prepare("INSERT INTO approvals (id,action,resource_type,resource_id,payload_json,reason,requested_by) VALUES (?,'refund.submit','refund',?,?,?,?)").bind(aid, rid, JSON.stringify({ paymentIntentId: id, amount: input.amount }), input.reason, p.userId),
    d.prepare("INSERT INTO refunds (id,payment_intent_id,amount,reason,status,approval_id,created_by) VALUES (?,?,?,?,'approval_pending',?,?)").bind(rid, id, input.amount, input.reason, aid, p.userId),
    auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: "refund.requested", resourceType: "refund", resourceId: rid, metadata: { amount: input.amount } }),
  ]);
  return c.json({ id: rid, approvalId: aid, status: "approval_pending" }, 201);
});
commerce.get("/refunds", requirePermission("ledger:read"), async (c) => c.json({ items: await many(D(c), "SELECT r.*, pi.merchant_order_id, pi.provider FROM refunds r JOIN payment_intents pi ON pi.id=r.payment_intent_id ORDER BY r.created_at DESC LIMIT 200") }));

/** Contributor payout request: records a payable settlement request. External payout execution is out of scope until approved. */
commerce.post("/payouts", requirePermission("ledger:write"), async (c) => {
  const p = P(c), d = D(c);
  const { taskId } = await body(c, z.object({ taskId: text(60, 5) }));
  const task = await mustFind<{ assignee_user_id: string | null; compensation_minor: number; status: string; executor_type: string }>(d, "SELECT assignee_user_id,compensation_minor,status,executor_type FROM tasks WHERE id=?", "TASK_NOT_FOUND", taskId);
  if (task.executor_type !== "human" || !task.assignee_user_id || task.status !== "done" || task.compensation_minor <= 0) fail(409, "TASK_NOT_PAYABLE", "Only accepted human tasks with compensation create payables.");
  const pid = newId("pyo"), aid = newId("apr");
  const r = await d.prepare("INSERT OR IGNORE INTO payout_requests (id,contributor_user_id,task_id,amount,status,approval_id) VALUES (?,?,?,?,'approval_pending',?)").bind(pid, task.assignee_user_id, taskId, task.compensation_minor, aid).run();
  if (!r.meta.changes) fail(409, "PAYOUT_EXISTS");
  await d.batch([
    d.prepare("INSERT INTO approvals (id,action,resource_type,resource_id,payload_json,reason,requested_by) VALUES (?,'payout.release','payout',?,?,?,?)").bind(aid, pid, JSON.stringify({ taskId, amount: task.compensation_minor }), "Contributor settlement", p.userId),
    auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: "payout.requested", resourceType: "payout", resourceId: pid, metadata: { amount: task.compensation_minor } }),
  ]);
  return c.json({ id: pid, approvalId: aid, status: "approval_pending", note: "Automated gateway payouts are disabled. After approval, record the external transfer reference." }, 201);
});
commerce.post("/payouts/:id/mark-paid", requirePermission("ledger:write"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const { externalReference } = await body(c, z.object({ externalReference: text(120, 4) }));
  const payout = await mustFind<{ status: string; amount: number }>(d, "SELECT status,amount FROM payout_requests WHERE id=?", "PAYOUT_NOT_FOUND", id);
  if (payout.status !== "approved") fail(409, "PAYOUT_NOT_APPROVED");
  await d.prepare("UPDATE payout_requests SET status='paid_externally', external_reference=?, updated_at=datetime('now') WHERE id=? AND status='approved'").bind(externalReference, id).run();
  await postJournal(d, { sourceType: "payout_paid", sourceId: id, createdBy: p.userId, description: `Contributor payout ${id} (${externalReference})`,
    lines: [{ accountId: "acct-contributor-payable", direction: "debit", amount: payout.amount }, { accountId: "acct-bank", direction: "credit", amount: payout.amount }] });
  await audit(d, { requestId: RID(c), actorUserId: p.userId, action: "payout.marked_paid", resourceType: "payout", resourceId: id, metadata: { externalReference } });
  return c.json({ ok: true });
});
commerce.get("/payouts", requirePermission("ledger:read"), async (c) => c.json({ items: await many(D(c), "SELECT pr.*, u.display_name AS contributor_name, t.title AS task_title FROM payout_requests pr JOIN users u ON u.id=pr.contributor_user_id JOIN tasks t ON t.id=pr.task_id ORDER BY pr.created_at DESC LIMIT 200") }));

// ---------- Economic Ledger ----------
commerce.get("/ledger/accounts", requirePermission("ledger:read"), async (c) => c.json({ items: await accountBalances(D(c)), trialBalance: await trialBalance(D(c)) }));
commerce.get("/ledger/journals", requirePermission("ledger:read"), async (c) => {
  const { limit, offset } = page(c);
  const d = D(c);
  const journals = await many<Record<string, unknown>>(d, "SELECT * FROM ledger_journals ORDER BY posted_at DESC, rowid DESC LIMIT ? OFFSET ?", limit, offset);
  const ids = journals.map((j) => j.id as string);
  const entries = ids.length ? await many<Record<string, unknown>>(d, `SELECT e.*, a.code, a.name FROM ledger_entries e JOIN ledger_accounts a ON a.id=e.account_id WHERE e.journal_id IN (${ids.map(() => "?").join(",")})`, ...ids) : [];
  return c.json({ items: journals.map((j) => ({ ...j, entries: entries.filter((e) => e.journal_id === j.id) })) });
});
/** Manual journals (e.g. bank settlement, gateway fees) — must balance; immutable after posting. */
commerce.post("/ledger/journals", requirePermission("ledger:write"), async (c) => {
  const p = P(c);
  const input = await body(c, z.object({ reference: text(80, 4), description: text(300, 5), lines: z.array(z.object({ accountId: text(60, 3), direction: z.enum(["debit", "credit"]), amount: moneyMinor.min(1) })).min(2).max(20) }));
  const res = await postJournal(D(c), { sourceType: "manual", sourceId: input.reference, description: input.description, lines: input.lines, createdBy: p.userId });
  await audit(D(c), { requestId: RID(c), actorUserId: p.userId, action: "ledger.manual_journal", resourceType: "ledger_journal", resourceId: res.journalId, metadata: { duplicate: res.duplicate } });
  return c.json(res, res.duplicate ? 200 : 201);
});
commerce.post("/ledger/journals/:id/reverse", requirePermission("ledger:write"), async (c) => {
  const p = P(c);
  const { reason } = await body(c, z.object({ reason: text(300, 5) }));
  const res = await reverseJournal(D(c), c.req.param("id"), reason, p.userId);
  await audit(D(c), { requestId: RID(c), actorUserId: p.userId, action: "ledger.reversed", resourceType: "ledger_journal", resourceId: c.req.param("id"), metadata: { reversal: res.journalId } });
  return c.json(res, 201);
});
commerce.get("/costs", requirePermission("ledger:read"), async (c) => c.json({ items: await many(D(c), "SELECT * FROM cost_records ORDER BY created_at DESC LIMIT 200") }));
commerce.post("/costs", requirePermission("ledger:write"), async (c) => {
  const p = P(c);
  const input = await body(c, z.object({ missionId: optText(60), category: z.enum(["ai", "search", "scraping", "contributor", "gateway_fee", "partner", "other"]), amountMinor: moneyMinor.min(1), source: text(120, 3), verified: z.boolean().default(false), note: optText(500) }));
  const id = newId("cst");
  await D(c).prepare("INSERT INTO cost_records (id,mission_id,category,amount_minor,currency,source,verified,note,created_by) VALUES (?,?,?,?,'IDR',?,?,?,?)").bind(id, input.missionId, input.category, input.amountMinor, input.source, input.verified ? 1 : 0, input.note, p.userId).run();
  await audit(D(c), { requestId: RID(c), actorUserId: p.userId, action: "cost.recorded", resourceType: "cost", resourceId: id, metadata: input });
  return c.json({ id }, 201);
});
/** Unit economics per mission: verified revenue (live SUCCEEDED + accepted) vs recorded direct costs. */
commerce.get("/economics/missions", requirePermission("ledger:read"), async (c) => {
  const rows = await many<Record<string, number | string | null>>(D(c), `SELECT m.id, m.title, m.status, o.price_minor, o.tax_minor,
      (SELECT pi.amount FROM payment_intents pi WHERE pi.offer_id=m.offer_id AND pi.mode='live' AND pi.status='SUCCEEDED' LIMIT 1) AS verified_paid,
      (SELECT COALESCE(SUM(amount_minor),0) FROM cost_records cr WHERE cr.mission_id=m.id) AS direct_costs,
      (SELECT COALESCE(SUM(amount_minor),0) FROM cost_records cr WHERE cr.mission_id=m.id AND cr.verified=1) AS verified_costs
    FROM missions m JOIN offers o ON o.id=m.offer_id ORDER BY m.created_at DESC LIMIT 200`);
  return c.json({ items: rows.map((r) => {
    const recognized = (r.status === "ACCEPTED" || r.status === "SETTLEMENT_COMPLETED" || r.status === "LEARNING_RECORDED" || r.status === "CLOSED") && r.verified_paid ? Number(r.verified_paid) - Number(r.tax_minor ?? 0) : 0;
    return { ...r, recognized_revenue: recognized, gross_margin: recognized ? recognized - Number(r.direct_costs) : null };
  }) });
});

// ---------- V2: sandbox simulator, maker-checker payment resolution, operator queues ----------
/**
 * Sandbox webhook simulator for MOCK intents only, and only when APP_ENV is not production.
 * Exercises the same applyPaymentStatus path (ledger, invoice, subscription activation) with [SANDBOX] journals.
 */
commerce.post("/payments/intents/:id/simulate", requirePermission("ledger:write"), async (c) => {
  if (isProductionEnv(c.env)) fail(403, "SIMULATOR_DISABLED_IN_PRODUCTION");
  const p = P(c), d = D(c), id = idParam(c);
  const { status } = await body(c, z.object({ status: z.enum(["SUCCEEDED", "FAILED", "EXPIRED", "RECONCILIATION_REQUIRED"]) }));
  const intent = await mustFind<IntentRow>(d, "SELECT * FROM payment_intents WHERE id=?", "PAYMENT_NOT_FOUND", id);
  if (intent.mode !== "mock") fail(409, "LIVE_INTENT", "The simulator never touches live intents.");
  return c.json(await applyPaymentStatus(d, intent, status, { actor: p.userId, requestId: RID(c), source: "sandbox_simulator" }));
});
/** Payment exception handling: finance requests a manual resolution; a DIFFERENT approver decides (governance approvals). */
commerce.post("/payments/intents/:id/manual-resolution", requirePermission("ledger:write"), async (c) => {
  const p = P(c), d = D(c), id = idParam(c);
  const input = await body(c, z.object({ target: z.enum(["SUCCEEDED", "FAILED", "EXPIRED"]), evidence: text(2000, 10) }));
  const intent = await mustFind<{ status: string; amount: number; merchant_order_id: string }>(d, "SELECT status,amount,merchant_order_id FROM payment_intents WHERE id=?", "PAYMENT_NOT_FOUND", id);
  if (!["RECONCILIATION_REQUIRED", "PENDING"].includes(intent.status)) fail(409, "NOT_AN_EXCEPTION", "Only pending or reconciliation-required payments can be resolved manually.");
  if (await one(d, "SELECT 1 AS x FROM approvals WHERE action='payment.manual_resolution' AND resource_id=? AND status='pending'", id)) fail(409, "RESOLUTION_PENDING");
  const aid = newId("apr");
  await d.batch([
    d.prepare("INSERT INTO approvals (id,action,resource_type,resource_id,payload_json,reason,requested_by) VALUES (?,'payment.manual_resolution','payment_intent',?,?,?,?)")
      .bind(aid, id, JSON.stringify({ target: input.target, from: intent.status, amount: intent.amount, order: intent.merchant_order_id }), input.evidence, p.userId),
    auditStatement(d, { requestId: RID(c), actorUserId: p.userId, action: "payment.manual_resolution_requested", resourceType: "payment_intent", resourceId: id, metadata: { target: input.target } }),
  ]);
  return c.json({ approvalId: aid, status: "approval_pending" }, 201);
});
commerce.get("/invoices", requirePermission("ledger:read"), async (c) => c.json({ items: await many(D(c), "SELECT i.*, o.name AS org_name FROM invoices i JOIN organizations o ON o.id=i.org_id ORDER BY i.issued_at DESC LIMIT 200") }));

/** Operator queues: every state has a responsible actor and next action. */
commerce.get("/ops/queues", requirePermission("workspace:read"), async (c) => {
  const d = D(c);
  const [intake, evidence, quoteReady, quotesPending, approvals, paymentExceptions, paidNoMission, blockedTasks, submittedTasks, qa, awaitingAcceptance, disputes, refunds, payouts, support, privacy, contributors] = await Promise.all([
    many(d, "SELECT id,title,urgency,created_at FROM demands WHERE origin='customer' AND status='DEMAND_HYPOTHESIS_CREATED' ORDER BY created_at LIMIT 50"),
    many(d, "SELECT id,title,created_at FROM demands WHERE status='DEMAND_EVIDENCE_PENDING' ORDER BY created_at LIMIT 50"),
    many(d, "SELECT dm.id,dm.title,dm.validated_at FROM demands dm WHERE dm.status='DEMAND_VALIDATED' AND dm.origin='customer' AND NOT EXISTS (SELECT 1 FROM offers o WHERE o.demand_id=dm.id AND o.status IN ('draft','authorization_pending','published','accepted')) LIMIT 50"),
    many(d, "SELECT id,title,version,status,created_at FROM offers WHERE status IN ('draft','authorization_pending') ORDER BY created_at LIMIT 50"),
    many(d, "SELECT id,action,resource_type,resource_id,created_at FROM approvals WHERE status='pending' ORDER BY created_at LIMIT 50"),
    many(d, "SELECT id,merchant_order_id,provider,mode,amount,status,created_at FROM payment_intents WHERE status='RECONCILIATION_REQUIRED' OR (status='PENDING' AND created_at < datetime('now','-1 day')) ORDER BY created_at LIMIT 50"),
    many(d, "SELECT o.id,o.title,pi.mode,pi.verified_at FROM offers o JOIN payment_intents pi ON pi.offer_id=o.id AND pi.status='SUCCEEDED' WHERE o.status='accepted' AND NOT EXISTS (SELECT 1 FROM missions m WHERE m.offer_id=o.id AND m.status NOT IN ('CANCELLED','FAILED')) LIMIT 50"),
    many(d, "SELECT t.id,t.title,m.title AS mission_title FROM tasks t JOIN missions m ON m.id=t.mission_id WHERE t.status='blocked' LIMIT 50"),
    many(d, "SELECT t.id,t.title,t.submission_note,t.mission_id,m.title AS mission_title FROM tasks t JOIN missions m ON m.id=t.mission_id WHERE t.status='review' LIMIT 50"),
    many(d, "SELECT id,title FROM missions WHERE status='QUALITY_REVIEW' LIMIT 50"),
    many(d, "SELECT id,title,updated_at FROM missions WHERE status='AWAITING_ACCEPTANCE' LIMIT 50"),
    many(d, "SELECT ds.id,ds.reason,m.title AS mission_title,ds.created_at FROM disputes ds LEFT JOIN missions m ON m.id=ds.mission_id WHERE ds.status='open' LIMIT 50"),
    many(d, "SELECT id,amount,status,created_at FROM refunds WHERE status IN ('approval_pending','approved','failed') LIMIT 50"),
    many(d, "SELECT id,amount,status FROM payout_requests WHERE status IN ('approval_pending','approved') LIMIT 50"),
    many(d, "SELECT id,subject,created_at FROM support_tickets WHERE status='open' ORDER BY created_at LIMIT 50"),
    many(d, "SELECT id,kind,created_at FROM privacy_requests WHERE kind='delete' AND status IN ('received','in_review') LIMIT 50"),
    many(d, "SELECT user_id,headline,created_at FROM contributor_profiles WHERE status='pending' LIMIT 50"),
  ]);
  return c.json({ queues: [
    { key: "intake", label: "Intake request baru", owner: "operator", link: "/app/w/demand", items: intake },
    { key: "evidence", label: "Validasi bukti", owner: "analyst", link: "/app/w/demand", items: evidence },
    { key: "quote_needed", label: "Tervalidasi — perlu penawaran", owner: "operator", link: "/app/w/commercial", items: quoteReady },
    { key: "quotes", label: "Penawaran draft / menunggu otorisasi", owner: "operator", link: "/app/w/commercial", items: quotesPending },
    { key: "approvals", label: "Persetujuan (maker-checker)", owner: "owner", link: "/app/w/governance", items: approvals },
    { key: "payment_exceptions", label: "Pengecualian pembayaran", owner: "finance", link: "/app/w/ledger", items: paymentExceptions },
    { key: "paid_no_mission", label: "Dibayar — misi belum direncanakan", owner: "operator", link: "/app/w/execution", items: paidNoMission },
    { key: "blocked", label: "Tugas terblokir", owner: "operator", link: "/app/w/execution", items: blockedTasks },
    { key: "submitted", label: "Hasil kontributor menunggu review", owner: "operator", link: "/app/w/execution", items: submittedTasks },
    { key: "qa", label: "Quality review misi", owner: "operator", link: "/app/w/delivery", items: qa },
    { key: "acceptance", label: "Menunggu penerimaan pelanggan", owner: "customer", link: "/app/w/delivery", items: awaitingAcceptance },
    { key: "disputes", label: "Sengketa terbuka", owner: "owner", link: "/app/w/delivery", items: disputes },
    { key: "refunds", label: "Refund", owner: "finance", link: "/app/w/ledger", items: refunds },
    { key: "payouts", label: "Payout kontributor", owner: "finance", link: "/app/w/ledger", items: payouts },
    { key: "support", label: "Tiket dukungan", owner: "operator", link: "/app/w/governance", items: support },
    { key: "privacy", label: "Permintaan penghapusan data", owner: "owner", link: "/app/w/governance", items: privacy },
    { key: "contributors", label: "Aplikasi kontributor", owner: "owner", link: "/app/w/governance", items: contributors },
  ] });
});
