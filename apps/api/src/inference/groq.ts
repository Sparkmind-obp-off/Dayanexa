import type { InferenceProvider, InferenceRequest, InferenceResult } from "./types";
import { InferenceError } from "./types";

/**
 * Optional GroqCloud adapter. DISABLED by default: requires GROQ_ENABLED=true AND a Worker secret
 * AND an explicit model mapping. Never used as an automatic fallback for Workers AI.
 */
export const GROQ_MODEL_MAP: Record<string, string> = {
  "@cf/meta/llama-3.1-8b-instruct-fp8": "llama-3.1-8b-instant",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": "llama-3.3-70b-versatile",
};

export class GroqProvider implements InferenceProvider {
  id = "groq" as const;
  constructor(private enabled: boolean, private apiKey: string | undefined) {}
  isAvailable() { return this.enabled && Boolean(this.apiKey); }
  async run(req: InferenceRequest): Promise<InferenceResult> {
    if (!this.enabled) throw new InferenceError("PROVIDER_DISABLED", "GroqCloud is disabled by policy.");
    if (!this.apiKey) throw new InferenceError("PROVIDER_NOT_CONFIGURED");
    const model = GROQ_MODEL_MAP[req.modelId];
    if (!model) throw new InferenceError("MODEL_UNAVAILABLE", "No approved Groq mapping for this profile.");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", signal: req.signal,
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, messages: req.messages, max_tokens: req.maxOutputTokens, temperature: req.temperature, ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}) }),
    });
    if (res.status === 429) throw new InferenceError("RATE_LIMITED", "Groq rate limit", true);
    if (!res.ok) throw new InferenceError(res.status >= 500 ? "PROVIDER_ERROR" : "INVALID_INPUT", `Groq HTTP ${res.status}`, res.status >= 500);
    const out = await res.json() as Record<string, any>;
    return {
      providerId: this.id, modelId: model, text: String(out.choices?.[0]?.message?.content ?? ""),
      usage: { inputTokens: out.usage?.prompt_tokens ?? null, outputTokens: out.usage?.completion_tokens ?? null, estimated: !out.usage, raw: out.usage },
      finishReason: out.choices?.[0]?.finish_reason ?? null, providerRequestId: res.headers.get("x-request-id"),
    };
  }
}
