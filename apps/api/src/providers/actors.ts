import { fetchJson, mapStatus } from "./net";
import type { ActorRunResponse } from "./types";
import { assertTicket, type DispatchTicket } from "./gateway";
import { ProviderError } from "./types";

/**
 * Apify and Scrape.ly expose a compatible Actor run API. One adapter, two bases.
 * Runs are bounded: allowlisted actor, maxItems, maxTotalChargeUsd, idempotency key, waitForFinish<=60.
 */
const BASES = { apify: "https://api.apify.com", scrapely: "https://api.scrape.ly" } as const;
export type ActorProvider = keyof typeof BASES;

export async function runActor(ticket: DispatchTicket, provider: ActorProvider, actorId: string, input: Record<string, unknown>,
  opts: { maxItems: number; maxChargeUsd: number; idempotencyKey: string; timeoutSeconds?: number }): Promise<ActorRunResponse> {
  const token = assertTicket(ticket, provider).credential;
  if (!token) throw new ProviderError("NOT_CONFIGURED", `${provider} token is not configured`, 503);
  if (!/^[\w.-]+[~/][\w.-]+$/.test(actorId)) throw new ProviderError("INVALID_REQUEST", "Invalid actor id", 400);
  const id = actorId.replace("/", "~");
  const qs = new URLSearchParams({ waitForFinish: "60", maxItems: String(opts.maxItems), maxTotalChargeUsd: String(opts.maxChargeUsd), timeout: String(Math.min(opts.timeoutSeconds ?? 120, 300)), memory: "1024" });
  const started = Date.now();
  const run = await fetchJson(`${BASES[provider]}/v2/acts/${encodeURIComponent(id)}/runs?${qs}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": opts.idempotencyKey },
    body: JSON.stringify(input), timeoutMs: 75_000,
  });
  if (run.status !== 201 && run.status !== 200 && run.status !== 202) mapStatus(run.status, provider, run.headers);
  const data = (run.body.data ?? {}) as Record<string, unknown>;
  const runId = String(data.id ?? "");
  const datasetId = String(data.defaultDatasetId ?? "");
  const usd = typeof data.usageTotalUsd === "number" ? data.usageTotalUsd : 0;
  let items: unknown[] = [];
  if (datasetId && data.status === "SUCCEEDED") {
    const ds = await fetchJson(`${BASES[provider]}/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&limit=${opts.maxItems}`, { headers: { authorization: `Bearer ${token}` }, timeoutMs: 30_000 });
    if (Array.isArray(ds.body)) items = ds.body as unknown[];
    else if (Array.isArray((ds.body as Record<string, unknown>).items)) items = (ds.body as Record<string, unknown>).items as unknown[];
  }
  return { runId, status: String(data.status ?? "UNKNOWN"), items: items.slice(0, opts.maxItems), costUsdMicros: Math.round(usd * 1_000_000), durationMs: Date.now() - started };
}
