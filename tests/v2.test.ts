import { describe, it, expect } from "vitest";
import { makeD1 } from "./d1shim";
import { computeWindow, entitlements, assertEntitlement, usageStatement } from "../apps/api/src/services/entitlements";
import { customerNextAction, quoteMargin, quoteSnapshot } from "../apps/api/src/domain/journey";
import { applyPaymentStatus, createIntent, recognizeRevenueForOffer, reconcileMismatch } from "../apps/api/src/services/payments";
import { subscribe } from "../apps/api/src/services/billing";
import { trialBalance, accountBalances } from "../apps/api/src/ledger/ledger";
import { digestHex } from "../apps/api/src/lib/crypto";

const env = { APP_ENV: "test", PAYMENTS_MODE: "mock", PAYMENT_LIVE_ENABLED: "false" } as never;

function seed(raw: any) {
  raw.exec(`INSERT INTO users (id,clerk_user_id,email,status) VALUES ('usr_customer0001','user_c','c@example.com','active'),('usr_staff000001','user_s','s@example.com','active');
    INSERT INTO organizations (id,name,kind,created_by) VALUES ('org_customer0001','Cust','personal','usr_customer0001');
    INSERT INTO memberships (org_id,user_id,role) VALUES ('org_customer0001','usr_customer0001','owner');`);
}
const principal = { userId: "usr_customer0001", clerkUserId: "user_c", email: "c@example.com", status: "active", roles: ["member"], orgIds: ["org_customer0001"], primaryOrgId: "org_customer0001" } as never;

async function acceptedQuote(raw: any, price = 1_000_000, tax = 110_000) {
  raw.exec(`INSERT INTO offers (id,org_id,customer_org_id,quote_group_id,version,title,scope,deliverables,exclusions,acceptance_criteria,refund_terms,delivery_days,price_minor,tax_minor,status,valid_days)
    VALUES ('ofr_test0000001','org_customer0001','org_customer0001','ofr_test0000001',1,'Sprint','scope scope scope scope','d','e','a','r',7,${price},${tax},'draft',14)`);
  const row = raw.prepare("SELECT * FROM offers WHERE id='ofr_test0000001'").get();
  const snap = quoteSnapshot(row); const hash = await digestHex("SHA-256", snap);
  raw.prepare("UPDATE offers SET status='authorization_pending', snapshot_json=?, snapshot_hash=? WHERE id='ofr_test0000001'").run(snap, hash);
  raw.exec("UPDATE offers SET status='published', published_at=datetime('now'), valid_until=datetime('now','+14 days') WHERE id='ofr_test0000001'");
  raw.prepare("UPDATE offers SET status='accepted', accepted_by='usr_customer0001', accepted_at=datetime('now'), accepted_snapshot_hash=? WHERE id='ofr_test0000001'").run(hash);
  return hash;
}

describe("entitlement window (V2: one window for UI + API)", () => {
  it("rolling 30-day cycles from anchor", () => {
    const day = 86_400_000, a = Date.UTC(2026, 0, 1);
    expect(computeWindow(a, a + 5 * day)).toEqual({ start: a, end: a + 30 * day });
    expect(computeWindow(a, a + 31 * day).start).toBe(a + 30 * day);
  });
  it("free plan quota enforced server-side from usage_events", async () => {
    const { d1, raw } = makeD1(); seed(raw);
    await usageStatement(d1, "org_customer0001", "usr_customer0001", "request", "x1").run();
    await usageStatement(d1, "org_customer0001", "usr_customer0001", "request", "x2").run();
    const e = await entitlements(d1, "org_customer0001");
    expect(e.plan.code).toBe("free"); expect(e.usage.requests).toBe(2); expect(e.window.basis).toBe("rolling_30_days");
    await expect(assertEntitlement(d1, "org_customer0001", "request")).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });
    await expect(assertEntitlement(d1, "org_customer0001", "ai_assist")).rejects.toMatchObject({ code: "PLAN_FEATURE_REQUIRED" });
  });
});

describe("customer journey next action", () => {
  it("always names a responsible actor", () => {
    expect(customerNextAction({ demandStatus: "DEMAND_HYPOTHESIS_CREATED", offers: [], payments: [], missions: [] }).actor).toBe("dayanexa");
    expect(customerNextAction({ demandStatus: "DEMAND_VALIDATED", offers: [{ id: "o", status: "published", version: 2 }], payments: [], missions: [] }).code).toBe("REVIEW_QUOTE");
    expect(customerNextAction({ demandStatus: "DEMAND_VALIDATED", offers: [{ id: "o", status: "accepted", version: 1 }], payments: [], missions: [] }).code).toBe("PAY");
    expect(customerNextAction({ demandStatus: "DEMAND_VALIDATED", offers: [{ id: "o", status: "accepted", version: 1 }], payments: [{ offer_id: "o", status: "SUCCEEDED", mode: "mock" }], missions: [{ id: "m", offer_id: "o", status: "AWAITING_ACCEPTANCE" }] }).code).toBe("REVIEW_DELIVERY");
  });
  it("margin + stable snapshot", () => {
    expect(quoteMargin(1_000_000, 600_000)).toEqual({ margin: 400_000, bps: 4000 });
    expect(quoteSnapshot({ price_minor: 1, title: "a" })).toBe(quoteSnapshot({ title: "a", price_minor: 1 }));
  });
  it("reconciliation detects amount/currency/order mismatch", () => {
    const i = { merchant_order_id: "DX1", amount: 1000, currency: "IDR" };
    expect(reconcileMismatch(i, { orderId: "DX1", amount: 999, currency: "IDR", status: "SUCCEEDED" })).toBe("amount");
    expect(reconcileMismatch(i, { orderId: "DX1", amount: 1000, currency: "USD", status: "SUCCEEDED" })).toBe("currency");
    expect(reconcileMismatch(i, { orderId: "DX1", amount: null, currency: null, status: "SUCCEEDED" })).toBe("amount_missing");
    expect(reconcileMismatch(i, { orderId: "DX1", amount: 1000, currency: "IDR", status: "SUCCEEDED" })).toBeNull();
  });
});

