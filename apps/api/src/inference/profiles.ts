import type { TaskProfileId } from "./types";

export interface ModelPricing { inputNeuronsPerM: number; outputNeuronsPerM: number }

/**
 * Server-side pinned task profiles. Model IDs and neuron rates were read from the official
 * Cloudflare Workers AI catalog/pricing pages on 2026-11-15. Re-verify before changing budgets.
 * Clients can never choose a model: only a profile ID, which the server maps here.
 */
export const TASK_PROFILES: Record<TaskProfileId, {
  modelId: string; maxOutputTokens: number; temperature: number; jsonMode: boolean; maxInputChars: number;
  pricing: ModelPricing; capabilityCheck: string;
}> = {
  classification: {
    modelId: "@cf/meta/llama-3.1-8b-instruct-fp8", maxOutputTokens: 300, temperature: 0, jsonMode: true, maxInputChars: 6000,
    pricing: { inputNeuronsPerM: 13778, outputNeuronsPerM: 26128 },
    capabilityCheck: "catalog: text-generation, multilingual dialogue; JSON validated post-hoc by schema",
  },
  extraction: {
    modelId: "@cf/meta/llama-3.1-8b-instruct-fp8", maxOutputTokens: 500, temperature: 0, jsonMode: true, maxInputChars: 12000,
    pricing: { inputNeuronsPerM: 13778, outputNeuronsPerM: 26128 },
    capabilityCheck: "catalog: text-generation; structured output validated by schema",
  },
  reasoning: {
    modelId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", maxOutputTokens: 700, temperature: 0.2, jsonMode: true, maxInputChars: 12000,
    pricing: { inputNeuronsPerM: 26668, outputNeuronsPerM: 204805 },
    capabilityCheck: "catalog: text-generation, function calling capable; JSON validated by schema",
  },
  generation: {
    modelId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", maxOutputTokens: 800, temperature: 0.4, jsonMode: false, maxInputChars: 8000,
    pricing: { inputNeuronsPerM: 26668, outputNeuronsPerM: 204805 },
    capabilityCheck: "catalog: text-generation; drafts only, always human-reviewed",
  },
  embeddings: {
    modelId: "@cf/baai/bge-m3", maxOutputTokens: 0, temperature: 0, jsonMode: false, maxInputChars: 8000,
    pricing: { inputNeuronsPerM: 1075, outputNeuronsPerM: 0 },
    capabilityCheck: "catalog: multilingual embeddings",
  },
};

export const PROMPT_VERSIONS = {
  signalClassify: "signal-classify@1",
  opportunityAssist: "opportunity-assess-assist@1",
  solutionDraft: "solution-draft@1",
} as const;

/** Rough token estimate (~4 chars/token) used only when the provider returns no usage payload. */
export const estimateTokens = (chars: number) => Math.ceil(chars / 4);

export function estimateNeurons(profile: TaskProfileId, inputTokens: number, outputTokens: number): number {
  const p = TASK_PROFILES[profile].pricing;
  return (inputTokens * p.inputNeuronsPerM + outputTokens * p.outputNeuronsPerM) / 1_000_000;
}
