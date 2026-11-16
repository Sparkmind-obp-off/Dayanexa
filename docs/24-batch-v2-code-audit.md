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
- `docs/ci/ci.workflow.yml` exists, but a file under `docs/ci` is not an active GitHub Actions workflow. Confirm `.github/workflows/ci.yml` and a successful run separately.
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
14. **CI activation remains unproven:** `docs/ci/ci.workflow.yml` is a template location; verify an actual workflow under `.github/workflows` and a successful run.
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
