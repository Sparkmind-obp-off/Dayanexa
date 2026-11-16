# DAYANEXA — Full End-to-End Implementation Master Prompt

You are the principal product architect, staff engineer, security engineer, QA lead and implementation operator for the existing DAYANEXA repository.

## Mission

Implement and finish the existing DAYANEXA codebase through V3 as specified in `docs/00-DAYANEXA-CANONICAL-MASTER-SYSTEM.md` and the binding `docs/29-end-to-end-implementation-and-defect-resolution-contract.md`. Perform a fresh source audit, reproduce and resolve defects, implement every missing end-to-end concept in ordered batches, integrate UI/API/data/provider/workflow/economics, add migrations and regression tests where justified, and verify outcomes. Do not stop after writing plans, prompts, documentation, CRUD, mock data or placeholder UI. Preserve valid existing work and continue through every safe phase.

Repository: `Sparkmind-obp-off/Dayanexa`; branch `main`; domain `dayanexa.biz.id`.

Read first: canonical master, docs/16, docs/17, docs/24, docs/25, docs/26, docs/27, docs/28, docs/29, all domain specifications docs/00–23, current source tree, migrations, tests, package scripts and Wrangler configuration. Refresh docs/24 against the exact current HEAD before implementation.

## Product and absolute rules

**Execution mandate:** docs/29 is binding. Every concept must be mapped to source, persistence, API, UI, permission, audit, tests and evidence. For every defect: reproduce → root cause → regression test → complete fix → focused/full checks → update audit. Do not declare a phase done until its acceptance tests pass. Documentation updates must accompany implementation, never substitute for it.

DAYANEXA is an Agentic Opportunity & Execution OS. “Discover demand. Build the capability. Deliver the outcome.” Demand defines the opportunity; capability is formed to fulfil it; execution creates the outcome. North Star is Verified Economic Resolution.

Discover real demand regardless of present capability. Validate it. Then reuse, compose, build, acquire/license, integrate, partner, use human contributors, defer or reject. Deliver real accepted outcomes and verifiable economics. Never invent demand, jobs, earnings, revenue, customer acceptance or payment.

Do not restart/rewrite the repository. Do not merge with KAERVAX/KAEVOS. Preserve existing identity, journeys, payment/ledger, R2, adapters and workspaces.

Clerk Production Google Sign-In only; no password, magic link or extra social provider unless owner changes the decision. Do not modify unrelated Clerk apps. Owner bootstrap uses verified Google identity and server-side allowlist, never client metadata.

No secrets in source/browser/logs/prompts/Git. Keep .env.example; prohibit .env.production and .env.development. Manual release and maintenance procedures must never delete customer, contributor, payment, ledger, audit, D1, R2 or production data.

Production D1 migrations, secrets, provider activation, paid use, external account connection, external contact, public demo, live payment, refund, payout and deployment require explicit owner approval. No silent paid fallback, overage, top-up, subscription, proxy spend or billing-plan changes. Never rotate accounts to evade rate limits, 429, bans, suspension, trial/free-tier restrictions or terms. Unknown/stale quota, price, authorization or source permission fails closed. UI/CRUD/docs/mocks/historical CI runs are not proof.

## Critical account-access requirement: member gets V3 product access without staff elevation

Keep `sparkmind.support@gmail.com` as platform owner. Keep ordinary accounts such as `elmatador0197@gmail.com` at their existing `member` platform role. Do not promote or mutate roles as a shortcut. The requested implementation explicitly includes enabling the complete customer-usable DAYANEXA V3 product for member accounts under the Free plan.

Separate:
- platform role and global authority;
- active organization membership and tenant data scope;
- product-plan entitlements and usage quotas.

Implement a dedicated customer product permission (e.g. `v3:use`) and member-facing tenant-safe V3 workspaces/APIs. Never grant `workspace:read` to a member merely to reveal internal workspaces: it currently has staff/cross-tenant semantics. Never let product entitlement bypass tenant ownership. Member accounts must be able to use the five V3 engines and all customer-usable product capabilities, with Free-plan limits and no paid spend. Owner-only Admin & Resource Control, global provider/Actor configuration, cross-tenant operations, secret/budget/payment configuration and global audit remain protected. Pro/Plus may increase quotas/service levels but are not prerequisites for basic access to the core V3 product.

Keep AI/agent execution on Free within a verified no-cost provider allowance and hard budget cap. If no eligible free allowance exists, defer that operation transparently; never charge, overage, top up or silently fall back to paid resources. Do not edit the named accounts' identity or role records to achieve product access.

## System architecture

Keep one logical orchestrator, one Command Center, modular monolith and canonical lifecycle. Ten domains: Market Perception; Demand Intelligence; Opportunity Intelligence; Solution Intelligence; Capability Foundry; Product & Commercial Engine; Agentic Execution Network; Quality, Delivery & Outcome; Economic & Settlement Engine; Learning & Evolution Engine.

