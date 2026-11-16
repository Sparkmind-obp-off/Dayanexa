import { describe, it, expect, beforeEach } from "vitest";
import { hmacHex, digestHex, md5Hex, safeEqual, hmacBase64 } from "../apps/api/src/lib/crypto";
import { duitkuSign } from "../apps/api/src/payments/gateways/duitku";
import { midtransSignature, midtransStatus } from "../apps/api/src/payments/gateways/midtrans";
import { xenditStatus } from "../apps/api/src/payments/gateways/xendit";
import { FaspayGateway } from "../apps/api/src/payments/gateways/faspay";
import { validateJournal } from "../apps/api/src/ledger/ledger";
import { isAllowed, MISSION_TRANSITIONS, DEMAND_TRANSITIONS, paymentTransitionAllowed } from "../apps/api/src/domain/lifecycle";
import { verifySvixSignature } from "../apps/api/src/auth/svix";
import { assertPublicUrl } from "../apps/api/src/providers/net";
import { PLANS, planByCode, SERVICE_PACKAGES } from "../apps/api/src/domain/plans";
import { runInference, extractJson, _resetBreaker } from "../apps/api/src/inference/service";
import { MockInferenceProvider } from "../apps/api/src/inference/mock";
import { z } from "zod";

describe("crypto", () => {
  it("md5 matches known vector", () => { expect(md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72"); });
  it("sha256 known vector", async () => { expect(await digestHex("SHA-256", "abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"); });
  it("safeEqual", () => { expect(safeEqual("a", "a")).toBe(true); expect(safeEqual("a", "b")).toBe(false); expect(safeEqual("a", "ab")).toBe(false); });
});

describe("payment gateway signatures", () => {
  it("duitku callback = HMAC-SHA256(merchantCode+amount+orderId)", async () => {
    expect(await duitkuSign.callback("k", "D1", "10000", "ORD1")).toBe(await hmacHex("SHA-256", "k", "D110000ORD1"));
    expect(await duitkuSign.inquiry("k", "D1", "ORD1", 10000)).toBe(await hmacHex("SHA-256", "k", "D1ORD110000"));
  });
  it("midtrans signature = SHA512(order+status+gross+key)", async () => {
    expect(await midtransSignature("O1", "200", "10000.00", "SK")).toBe(await digestHex("SHA-512", "O120010000.00SK"));
  });
  it("midtrans/xendit status mapping", () => {
    expect(midtransStatus("settlement")).toBe("SUCCEEDED");
    expect(midtransStatus("capture", "challenge")).toBe("PENDING");
    expect(midtransStatus("expire")).toBe("EXPIRED");
    expect(xenditStatus("PAID")).toBe("SUCCEEDED");
    expect(xenditStatus("EXPIRED")).toBe("EXPIRED");
  });
  it("faspay fails closed without verified contract", () => {
    const g = new FaspayGateway();
    expect(g.isConfigured({ FASPAY_CONTRACT_VERIFIED: "false" } as never)).toBe(false);
  });
});

describe("ledger", () => {
  it("accepts balanced journal", () => {
    expect(() => validateJournal([{ accountId: "a", direction: "debit", amount: 100 }, { accountId: "b", direction: "credit", amount: 100 }])).not.toThrow();
  });
  it("rejects unbalanced, single-line, non-integer", () => {
    expect(() => validateJournal([{ accountId: "a", direction: "debit", amount: 100 }, { accountId: "b", direction: "credit", amount: 99 }])).toThrow();
    expect(() => validateJournal([{ accountId: "a", direction: "debit", amount: 100 }])).toThrow();
    expect(() => validateJournal([{ accountId: "a", direction: "debit", amount: 1.5 }, { accountId: "b", direction: "credit", amount: 1.5 }])).toThrow();
  });
});

describe("lifecycle", () => {
  it("rejects skipping states", () => {
    const states = Object.keys(MISSION_TRANSITIONS);
    expect(states.length).toBeGreaterThan(3);
    expect(isAllowed(MISSION_TRANSITIONS, states[0], "SETTLEMENT_COMPLETED")).toBe(false);
    expect(isAllowed(DEMAND_TRANSITIONS, "UNKNOWN_STATE", "ANY")).toBe(false);
  });
  it("payment never regresses from SUCCEEDED to PENDING", () => {
    expect(paymentTransitionAllowed("SUCCEEDED", "PENDING")).toBe(false);
    expect(paymentTransitionAllowed("PENDING", "SUCCEEDED")).toBe(true);
    expect(paymentTransitionAllowed("REFUNDED", "SUCCEEDED")).toBe(false);
    expect(paymentTransitionAllowed("SUCCEEDED", "REFUND_PENDING")).toBe(true);
  });
});

describe("svix (Clerk webhook)", () => {
  const secretBytes = new TextEncoder().encode("supersecretkey-for-tests-123456");
  const secret = "whsec_" + btoa(String.fromCharCode(...secretBytes));
  it("verifies valid and rejects tampered / stale", async () => {
    const now = 1_800_000_000, body = '{"type":"user.created"}';
    const sig = await hmacBase64(secretBytes, `msg_1.${now}.${body}`);
    const h = new Headers({ "svix-id": "msg_1", "svix-timestamp": String(now), "svix-signature": `v1,${sig}` });
    expect(await verifySvixSignature(secret, h, body, now)).toBe("msg_1");
    expect(await verifySvixSignature(secret, h, body + " ", now)).toBeNull();
    expect(await verifySvixSignature(secret, h, body, now + 1000)).toBeNull();
  });
});

describe("SSRF guard", () => {
  it("blocks internal targets", () => {
    for (const u of ["http://localhost/x", "http://127.0.0.1", "http://10.1.2.3", "http://192.168.1.1", "http://169.254.169.254/latest", "file:///etc/passwd", "http://user:pw@example.com", "http://[::1]/"])
      expect(() => assertPublicUrl(u), u).toThrow();
    expect(assertPublicUrl("https://example.com/a").hostname).toBe("example.com");
  });
});

describe("plans", () => {
  it("free/pro/plus with ascending price", () => {
    expect(PLANS.map((p) => p.code)).toEqual(["free", "pro", "plus"]);
    expect(planByCode("unknown").code).toBe("free");
    expect(SERVICE_PACKAGES.length).toBeGreaterThanOrEqual(4);
  });
});

function fakeD1(used = { day_total: 0, month_total: 0 }) {
  const traces: unknown[][] = [];
  const db = { prepare: (_sql: string) => ({ bind: (...args: unknown[]) => ({ first: async () => used, run: async () => { traces.push(args); return {}; }, all: async () => ({ results: [] }) }) }) };
  return { db: db as unknown as D1Database, traces };
}

describe("inference service", () => {
  beforeEach(() => _resetBreaker());
  it("extractJson handles fenced output", () => { expect(extractJson("```json\n{\"a\":1}\n```")).toEqual({ a: 1 }); });
  it("runs mock with schema and records trace", async () => {
    const { db, traces } = fakeD1();
    const schema = z.object({ is_demand_signal: z.boolean(), confidence: z.number() });
    const out = await runInference({ APP_ENV: "test" } as never, db, "classification", [{ role: "user", content: "saya butuh aplikasi" }], { promptVersion: "t1" }, schema, new MockInferenceProvider());
    expect(out.data.is_demand_signal).toBe(true);
    expect(traces.length).toBe(1);
  });
  it("fails closed when Workers AI budget exhausted", async () => {
    const { db } = fakeD1({ day_total: 8000, month_total: 8000 });
    const fakeAi = { id: "workers-ai" as const, isAvailable: () => true, run: async () => { throw new Error("must not be called"); } };
    await expect(runInference({ APP_ENV: "test" } as never, db, "classification", [{ role: "user", content: "x" }], { promptVersion: "t1" }, undefined, fakeAi as never)).rejects.toMatchObject({ code: "BUDGET_EXHAUSTED" });
  });
  it("mock is rejected in production", async () => {
    const { db } = fakeD1();
    await expect(runInference({ APP_ENV: "production", INFERENCE_PROVIDER: "mock" } as never, db, "classification", [{ role: "user", content: "x" }], { promptVersion: "t1" })).rejects.toMatchObject({ code: "PROVIDER_DISABLED" });
  });
});
