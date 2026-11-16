# DAYANEXA — Canonical Master System V3.1

**Product:** DAYANEXA — Agentic Opportunity & Execution OS  
**Domain:** https://dayanexa.biz.id  
**Repository:** https://github.com/Sparkmind-obp-off/Dayanexa  
**Branch:** main  
**Tagline:** Discover demand. Build the capability. Deliver the outcome.  
**Doctrine:** Demand defines the opportunity. Capability is formed to fulfil it. Execution creates the outcome.  
**Date:** 16 November 2026  
**Status:** Canonical product, architecture, governance and implementation authority.

## 0. Authority and document map

This file is the single top-level source of truth. Detailed contracts remain binding:
- `docs/16-master-system-and-full-stack-implementation.md` — full-stack architecture and domain contracts.
- `docs/17-master-upgrade-and-execution-roadmap.md` — roadmap.
- `docs/24-batch-v2-code-audit.md` — dated source audit; refresh against current HEAD before implementation.
- `docs/25-admin-resource-control-center.md` — admin control plane.
- `docs/26-provider-runtime-governance.md` — provider account/quota/runtime/fallback rules.
- `docs/27-clerk-publishable-key-build-contract.md` — Clerk public-key Vite build-time contract and production verification.\n- `docs/28-production-build-artifact-and-pages-deployment.md` — canonical manual Wrangler build, deployment, production smoke tests and rollback contract.
- `prompts/DAYANEXA_FULL_IMPLEMENTATION_MASTER_PROMPT.md` — execution prompt.

Precedence: this master governs product intent, scope and phase order; detailed specs govern contracts; ADRs govern approved deviations. Source code is implementation evidence, not permission to silently change product intent.

**Extend the existing repository. Do not restart or rewrite from scratch. Do not merge DAYANEXA with KAERVAX/KAEVOS or unrelated projects.**

## 1. Product purpose

DAYANEXA discovers real demand, validates it, turns it into viable opportunities, forms the capabilities needed to fulfil it, executes solutions with AI agents and accountable human contributors, and delivers customer-accepted outcomes with verifiable economic records.

It creates real earning opportunities for unemployed, underemployed and low-income people through value creation. It is not a job portal, passive project listing, generic freelancer marketplace, chatbot-only product or revenue simulator.

Discover demand first regardless of current capability. Then choose to reuse, compose, build, acquire/license, integrate, partner, assign a human contributor, defer or reject. Never fabricate demand, customers, jobs, earnings, payment or outcomes.

**North Star — Verified Economic Resolution (VER):** a demand-linked outcome with inspectable evidence, accepted scope, completed and quality-checked delivery, customer acceptance, verified economic records and correct settlement where applicable.

## 2. Non-negotiable doctrine

1. Evidence before claims; demand before solution.
2. Capability can be formed after demand is validated.
3. AI agents are the primary execution mechanism where reliable; humans handle physical work, specialist judgment, local interaction and accountable human action.
4. Contributors see scope, compensation and acceptance criteria before accepting work.
5. Signals are not validated demand; search results are not evidence by themselves; redirects are not payment proof.
6. No external commitment, spend, public demo, outreach, live payment, refund, payout or production migration without required explicit approval.
7. No paid provider usage, overage, top-up or paid fallback without scoped owner approval.
8. Respect provider terms, source permissions, privacy, copyright, platform rules, rate limits and opt-outs.
9. Every sensitive action is server-authorized, attributable and audited.
10. UI, CRUD, mocks, documentation and old CI runs are not proof of end-to-end operation.
11. Unknown authorization, quota, pricing, provenance or safety fails closed.
12. Never evade provider limits by rotating accounts.

## 3. Five engines

### 3.1 Demand Discovery Engine
Discovery briefs and query plans; approved source catalog and permissions; web search, crawl/extraction and specialized Actors; schema-driven inputs/output mapping; durable jobs with history, pagination, pause/resume/cancel/recovery; provenance, hashes, timestamps, deduplication, stable idempotency, retries, per-job budget and usage reconciliation.

Initial adapters: Tavily search, Firecrawl crawl/extraction, Apify OR Scrape.ly specialized Actors, Workers AI inference. Social sources such as Threads are candidates only after access, terms, permissions, Actor compatibility and account entitlement are verified.