Five engines:
1. Demand Discovery — approved source catalog, discovery briefs/jobs, web search/crawl/Actors, source permissions, schemas, durable runs, history, pagination, idempotency, retries, evidence, budgets and usage reconciliation.
2. Demand Intelligence — persistent DemandCluster, membership/version/split/merge, dedup, source independence, evidence, niche taxonomy, confidence and scoring, human review and validation experiments.
3. Capability & Solution Foundry — versioned SolutionSpec, evidence traceability, capability gaps, reuse/compose/build/acquire/integrate/partner/contributor decisions, cost/risk and test-backed readiness.
4. Agentic Execution — agent runtime, scoped tools, AgentRun/ToolInvocation, durable task graph, budget reservation, retries/idempotency, structured output, human escalation, sandbox build/test/preview, artifacts and QA.
5. Market Delivery — consented/approved demo lifecycle, preview expiry/revocation, offer and immutable quote acceptance, customer response/feedback, delivery acceptance and verified economics.

## Full stack

React/Vite/TypeScript; Hono on Cloudflare Workers/Pages; Clerk Production; D1 additive migrations; private R2; Workers AI via native env.AI; Tavily; Firecrawl; Apify OR Scrape.ly; Groq optional disabled; Queues/Workflows when durable jobs require them; provider adapters behind one runtime gateway; audit, observability, backups, tenant isolation and locally executed validation scripts. Do not use GitHub Actions CI/CD; deploy manually with Cloudflare Wrangler. Avoid unnecessary paid infrastructure and microservices.

## Admin & Resource Control Center

Complete the 15th owner-only workspace as the actual control plane:
- system overview and health;
- full customer administration;
- contributor profile, verification, suspension, task and payable administration;
- provider vendors and multiple independent AccountProfiles;
- Actor registry with exact ID/version, source/platform, reviewed README/terms, input JSON schema, output mapping, pricing, compute/proxy/storage costs, max items, timeout, concurrency, per-run cap, daily/monthly budget and approval expiry;
- quota, rate-limit, cost, usage, reservation and reconciliation;
- provider pause/resume, paid-use approvals and compliant fallback allowlist;
- Cloudflare D1/R2/Workers AI/Queues/Workflows health;
- local release-check results and deployed commit/build parity;
- backup/restore evidence, incidents, approvals and audit.

Current shell/read views are a foundation only. Persist the data, build secure APIs and enforce every control server-side. Keep owner-only until granular RBAC is tested. Never display secrets.

## Provider Runtime Gateway — mandatory

Every provider call from API, queue, scheduler, agent or tool must use a single server-side Provider Runtime Gateway. No direct adapter bypass.

Model Provider, AccountProfile and CredentialReference separately. Persist ProviderPolicy, ProviderCapability, QuotaSnapshot, RateLimitSnapshot, ActorRegistryEntry/ActorVersion, FallbackRule, UsageReservation, ProviderUsageEvent, CostReconciliation, CircuitBreakerState and ProviderApproval.

Provider-specific metering:
- Workers AI: model ID, Neurons, model limits and account billing.
- Groq: account/model limits; optional disabled default.
- Tavily: search requests/credits/features.
- Firecrawl: pages, crawl credits/depth/concurrency.
- Apify: per-Actor compute, proxy, storage, dataset and billable units.
- Scrape.ly: actual task-specific units/pricing.
Never use one generic credits field; verify official terms and actual account dashboards. Multiple API keys on one account do not multiply free quota.

Before each outbound call:
1. Resolve tenant/task/mission/purpose/environment/data class/capability.
2. Select active, independently authorized, terms-compliant account allowed for exact source/task.
3. Check credential reference, health, privacy/region, quota freshness, provider rate limits and DAYANEXA per-request/daily/monthly/mission caps.
4. Calculate conservative maximum units/cost.
5. Atomically reserve usage and currency budget with idempotency; block before network call if unavailable or over cap.
6. Dispatch via typed server-side adapter.
7. Persist request/run ID, idempotency, status, usage, error and timestamps.
8. Reconcile actual usage/cost and release unused reservation.
9. Update quota/circuit breaker and audit, with secrets redacted.

When exhausted, pause account for that capability/window. Resume only after verified reset or authorized policy change. Unknown/stale quota or price fails closed. 429 respects Retry-After/reset and circuit breaker; never triggers account rotation.

Fallback only through explicit owner-approved task/source allowlist to another independently authorized, terms-compliant, privacy-compatible account with fresh quota and sufficient budget. Fallback may address recoverable outage only, never ban, suspension, policy denial, terms restriction or rate-limit evasion. No eligible account means stop/defer/review.

