# DAYANEXA — Code Audit (historical Batch 0 + Batch 5; refresh required at current HEAD)

## Current audit status — 16 November 2026

The source-level Batch 5 gateway audit below was performed before the current documentation-only commits. Current repository HEAD must be re-audited before any source implementation. The latest recorded HEAD at this update is the master documentation/prompt consolidation; no local test/build or production verification was run for that documentation-only HEAD. GitHub Actions has been retired; do not rely on its historical runs as current verification.

## A. Historical Batch 0 refresh — 16 November 2026, `main @ a7543346a9ca9c0419e80b446c3a090a43aef838`

Evidence gathered (read-only unless stated):
- Local `npm run ci` at that HEAD: typecheck OK, 25/25 tests, 7 migrations, secret scan clean, 0 high vulnerabilities, build OK.
- Historical GitHub Actions: last 5 runs on `main` = success (latest run `43809977784`, docs-only commit). These runs are historical only; the workflow is now retired.
- Cloudflare (read-only via BYOK token): Pages project `dayanexa`, latest production deployment `238af21e` built from **`04b4bbe`** (not HEAD). Remote D1 `dayanexa-production`: migration **0007 NOT applied**. Production health: D1/Workers AI/R2 bound, Clerk JWT key + secret present, **Clerk webhook secret missing**, payments `mock`.
- Production Pages secrets present (names only): APIFY_API_TOKEN, ARTIFACT_SIGNING_SECRET, CLERK_JWT_KEY, CLERK_SECRET_KEY, FIRECRAWL_API_KEY, GROQ_API_KEY, SCRAPELY_API_KEY, SCRAPELY_USER_ID, TAVILY_API_KEY. CLERK_WEBHOOK_SECRET absent.

Provider call-site inventory before Batch 5 (all now routed through the gateway):
| Provider | Adapter | Call site(s) | Previous control |
|---|---|---|---|
| Tavily | `providers/tavily.ts` | `routes/intel.ts` POST /discovery/search | env daily cap via non-atomic SUM, no account model |
| Firecrawl | `providers/firecrawl.ts` | `routes/intel.ts` POST /discovery/extract | same |
| Apify / Scrape.ly | `providers/actors.ts` | `routes/intel.ts` POST /discovery/actor-run | env allowlist + env max charge; registry not enforced |
| Workers AI | `inference/workersai.ts` | `inference/service.ts` ← intel classify, me ai-draft, ops ai-assist | neuron budget via non-atomic SUM, per-isolate breaker |
| Groq | `inference/groq.ts` | `inference/service.ts` (disabled by default) | flag only |

Defects found: budget checks were check-then-act (race could overspend); 0007 policy/account/Actor registry tables were persisted but **not enforced** at runtime; Actor approval had no expiry; circuit breaker per isolate only; 429 had no Retry-After handling.

## B. Batch 5 — Provider Runtime Gateway (implemented in source; CI evidence in batch report)

- `apps/api/migrations/0008_provider_runtime_gateway.sql` (additive): AccountProfile columns (capabilities, unit type/price, per-request cap, concurrency, region, multi-account terms flag, quota max age), `quota_snapshots`, `usage_reservations`, `provider_approvals`, `fallback_rules` (CHECK: trigger `upstream_error` only), `circuit_breakers`, `actor_registry.approval_expires_at`, `provider_usage.account_id/reservation_id`.
- `apps/api/src/providers/gateway.ts`: single `governedCall()`; fail-closed evaluation; atomic `INSERT…SELECT…WHERE` reservation re-checking every cap; settle/release/`unknown_charge`; persistent breaker honoring Retry-After; auth denial auto-pauses, provider quota exhaustion marks exhausted; deterministic primary account (no rotation); outage-only single fallback via active, unexpired owner rule with multi-account terms confirmed on both accounts; paid usage only with scoped, capped, unexpired approval; schema guard (`SCHEMA_NOT_MIGRATED`).
- Adapters require an unforgeable single-use ticket (`assertTicket`) and take the credential from it — direct calls throw `GATEWAY_REQUIRED` before any network I/O. Credential references are restricted to provider-specific binding names.
- Owner-only APIs under `/api/v1/admin/*`: gateway status, quota snapshots, paid approvals (+revoke), fallback rules (+revoke), reservations (+manual reconcile of unknown_charge), circuit breakers (+reset); account/Actor admin extended. Admin UI tab "Runtime gateway".
- Tests: `tests/gateway.test.ts` (43 cases) incl. pre-dispatch blocking for 17 conditions, concurrent overspend, concurrency limit, reconciliation, unknown charge, 429/ban/quota no-rotation, outage-only fallback, paid approval, forged-ticket bypass, static no-bypass scan, secret redaction, unmigrated schema.