### 3.2 Demand Intelligence Engine
Persistent DemandCluster, membership/version and split/merge history; normalization, niche taxonomy, deduplication, corroborating/contradicting evidence, source independence, scoring and rubric versions; human review and confirmation experiments. Keep demand confidence, commercial potential, execution feasibility, strategic value and risk as separate dimensions. AI assessment is a draft, not truth.

### 3.3 Capability & Solution Foundry
Versioned SolutionSpec for products, services, packages and managed outcomes; feature-to-demand evidence traceability; reuse/compose/build/acquire/integrate/partner/contributor/defer/reject decisions; capability inventory/gaps; cost, risk, timeline and dependency plans; readiness tests and evidence. A capability cannot be marked ready without proof.

### 3.4 Agentic Execution Engine
Agent registry and versions; scoped tool registry and schemas; AgentRun, TaskRun, ToolInvocation and traces; durable task graph and orchestration; budget reservations, retries, idempotency, cancellation and recovery; structured outputs; human escalation and contributor assignments; isolated build/test/sandbox/preview pipeline; private artifacts, hashes, QA, revisions and delivery.

Agent records alone do not execute work. Prove actual runs, tool calls, artifacts, tests and cost.

### 3.5 Market Delivery Engine
Demand-linked demo and market presentation; consent/legal basis, approval, expiry and revocation; immutable offers and quote versions; exact quote hash acceptance; scope, exclusions, deliverables, timeline, milestones, revisions, taxes/fees, cancellation/refund/dispute and expiry; customer response and feedback; invoice, payment, signed webhook, inquiry/reconciliation; accepted delivery, ledger, contributor settlement and learning feedback.

## 4. Ten logical domains

1. Market Perception.
2. Demand Intelligence.
3. Opportunity Intelligence.
4. Solution Intelligence.
5. Capability Foundry.
6. Product & Commercial Engine.
7. Agentic Execution Network.
8. Quality, Delivery & Outcome.
9. Economic & Settlement Engine.
10. Learning & Evolution Engine.

Cross-cutting: identity/access, tenant isolation, policy engine, provider runtime gateway, audit, notifications, storage, observability, backups, configuration and feature flags. Begin as a modular monolith with one logical orchestrator and one Command Center.

## 5. Canonical entities

Identity: User, Principal, Organization, Membership, Role, Permission, Consent, TenantPolicy.

Market: Source, SourcePermission, DiscoveryBrief, DiscoveryJob, SourceRun, Signal, Evidence, Demand, DemandCluster, DemandClusterMembership, ClusterVersion, ValidationExperiment, Opportunity, OpportunityAssessment, Scorecard.

Solution: Solution, SolutionVersion, SolutionSpec, Product, Service, Package, ManagedOutcome, Capability, CapabilityGap, CapabilityBuild, CapabilityTest, CapabilityReadinessEvidence, Partner, AcquisitionDecision.

Execution: Agent, AgentVersion, Tool, ToolSchema, ToolPermission, AgentRun, ToolInvocation, Mission, Task, TaskDependency, Assignment, ExecutionAttempt, Artifact, Build, TestRun, Preview, QualityReview, Delivery, Acceptance, Dispute.

Market/customer: Customer, CustomerContact, ConsentRecord, MarketPresentation, Demo, DemoAccess, Offer, QuoteVersion, QuoteAcceptance, Contract, Invoice, SupportTicket, Feedback, OptOut/Suppression.

Provider: Provider, AccountProfile, CredentialReference, ProviderPolicy, ProviderCapability, QuotaSnapshot, RateLimitSnapshot, ActorRegistryEntry, ActorVersion, ActorInputSchema, ActorOutputMapping, FallbackRule, UsageReservation, ProviderUsageEvent, CostReconciliation, CircuitBreakerState, ProviderApproval.

Economics/governance: Subscription, Entitlement, PaymentIntent, PaymentEvent, Payment, Refund, GatewayFee, TaxRecord, RevenueRecord, CostRecord, ContributorPayable, Settlement, PayoutRequest, LedgerAccount, LedgerEntry, Reconciliation, Policy, Approval, AuditEvent, Incident, LearningRecord, PerformanceRecord, PromptVersion, RubricVersion, ModelProfile, FeatureFlag.

