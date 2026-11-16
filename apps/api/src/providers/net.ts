import { ProviderError } from "./types";

/** SSRF guard: only public http(s) hosts; no credentials, internal hosts, IP literals in private ranges. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ProviderError("INVALID_REQUEST", "Invalid URL", 400); }
  if (!["http:", "https:"].includes(url.protocol)) throw new ProviderError("BLOCKED_TARGET", "Only http(s) URLs are allowed", 400);
  if (url.username || url.password) throw new ProviderError("BLOCKED_TARGET", "Credentials in URL are not allowed", 400);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local") || !host.includes(".") && !host.includes(":"))
    throw new ProviderError("BLOCKED_TARGET", "Internal hosts are not allowed", 400);
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224)
      throw new ProviderError("BLOCKED_TARGET", "Private network addresses are not allowed", 400);
  }
  if (host.includes(":") && (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.startsWith("::ffff:")))
    throw new ProviderError("BLOCKED_TARGET", "Private network addresses are not allowed", 400);
  return url;
}

export async function fetchJson(url: string, init: RequestInit & { timeoutMs?: number }): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 300) }; }
    return { status: res.status, body, headers: res.headers };
  } catch (error) {
    if (controller.signal.aborted) throw new ProviderError("TIMEOUT", "Provider request timed out", 504);
    throw new ProviderError("UPSTREAM_ERROR", error instanceof Error ? error.message : "fetch failed");
  } finally { clearTimeout(timer); }
}

export function mapStatus(status: number, provider: string, headers?: Headers): never {
  if (status === 401 || status === 403) throw new ProviderError("NOT_CONFIGURED", `${provider} rejected the credential (HTTP ${status})`, 502);
  if (status === 402) throw new ProviderError("QUOTA_EXHAUSTED", `${provider} quota/credits exhausted (HTTP 402). No paid fallback.`, 503);
  if (status === 429) {
    const ra = Number(headers?.get("retry-after"));
    throw new ProviderError("RATE_LIMITED", `${provider} rate limited`, 429, Number.isFinite(ra) && ra > 0 ? ra : 60);
  }
  if (status >= 400 && status < 500) throw new ProviderError("INVALID_REQUEST", `${provider} rejected the request (HTTP ${status})`, 400);
  throw new ProviderError("UPSTREAM_ERROR", `${provider} upstream error (HTTP ${status})`, 502);
}