Not yet done: production D1 migration 0007+0008 (owner gate), production configuration of policies/accounts/snapshots (all provider calls are blocked until configured — intentional), automated quota refresh from provider APIs, Queues/Workflows, Batches 1–4 and 6–11.

---

# (Historical) DAYANEXA — Batch V2 Code Audit for V3

**Audit date:** 16 November 2026  
**Audited branch:** `main`  
**Audited HEAD:** `04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa`  
**Scope:** GitHub source tree, route declarations, provider adapters, migrations, frontend workspace source, package scripts and existing test declarations.  
**Not performed:** fresh local CI run, production browser login, live source/Actor run, real agent execution, customer outreach or production database mutation.

## 1. Executive result

Batch V2 is a meaningful application foundation and includes real source-adapter code paths. It is not yet a complete Demand-to-Execution OS. The main gaps are automated discovery jobs/history and source-specific connector contracts; persistent demand clustering and richer evidence validation; solution/capability readiness proof; durable agent/tool execution; and a controlled demo-to-market presentation workflow.

Do not restart the application from scratch. Preserve the working identity, request, commerce, ledger, provider, inference, audit, storage and UI foundations, then extend them around the five engines.

## 2. Repository snapshot

- `main` HEAD: `04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa`; commit message identifies Batch V2 journey/monetization work.
- 147 Git tree entries were returned by GitHub's recursive tree.
- Six SQL migrations exist: `0001` through `0006_v2_journeys_monetization.sql`.
- Package scripts include typecheck, Vitest, migration check, secret check, audit and build.
- `package-lock.json` is present in the audited tree.
- Wrangler config defines Pages, D1, R2 and Workers AI bindings.
- At this historical audit point, `docs/ci/ci.workflow.yml` was only a template and no active workflow had yet been proven. Subsequent repository history briefly added a workflow, then retired both workflow and template by owner decision. Current release verification is local + manual Wrangler.
- Both `.env.development` and `.env.production` exist in the repository tree with the same blob SHA. The inspected contents contain only a Vite Clerk publishable key, not a private Clerk secret. These environment files should still be removed from source control and represented by safe examples to avoid normalizing committed environment-specific configuration.

## 3. Five-engine audit matrix

| Engine | Existing code evidence | Classification | Missing for V3 |
|---|---|---|---|
| Demand Discovery | `providers/tavily.ts`, `firecrawl.ts`, `actors.ts`, provider registry/governor; `intel.ts` search/extract/actor-run; signal history and benchmarks UI | Partial foundation with real adapter code paths; not verified live | Durable discovery briefs/jobs, actor schema registry, source-specific Threads support verification, query/input UI, pagination/history, source permission/terms snapshots, retries/cancel/partial states, complete cost reconciliation |
| Demand Intelligence | signal classification, manual demand creation, evidence linking, validation guard requiring two supports from two distinct URLs, AI opportunity assessment | Partial workflow; significant manual steps | Persistent cluster entity, niche/sub-niche grouping, similarity/dedup intelligence, source independence verification, richer assessment rubric, cluster history/split/merge, confirmation experiment workflow |
| Capability & Solution Foundry | solutions, capabilities, capability gaps, route enum (reuse/compose/build/acquire/integrate/partner/contributor/defer/reject), lifecycle gates | CRUD/workflow foundation | Structured SolutionSpec, feature-to-evidence traceability, capability readiness test evidence, build/acquire plan, cost/risk model and automated readiness checks |
| Agentic Execution | agent registry/profile, missions, tasks, executor type, R2 artifacts, quality reviews, delivery and acceptance routes | Inventory and manual task orchestration foundation | Actual agent runtime, tool registry/authorization, invocation traces, durable workflow/queue, model-to-tool loop, budget reservation, retries/idempotency, task output schema, build/test pipeline and preview deployment |
| Market Delivery | versioned offers, acceptance, billing/payment, invoices, artifact links, delivery acceptance/dispute, ledger | Partial commercial/delivery flow | Demand-linked demo lifecycle, demo preview generation and revocation, test evidence, lawful market presentation/consent, response capture, feedback-to-demand loop and complete real payment/payout validation |