Preserve immutable versions for quotes, contracts, payment events, ledger entries, policies, source/Actor versions and approvals. Enforce tenant isolation across routes, joins, background jobs and artifact access.

## 6. Lifecycle contracts

Demand: DISCOVERED → NORMALIZED → CLUSTERED → UNDER_REVIEW → VALIDATED / REJECTED / DEFERRED.

Opportunity: CANDIDATE → ASSESSED → PRIORITIZED → SOLUTION_DESIGN → CAPABILITY_PLANNED → CAPABILITY_READY → OFFER_READY → ACTIVE / PAUSED / CLOSED.

Capability: IDENTIFIED → GAP_ANALYSIS → REUSE / COMPOSE / BUILD / ACQUIRE / INTEGRATE / PARTNER / HUMAN_CONTRIBUTOR → TESTING → READY / BLOCKED / RETIRED.

Offer/mission: DRAFT → REVIEW → SUBMITTED → ACCEPTED / REJECTED / EXPIRED → MISSION_CREATED → EXECUTING → QA → REVISION / APPROVED → DELIVERED → ACCEPTED / DISPUTED → SETTLED / CLOSED.

Use canonical server-side transition services, preconditions, audit and idempotency. UI is never the source of truth.

## 7. Identity, roles and journeys

Clerk Production, Google Sign-In only. No password, magic link or extra social provider unless owner changes the decision. Verify correct DAYANEXA Production instance, callback/domain, SDK, JWT, authorized parties, webhook signing secret and server-side keys. Owner bootstrap requires verified Google identity plus server-side allowlist and one-time audit; never grant owner from client metadata. Do not alter unrelated Clerk apps.

Roles:
- Owner: full governance and approvals.
- Operator: discovery, demand review, opportunities, solutions and mission operations within scope.
- Finance: quotes, payments, reconciliation and ledger; maker-checker for sensitive operations.
- Analyst: read-only evidence, cost and performance.
- Customer: own requests, quotes, invoices, payment status, delivery, acceptance, disputes, support and data rights.
- Contributor: profile, verification, tasks, visible compensation, accept/decline, submit, revision, payable and settlement.
- Agents: non-human principals with narrowly scoped permissions, never implicit owner.

Required journeys:
1. Google sign-up/sign-in, consent, session refresh, sign-out and role workspace.
2. Customer request → clarification → quote version → exact approval → invoice/payment → delivery → acceptance/dispute/support/export/deletion request.
3. Contributor onboarding → verification → task and compensation → accept/decline → submit → QA/revision → payable → settlement.
4. Operator discovery → evidence → cluster/demand → opportunity → solution/capability → offer/mission → execution → QA/delivery.
5. Finance invoice/payment event → signature/deduplication/inquiry → reconciliation → taxes/fees/revenue/cost separation → maker-checker.
6. Owner security/users → customers/contributors → providers/Actors/quotas/cost → infrastructure/CI/backup → approvals/audit.

## 8. One Command Center — 15 workspaces

Preserve the 14 existing role workspaces and the 15th owner-only Admin & Resource Control workspace. Target logical areas:
1. Overview / Command Center.
2. Demand Discovery.
3. Signals & Evidence.
4. Demand Clusters & Validation.
5. Opportunities.
6. Solutions & Product Foundry.
7. Capabilities & Readiness.
8. Agents & Tools.
9. Missions & Task Graph.
10. Quality, Artifacts & Delivery.
11. Market Presentation & Offers.
12. Customers & Requests.
13. Contributors & Workforce.
14. Finance, Billing & Settlement.
15. Admin & Resource Control.

Admin control plane must cover system health; customer administration; contributor verification/suspension; provider and account registry; Actor registry and schema editor; quota/rate/cost/usage; reservations/reconciliation; fallback allowlist/approvals; Cloudflare D1/R2/Workers AI/Queues/Workflows health; manual release and deployment commit parity; backup/restore, incidents and audit. Current shell is owner-only and partly read/verify; do not claim full administration until persistent API and policy enforcement exist. UI controls must be server-authorized and audited; secrets never display.

