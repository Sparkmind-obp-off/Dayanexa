import { newId, today } from "../lib/ids";

export interface UsageInput {
  providerId: string; operation: string; orgId?: string | null; userId?: string | null;
  units: number; unitType: string; usageEstimated?: boolean; costUsdMicros?: number;
  status: "success" | "failure" | "denied"; errorCode?: string | null; providerRequestId?: string | null; latencyMs?: number | null;
}
export async function recordUsage(d: D1Database, u: UsageInput) {
  await d.prepare(`INSERT INTO provider_usage (id,provider_id,operation,org_id,user_id,units,unit_type,usage_estimated,estimated_cost_usd_micros,status,error_code,provider_request_id,latency_ms,day)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(newId("pus"), u.providerId, u.operation, u.orgId ?? null, u.userId ?? null, u.units, u.unitType,
    u.usageEstimated === false ? 0 : 1, u.costUsdMicros ?? 0, u.status, u.errorCode ?? null, u.providerRequestId ?? null, u.latencyMs ?? null, today()).run();
}
export async function unitsUsedToday(d: D1Database, providerId: string): Promise<number> {
  const row = await d.prepare("SELECT COALESCE(SUM(units),0) AS total FROM provider_usage WHERE provider_id=? AND day=? AND status='success'")
    .bind(providerId, today()).first<{ total: number }>();
  return row?.total ?? 0;
}
