export type TaskProfileId = "classification" | "extraction" | "reasoning" | "generation" | "embeddings";
export type InferenceProviderId = "workers-ai" | "mock" | "groq";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface InferenceRequest {
  profile: TaskProfileId;
  modelId: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  temperature: number;
  jsonMode: boolean;
  signal?: AbortSignal;
}

export interface InferenceUsage { inputTokens: number | null; outputTokens: number | null; estimated: boolean; raw?: unknown }

export interface InferenceResult {
  providerId: InferenceProviderId;
  modelId: string;
  text: string;
  usage: InferenceUsage;
  finishReason: string | null;
  providerRequestId: string | null;
}

export type InferenceErrorCode =
  | "PROVIDER_NOT_CONFIGURED" | "PROVIDER_DISABLED" | "BUDGET_EXHAUSTED" | "RATE_LIMITED" | "QUOTA_EXHAUSTED"
  | "MODEL_UNAVAILABLE" | "INVALID_INPUT" | "TIMEOUT" | "CIRCUIT_OPEN" | "PROVIDER_ERROR" | "INVALID_OUTPUT";

export class InferenceError extends Error {
  constructor(public code: InferenceErrorCode, message?: string, public transient = false) { super(message ?? code); }
}

/** Provider-neutral contract. The domain layer never sees provider-specific response shapes. */
export interface InferenceProvider {
  id: InferenceProviderId;
  isAvailable(): boolean;
  /** Real providers require a Provider Runtime Gateway ticket; the mock ignores it. */
  run(request: InferenceRequest, ticket?: import("../providers/gateway").DispatchTicket): Promise<InferenceResult>;
}
