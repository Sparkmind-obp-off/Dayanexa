import { fetchJson, mapStatus } from "./net";
import type { SearchResponse } from "./types";
import { assertTicket, type DispatchTicket } from "./gateway";
import { ProviderError } from "./types";

/** Tavily search/discovery. Results are signals, never validated demand. */
export async function tavilySearch(ticket: DispatchTicket, query: string, opts: { maxResults: number; depth: "basic" | "advanced" }): Promise<SearchResponse> {
  const apiKey = assertTicket(ticket, "tavily").credential;
  if (!apiKey) throw new ProviderError("NOT_CONFIGURED", "TAVILY_API_KEY is not configured", 503);
  const { status, body, headers } = await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ query, search_depth: opts.depth, max_results: opts.maxResults, include_answer: false, include_raw_content: false, include_usage: true }),
    timeoutMs: 25_000,
  });
  if (status !== 200) mapStatus(status, "Tavily", headers);
  const results = Array.isArray(body.results) ? body.results as Record<string, unknown>[] : [];
  const usage = body.usage as Record<string, unknown> | undefined;
  const credits = typeof usage?.credits === "number" ? usage.credits : (opts.depth === "advanced" ? 2 : 1);
  return {
    results: results.map((r) => ({ url: String(r.url ?? ""), title: String(r.title ?? ""), content: String(r.content ?? "").slice(0, 2000), score: typeof r.score === "number" ? r.score : null, publishedAt: typeof r.published_date === "string" ? r.published_date : null })).filter((r) => r.url),
    providerRequestId: typeof body.request_id === "string" ? body.request_id : null,
    creditsUsed: credits, usageEstimated: typeof usage?.credits !== "number",
    responseTimeMs: typeof body.response_time === "number" ? Math.round(body.response_time * 1000) : null,
  };
}
