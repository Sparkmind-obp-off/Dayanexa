import type { Env } from "../env";
import { flag, list, num } from "../lib/http";
import { inferenceStatus } from "../inference/service";

export interface ProviderDescriptor {
  id: string; layer: string; role: string; configured: boolean; enabled: boolean; mode: string;
  billingUnit: string; dailyCap: number | null; fallback: string; notes: string; checkedAt: string;
}

/** One registry for every external capability. Listed ≠ enabled. Pricing notes are dated, not guarantees. */
export function providerRegistry(env: Env): ProviderDescriptor[] {
  const specialized = env.SPECIALIZED_SCRAPER || "none";
  const ai = inferenceStatus(env);
  return [
    { id: "workers-ai", layer: "inference", role: "Primary/default inference via env.AI", configured: ai.workersAi.bindingPresent, enabled: ai.defaultProvider === "workers-ai" && ai.workersAi.bindingPresent,
      mode: ai.defaultProvider, billingUnit: "neurons", dailyCap: ai.workersAi.dailyNeuronBudget, fallback: "none — fail closed", notes: "10,000 neurons/day free; $0.011/1k neurons on Workers Paid (docs 2026-11-15). Local wrangler inference also consumes allocation.", checkedAt: "2026-11-15" },
    { id: "groq", layer: "inference", role: "Optional secondary inference (disabled by default)", configured: ai.groq.secretPresent, enabled: ai.groq.enabled,
      mode: ai.groq.enabled ? "enabled-by-owner" : "disabled", billingUnit: "tokens", dailyCap: num(env.GROQ_DAILY_TOKEN_BUDGET, 0), fallback: "never automatic", notes: "Requires owner approval + explicit budget before enabling.", checkedAt: "2026-11-15" },
    { id: "ai-gateway", layer: "inference-control", role: "Optional observability/caching control plane", configured: false, enabled: false, mode: "not-configured",
      billingUnit: "n/a", dailyCap: null, fallback: "n/a", notes: "Unified Billing / third-party models disabled until owner approval.", checkedAt: "2026-11-15" },
    { id: "tavily", layer: "discovery", role: "Search/discovery → signals (not validated demand)", configured: Boolean(env.TAVILY_API_KEY), enabled: Boolean(env.TAVILY_API_KEY),
      mode: "free-tier", billingUnit: "credits", dailyCap: num(env.TAVILY_DAILY_CREDIT_CAP, 25), fallback: "none", notes: "Researcher plan 1,000 credits/month observed via /usage on 2026-11-15.", checkedAt: "2026-11-15" },
    { id: "firecrawl", layer: "extraction", role: "Single-page extraction with provenance", configured: Boolean(env.FIRECRAWL_API_KEY), enabled: Boolean(env.FIRECRAWL_API_KEY),
      mode: "free-tier", billingUnit: "credits", dailyCap: num(env.FIRECRAWL_DAILY_CREDIT_CAP, 25), fallback: "none", notes: "1,000 plan credits observed via credit-usage on 2026-11-15.", checkedAt: "2026-11-15" },
    { id: "apify", layer: "specialized-collection", role: "Actor-based structured collection", configured: Boolean(env.APIFY_API_TOKEN), enabled: specialized === "apify",
      mode: specialized === "apify" ? "selected" : "benchmark-only", billingUnit: "usd", dailyCap: null, fallback: "none", notes: `FREE plan account verified 2026-11-15. Actor allowlist: ${list(env.SPECIALIZED_ACTOR_ALLOWLIST).join(", ") || "empty"}.`, checkedAt: "2026-11-15" },
    { id: "scrapely", layer: "specialized-collection", role: "Actor-based structured collection (alternative)", configured: Boolean(env.SCRAPELY_API_KEY), enabled: specialized === "scrapely",
      mode: specialized === "scrapely" ? "selected" : "benchmark-only", billingUnit: "usd", dailyCap: null, fallback: "none", notes: "Do not activate together with Apify for the same source; select by benchmark.", checkedAt: "2026-11-15" },
    { id: "langgraph", layer: "orchestration", role: "Optional later; DAYANEXA lifecycle remains canonical", configured: false, enabled: false, mode: "not-adopted", billingUnit: "n/a", dailyCap: null, fallback: "n/a", notes: "No documented need yet.", checkedAt: "2026-11-15" },
    { id: "crewai", layer: "experimental", role: "Isolated experiment only", configured: false, enabled: false, mode: "not-adopted", billingUnit: "n/a", dailyCap: null, fallback: "n/a", notes: "Never controls payment, authorization or canonical state.", checkedAt: "2026-11-15" },
  ];
}
export const specializedEnabled = (env: Env) => env.SPECIALIZED_SCRAPER === "apify" || env.SPECIALIZED_SCRAPER === "scrapely";
export const liveFlag = flag;