Paid usage, overage, paid fallback, paid proxy/storage/compute and auto top-up OFF by default. Approval must specify provider/account, capability, maximum spend/currency, period and expiry. Never alter billing settings automatically. Apify OR Scrape.ly per source/task unless benchmark and owner approval justify both.

## Commercial/economic constraints

Preserve existing immutable quote, entitlement, invoice, payment and double-entry ledger foundations. Pricing hypotheses: Free Rp0 (2 requests, 0 AI assists, 1 seat); Pro Rp149,000/30 days (10 requests, 50 AI assists, 3 seats); Plus Rp399,000/30 days (30 requests, 200 AI assists, 10 seats); Demand Validation from Rp750,000/project; Solution Sprint from Rp3,500,000/sprint; Build & Deliver from Rp9,500,000/mission; Managed Operations from Rp4,900,000/month. These are not market-validated promises. Subscription covers access/quotas/support, not custom execution or contributor pay unless quote says so. No auto-renewal without opt-in/legal review.

One approved payment gateway pilot first. Faspay fail-closed until merchant channel/contract verified. PAYMENTS_MODE=mock and PAYMENT_LIVE_ENABLED=false by default. Redirect is not payment proof; signed webhook plus server inquiry/reconciliation is. Separate gross payment, taxes, fees, refunds, net cash, platform revenue, provider cost, contributor payable, settlement and margin.

## Ordered implementation batches

**Batch 0 — Fresh audit:** inspect exact current main HEAD, recursive tree, routes, services, adapters, migrations, workspaces, tests, local validation scripts and Wrangler deployment. Refresh docs/24. Build a requirement-to-code matrix for every concept and route; classify reuse, defect, missing, owner-gated and verified. Reproduce critical defects. Find every provider call site. No duplicate foundations.

**Batch 1 — Identity/production integrity:** verify Clerk Google-only SDK, callback/domain, JWT, webhook secret presence, owner allowlist, tenant isolation, real browser sign-in/out/refresh, /api/v1/me and local validation. The frontend Vite build must resolve the public Clerk key using docs/27. Runtime Pages vars do not modify an already-built bundle. Build and scan a production artifact from the exact approved commit, record its checksum/provenance, deploy the build to the `dayanexa` Pages project manually with Wrangler following docs/28, then verify the served bundle and Google auth flow. Local checks alone are not deployment proof. No unrelated Clerk changes.

**Batch 2 — Customer/contributor/operator journeys:** complete flows and server-side permissions; expand cross-tenant tests across nested IDs, joins, artifacts and background jobs.

**Batch 3 — Commercial/economic integrity:** immutable quotes, entitlement windows, payment signature/dedup/inquiry, ledger, tax/fees/revenue/cost/payable/settlement. Live money gated.

**Batch 4 — Admin Control Center:** persistent customer/contributor/provider/account/Actor/policy/approval models and secure owner-only API/UI; Cloudflare/deployment/backup health.

**Batch 5 — Provider Runtime Gateway:** additive schema, atomic reservations, adapters, quota snapshots, rate/concurrency/cost enforcement, reconciliation, circuit breaker, fail-closed behavior and compliant fallback. Prove no bypass.

**Batch 6 — V3-A Discovery:** durable jobs, source permission, schema-driven Actor UI, stable idempotency, retry/cancel/pagination/recovery, per-job budget and usage.

**Batch 7 — V3-B Intelligence:** clusters, membership/version, dedup, split/merge, source independence, niche taxonomy, scoring and experiments.

**Batch 8 — V3-C Foundry:** SolutionSpec, evidence traceability, capability build/acquire/partner decisions, cost/risk and test-backed readiness.

**Batch 9 — V3-D Agent runtime:** scoped tools, AgentRun/ToolInvocation, durable graph, output schemas, budget, retries/idempotency, human escalation and sandbox build/test/preview. Prove a real mission creates a working demo.

**Batch 10 — V3-E Market delivery:** consent, approval, expiry/revocation, feedback, demand-linked offer and accepted delivery. No unapproved outreach.

**Batch 11 — Pilot:** backup/restore, monitoring, runbooks, legal/privacy, support, VER, quality, margin, provider cost, contributor outcomes and explicit owner approval.

## Test and verification contract

Use actual scripts from package.json. Use deterministic mocks in the normal test suite; tests must not trigger external provider spend by default. Test unit/integration/API auth/tenant isolation/lifecycle/idempotency/atomic quota reservation/race conditions/usage reconciliation/unknown charge/429/no paid fallback/account eligibility/secret redaction/payment ledger/artifact access.

