import { assertPublicUrl, fetchJson, mapStatus } from "./net";
import type { ExtractResponse } from "./types";
import { assertTicket, type DispatchTicket } from "./gateway";
import { ProviderError } from "./types";

/** Firecrawl single-page scrape (v2). Extraction, not specialized platform scraping. */
export async function firecrawlScrape(ticket: DispatchTicket, rawUrl: string): Promise<ExtractResponse> {
  const apiKey = assertTicket(ticket, "firecrawl").credential;
  if (!apiKey) throw new ProviderError("NOT_CONFIGURED", "FIRECRAWL_API_KEY is not configured", 503);
  const url = assertPublicUrl(rawUrl).toString();
  const { status, body, headers } = await fetchJson("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 30000, blockAds: true }),
    timeoutMs: 45_000,
  });
  if (status !== 200 || body.success === false) mapStatus(status === 200 ? 502 : status, "Firecrawl", headers);
  const data = (body.data ?? {}) as Record<string, unknown>;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  return {
    url, title: typeof meta.title === "string" ? meta.title : null,
    markdown: String(data.markdown ?? "").slice(0, 20000),
    creditsUsed: typeof meta.creditsUsed === "number" ? meta.creditsUsed : 1,
    usageEstimated: typeof meta.creditsUsed !== "number",
    providerRequestId: typeof meta.scrapeId === "string" ? meta.scrapeId : null,
  };
}