## 9. Provider and Actor governance

Detailed binding contract: `docs/26-provider-runtime-governance.md`.

Provider roles:
- Cloudflare Workers AI primary inference via native `env.AI`.
- Groq optional inference, disabled by default.
- Tavily search/discovery.
- Firecrawl crawl/extraction.
- Apify specialized Actors.
- Scrape.ly alternative specialized extraction.
- DAYANEXA-native orchestration initially; LangGraph optional later, LangChain optional abstraction, CrewAI experimental only.

Separate Provider, AccountProfile and CredentialReference. AccountProfile tracks plan, billing state, independent authorization, terms, capabilities, quota windows/timezone, rate limits, cost model, health and secret reference. Actor registry tracks exact Actor ID/version, source coverage, README/terms, input JSON schema, output mapping, pricing, compute/proxy/storage units, max items, timeout, concurrency, per-run cap and approval expiry.

Every provider call—API, queue, scheduled job or agent tool—must pass through one server-side Provider Runtime Gateway:
1. Resolve tenant/task/mission/purpose/environment/data class/capability.
2. Select only an active, independently authorized, terms-compliant account allowed for exact source/task.
3. Check credential reference, health, privacy/region, fresh quota, rate limits and internal caps.
4. Atomically reserve maximum expected units and cost.
5. Dispatch through typed server-side adapter.
6. Persist request/run ID, idempotency, status, usage and error.
7. Reconcile actual usage/cost and release unused reservation.
8. Update quota/circuit breaker and audit without secrets.

Track provider allowance, provider rate limits, DAYANEXA per-request/daily/monthly caps, mission budget, currency hard cap, reserved/consumed/remaining, billing state, reset window/timezone and confidence separately. Unknown/stale quota or price fails closed. Exhausted account is paused for the capability/window. 429 respects Retry-After/reset and circuit breaker.

Account failover is allowed only by explicit owner-approved task/source allowlist for a separately authorized, terms-compliant, healthy account with fresh quota and budget. Never rotate to evade 429, bans, suspension, trial/free-tier limits, identity restrictions or terms. No eligible account means stop/defer/review. Multiple API keys on one account do not multiply free quota.

Paid use, overage, paid fallback, top-up, paid proxy/storage/compute and subscriptions default OFF. Owner approval must specify provider/account, capability, spend cap, period and expiry. Never change billing or payment settings automatically. Apify OR Scrape.ly per source/task unless benchmark plus owner approval justifies both. Verify current official terms/pricing and actual account dashboard before activation.

## 10. Commercial and economic model

All prices below are hypotheses, not validated promises:
- Free Rp0: 2 requests, 0 AI assists, 1 seat.
- Pro Rp149,000 per 30 days: 10 requests, 50 AI assists, 3 seats.
- Plus Rp399,000 per 30 days: 30 requests, 200 AI assists, 10 seats.
- Demand Validation from Rp750,000/project.
- Solution Sprint from Rp3,500,000/sprint.
- Build & Deliver from Rp9,500,000/mission.
- Managed Operations from Rp4,900,000/month.

Subscription covers access/quotas/support, not custom project execution or contributor compensation unless quote says so. No auto-renewal without opt-in/legal review. Quotes are immutable/versioned and scoped. Metered add-ons and partner commission remain gated. Separate gross charge, tax, discount, gateway fee, refund/chargeback, net cash, platform revenue, provider costs, contributor compensation, payable/liability, settlement and margin. Gross payment is not platform revenue.

Payment adapters exist for Duitku, Xendit, Midtrans and Faspay. One approved gateway pilot first. Faspay fail-closed until merchant channel/contract verified. `PAYMENTS_MODE=mock`, `PAYMENT_LIVE_ENABLED=false` by default. Signed, deduplicated webhook plus server-side inquiry/reconciliation is payment proof; redirect is not. Refund and payout use maker-checker.

## 11. Technical architecture

React/Vite/TypeScript; Hono on Cloudflare Workers/Pages; Clerk Production; D1; private R2; Workers AI via `env.AI`; Queues/Workflows for durable background work; Durable Objects only when justified; typed provider adapters behind runtime gateway; structured logs, metrics, traces, audit, health, backup and alerting.

