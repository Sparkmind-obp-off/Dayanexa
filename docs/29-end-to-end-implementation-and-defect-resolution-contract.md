# DAYANEXA — End-to-End Implementation, Defect Resolution & Acceptance Contract

**Version:** 1.0  
**Date:** 16 November 2026  
**Authority:** subordinate to `docs/00-DAYANEXA-CANONICAL-MASTER-SYSTEM.md`; binding execution contract for the full implementation prompt.  
**Repository:** `Sparkmind-obp-off/Dayanexa`, branch `main`  
**Release model:** local validation + manual Cloudflare Wrangler. No GitHub Actions CI/CD.

## 1. Mission — implement the product, not merely describe it

Complete DAYANEXA as one integrated Demand-to-Execution OS. The task is not satisfied by documentation, architecture diagrams, static screens, CRUD, seeded records, mock dashboards, placeholder buttons, or isolated modules. Every accepted concept must be traced to a real domain contract, persistent state where needed, server-authorized API, working UI/workflow, automated test and observable evidence.

Preserve working foundations. Audit first, fix defects in place, extend additively, and prove integration. Never perform a destructive rewrite merely to make the architecture look cleaner.

## 2. Required end-to-end product chain

Implement and connect this canonical chain:

`DemandBrief → DiscoveryJob → SourceRun → Signal → Evidence → DemandCluster → DemandHypothesis → DemandValidation → Opportunity → OpportunityAssessment → SolutionSpec → CapabilityPlan → CapabilityBuild/Acquire/Partner → ReadinessProof → ApprovedMission → TaskGraph → AgentRun/ToolInvocation or HumanAssignment → Artifact/TestReport/Demo → QualityReview → MarketPresentation/Consent → Response/Feedback → Offer/Quote/Acceptance → Invoice/Payment → Delivery/CustomerAcceptance → Settlement/Ledger → Learning/Performance → next discovery cycle`

Every transition must have:
- canonical entity/state and allowed transition;
- actor, tenant, scope and permission check;
- input/output schema validation;
- idempotency and retry/timeout behavior where relevant;
- budget reservation and cost attribution for metered work;
- audit/event history and user-visible status;
- failure, cancellation, expiry and recovery path;
- acceptance tests for both success and denial/failure.

A transition must not silently skip a validation, approval, payment or acceptance gate.

## 3. Five engines and their implementation outcomes

### Engine 1 — Demand Discovery
Implement persistent discovery briefs/jobs, source registry, source permission/terms snapshots, provider/Actor selection, schema-driven inputs, pagination, stable idempotency, partial results, retry/cancel/resume, run history and complete source/provider cost reconciliation. Search results are signals, never automatically validated demand.

Required proof: a permitted source run produces traceable signals with original URLs, timestamps, source identity, content hashes, provider run IDs, normalized fields and cost attribution. An Actor cannot run unless its registry record, schema, approval expiry, terms and hard cap pass.

### Engine 2 — Demand Intelligence
Implement persistent niche taxonomy, DemandCluster membership/version/history, normalization, deduplication, near-duplicate handling, source independence, corroboration/contradiction, confidence, demand evidence, rubric-versioned assessment and confirmation experiments. Human review remains explicit for validation decisions.

Required proof: each validated demand links to inspectable independent evidence; cluster split/merge does not lose provenance; stale, duplicate or contradictory evidence is visible; unsupported hypotheses cannot become opportunities.

### Engine 3 — Capability & Solution Foundry
Implement versioned SolutionSpec, feature-to-demand/evidence traceability, capability inventory and gaps, reuse/compose/build/acquire-license/integrate/partner/contributor/defer/reject decisions, build plans, cost/risk/ownership/licensing analysis, test evidence and readiness gates.

Required proof: a solution cannot be marked ready because a row says so. Required capabilities have test/evidence-backed readiness, unresolved risks and owner approvals are visible, and the solution maps to validated demand.