## 4. Verified code paths

### Discovery and provider integrations
- `POST /api/v1/intel/discovery/search`: Tavily search results become deduplicated signal records; records provider request ID, credits and audit event. Response explicitly states results are signals, not validated demand.
- `POST /api/v1/intel/discovery/extract`: Firecrawl single-page extraction with SSRF guard, daily cap, content hash and provider usage record.
- `POST /api/v1/intel/discovery/actor-run`: Apify or Scrape.ly selected by environment; requires actor allowlist; has max items and max charge setting; records provider benchmark and imported signals.
- `GET /api/v1/intel/discovery/benchmarks`: lists benchmark records.
- `GET/POST /sources`, `GET/POST /signals`, classification and discard endpoints exist.
- UI exposes Tavily and Firecrawl forms and an Actor form.

### Intelligence
- `POST /signals/:id/classify` runs Workers AI inference and labels result as inference.
- Demand records can be created manually and linked to signals with supporting/contradicting stance.
- `POST /demands/:id/transition` requires at least two supporting evidence items from two distinct source URLs/provider IDs and a confidence plus human rationale before `DEMAND_VALIDATED`.
- Opportunity creation rejects non-validated demand.
- Opportunity AI assessment drafts independent score dimensions and missing evidence for human review.

### Foundry
- Routes create and list solutions, capabilities and capability gaps.
- Capability gap route supports reuse, compose, build, acquire, integrate, partner, contributor, defer and reject.
- Opportunity transition blocks solution design without a solution and capability-ready without open/planned gaps.

### Execution
- Agent records store purpose, task profile, allowed tool IDs, daily neuron budget and escalation rule.
- Missions can be created from accepted offers.
- Tasks can be assigned as agent or human and contain acceptance criteria and compensation.
- Artifacts can be uploaded to private R2; metadata includes SHA-256 and delivery uses short-lived signed links.
- Quality review, delivery, acceptance/dispute, settlement and learning routes exist.

### Market and economics
- Offers are versioned and immutable after submission; customer acceptance is tied to a hash.
- Payment, invoice, subscription, ledger, refunds and payout request flows exist.
- Existing tests include quota period, customer next action, quote/payment/revenue flow, tax separation, idempotency and non-regressing payment status.

## 5. Important limitations and defects to address

1. **Actor UI input is incomplete:** the frontend Actor form posts `input: {}` regardless of the selected Actor. Most source-specific Actors need a query, date range, pagination or other required input. API accepts a JSON object but UI cannot configure a reviewed Actor schema. Implement a schema-driven form from the Actor registry.
2. **Actor identity is not a full registry:** current allowlist is a comma-separated environment value. It does not persist reviewed README/schema version, owner, terms, source coverage, field mapping, pricing model or approval expiry.
3. **Actor idempotency is weak:** the route generates a new random idempotency key for each call. A user retry can start a second paid run. Derive and persist a stable key from discovery job + provider + actor version + normalized input.
4. **Synchronous execution is bounded but not durable:** Actor calls wait up to 60 seconds and return within request handling. There is no durable discovery job queue, pause/resume, cancel or recovery state in this path.
5. **No dedicated demand-cluster schema:** current migrations include sources, signals, demands, evidence and opportunities, but no persistent DemandCluster, cluster membership/version, or split/merge history.
6. **Demand creation and validation remain manual:** the UI lets an operator create a hypothesis and link signals. There is no automated grouping/confirmation experiment lifecycle.
7. **Capability CRUD is not capability proof:** a capability row can be marked ready through a simple status update; readiness is not backed by a required test/evidence bundle.
8. **Agent records do not execute work:** agents are registered and can be activated/paused, but the audited source shows no agent runtime that consumes a task, invokes scoped tools, persists an AgentRun, validates output and updates task state.
9. **Task assignment is not execution:** task status updates and manual mission transitions exist; no durable queue/workflow, attempt log, tool invocation ledger or robust retry/idempotency contract is visible in the audited paths.
10. **Demo generation is not implemented as a lifecycle:** R2 artifact upload and signed links exist, but no verified isolated build/deploy/test workflow creates a working app demo and ties it to the demand/solution/build commit.
11. **Market presentation is not implemented:** offers and delivery exist, but no explicit consent/lawful-basis presentation record, outreach approval, opt-out/suppression or demo-response funnel is visible.
12. **Tenant-boundary tests need expansion:** authorization policy distinguishes staff and customer orgs, but V3 tests must exercise every demand, signal, opportunity, solution, mission and artifact route against cross-tenant IDs, including joins and nested mutations.
13. **Environment files are committed:** `.env.development` and `.env.production` contain the same publishable Clerk key. It is not a private secret, but these files should be removed from Git and covered by ignore rules.
14. **Historical CI activation note (superseded):** at this audit point, only a template was confirmed. GitHub Actions was later activated and subsequently retired by owner decision. Do not recreate it; use current local validation and Wrangler procedures.
15. **Production auth and customer journeys remain owner/browser gates:** source presence and API smoke tests do not prove a real Google login or full customer/contributor/operator browser journey.