Start modular monolith, not microservices. DAYANEXA owns domain model, lifecycle, data, workflows, policy, auth, audit, provider registry, cost control, payment state, ledger and learning. Providers are replaceable adapters, never business sources of truth.

DAYANEXA uses **manual Cloudflare-first releases with Wrangler**. GitHub is the source repository only; Git pushes do not deploy. GitHub Actions CI/CD workflows are intentionally not used. Before every release, the operator performs the documented local checks (`npm ci`, `npm run check`, `npm run audit`, `npm run build`), inspects the exact build output and deploys with the repository's Wrangler command (`npm run deploy`) to Pages project `dayanexa`. Record source commit, build/check results, Wrangler account/project confirmation, deployment ID/URL and post-deploy smoke evidence. Follow `docs/28-production-build-artifact-and-pages-deployment.md`.

## 12. Security, privacy and resilience

Server-side RBAC/ABAC and tenant isolation; least privilege; maker-checker; immutable audit; no secrets in browser/logs/prompts/Git; only `.env.example` tracked; prohibit `.env.production` and `.env.development`; rate limiting, SSRF defenses, schema validation, safe uploads, signed short-lived URLs, privacy/terms consent, export/deletion requests, retention, backup/restore, incident response and key rotation. Fail closed for metered external operations when policy/quota cannot be checked.

Manual release and maintenance procedures must never delete customer, contributor, payment, ledger, audit, D1, R2 or production data. Never run a production migration as an incidental part of frontend deployment.

## 13. Existing implementation — reuse and gaps

A Batch V2 source audit at commit `04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa` found a meaningful foundation:
- Clerk integration and principal/permission model; React/Vite/TS dashboard.
- D1 migrations 0001–0006; Cloudflare Workers/Pages, R2 and Workers AI bindings.
- Provider registry/governor and Tavily, Firecrawl, Apify/Scrape.ly adapter paths.
- Search/extract/Actor-run routes, signals/evidence and benchmarks.
- Manual demand creation, evidence linking, validation gate and opportunity assessment.
- Solution, capability and capability-gap workflows.
- Agent registry/profile, missions, tasks and manual assignments.
- Private R2 artifacts, hashes, signed links, QA/delivery routes.
- Versioned offers/quotes, customer request/invoice/payment, subscription/entitlement and double-entry ledger foundations.
- Contributor compensation/task/settlement foundations.
- Owner-only Admin & Resource Control Center shell and contributor verify/suspend action.
- Environment-specific files removed from Git. Historical GitHub Actions workflow/template have since been retired; local validation commands remain available.

Audit classified the V3 engines as partial, not end-to-end. Gaps:
- durable discovery jobs, source permissions, schema-driven Actor input, stable idempotency and complete cost reconciliation;
- persistent DemandCluster, split/merge, source independence and validation experiments;
- evidence-backed SolutionSpec and test-backed capability readiness;
- actual agent runtime, tool invocation trace, durable task graph, budget enforcement and sandbox demo build;
- market presentation consent/approval, preview revocation, response capture and feedback loop;
- expanded tenant isolation tests and real Google auth/browser proof;
- persistent provider policy/account registry, runtime gateway, automatic quota enforcement and compliant failover;
- full customer administration, operator/finance granular permissions, Cloudflare/deployment/backup/restore monitoring.

Re-audit current HEAD; this older audit is not a statement of current source state.

## 14. Evidence and current status rules

Classify every capability as:
- Implemented in source (exact commit and code path).
- Local checks verified (commands/results tied to exact source checkout).
- Provider/sandbox verified (actual controlled external response and usage).
- Production verified (deployed build parity and authorized browser/API workflow).

Historical evidence only: earlier GitHub Actions runs `43806769240`, `43847796716` and `43850273982` passed for their respective historical commits. GitHub Actions has since been retired by owner decision. These results do not verify the current HEAD, a local build, or a production deployment. Use local checks and Wrangler deployment evidence for every release.