### Engine 4 — Agentic Execution
Implement actual AgentRun and ToolInvocation runtime, Tool Registry, typed input/output schemas, least-privilege scopes, policy checks, durable task graph, budget reservation, idempotency, attempt history, timeout/retry/cancel, output validation, artifact storage, test/security reports and human escalation. Agents are execution workers, not identities with unrestricted access.

Use Cloudflare-native Queues/Workflows only where durable asynchronous work requires them. Keep canonical lifecycle and business state in DAYANEXA. No agent may grant itself access, approve its own work, accept a quote, authorize paid use, contact a customer or perform a financial action without the required human approval.

Required proof: one real controlled mission takes validated demand through approved solution and task graph to a working private demo/artifact with build SHA, test report, cost, quality review and revocation path.

### Engine 5 — Market Delivery
Implement demo lifecycle, private preview, expiry/revocation, lawful market presentation, consent/legal-basis evidence, approval, opt-out/suppression, response capture, feedback, demand traceability, immutable offer/quote version, customer acceptance, invoice, verified payment, delivery acceptance, dispute, refund/settlement and learning loop.

Required proof: a consented demo can be presented through an approved channel, response is captured against the originating demand, quote/acceptance is immutable and payment is confirmed server-side. No unsolicited external contact, public demo or live payment without explicit approval.

## 4. Cross-cutting product and control-plane scope

Implement all role journeys and the 15 workspaces: the original 14 role-based workspaces plus the owner-only Admin & Resource Control Center. Do not treat the count or navigation entry as completion.

Required roles: owner, operator, finance, analyst, customer, contributor and other explicitly defined tenant roles. Enforce RBAC/ABAC server-side on every route, nested resource, join, background job, artifact, export and mutation. Test cross-tenant ID substitution and privilege escalation.

Admin & Resource Control Center must provide functional customer/contributor administration; provider/account registry; Actor registry/schema/approval; provider policy and quota; cost/usage and reservations/reconciliation; mission economics; infrastructure health; approvals; incidents; audit; backup/restore evidence. All mutations require owner-authorized API, persistence, validation, before/after audit and tests. No display-only controls.

## 5. Provider Runtime Gateway — mandatory external-call boundary

Every outbound provider request, including search, extraction, Actor, inference, queue, scheduled and agent calls, must pass through the single server-side gateway.

Before dispatch verify:
1. caller, tenant, mission, task, purpose, environment and data class;
2. active provider/account/credential reference and exact capability authorization;
3. source permission, provider terms, region and privacy compatibility;
4. health, rate limit, concurrency and fresh quota;
5. provider allowance and DAYANEXA per-request/daily/monthly/mission caps;
6. explicit paid-use approval if any paid exposure exists;
7. atomic reservation and idempotency.

After dispatch persist provider run/request ID, state, units, cost provenance, error/retryability and audit; reconcile actual usage and release unused reservation. Unknown charge must be held and reconciled before retry. Unknown/stale quota or pricing fails closed.

Provider-specific units stay distinct: Workers AI Neurons/model; Groq model/account; Tavily requests/credits/features; Firecrawl pages/depth/concurrency; Apify Actor compute/proxy/storage/dataset; Scrape.ly its verified task-specific units. Apify OR Scrape.ly per source/task unless a measured, owner-approved benchmark justifies both. No account rotation to evade 429, bans, suspensions, trial/free-tier restrictions or terms. Paid fallback, overage, top-up and subscriptions remain OFF without explicit scoped owner approval.

## 6. Identity, security, privacy and data integrity

- Clerk Production Google Sign-In only, unless owner changes the decision. No mock auth in production, no password/magic-link fallback, no unrelated Clerk app changes.
- Resolve the public Clerk publishable key at Vite build time per docs/27. Never bundle Clerk secret, JWT verification key, webhook secret or provider tokens.
- Owner bootstrap uses verified Google identity plus server-side allowlist; client metadata cannot grant privileges.
- Enforce tenant isolation, least privilege, rate limiting, SSRF defenses, safe upload/MIME/size checks, signed short-lived R2 links, secret redaction, retention, export/deletion requests, backup and restore.
- Additive D1 migrations only. No destructive migration, production DB mutation or data deletion without a separate reviewed runbook, backup and explicit owner approval.
- Audit high-impact changes, provider decisions, customer/contributor actions, approvals, financial transitions and data access.

