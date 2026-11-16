import type { InferenceProvider, InferenceRequest, InferenceResult } from "./types";
import { InferenceError } from "./types";

/** Primary/default inference adapter using the native Workers AI binding (env.AI). */
export class WorkersAiProvider implements InferenceProvider {
  id = "workers-ai" as const;
  constructor(private ai: Ai | undefined) {}
  isAvailable() { return Boolean(this.ai); }

  async run(req: InferenceRequest): Promise<InferenceResult> {
    if (!this.ai) throw new InferenceError("PROVIDER_NOT_CONFIGURED", "Workers AI binding AI is missing.");
    const input: Record<string, unknown> = { messages: req.messages, max_tokens: req.maxOutputTokens, temperature: req.temperature };
    if (req.jsonMode) input.response_format = { type: "json_object" };
    let raw: unknown;
    try {
      raw = await (this.ai as unknown as { run: (m: string, i: unknown, o?: unknown) => Promise<unknown> }).run(req.modelId, input, { signal: req.signal });
    } catch (error) {
      throw mapWorkersAiError(error);
    }
    const out = (raw ?? {}) as Record<string, unknown>;
    let text = "";
    if (typeof out.response === "string") text = out.response;
    else if (out.response && typeof out.response === "object") text = JSON.stringify(out.response);
    else if (Array.isArray(out.choices)) text = String(((out.choices[0] as Record<string, unknown>)?.message as Record<string, unknown>)?.content ?? "");
    const usage = (out.usage ?? null) as Record<string, number> | null;
    return {
      providerId: this.id, modelId: req.modelId, text,
      usage: { inputTokens: usage?.prompt_tokens ?? null, outputTokens: usage?.completion_tokens ?? null, estimated: !usage, raw: usage ?? undefined },
      finishReason: typeof out.finish_reason === "string" ? out.finish_reason : null,
      providerRequestId: null,
    };
  }
}

export function mapWorkersAiError(error: unknown): InferenceError {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort/i.test(message)) return new InferenceError("TIMEOUT", message, true);
  if (/(3036|daily free allocation|neurons|quota|allocation)/i.test(message)) return new InferenceError("QUOTA_EXHAUSTED", message, false);
  if (/(429|rate limit|too many|3040)/i.test(message)) return new InferenceError("RATE_LIMITED", message, true);
  if (/(5007|no such model|not found|unknown model)/i.test(message)) return new InferenceError("MODEL_UNAVAILABLE", message, false);
  if (/(5006|invalid input|bad input|validation)/i.test(message)) return new InferenceError("INVALID_INPUT", message, false);
  return new InferenceError("PROVIDER_ERROR", message, true);
}