Admin UI and governance docs are not deployed merely because they are committed. Cloudflare Pages deployment is manual via Wrangler. The Vite build-time Clerk public-key source fix is committed, but production deployment and post-deployment Google Sign-In verification have not been proven in the recorded baseline. Keep status **SOURCE FIX COMMITTED / PRODUCTION DEPLOYMENT PENDING** until docs/28 acceptance criteria pass. Historical CI success is not current release evidence.

## 14A. Production build and deployment contract

All release states are distinct and must be evidenced separately: source commit identified, local checks passed for that exact checkout, production build inspected/scanned, Wrangler deployment completed, domain smoke passed, and Google authentication verified. Record commit SHA, local command results, build timestamp/output identity, Cloudflare Pages deployment ID/URL and post-deploy evidence. Do not infer one state from another.

The Clerk publishable-key incident is the active example: Vite requires a build-time value; runtime Pages variables cannot rewrite an existing bundle. Build from the corrected commit, inspect the output, scan for secrets, deploy only the exact artifact, then test the live domain and Google Sign-In. Use the documented manual Wrangler process. Confirm the authenticated Cloudflare account and exact Pages project before deployment. Missing credentials, wrong account, wrong project or uncertain build provenance means stop, not improvise.

Deployment approval is scoped to the frontend bundle only. It does not authorize D1 migrations, Clerk dashboard changes, secret changes, payment changes, provider spend, billing changes or data deletion. See `docs/28-production-build-artifact-and-pages-deployment.md`.

## 15. Phased implementation and exit gates

**Phase 0 — Fresh audit:** inspect current main HEAD/tree/routes/services/adapters/migrations/workspaces/local validation scripts/Wrangler deployment. Refresh code audit. Map each requirement to code, gaps, tests and owner gates. Exit: no duplicate work or destructive rewrite.

**Phase 1 — Identity & production integrity:** Clerk Google-only, SDK, callback/domain, JWT, webhook, owner allowlist, tenant isolation, real sign-in/out/refresh, /api/v1/me, local validation and Wrangler deployment parity.

**Phase 2 — Customer/contributor/operator journeys:** full role flows and tenant tests.

**Phase 3 — Commercial/economic integrity:** immutable quote, entitlement window, payment webhook/inquiry, ledger, tax/fees/revenue/cost/payable/settlement. Live payment remains gated.

**Phase 4 — Admin Control Center:** customer/contributor administration, provider/account/Actor registry, cost/usage/quota, approvals, Cloudflare/deployment/backup/restore/audit. Owner-only until granular RBAC is tested.

**Phase 5 — V3-A Discovery reliability:** durable jobs, schema-driven Actors, permissions, stable idempotency, retry/cancel/pagination, budgets and usage.

**Phase 6 — V3-B Demand intelligence:** DemandCluster, dedup, split/merge, source independence, niche taxonomy, scoring and validation experiments.

**Phase 7 — V3-C Foundry:** SolutionSpec, evidence traceability, capability plan and test-backed readiness.

**Phase 8 — V3-D Agentic execution:** scoped tools, AgentRun/ToolInvocation, durable task graph, budget, retries, human escalation and sandbox build/test/preview. Prove a working demo.

**Phase 9 — V3-E Market delivery:** consented demo, approval, expiry/revocation, feedback, demand-linked offer and accepted delivery. No unapproved outreach.

**Phase 10 — Controlled pilot:** backup/restore, monitoring, runbooks, legal/privacy, support, VER, quality, margin, provider cost, contributor outcomes and owner approval.

## 16. Definition of complete

V3 is complete only when five engines work end-to-end; clusters and validated demand are persistent; solution readiness is test-proven; agents actually execute scoped tools and durable tasks; a mission creates a tested private revocable demo; market consent/feedback links to demand; all customer/contributor/operator/finance/owner journeys work; Admin Control Center is backed by secure APIs; every provider call is quota/cost governed with compliant fallback; payments and ledger reconcile; local checks pass for the release source; deployment parity, backups/restore, monitoring, legal/privacy and owner approvals are proven.

## 17. Required batch report

Report exact branch/HEAD, changed files/migrations, code reused/implemented, test commands/results, local command results and source commit, provider calls/usage/cost (never secrets), browser/production evidence, deployment status, remaining defects/owner actions and what was not tested. Explicitly state whether production D1, secrets, provider spend, external contact, live payment or deployment was touched.