## 7. Commercial and economic truth

Keep SaaS access subscriptions separate from project execution, managed operations, metered add-ons and future marketplace commission. Existing Free/Pro/Plus and service prices remain hypotheses until validated; do not claim market validation.

Use immutable quotes and acceptance hashes. Verify payments through signed, deduplicated webhooks and server-side inquiry/reconciliation; browser redirects are not proof. Keep payment mock mode and live payments disabled until merchant setup, sandbox, webhook and owner approval pass.

Separate gross charge, tax, discount, gateway fee, refund/chargeback, net cash, platform revenue, provider cost, human compensation, contributor payable and mission margin. Revenue is not recognized merely because a payment intent or invoice exists. Settlement requires verified receipt and correct ledger postings. No auto-renewal, auto-top-up, silent overage or payout without explicit consent/approval.

## 8. Fix-and-resolve protocol

For every discovered defect:
1. Reproduce it with exact route, UI path, input, environment and observed result.
2. Trace the full path: UI → API → auth/policy → service → DB/provider → response/UI.
3. Identify root cause, affected entities/tenants, security/economic impact and regression risk.
4. Add a failing regression test before or with the fix.
5. Implement the smallest complete fix without breaking canonical contracts.
6. Run focused tests, full local checks and build.
7. Verify the failure path and adjacent success path.
8. Update docs, audit, status and migration notes.
9. Mark resolved only with test/source evidence; production issues require production verification.

Do not hide defects by catching errors and returning success, weakening auth, changing real calls to mocks, dropping validation, increasing budgets, suppressing warnings or marking records complete manually. If a defect depends on an unavailable credential/provider/production setting, implement safe source-side handling and report the external owner gate separately.

## 9. Implementation phases — execute, do not stop at planning

**Phase 0 — Fresh source audit and recovery baseline**
- Inspect exact HEAD, complete recursive tree, package lock/scripts, UI routes/workspaces, API routes/services, migrations, all provider call sites, tests, Wrangler config and production state available read-only.
- Reconcile docs/24 against current source. Separate stale historical claims from current evidence.
- Produce requirement-to-code matrix: existing/reusable, defective, missing, owner-gated, verified.
- Exit only when no critical route/call site or migration is unclassified.

**Phase 1 — Identity, tenant security and production integrity**
- Resolve Clerk SDK/build key/callback/webhook and owner bootstrap.
- Prove Google-only auth, refresh/sign-out, /api/v1/me, roles and tenant isolation.
- No unrelated Clerk changes.

**Phase 2 — Customer, contributor, operator and finance journeys**
- Complete real request, task, contribution, review, quote, payment-state, delivery, dispute and settlement flows.
- Server-side permission tests for every mutation and nested ID.

**Phase 3 — Commercial, payment and ledger integrity**
- Complete immutable quote, entitlement, webhook/inquiry, idempotency, double-entry ledger, refund, payout and reconciliation paths.
- Keep live-money gates closed until separately approved.

**Phase 4 — Admin Control Center**
- Persist and enforce customer/contributor/provider/account/Actor/policy/approval models and owner-only APIs/UI.
- Complete cost/usage, cloud health, audit and backup/restore evidence.

**Phase 5 — Provider Runtime Gateway**
- Verify all call sites use the gateway; finish atomic reservation, quota freshness, account policy, cost reconciliation, circuit breaker and compliant outage fallback.
- Prove no bypass, no overspend and no terms evasion.

**Phase 6 — V3-A Demand Discovery**
- Durable discovery jobs, reviewed source/Actor registry, schema-driven UI, stable idempotency, permissions and cost reconciliation.

**Phase 7 — V3-B Demand Intelligence**
- Persistent clusters, provenance, source independence, taxonomy, scoring, validation and experiments.

**Phase 8 — V3-C Capability & Solution Foundry**
- Versioned specs, evidence traceability, build/acquire/partner plans and test-backed readiness.