## 6. What to reuse

Keep and extend:
- Clerk Production integration and internal principal/permission model.
- D1 data layer, migration checker, audit and lifecycle transition service.
- Provider registry, Tavily, Firecrawl, Actor HTTP adapter and usage governor (after strengthening).
- Workers AI inference profiles/service/traces and deterministic mock for CI.
- Demand/signal/evidence/opportunity tables and lifecycle.
- Solution/capability/gap entities as the V3 Foundry starting point.
- Offers, immutable quote versions, entitlement service, invoices, payment status normalization, double-entry ledger and maker-checker approvals.
- R2 private artifact storage, hashes and signed short-lived links.
- Customer, contributor and operator journey UI/workspaces.

## 7. Recommended V3 implementation order

### V3-A — Discovery reliability
Add discovery briefs/jobs/source runs, persisted Actor registry and versioned schema, schema-driven Actor UI, stable idempotency, durable queue, source permission/terms snapshots, per-job budgets and provider usage reconciliation. Prove one real permitted web source and one explicitly reviewed social source; Threads is a candidate only after access/terms/Actor support is verified.

### V3-B — Demand intelligence
Add DemandCluster and membership/history, normalization, dedup/near-duplicate handling, niche taxonomy, corroboration/contradiction model, scoring rubric versioning, review and confirmation experiment workflow. Prove cluster results with inspectable original sources.

### V3-C — Solution and capability readiness
Add SolutionSpec versioning, feature-to-evidence links, capability plan, build/acquire/partner decision records, cost/risk model, test evidence and readiness gate.

### V3-D — Actual agent execution
Add tool registry, scoped tool authorization, AgentRun/ToolInvocation, durable orchestration, budget reservation, retries, idempotency, output validation, human escalation and sandbox build/test/preview pipeline. Prove one complete mission that builds a working demo.

### V3-E — Market delivery
Add Demo/MarketPresentation/consent records, preview revocation, presentation approval, response/feedback capture and traceability to demand. Preserve current immutable quote, verified payment and ledger. Prove a demo-to-customer feedback flow; keep live money and outbound contact gated.

## 8. Audit confidence and caveats

This audit is based on source code and schema inspection at the stated Git commit. It does not prove production credentials, external provider entitlements, current actor compatibility, real Threads access, production D1 state, deployed bundle parity, or actual end-to-end behavior. The V2 test files declare tests for payment, lifecycle and provider controls; this audit did not execute those tests. Fresh local validation using the current package scripts and real controlled smoke tests remain separate acceptance evidence.

No production database migration, provider activation, paid Actor run, payment configuration or deployment was performed as part of this audit.


---

# C. Fresh V3 implementation audit — 16 November 2026

**Current documentation HEAD:** `398f39aa08d91ca16e85d78fa47d5b459a88fa92` (two documentation-only scope clarifications after the source snapshot).  
**Source snapshot inspected:** `5a7a0b839041a0949df874eccb67116b286e583c`.  
**Method:** GitHub source/tree inspection and prior read-only Cloudflare production inspection. No local checkout, test/build execution, production migration, provider call, browser sign-in, customer contact or deployment was performed in this audit batch.

