export type ProviderErrorCode = "NOT_CONFIGURED" | "DISABLED" | "CAP_REACHED" | "RATE_LIMITED" | "QUOTA_EXHAUSTED" | "INVALID_REQUEST" | "BLOCKED_TARGET" | "UPSTREAM_ERROR" | "TIMEOUT";
export class ProviderError extends Error {
  constructor(public code: ProviderErrorCode, message?: string, public status = 502) { super(message ?? code); }
}
export interface SearchResult { url: string; title: string; content: string; score: number | null; publishedAt: string | null }
export interface SearchResponse { results: SearchResult[]; providerRequestId: string | null; creditsUsed: number; usageEstimated: boolean; responseTimeMs: number | null }
export interface ExtractResponse { url: string; title: string | null; markdown: string; creditsUsed: number; usageEstimated: boolean; providerRequestId: string | null }
export interface ActorRunResponse { runId: string; status: string; items: unknown[]; costUsdMicros: number; durationMs: number | null }