describe("sandbox money flow end-to-end (real migrations + triggers)", () => {
  it("quote → intent+invoice → verified payment → acceptance → revenue; tax separate; ledger balanced; idempotent", async () => {
    const { d1, raw } = makeD1(); seed(raw);
    await acceptedQuote(raw);
    expect(() => raw.exec("UPDATE offers SET price_minor=1 WHERE id='ofr_test0000001'")).toThrow(/immutable/);
    const intent: any = await createIntent(env, d1, principal, { offerId: "ofr_test0000001", provider: "midtrans", idempotencyKey: "idem-key-0001", origin: "https://x", requestId: "r1", customer: { name: "C", email: "c@example.com" } });
    expect(intent.mode).toBe("mock"); expect(intent.amount).toBe(1_110_000);
    const replay: any = await createIntent(env, d1, principal, { offerId: "ofr_test0000001", provider: "midtrans", idempotencyKey: "idem-key-0001", origin: "https://x", requestId: "r1", customer: { name: "C", email: "c@example.com" } });
    expect(replay.replayed).toBe(true);
    const inv: any = raw.prepare("SELECT * FROM invoices WHERE payment_intent_id=?").get(intent.id);
    expect(inv.kind).toBe("project"); expect(inv.total_minor).toBe(1_110_000); expect(inv.tax_minor).toBe(110_000);
    const row: any = raw.prepare("SELECT * FROM payment_intents WHERE id=?").get(intent.id);
    expect((await applyPaymentStatus(d1, row, "SUCCEEDED", { actor: "usr_staff000001", requestId: "r2", source: "sandbox_simulator" })).applied).toBe(true);
    const after: any = raw.prepare("SELECT * FROM payment_intents WHERE id=?").get(intent.id);
    expect((await applyPaymentStatus(d1, after, "PENDING", { actor: null, requestId: "r3", source: "webhook" })).applied).toBe(false); // out-of-order regression ignored
    expect((await applyPaymentStatus(d1, row, "SUCCEEDED", { actor: null, requestId: "r4", source: "webhook" })).applied).toBe(false); // stale duplicate
    expect((raw.prepare("SELECT status FROM invoices WHERE payment_intent_id=?").get(intent.id) as any).status).toBe("paid");
    await recognizeRevenueForOffer(d1, "ofr_test0000001", "usr_customer0001");
    const bal = Object.fromEntries((await accountBalances(d1)).map((a: any) => [a.id, a.balance]));
    expect(bal["acct-gateway-clearing"]).toBe(1_110_000);
    expect(bal["acct-tax-payable"]).toBe(110_000);
    expect(bal["acct-platform-revenue"]).toBe(1_000_000);
    expect(bal["acct-unearned-revenue"]).toBe(0);
    expect((await trialBalance(d1)).balanced).toBe(true);
    expect(() => raw.exec("UPDATE ledger_entries SET amount=1")).toThrow(/immutable/);
  });
  it("subscription: separate invoice + subscription revenue, activated only after verified payment", async () => {
    const { d1, raw } = makeD1(); seed(raw);
    const r: any = await subscribe(env, d1, principal, { planCode: "pro", provider: "midtrans", customerName: "C", origin: "https://x", requestId: "r1", idempotencyKey: "idem-sub-0001" });
    expect(r.amount).toBe(149_000);
    expect((await entitlements(d1, "org_customer0001")).plan.code).toBe("free");
    const inv: any = raw.prepare("SELECT * FROM invoices WHERE payment_intent_id=?").get(r.id);
    expect(inv.kind).toBe("subscription"); expect(inv.offer_id).toBeNull();
    const row: any = raw.prepare("SELECT * FROM payment_intents WHERE id=?").get(r.id);
    await applyPaymentStatus(d1, row, "SUCCEEDED", { actor: "usr_staff000001", requestId: "r2", source: "sandbox_simulator" });
    const e = await entitlements(d1, "org_customer0001");
    expect(e.plan.code).toBe("pro"); expect(e.window.basis).toBe("subscription_period");
    const bal = Object.fromEntries((await accountBalances(d1)).map((a: any) => [a.id, a.balance]));
    expect(bal["acct-subscription-revenue"]).toBe(149_000); expect(bal["acct-platform-revenue"]).toBe(0);
    expect((await trialBalance(d1)).balanced).toBe(true);
  });
});