## C1. Source and production baseline

- Repository `main` source snapshot `5a7a0b8` contains 165 Git tree entries.
- Production Cloudflare Pages project `dayanexa`, custom domain `dayanexa.biz.id`, deployment ID `92347b6c`, source commit `5a7a0b8` (read-only deployment inspection).
- Production D1 `dayanexa-production`: migrations `0001`–`0006` applied; `0007_provider_policy_actor_registry.sql` and `0008_provider_runtime_gateway.sql` not applied at the time of inspection. No migration was run.
- Package scripts provide local `typecheck`, `test`, migration/secret checks, `release:check`, `build`, `deploy` (manual Wrangler after release gate) and `smoke:prod`. No GitHub Actions workflow is part of the current release model.
- `smoke:prod` is a narrow unauthenticated health/auth/homepage smoke check; it does not prove Google sign-in, owner workflows, customer journeys, contributor operations or provider execution.

## C2. Evidence-backed implementation matrix

| V3 capability | Source evidence inspected | Current classification | Gap / proof still required |
|---|---|---|---|
| Demand Discovery | `routes/intel.ts`: source CRUD, signal CRUD, Tavily search, Firecrawl extract, Actor run, benchmark history; adapters invoke `governedCall` | Partial, real synchronous adapters | Durable DiscoveryJob/SourceRun lifecycle, scheduling, pagination/resume/cancel/recovery, source-specific permission review, end-to-end live evidence and reconciled cost |
| Demand Intelligence | Migration 0002 has `demands`, `demand_evidence`, `opportunity_assessments`; routes expose demand CRUD/evidence/transitions | Partial | No `demand_clusters`, membership/version/split/merge, independent evidence scoring rubric, validation experiment and corroboration workflow found in inspected migrations/routes |
| Opportunity Intelligence | `routes/ops.ts` exposes opportunity CRUD, assessments, AI assist and transitions | Partial | Must prove traceable demand-to-opportunity creation, independent score dimensions, review gates and repeatable acceptance |
| Capability & Solution Foundry | Migration 0002 has `solutions`, `capabilities`, `capability_gaps`; routes create/edit solutions and capabilities and add gaps | Partial | No complete versioned SolutionSpec, capability build/acquire/partner lifecycle, readiness test/evidence gate or costed dependency plan established by inspected schema/routes |
| Agentic Execution | Migration 0002 has `agents`, `missions`, `tasks`, `artifacts`, `quality_reviews`; ops routes create missions/tasks, review, deliver and accept | Partial foundation | No canonical AgentRun/ToolInvocation/TaskDependency execution records or durable workflow/queue orchestration found in inspected tree/schema; agent records and task CRUD do not prove agent execution |
| Market Delivery | Ops routes expose offer revisions/publication request/withdraw/accept; mission delivery/acceptance/settlement; commerce routes expose payment, refund, payout and ledger operations | Partial | No explicit MarketPresentation/DemoAccess/consent lifecycle or end-to-end immutable quote-hash acceptance → verified payment → accepted delivery → settlement proof established from inspected migrations/routes |
| Provider governance | Migrations 0007/0008; `gateway.ts`; provider-admin routes expose policies, accounts, Actors, quota, approvals, fallback, reservations, breakers | Source implemented, production inactive pending migrations/configuration | Apply only after explicit owner approval; configure verified policies/accounts/quota; prove deployed source parity and a safely authorized, budget-capped test |
| Admin & Resource Control | 15th workspace exists; provider-admin APIs and AdminControl UI source exists | Partial | Full customer administration, persisted operational policy controls, deployment/backup/restore evidence and complete observability still need acceptance proof |
| Economic & Settlement | Commerce routes expose payment intents, reconcile, refunds, payouts, ledger journals, costs and mission economics; ops routes expose mission settlement | Partial foundation | Prove signed/deduplicated gateway webhook, reconciliation, maker-checker refund/payout, contributor payable and ledger invariants on real approved sandbox/pilot flows |
| Learning & Evolution | `learning_records` table and mission learning route exist | Partial | Prove feedback ingestion, evidence-linked outcome metrics, model/rubric versioning and a controlled next-discovery improvement loop |

## C3. Important corrections to stale documentation

