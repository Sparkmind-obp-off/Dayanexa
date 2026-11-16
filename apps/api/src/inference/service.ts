import type { z } from "zod";
import type { Env } from "../env";
import { flag, num } from "../lib/http";
import { newId, thisMonth, today } from "../lib/ids";
import { redact } from "../lib/redact";
import { GroqProvider } from "./groq";
import { MockInferenceProvider } from "./mock";
import { estimateNeurons, estimateTokens, TASK_PROFILES } from "./profiles";
import type { ChatMessage, InferenceProvider, InferenceProviderId, InferenceResult, TaskProfileId } from "./types";
import { InferenceError } from "./types";
import { WorkersAiProvider } from "./workersai";
import { GatewayError, governedCall } from "../providers/gateway";

export interface InferenceContext { requestId?: string; orgId?: string | null; userId?: string | null; promptVersion: string; schemaVersion?: string }
export interface InferenceOutcome<T> { traceId: string; providerId: InferenceProviderId; modelId: string; data: T; estimatedNeurons: number; usageEstimated: boolean }

// Per-isolate circuit breaker: opens after 3 consecutive transient failures for 60s.
const breaker = new Map<string, { failures: number; openUntil: number }>();
export const _resetBreaker = () => breaker.clear();

/** Server-side provider policy. No client input participates. No automatic fallback between providers. */
export function selectProvider(env: Env): InferenceProvider {
  const configured = (env.INFERENCE_PROVIDER || "workers-ai") as InferenceProviderId;
  if (configured === "mock") {
    if (env.APP_ENV === "production") throw new InferenceError("PROVIDER_DISABLED", "Mock inference is not allowed in production.");
    return new MockInferenceProvider();
  }
  if (configured === "groq") return new GroqProvider(flag(env.GROQ_ENABLED), env.GROQ_API_KEY);
  return new WorkersAiProvider(env.AI);
}

export function inferenceStatus(env: Env) {
  const provider = (env.INFERENCE_PROVIDER || "workers-ai");
  return {
    defaultProvider: provider,
    workersAi: { bindingPresent: Boolean(env.AI), dailyNeuronBudget: num(env.AI_DAILY_NEURON_BUDGET, 8000), monthlyNeuronBudget: num(env.AI_MONTHLY_NEURON_BUDGET, 200000) },
    groq: { enabled: flag(env.GROQ_ENABLED), secretPresent: Boolean(env.GROQ_API_KEY), automaticFallback: false },
    profiles: Object.fromEntries(Object.entries(TASK_PROFILES).map(([k, v]) => [k, { modelId: v.modelId, maxOutputTokens: v.maxOutputTokens, capabilityCheck: v.capabilityCheck }])),
  };
}

async function usedNeurons(d: D1Database, providerId: string) {
  const row = await d.prepare(`SELECT
      COALESCE(SUM(CASE WHEN day=? THEN estimated_neurons END),0) AS day_total,
      COALESCE(SUM(CASE WHEN month=? THEN estimated_neurons END),0) AS month_total
    FROM inference_traces WHERE provider_id=? AND month=?`).bind(today(), thisMonth(), providerId, thisMonth()).first<{ day_total: number; month_total: number }>();
  return { day: row?.day_total ?? 0, month: row?.month_total ?? 0 };
}

const withTimeout = async <T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([fn(controller.signal), new Promise<T>((_, reject) => controller.signal.addEventListener("abort", () => reject(new InferenceError("TIMEOUT", "Inference timed out", true))))]);
  } finally { clearTimeout(timer); }
};

export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf("{"), end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) { try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* ignore */ } }
  throw new InferenceError("INVALID_OUTPUT", "Model output was not valid JSON.");
}

/**
 * Runs one bounded inference task: policy → budget → breaker → timeout/retry → schema validation → trace.
 * Fails closed with an observable error on budget/quota/rate exhaustion.
 */
