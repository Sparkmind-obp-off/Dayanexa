import { describe, it, expect, vi, beforeAll } from "vitest";
import { makeD1 } from "./d1shim";

// Session verification is mocked (token = Clerk user id). Everything else — routing, middleware,
// principal resolution, permissions and SQL — is the real application on the real migrations.
vi.mock("../apps/api/src/auth/clerk", () => ({
  verifySession: async (token: string) => (token ? { clerkUserId: token, sessionId: null } : null),
  fetchClerkUser: async () => null,
  isGoogleAccount: () => true,
}));
const { createApp } = await import("../apps/api/src/index");

const { d1, raw } = makeD1();
const env = { APP_ENV: "test", DB: d1, CLERK_JWT_KEY: "test", PAYMENTS_MODE: "mock", PAYMENT_LIVE_ENABLED: "false", ARTIFACT_SIGNING_SECRET: "test-signing-secret-value" } as never;
const app = createApp();
const call = (who: string | null, method: string, path: string, body?: unknown) =>
  app.request(`/api/v1${path}`, { method, headers: { ...(who ? { authorization: `Bearer ${who}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }, env);

beforeAll(() => {
  raw.exec(`
    INSERT INTO users (id,clerk_user_id,email,status) VALUES
      ('usr_alice0000001','user_alice','alice@example.com','active'),
      ('usr_bob000000001','user_bob','bob@example.com','active'),
      ('usr_owner0000001','user_owner','owner@example.com','active'),
      ('usr_finance00001','user_fin','fin@example.com','active');
    INSERT INTO organizations (id,name,kind,created_by) VALUES
      ('org_alice0000001','Alice','personal','usr_alice0000001'),
      ('org_bob000000001','Bob','personal','usr_bob000000001'),
      ('org_owner0000001','Owner','personal','usr_owner0000001'),
      ('org_finance00001','Fin','personal','usr_finance00001');
    INSERT INTO memberships (org_id,user_id,role) VALUES
      ('org_alice0000001','usr_alice0000001','owner'),('org_bob000000001','usr_bob000000001','owner'),
      ('org_owner0000001','usr_owner0000001','owner'),('org_finance00001','usr_finance00001','owner');
    INSERT INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES
      ('usr_alice0000001','member','platform','global','system'),('usr_bob000000001','member','platform','global','system'),
      ('usr_owner0000001','owner','platform','global','test'),('usr_finance00001','finance','platform','global','test');
    INSERT INTO demands (id,org_id,origin,title,problem,status,created_by) VALUES
      ('dem_alice0000001','org_alice0000001','customer','Alice demand','Alice private problem text','DEMAND_VALIDATED','usr_alice0000001');
    INSERT INTO offers (id,org_id,customer_org_id,demand_id,quote_group_id,version,title,scope,deliverables,exclusions,acceptance_criteria,refund_terms,delivery_days,price_minor,tax_minor,status,snapshot_hash)
      VALUES ('ofr_alice0000001','org_alice0000001','org_alice0000001','dem_alice0000001','ofr_alice0000001',1,'Alice quote','s','d','e','a','r',7,1000000,0,'published','${"a".repeat(64)}');
    INSERT INTO missions (id,org_id,offer_id,title,status) VALUES ('msn_alice0000001','org_alice0000001','ofr_alice0000001','Alice mission','AWAITING_ACCEPTANCE');
    INSERT INTO artifacts (id,mission_id,r2_key,filename,content_type,size_bytes,sha256) VALUES ('art_alice0000001','msn_alice0000001','missions/x/a','a.pdf','application/pdf',1,'x');
    INSERT INTO notifications (id,user_id,kind,title) VALUES ('ntf_alice0000001','usr_alice0000001','k','Alice notice');
  `);
});

describe("regression: provider-admin middleware must not leak onto sibling routers", () => {
  it("customers can still use billing (mounted after provider-admin)", async () => {
    const r = await call("user_alice", "GET", "/billing");
    expect(r.status).toBe(200);
  });
  it("finance keeps ledger access; operator-level routes are not owner-gated", async () => {
    expect((await call("user_fin", "GET", "/ledger/accounts")).status).toBe(200);
    expect((await call("user_fin", "GET", "/invoices")).status).toBe(200);
  });
  it("admin APIs stay owner-only", async () => {
    for (const path of ["/admin/provider-policies", "/admin/gateway/status", "/admin/usage-reservations", "/admin/fallback-rules"]) {
      expect((await call("user_alice", "GET", path)).status, path).toBe(403);
      expect((await call("user_fin", "GET", path)).status, path).toBe(403);
      expect((await call("user_owner", "GET", path)).status, path).toBe(200);
    }
  });
  it("unauthenticated requests get 401 everywhere", async () => {
    for (const path of ["/me", "/billing", "/admin/gateway/status", "/requests"]) expect((await call(null, "GET", path)).status, path).toBe(401);
  });
});

describe("tenant isolation: another customer cannot read or act on Alice's records", () => {
  const cases: [string, string, unknown?][] = [
    ["GET", "/requests/dem_alice0000001"],
    ["GET", "/demands/dem_alice0000001"],
    ["GET", "/missions/msn_alice0000001"],
    ["GET", "/offers/ofr_alice0000001/versions"],
    ["POST", "/offers/ofr_alice0000001/accept", { confirmTerms: true, snapshotHash: "a".repeat(64) }],
    ["POST", "/missions/msn_alice0000001/acceptance", { decision: "accept", note: "looks good" }],
    ["POST", "/artifacts/art_alice0000001/link"],
    ["POST", "/payments/intents", { offerId: "ofr_alice0000001", provider: "midtrans", customerName: "Bob" }],
  ];
  for (const [method, path, body] of cases) {
    it(`${method} ${path} → 404 for Bob`, async () => {
      const r = await call("user_bob", method, path, body);
      expect(r.status).toBe(404);
      expect(await r.text()).not.toContain("Alice private problem text");
    });
  }
  it("Alice can read her own request and mint her own artifact link", async () => {
    expect((await call("user_alice", "GET", "/requests/dem_alice0000001")).status).toBe(200);
    expect((await call("user_alice", "POST", "/artifacts/art_alice0000001/link")).status).toBe(200);
  });
  it("list endpoints never include other tenants' rows", async () => {
    const bob = await (await call("user_bob", "GET", "/requests")).json() as Record<string, unknown[]>;
    for (const k of ["demands", "offers", "missions", "payments", "invoices"]) expect(bob[k], k).toHaveLength(0);
    const demands = await (await call("user_bob", "GET", "/demands")).json() as { items: unknown[] };
    expect(demands.items).toHaveLength(0);
  });
  it("Bob cannot mark Alice's notification as read", async () => {
    await call("user_bob", "POST", "/notifications/ntf_alice0000001/read");
    expect(raw.prepare("SELECT read_at FROM notifications WHERE id='ntf_alice0000001'").get().read_at).toBeNull();
  });
  it("Bob cannot attach a support ticket to Alice's request, and it never appears in her request detail", async () => {
    const r = await call("user_bob", "POST", "/support", { subject: "Injected subject", body: "trying to attach to another tenant", relatedType: "demand", relatedId: "dem_alice0000001" });
    expect(r.status).toBe(404);
    // Even if such a row existed (legacy data), the detail view filters by the request's org.
    raw.exec(`INSERT INTO support_tickets (id,org_id,user_id,subject,body,related_type,related_id) VALUES ('sup_legacy000001','org_bob000000001','usr_bob000000001','Legacy injected','x','demand','dem_alice0000001')`);
    const detail = await (await call("user_alice", "GET", "/requests/dem_alice0000001")).text();
    expect(detail).not.toContain("Legacy injected");
    expect(detail).not.toContain("Injected subject");
  });
  it("Alice can attach a support ticket to her own request", async () => {
    expect((await call("user_alice", "POST", "/support", { subject: "Question", body: "about my own request", relatedType: "demand", relatedId: "dem_alice0000001" })).status).toBe(201);
  });
});