1. Docs/25's prior status statement that provider policies and the runtime gateway were wholly pending is stale relative to source snapshot `5a7a0b8`: migrations, gateway implementation, provider-admin APIs and gateway tests exist in source. They are **not production-active** because migrations 0007/0008 were not applied in the inspected production D1.
2. Docs/26 correctly describes source-level gateway implementation and the production migration gate, but quota refresh automation, durable queue/workflow processing and full V3 engine completion remain open.
3. Workspace presence and CRUD routes are not acceptance proof. The five engines remain partial until their end-to-end acceptance paths are implemented and tested.
4. Do not spend this workstream changing the user's role, membership, bootstrap identity or the `member` label. Identity/access is audited only as a required security foundation.

## C4. Execution order from this audit

1. Build an exact source-to-requirement traceability register for docs/18–23 and docs/29, including every API route, table, permission, UI surface, background process and test.
2. Implement persistent demand clustering and validation as the first missing domain capability; add additive migration, tenant-scoped APIs, UI and regression/integration tests.
3. Implement durable discovery jobs and source-run lifecycle with idempotency, pause/resume/cancel/recovery and cost reconciliation.
4. Implement versioned SolutionSpec and test-backed capability readiness.
5. Implement durable AgentRun/ToolInvocation/task graph and real controlled tool execution with approval, budget and artifact evidence.
6. Implement consented demo/market presentation, immutable offer/quote acceptance and full verified payment-to-settlement lifecycle.
7. Complete Admin Control Center, provider quota refresh, observability and operational runbooks.
8. Run local release checks from a real checkout; separately verify Google sign-in and owner/customer/contributor/finance browser journeys. Keep production migration, provider spend, live payments and deployment behind explicit approval.

**Audit conclusion:** DAYANEXA is a working V2/V3 foundation with several real workflows and a source-level provider runtime gateway. It is not yet a complete, production-proven V3 Demand-to-Execution OS. The next work must be source implementation and test evidence, not another round of conceptual documentation.


---

# D. Member V3 access and Free-plan entitlement audit — 16 November 2026

Source inspection after the user clarified the account requirement found the concrete reason a normal member cannot use V3:

- `apps/api/src/auth/policy.ts`: `ROLE_PERMISSIONS.member` is only `customer:self`.
- `src/pages/AppShell.tsx`: the 15-workspace Command Center navigation is rendered only inside `{isStaff && ...}`; individual workspaces are gated by staff permissions (`workspace:read`, `ledger:read`, `governance:read`, `provider:admin`).
- `assertOrgAccess()` treats `workspace:read` as platform staff and bypasses ordinary organization scoping. Giving this permission to members would be an IDOR/cross-tenant risk, not a valid fix.
- `apps/api/src/domain/plans.ts`: Free is Rp0, 2 requests/30 days, 0 AI assists, 1 seat.
- `src/pages/Customer.tsx`: Free users cannot use the AI request-drafting capability and are directed to upgrade.

**Correct product requirement:** keep `sparkmind.support@gmail.com` as platform owner; keep `elmatador0197@gmail.com` and all ordinary users at their existing `member` role; provide full customer-usable V3 product access through a distinct Free-plan product entitlement. Do not hard-code either email address. See `docs/30-member-v3-access-and-free-entitlement.md`.

**Architecture required:** separate platform role, tenant membership, and product-plan entitlement. Add a member-safe V3 workspace and tenant-scoped APIs. Keep global Admin/Provider/Actor/finance controls owner-only. Do not reuse `workspace:read` for member product access.

**Free AI constraint:** Cloudflare's official Workers AI pricing documentation currently states 10,000 Neurons/day at no charge on Workers Free, with further calls failing when exhausted; some models require Workers Paid. The allocation is shared at provider/account level, not a guaranteed per-user allowance. DAYANEXA must enforce a shared central cap, protected reserve, per-organization sub-caps and fail-closed behavior before offering positive Free AI usage. Existing application defaults are 8,000 neurons/day and 200,000/month; do not increase them without verified provider plan/quota and budget design. <https://developers.cloudflare.com/workers-ai/platform/pricing/>

**Status:** root cause identified and documented; member product entitlement, member-facing V3 UI, tenant-safe APIs, and positive bounded Free AI allocation are not yet implemented. No account/role mutation, migration, provider spend or deployment was performed.
