import type { InferenceProvider, InferenceRequest, InferenceResult } from "./types";

/** Deterministic mock used by CI/unit tests and local dev. Clearly labeled; never used in production. */
export class MockInferenceProvider implements InferenceProvider {
  id = "mock" as const;
  isAvailable() { return true; }
  async run(req: InferenceRequest): Promise<InferenceResult> {
    const last = req.messages[req.messages.length - 1]?.content ?? "";
    let text: string;
    if (req.profile === "classification") {
      text = JSON.stringify({ is_demand_signal: /need|butuh|looking for|cari|problem|masalah|help/i.test(last), category: "mock", urgency: "unknown", summary: "MOCK classification — deterministic test output", confidence: 50 });
    } else if (req.profile === "reasoning") {
      text = JSON.stringify({ demand_confidence: 40, commercial_potential: 40, execution_feasibility: 40, strategic_value: 40, risk_level: "medium", rationale: "MOCK assessment — not a real analysis", missing_evidence: ["mock"] });
    } else {
      text = "MOCK draft generated deterministically for tests.";
    }
    return { providerId: this.id, modelId: "mock/deterministic", text, usage: { inputTokens: Math.ceil(last.length / 4), outputTokens: Math.ceil(text.length / 4), estimated: true }, finishReason: "stop", providerRequestId: null };
  }
}