**Phase 9 — V3-D Agentic Execution**
- Real tool runtime, durable tasks, scoped execution, sandbox build/test, private demo and human escalation.

**Phase 10 — V3-E Market Delivery**
- Consent, presentation, revocation, feedback, accepted offers, verified payment/delivery and learning.

**Phase 11 — Controlled pilot and operations**
- Backup/restore drill, monitoring, incident/runbooks, privacy/legal review, support, cost/margin, customer acceptance and owner sign-off.

Phases may be split into reviewable batches, but may not be silently skipped. Dependencies and owner gates must be explicit. Do not claim the whole system is complete when only one phase passes.

## 10. Test and evidence requirements

Use actual package scripts. Current intended local release checks are:
```bash
npm ci
npm run check
npm run audit
npm run build
```

Add focused tests for:
- route and service success/failure;
- role and tenant isolation;
- lifecycle transition rules and state recovery;
- idempotency, retries, duplicate webhooks and unknown charge;
- concurrent atomic budget reservation and quota exhaustion;
- no direct provider adapter bypass;
- source permission, Actor schema and approval expiry;
- secret redaction, SSRF, file security and signed-link expiry;
- quote hash, payment reconciliation, ledger balance, refund and settlement;
- AgentRun/ToolInvocation authorization, timeout, retry, cancellation and output validation;
- consent, suppression, demo revocation and feedback provenance.

No external provider spend in ordinary tests. Provider smoke is opt-in, low-volume, hard-capped and owner-approved. Deterministic mocks are for test isolation, not production proof.

Classify each capability independently:
- **Specified** — canonical contract exists.
- **Implemented in source** — exact code path and commit.
- **Locally tested** — exact command and result.
- **Provider/sandbox verified** — actual controlled external response and measured usage.
- **Production verified** — deployed commit parity and real authorized browser/API workflow.
- **Owner-gated** — blocked pending explicit owner action.

Never conflate these states. No green UI, documentation, CRUD, old CI run or build alone proves end-to-end operation.

## 11. Manual Cloudflare release model

GitHub is source control only. GitHub Actions CI/CD workflows are intentionally retired. A push to main is not a deployment.

Before release run `npm ci`, `npm run check`, `npm run audit`, `npm run build`; inspect the exact `dist/` bundle and scan for secrets. Confirm `npx wrangler whoami`, the intended account and Pages project `dayanexa`. Deploy manually with `npm run deploy`. Record source SHA, command results, deployment ID/URL and post-deploy smoke evidence.

Frontend deployment approval does not authorize D1 migrations, Clerk dashboard/provider changes, secret changes, payment changes, billing changes, provider spend or data deletion. Never run `npm run db:migrate:prod` as part of frontend deployment. Follow docs/28.

## 12. Owner approval boundaries

Require separate explicit approval for:
- production D1 migration or data mutation;
- secret creation/rotation/deletion or Clerk dashboard changes;
- provider activation, new external account connection or paid provider use;
- paid fallback, top-up, proxy/storage/compute spend or budget increase;
- external outreach, public demo or customer presentation;
- live payment, refund, payout or recurring charge;
- production deployment beyond the previously approved frontend-only scope;
- destructive data deletion or retention changes.

Do not ask for approval again for already approved safe source/documentation changes. Do not infer approval for a different high-impact action.

## 13. Required batch report

Every batch must report:
1. exact repository, branch and HEAD before/after;
2. defects reproduced, root causes and fixes;
3. files/code paths/migrations added or changed;
4. reused versus newly implemented capabilities;
5. tests/commands actually run and exact results;
6. provider calls, account label, usage and actual cost (never secrets);
7. browser, sandbox and production evidence;
8. owner approvals used and external gates still pending;
9. known limitations, untested cases and next batch;
10. whether production D1, secrets, spend, outreach, live payment or deployment was touched.

Continue with the next safe implementation batch after reporting. Do not stop after producing a roadmap, master prompt or documentation update. Stop only at an explicit owner gate, unavailable required access, material ambiguity, or a verified phase boundary.