export async function runInference<T>(env: Env, d: D1Database, profile: TaskProfileId, messages: ChatMessage[], ctx: InferenceContext, schema?: z.ZodType<T>, providerOverride?: InferenceProvider): Promise<InferenceOutcome<T>> {
  const cfg = TASK_PROFILES[profile];
  const provider = providerOverride ?? selectProvider(env);
  const traceId = newId("inf");
  const inputChars = messages.reduce((n, m) => n + m.content.length, 0);
  const base = { traceId, provider: provider.id, model: cfg.modelId };
  const record = async (status: string, extra: Partial<{ result: InferenceResult; neurons: number; error: string; latency: number; outputChars: number; policy: string }>) => {
    await d.prepare(`INSERT INTO inference_traces (id,provider_id,model_id,task_profile,prompt_version,schema_version,policy_decision,request_id,provider_request_id,org_id,user_id,input_chars,output_chars,input_tokens,output_tokens,estimated_neurons,usage_estimated,usage_payload_json,latency_ms,finish_reason,status,error_code,day,month)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      traceId, provider.id, extra.result?.modelId ?? cfg.modelId, profile, ctx.promptVersion, ctx.schemaVersion ?? null, extra.policy ?? "allowed",
      ctx.requestId ?? null, extra.result?.providerRequestId ?? null, ctx.orgId ?? null, ctx.userId ?? null, inputChars, extra.outputChars ?? 0,
      extra.result?.usage.inputTokens ?? null, extra.result?.usage.outputTokens ?? null, extra.neurons ?? 0, extra.result ? (extra.result.usage.estimated ? 1 : 0) : 1,
      extra.result?.usage.raw ? JSON.stringify(redact(extra.result.usage.raw)) : null, extra.latency ?? null, extra.result?.finishReason ?? null, status, extra.error ?? null, today(), thisMonth()).run();
  };

  if (!provider.isAvailable()) { await record("denied", { error: "PROVIDER_NOT_CONFIGURED", policy: "provider_unavailable" }); throw new InferenceError("PROVIDER_NOT_CONFIGURED", `${provider.id} is not available.`); }
  if (inputChars > cfg.maxInputChars) { await record("denied", { error: "INVALID_INPUT", policy: "input_too_large" }); throw new InferenceError("INVALID_INPUT", `Input exceeds ${cfg.maxInputChars} characters.`); }

  // Budget: reserve the worst case for this request before calling the model.
  const worstCase = estimateNeurons(profile, estimateTokens(inputChars), cfg.maxOutputTokens);
  if (provider.id === "workers-ai") {
    const used = await usedNeurons(d, provider.id);
    const dayBudget = num(env.AI_DAILY_NEURON_BUDGET, 8000), monthBudget = num(env.AI_MONTHLY_NEURON_BUDGET, 200000);
    if (used.day + worstCase > dayBudget || used.month + worstCase > monthBudget) {
      await record("denied", { error: "BUDGET_EXHAUSTED", policy: "budget_exhausted" });
      throw new InferenceError("BUDGET_EXHAUSTED", `Workers AI budget reached (day ${used.day.toFixed(1)}/${dayBudget}, month ${used.month.toFixed(1)}/${monthBudget} neurons). Deferred; no fallback.`);
    }
  }
  const state = breaker.get(provider.id);
  if (state && state.openUntil > Date.now()) { await record("denied", { error: "CIRCUIT_OPEN", policy: "circuit_open" }); throw new InferenceError("CIRCUIT_OPEN", "Provider circuit open; retry later."); }

  const started = Date.now();
  let result: InferenceResult | null = null;
  let lastError: InferenceError | null = null;
  const runOnce = (signal: AbortSignal, ticket?: Parameters<InferenceProvider["run"]>[1]) =>
    provider.run({ profile, modelId: cfg.modelId, messages, maxOutputTokens: cfg.maxOutputTokens, temperature: cfg.temperature, jsonMode: cfg.jsonMode, signal }, ticket);
  if (provider.id === "mock") {
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try { result = await withTimeout(25_000, (signal) => runOnce(signal)); }
      catch (error) { lastError = error instanceof InferenceError ? error : new InferenceError("PROVIDER_ERROR", String(error), true); if (!lastError.transient) break; }
    }
  } else {
    // Every real inference call passes the Provider Runtime Gateway (reserve worst case → dispatch → reconcile).
    const unitType = provider.id === "workers-ai" ? "neurons" : "tokens";
    const estimatedUnits = provider.id === "workers-ai" ? Math.max(worstCase, 0.001) : estimateTokens(inputChars) + cfg.maxOutputTokens;
    try {
      const out = await governedCall(env, d, { providerId: provider.id, capability: `inference:${profile}`, purpose: ctx.promptVersion, unitType, estimatedUnits,
        idempotencyKey: `inf:${traceId}`, orgId: ctx.orgId ?? null, userId: ctx.userId ?? null, requestId: ctx.requestId },
        async (ticket) => {
          const r = await withTimeout(25_000, (signal) => runOnce(signal, ticket));
          const inT = r.usage.inputTokens ?? estimateTokens(inputChars), outT = r.usage.outputTokens ?? estimateTokens(r.text.length);
          return { value: r, unitsActual: provider.id === "workers-ai" ? estimateNeurons(profile, inT, outT) : inT + outT, providerRequestId: r.providerRequestId, usageEstimated: r.usage.estimated };
        });
      result = out.value;
    } catch (error) {
      if (error instanceof GatewayError) {
        const code = error.code === "CIRCUIT_OPEN" ? "CIRCUIT_OPEN" : error.code === "QUOTA_EXHAUSTED" ? "QUOTA_EXHAUSTED"
          : ["BUDGET_EXCEEDED", "CONCURRENCY_LIMIT", "RESERVATION_RACE_LOST"].includes(error.code) ? "BUDGET_EXHAUSTED" : "PROVIDER_DISABLED";
        await record("denied", { error: `GATEWAY_${error.code}`, policy: `gateway_${error.code.toLowerCase()}` });
        throw new InferenceError(code, `[${error.code}] ${error.message}`);
      }
      lastError = error instanceof InferenceError ? error : new InferenceError("PROVIDER_ERROR", String(error), true);
    }
  }
  const latency = Date.now() - started;
  if (!result) {
    const s = breaker.get(provider.id) ?? { failures: 0, openUntil: 0 };
    s.failures += lastError?.transient ? 1 : 0;
    if (s.failures >= 3) { s.openUntil = Date.now() + 60_000; s.failures = 0; }
    breaker.set(provider.id, s);
    await record("failure", { error: lastError?.code ?? "PROVIDER_ERROR", latency });
    throw lastError ?? new InferenceError("PROVIDER_ERROR");
  }
  breaker.delete(provider.id);
  const inTok = result.usage.inputTokens ?? estimateTokens(inputChars);
  const outTok = result.usage.outputTokens ?? estimateTokens(result.text.length);
  const neurons = provider.id === "mock" ? 0 : estimateNeurons(profile, inTok, outTok);
  let data: unknown = result.text;
  if (schema) {
    try {
      const parsed = schema.safeParse(extractJson(result.text));
      if (!parsed.success) throw new InferenceError("INVALID_OUTPUT", "Model output failed schema validation.");
      data = parsed.data;
    } catch (error) {
      await record("invalid_output", { result, neurons, latency, outputChars: result.text.length, error: "INVALID_OUTPUT" });
      throw error instanceof InferenceError ? error : new InferenceError("INVALID_OUTPUT");
    }
  }
  await record("success", { result, neurons, latency, outputChars: result.text.length });
  void base;
  return { traceId, providerId: provider.id, modelId: result.modelId, data: data as T, estimatedNeurons: neurons, usageEstimated: result.usage.estimated };
}
