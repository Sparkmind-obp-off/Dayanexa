import { Hono } from "hono";
import type { AppEnv } from "../env";
import { requirePermission } from "../middleware/auth";
import { many, one } from "../lib/db";
import { trialBalance } from "../ledger/ledger";
import { D } from "./helpers";

export const metrics = new Hono<AppEnv>();

/**
 * Executive metrics computed ONLY from canonical records. Verified Economic Resolution (VER) =
 * mission accepted + live payment SUCCEEDED + costs recorded + settlement completed.
 */
metrics.get("/metrics/executive", requirePermission("workspace:read"), async (c) => {
  const d = D(c);
  const q = async (sql: string) => (await one<{ n: number }>(d, sql))?.n ?? 0;
  const [signals, hypotheses, validated, opportunities, activeMissions, awaiting, ver, verifiedRevenue, pendingApprovals, disputes, reconciliation, mockIntents] = await Promise.all([
    q("SELECT COUNT(*) AS n FROM signals WHERE status!='discarded'"),
    q("SELECT COUNT(*) AS n FROM demands WHERE status IN ('DEMAND_HYPOTHESIS_CREATED','DEMAND_EVIDENCE_PENDING')"),
    q("SELECT COUNT(*) AS n FROM demands WHERE status='DEMAND_VALIDATED'"),
    q("SELECT COUNT(*) AS n FROM opportunities WHERE status NOT IN ('REJECTED','CLOSED')"),
    q("SELECT COUNT(*) AS n FROM missions WHERE status IN ('TASKS_DECOMPOSED','RESOURCES_ASSIGNED','EXECUTING','QUALITY_REVIEW','READY_FOR_DELIVERY','NEEDS_HUMAN_REVIEW')"),
    q("SELECT COUNT(*) AS n FROM missions WHERE status='AWAITING_ACCEPTANCE'"),
    q(`SELECT COUNT(*) AS n FROM missions m WHERE m.status IN ('SETTLEMENT_COMPLETED','LEARNING_RECORDED','CLOSED')
        AND EXISTS (SELECT 1 FROM payment_intents pi WHERE pi.offer_id=m.offer_id AND pi.mode='live' AND pi.status='SUCCEEDED')
        AND EXISTS (SELECT 1 FROM cost_records cr WHERE cr.mission_id=m.id)`),
    q(`SELECT COALESCE(SUM(e.amount),0) AS n FROM ledger_entries e JOIN ledger_journals j ON j.id=e.journal_id WHERE e.account_id='acct-platform-revenue' AND e.direction='credit' AND j.status='posted'`),
    q("SELECT COUNT(*) AS n FROM approvals WHERE status='pending'"),
    q("SELECT COUNT(*) AS n FROM disputes WHERE status='open'"),
    q("SELECT COUNT(*) AS n FROM payment_intents WHERE status='RECONCILIATION_REQUIRED'"),
    q("SELECT COUNT(*) AS n FROM payment_intents WHERE mode='mock'"),
  ]);
  const funnel = await many(d, "SELECT status, COUNT(*) AS n FROM missions GROUP BY status");
  return c.json({
    asOf: new Date().toISOString(),
    northStar: { verifiedEconomicResolutions: ver, definition: "Accepted + live payment verified + costs recorded + settled" },
    verifiedRevenueMinor: verifiedRevenue, currency: "IDR",
    pipeline: { signals, demandHypotheses: hypotheses, validatedDemand: validated, openOpportunities: opportunities, activeMissions, awaitingAcceptance: awaiting },
    attention: { pendingApprovals, openDisputes: disputes, paymentsNeedingReconciliation: reconciliation },
    integrity: { mockPaymentIntents: mockIntents, mockExcludedFromRevenue: true, ledger: await trialBalance(d) },
    missionFunnel: funnel,
  });
});

metrics.get("/metrics/learning", requirePermission("workspace:read"), async (c) => {
  const d = D(c);
  const [records, providerPerf, demandOutcomes] = await Promise.all([
    many(d, "SELECT l.*, m.title AS mission_title FROM learning_records l LEFT JOIN missions m ON m.id=l.mission_id ORDER BY l.created_at DESC LIMIT 100"),
    many(d, `SELECT provider_id, COUNT(*) AS calls, SUM(status='success') AS ok, SUM(status!='success') AS not_ok, ROUND(AVG(latency_ms)) AS avg_latency_ms, SUM(units) AS units, MAX(unit_type) AS unit_type
      FROM provider_usage GROUP BY provider_id`),
    many(d, "SELECT status, origin, COUNT(*) AS n FROM demands GROUP BY status, origin"),
  ]);
  const ai = await many(d, "SELECT task_profile, model_id, COUNT(*) AS calls, SUM(status='success') AS ok, SUM(status='invalid_output') AS invalid, ROUND(AVG(latency_ms)) AS avg_latency_ms, ROUND(SUM(estimated_neurons),2) AS neurons FROM inference_traces GROUP BY task_profile, model_id");
  return c.json({ records, providerPerformance: providerPerf, aiPerformance: ai, demandOutcomes });
});