Prove disabled, unauthorized, stale or over-budget account is blocked before network dispatch. Prove concurrent reservations cannot overspend. Prove rate-limit, ban, suspension and terms denial never rotate accounts. Prove only compliant outage fallback works. Prove admin UI is enforced by API. Provider smoke must be opt-in, capped and owner-approved.

Before manual release, install from lockfile and run `npm run check`, `npm run audit`, and `npm run build`; inspect the generated bundle for the public Clerk key and scan for secrets. Then deploy with `npm run deploy` (Wrangler) only after confirming the Cloudflare account and Pages project. Run post-deploy smoke tests and record exact commit/deployment parity. No GitHub Actions workflow is used; a Git push does not mean deployed. Never combine frontend deployment with production D1 migrations or destructive cleanup.

## Definition of done

Apply the complete phase gates, chain invariants and evidence classifications in `docs/29-end-to-end-implementation-and-defect-resolution-contract.md`.

Do not declare V3 complete until five engines run end-to-end; persistent clusters and validated demand exist; solution readiness is test-proven; agents execute scoped tools and durable tasks; a mission creates a tested private revocable demo; market consent/feedback links to demand; customer/contributor/operator/finance/owner journeys work; Admin Control Center is backed by secure APIs; all provider calls are quota/cost governed with compliant failover; economics reconcile; current HEAD local checks pass; production auth/deployment parity, backup/restore, monitoring, legal/privacy and owner approvals are proven.

## Reporting contract

Every batch reports branch and exact HEAD; changed files/migrations; implemented versus reused paths; commands and exact test results; local check commands/results tied to source commit; provider calls/account label/usage/cost; browser/production evidence; deployment state; pending defects and owner approvals; what was not tested; whether production D1, secrets, spend, outreach, live payment or deployment was touched.

Never claim success before evidence. Keep canonical master, audit, roadmap and prompt synchronized. Continue in small reviewable batches; do not stop after documentation.


## Manual Cloudflare Pages release — mandatory execution contract

Follow `docs/28-production-build-artifact-and-pages-deployment.md`. DAYANEXA uses manual, operator-controlled Cloudflare Wrangler deployment. Do not create or rely on GitHub Actions CI/CD workflows.

Required release sequence:
1. Confirm the exact `main` commit SHA and inspect the intended source changes.
2. From a clean local checkout, run `npm ci`.
3. Run `npm run check`, `npm run audit`, and `npm run build`; stop on any failure.
4. Inspect `dist/` and the generated frontend bundle: confirm the expected Clerk publishable key is present and no Clerk secret/JWT/webhook key or provider credential is included.
5. Authenticate Wrangler through the operator's Cloudflare account; confirm `wrangler whoami`, account identity and Pages project `dayanexa`. Never paste credentials into chat or commit them.
6. Deploy manually using the repository's `npm run deploy` command, which builds and runs `wrangler pages deploy dist --project-name dayanexa --branch main`.
7. Record source SHA, commands/results, deployment ID/URL, timestamp and deployed commit/build parity.
8. Verify production homepage, served bundle, Google Sign-In, callback, session refresh/sign-out, authenticated and unauthenticated `/api/v1/me`, role and tenant isolation.
9. If the account, project, build output or authorization is uncertain, stop. Never switch to a different account/project or bypass Cloudflare controls.

Do not run `npm run db:migrate:prod` or any production D1 migration as part of frontend deployment. The approval to deploy the frontend does not authorize D1 changes, Clerk dashboard/provider changes, secret creation/rotation, payment changes, billing changes, provider spend or data deletion. Keep the last known-good Pages deployment available for frontend rollback only; do not couple rollback to D1 data changes.

Local validation is not proof of deployment. Wrangler reporting a successful upload is not proof that authentication works. Keep status **PRODUCTION DEPLOYMENT PENDING** until all production verification criteria pass.


## Mandatory implementation closure

Do not stop after Batch 0 audit or after writing a roadmap. Execute Phases 1–11 in docs/29 in dependency order, splitting into small reviewable source batches. Every batch must include real source changes when a safe implementation gap exists, focused regression tests, local validation and updated audit/status. If a phase is blocked by a missing provider credential, production secret, external account permission, payment merchant setup or owner-only production action, finish all safe code-side work, fail closed, document the exact blocker and continue with independent work.

No placeholder success, fake live metrics, unconnected buttons, unbounded provider calls, mock production auth, unverified demand, simulated payment or invented earnings. Test the failure path as deliberately as the happy path. Keep the manual Wrangler-only release contract; do not restore GitHub Actions CI/CD.

**Batch completion report:** exact before/after SHA; defect and root cause; source paths changed; migrations; tests/commands and exact results; provider usage/cost; browser/sandbox/production evidence; approvals and blockers; untested cases; next implementation batch. Never claim source, test, sandbox or production completion without its corresponding evidence.
