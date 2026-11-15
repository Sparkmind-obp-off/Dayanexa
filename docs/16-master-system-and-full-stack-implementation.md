# DAYANEXA — Master System & Full-Stack Implementation Specification

**Document type:** Canonical implementation contract  
**Version:** 1.0  
**Date:** 16 November 2026  
**Status:** Approved architectural direction; implementation and production activation remain gated  
**Repository:** `Sparkmind-obp-off/Dayanexa` · `main`  
**Product:** Agentic Opportunity & Execution OS

> Discover demand. Build the capability. Deliver the outcome.

## 0. Purpose and authority

This document consolidates the product constitution, domain architecture, provider strategy, identity, monetization, payments and delivery requirements into one implementation contract. It is the governing reference for the complete DAYANEXA build.

The implementation agent MUST read this document and the linked canonical documents before changing code. If a conflict exists, use this precedence:

1. Product Constitution and explicit owner decisions.
2. This Master System & Full-Stack Implementation Specification.
3. Domain, lifecycle, governance, economic and provider specifications.
4. Existing code and prototype behavior.

Existing code is not automatically correct merely because it exists. Audit it against this contract. Preserve valid work; refactor or replace unsafe/incomplete scaffolding with tests and a migration plan. Never represent a scaffold as a verified integration.

## 1. Product identity and non-negotiable doctrine

DAYANEXA is an Agentic Opportunity & Execution OS that identifies real demand, validates it, forms the capability needed to fulfil it, creates a viable offer, coordinates AI agents and human contributors, delivers accepted outcomes, verifies the economic result and learns.

It is NOT a job board, freelancer directory, passive project listing, generic chatbot or conventional agency limited to today's installed skills.

**Core doctrine:** Demand defines the opportunity. Capability is formed to fulfil it. Execution creates the outcome.

### Success metric
North Star: **Verified Economic Resolution (VER)** — a real demand/opportunity that passes evidence and commercial validation, is fulfilled, accepted by the customer, has payment verified, has direct costs and margin recorded, and reaches its proper settlement state.

Never count a lead, generated listing, unaccepted delivery, unpaid invoice, simulated payment or unverified scraping result as a completed economic outcome.

### Product boundaries
- Support customer-originated demand and market-originated opportunities.
- Discover demand independently of currently installed capabilities.
- Resolve capability gaps by reuse, composition, build, acquire/license, integrate, partner, human contributor, defer or reject.
- Offer products, services, packages, solutions, managed outcomes and recurring offerings.
- AI agents are the primary execution mechanism where reliable; human contributors are engaged when physical work, specialist judgment, local interaction or accountable human action is required.
- Never fabricate jobs, demand, customers, revenue, testimonials or contributor earnings.
- Never hide that a payment, execution, provider, account or outcome is still pending.

## 2. Complete system boundary

DAYANEXA owns its canonical data, domain lifecycle, policy, authorization, orchestration decisions, provider registry, cost controls, payment state, economic ledger, audit trail and learning records.

External vendors are replaceable capabilities, not the system's source of truth.

### Target stack (initial architecture)

| Layer | Selected direction | Responsibility |
|---|---|---|
| Web application | React + TypeScript + Vite | Public site, authenticated workspace, command center |
| UI | Existing component system; accessible design tokens; responsive layout | Consistent interaction and accessibility |
| Client data | TanStack Query (or equivalent, one chosen library) | Server state, cache, invalidation |
| Forms/schema | Zod + React Hook Form (or equivalent) | Typed validation at client boundary; server revalidates |
| Edge/API | Cloudflare Workers + Hono | API, webhooks, auth verification, business services |
| Database | Cloudflare D1 (SQLite) | Canonical relational operational data |
| Object/file storage | Cloudflare R2 | Private evidence, deliverables, exports, attachments |
| Async work | Cloudflare Queues | Retryable background work and provider tasks |
| Durable workflows | Cloudflare Workflows or an explicitly tested internal state machine | Long-running, retry-safe mission/payment processes |
| Coordination/realtime | Durable Objects only where single-writer coordination or realtime state is required | Locks, coordination, live operational state |
| Authentication | **Clerk Production** | Authentication, sessions, user lifecycle, account recovery |
| Authorization | DAYANEXA policy service and D1 | Roles, scopes, permissions, approvals and ownership |
| AI inference | GroqCloud adapter first; model/provider registry | Classification, extraction assistance, reasoning and generation |
| Search/discovery | Tavily adapter | Search discovery and source finding |
| Crawl/extraction | Firecrawl adapter | Website/page extraction and crawl jobs |
| Specialized scraping | Apify OR Scrape.ly adapters, selected per source benchmark | Platform-specific structured collection |
| Workflow/agent framework | DAYANEXA-native lifecycle first; LangGraph optional later | Canonical workflow state and orchestration |
| Multi-agent framework | CrewAI experimental only, not on critical path | Optional bounded agent collaboration |
| Monitoring | Cloudflare logs/metrics + structured application events; OpenTelemetry-compatible traces where practical | Runtime health, cost, latency and errors |
| CI/CD | GitHub Actions + Cloudflare deployment | Checks, build, migrations and controlled release |
| Domain/DNS | Cloudflare | DNS, TLS, routing and environment separation |

This is a target design, not a claim that every account, plan, feature or resource is currently activated. Confirm account-specific availability, limits and prices before relying on them.

### Architectural rule
Start as a **modular monolith** with clear domain boundaries, shared contracts and asynchronous workers. Do not split into microservices until measured scale, team ownership or isolation requirements justify it.

## 3. Frontend: complete user experience

Build the public and authenticated product, not a static dashboard mock.

### Public surface
- Landing page explaining demand-first economic outcomes.
- How it works and trust/safety explanation.
- Product/service/solution catalog and offer detail.
- Customer request / opportunity submission.
- Pricing and plan comparison when commercial terms are approved.
- FAQ, contact/support, Terms, Privacy, contributor terms and refund/dispute policy.
- SEO metadata, canonical URLs, accessible semantic structure and responsive behavior.
- No fake testimonials, fabricated metrics or fake availability.

### Authenticated surfaces
- Clerk Production sign-in, sign-up, sign-out and account recovery.
- First-run onboarding, profile, consent and account status.
- Role-aware command center.
- All 14 workspaces: Executive Command; Market Radar; Demand Intelligence; Opportunity Universe; Solution Studio; Capability Foundry; Product & Service Catalog; Agent Workforce; Execution Control; Commercial Control; Quality & Delivery; Economic Ledger; Intelligence & Learning; Governance & Audit.
- Customer request tracking, offer acceptance and payment status.
- Contributor onboarding, mission scope, compensation, work status, acceptance and dispute path.
- Operator/admin control surfaces with explicit permission gates.
- Notification center, activity history and support.

### Frontend quality requirements
- Every displayed live metric comes from an authenticated API and includes loading, empty, stale and error states.
- Do not hardcode placeholder values as live data.
- Use role-aware navigation, but enforce permissions on the server too.
- Every interactive control has a real action, success/failure feedback, disabled state and keyboard support.
- Forms validate on client and server; never trust client-provided price, role, status, provider fee or permission.
- Payment UI shows gross amount, fees where known, total, currency, payment state and clear refund/support terms.
- Avoid storing secrets, Clerk secret keys, payment keys or provider tokens in browser bundles/local storage.

## 4. Backend domain modules

Use Hono route groups and service/repository boundaries. Keep business logic out of route handlers.

1. Identity & Access — Clerk identity mapping, accounts, organizations, memberships, role/scope permissions.
2. Market Perception — source registry, collection schedules, source health, provenance.
3. Demand Intelligence — signals, evidence, normalization, clusters, validation.
4. Opportunity Intelligence — opportunity creation, assessment, scoring and prioritization.
5. Solution Intelligence — product/service/solution design, feasibility and offer blueprint.
6. Capability Foundry — capability inventory, gap analysis, build/acquire/partner/contributor plans.
7. Product & Commercial — catalog, pricing, quote, contract, offer and subscriptions.
8. Agentic Execution — agents, tools, task decomposition, missions, assignment, execution and retries.
9. Quality & Delivery — quality review, deliverables, acceptance, revision and disputes.
10. Payment & Economic — gateway adapters, payment intents/events, refunds, payout requests, reconciliation, ledger.
11. Learning & Evolution — performance, cost, feedback and model/provider quality.
12. Governance & Audit — policy, approval, risk, audit, retention and data rights.

Each module exposes typed commands/queries and emits domain events. Cross-module changes use explicit application services/workflows, not ad hoc SQL in unrelated handlers.

## 5. Canonical lifecycle and data

Retain the canonical opportunity/mission lifecycle from `docs/03-opportunity-lifecycle.md`. State transitions must be explicit, validated, auditable and idempotent. Do not let a frontend or external provider directly set a canonical lifecycle state.

Canonical entities include Source, Signal, Evidence, Requester, Demand, DemandCluster, Opportunity, OpportunityAssessment, Solution, Product, Service, Offer, PricingModel, Capability, CapabilityGap, CapabilityBuild, Agent, Tool, Provider, Contributor, Mission, Task, Assignment, Execution, Artifact, QualityReview, Delivery, Acceptance, Dispute, Customer, Contract, Quote, Transaction, Payment, Settlement, LedgerEntry, CostRecord, RevenueRecord, Policy, Permission, Approval, AuditEvent, LearningRecord and PerformanceRecord.

Use opaque IDs, UTC timestamps, explicit currency/units, immutable provenance and soft-delete/retention rules where required. Store money as integer minor units (IDR rupiah as integer); never use floating-point arithmetic for financial postings.

Keep distinct scores: demand confidence, commercial potential, execution feasibility, strategic value and risk level. Expose evidence and rationale for scores.

## 6. Clerk Production — mandatory identity architecture

**Clerk Production is mandatory for the production user-authentication path.** A mock login, local-only user, hardcoded admin password or development Clerk instance is not an acceptable substitute for the production build.

Clerk responsibilities:
- Authentication, session issuance and verification.
- Sign-up/sign-in, account recovery and supported identity providers.
- User lifecycle events and account security features.
- Production domain and redirect configuration.

DAYANEXA responsibilities:
- Internal immutable user ID.
- Organization, team, membership, role, scope and permission.
- Contributor/customer/operator classifications and status.
- Approval rights, resource ownership and audit.
- Policy enforcement on every protected API and object.

### Identity rules
- Store a unique `clerk_user_id` mapping to internal `users.id`; do not use email as primary identity.
- Verify Clerk session JWT on the server using the supported Clerk backend verification method and the Production instance's correct key/configuration.
- Validate authorized party/origin, issuer/audience where applicable, expiry and signature.
- Never accept role, organization, payment status, account status or permissions from client-supplied metadata.
- Webhooks: verify signature against raw request body, persist idempotency key, process asynchronously, tolerate retries and reconcile missed events.
- Separate production, preview and local configuration. Production keys must never be used in local tests; development keys must never authenticate production users.
- Configure exact allowed origins, redirect URLs, callback URLs and custom domain only after owner supplies/approves the real Clerk Production configuration.
- Keep secret keys only in Worker secrets. Public publishable key may be exposed only where Clerk's design requires it.
- Enforce account suspension, deletion, organization isolation and resource-level authorization server-side.
- If Clerk Production cannot be verified/configured, stop the production-auth acceptance gate. Do not quietly downgrade to mock authentication.

Production acceptance requires a successful real sign-in on the production domain, session refresh, sign-out, protected API access, denied unauthorized access, verified webhook and account lifecycle test.

## 7. Provider registry and adapters — all providers in one system

Create one provider registry with normalized interfaces, capability metadata, health, configuration status, pricing model, quotas, cost limits, environment support and fallback policy. A provider being listed does not mean it is enabled.

### AI and market intelligence
- **GroqCloud:** model inference adapter. Model selection, token accounting, latency/error tracking, prompt/version trace and per-task budget.
- **Tavily:** search/discovery adapter. Preserve query, source URL, timestamps and evidence provenance. Search result is a signal, not validated demand.
- **Firecrawl:** scrape/crawl/extract adapter. Preserve page URL, crawl time, extraction schema, content hash and source terms.
- **Apify:** specialized actor adapter for source-specific structured data. Require actor README/schema, permissions, data minimization, run limits and per-result cost measurement.
- **Scrape.ly:** specialized actor adapter alternative. Benchmark against Apify on identical representative tasks; do not activate both by default for the same source.
- **LangGraph:** optional later for durable stateful agent orchestration where the DAYANEXA-native workflow engine demonstrably needs it. DAYANEXA lifecycle remains canonical.
- **LangChain:** optional integration/agent abstraction; not a mandatory runtime dependency.
- **CrewAI:** isolated experiment only; never controls payment, authorization or canonical state.

### Adapter contract
Every adapter must implement:
- Stable provider ID and capability list.
- Config validation and readiness status.
- Typed request/response schema with runtime validation.
- Timeout, bounded retry, backoff, circuit breaker and cancellation.
- Idempotency where provider supports it; deduplication otherwise.
- Quota and cost estimate before execution; actual cost/units after.
- Structured error taxonomy and redacted logs.
- Provenance, provider request ID and execution timestamps.
- Data retention/deletion and terms/permission metadata.
- Sandbox/production environment separation.
- Contract tests using recorded fixtures and, when available, sandbox credentials.

Never auto-fallback to a paid provider. Paid fallback requires a configured ceiling and explicit owner approval. If quota/cost limit is exceeded, fail closed, defer or request approval.

## 8. Payment gateway architecture — Duitku, Xendit, Midtrans and Faspay

All four gateways must be represented behind a **single DAYANEXA Payment Gateway interface** and selected through provider registry/configuration. Do not couple the business domain to one provider's response schema.

### Gateway adapters
1. **Duitku** — candidate for Indonesian payment collection and separately authorized disbursement. Confirm merchant product/channel, signature contract, callback, refund handling, settlement and disbursement eligibility. Do not assume prior testing elsewhere means DAYANEXA is configured.
2. **Xendit** — candidate for invoices/collection; strategic marketplace/platform option only if xenPlatform, subaccounts, split and payout products are approved for this merchant and jurisdiction. Verify callback token separately from API secret. Confirm owned subaccount availability; it may require provider activation.
3. **Midtrans** — candidate for broad collection methods via Snap/Core API. Verify sandbox and production keys, notification signature, status inquiry, refund and settlement terms.
4. **Faspay** — candidate for debit/payment-channel integration. Endpoint, merchant credentials, payment channel, callback format and production access are merchant-contract specific. Never invent endpoint, request fields, signature or status mapping; obtain the approved merchant API specification and validate it with fixtures/provider sandbox.

### Normalized payment interface
- `createPaymentIntent`
- `getPaymentStatus`
- `verifyAndNormalizeWebhook`
- `requestRefund`
- `getSettlementReport`
- `createPayoutRequest` (only when product and legal approval permit)
- `getProviderCapabilities`

Represent provider capability honestly. If a gateway does not support a method, return unsupported rather than silently emulating it. Separate collection, split, refund, payout and settlement capabilities.

### Canonical payment lifecycle
`CREATED → PENDING → SUCCEEDED | FAILED | EXPIRED`, with separate `REFUND_PENDING → REFUNDED | REFUND_FAILED`, `DISPUTED`, `RECONCILIATION_REQUIRED`, and settlement states.

Payment success does not mean mission delivered, accepted or contributor paid. Keep these lifecycles independent.

### Webhook and reconciliation requirements
- Verify signatures/tokens using the provider's current official contract and raw payload where required.
- Persist raw payload securely with redaction/retention policy, payload hash, provider event ID, received time and processing outcome.
- Unique provider/event ID; deduplicate retries.
- Do not trust browser return/redirect as payment proof.
- Confirm final status using provider status inquiry or settlement report where supported.
- Handle out-of-order events, duplicate events, delayed callbacks, amount/currency mismatch and unknown order.
- Never mark paid unless order ID, amount, currency, merchant identity and provider status all reconcile.
- Create idempotent ledger postings only after verified events.
- Build refund, dispute, reconciliation and manual review paths before live launch.

### Marketplace and contributor settlement
- Do not represent DAYANEXA as escrow or a wallet unless the provider contract and applicable legal requirements explicitly permit it.
- Do not collect money for third parties, split balances or promise payouts before provider and legal eligibility is confirmed.
- Start with a clearly disclosed single-merchant pilot if appropriate. Marketplace split, subaccounts and payouts are a later gate.
- Contributor compensation is a contractual payable with scope, amount, due date, acceptance criteria and dispute process. It is not automatically released merely because customer payment succeeded.

## 9. Monetization and economic ledger

Supported revenue models:
- Product sales (digital/physical where permitted).
- Packaged services and solutions.
- Implementation/setup fees.
- Subscription tiers.
- Usage-based charges.
- Managed operations/retainers.
- Licensing and white-label.
- Partner referral/commission/margin.
- Outcome-based fees only where attribution, measurement and contract are clear.

### Unit economics
For each offer/mission record:
- Customer list price, discount, tax and gross amount.
- Gateway/provider fee and net settlement amount.
- AI/model/search/scraping/tool cost.
- Human contributor compensation and partner costs.
- Direct execution costs, support/rework and refunds/chargebacks.
- Gross mission margin and contribution margin.
- Amount collected, amount outstanding, payable liabilities and actual settlement.
- Currency, exchange rate and evidence source where non-IDR is later supported.

Gross mission margin = verified revenue excluding pass-through/tax treatment as defined by accounting policy, minus direct mission costs. Keep platform overhead separate for contribution analysis.

Use double-entry journal model. Every posted journal must balance by currency. Never edit a posted journal; reverse and repost with audit. Reconcile gateway settlement against payment events and bank records. No fake balances.

## 10. Agentic execution and human contribution

Agents must have:
- Explicit identity, purpose, capability, model/tool permissions and owner.
- Scoped credentials, least privilege, budget and rate limits.
- Task input/output schema, timeout, retries and cancellation.
- Evaluation criteria and human escalation conditions.
- Full execution trace and cost attribution.

Human contributors must receive clear scope, deliverables, quality criteria, deadlines, compensation, payment conditions, privacy expectations and dispute path before assignment. No unpaid speculative work. Do not expose personal data beyond task necessity.

External commercial commitments, customer-facing price changes, provider spend/top-ups, refunds, contributor settlement, contracts and irreversible actions require the configured approval level.

## 11. Security, privacy and compliance

- Threat model tenant isolation, privilege escalation, prompt injection, malicious files, SSRF, webhook spoofing/replay, credential leakage and supply-chain risk.
- Validate and authorize every API operation server-side.
- Use least-privilege scoped secrets, rotate credentials, redact PII and never log secrets.
- Apply request size limits, rate limits, abuse controls, CSRF/origin protections appropriate to auth transport, secure headers and strict CORS.
- Protect R2 objects with private-by-default access and short-lived signed URLs.
- Scan/validate uploads, MIME type, file size and object key ownership.
- Treat web pages, uploaded documents, actor output and customer text as untrusted data, never system instructions.
- Define retention, deletion, export, consent and incident response.
- Publish legally reviewed Privacy, Terms, refund, dispute and contributor policies before public commercial operation.
- Follow source site terms, platform rules, applicable privacy laws and provider agreements. No unauthorized scraping or bypassing access controls.

## 12. Environments, deployment and operations

Environments: local, preview/staging, production. Each has separate Clerk instance/keys, payment credentials, provider credentials, D1, R2 buckets, webhook URLs, allowed origins and budgets.

CI must run:
1. Dependency install and lockfile validation.
2. Formatting/lint.
3. Frontend typecheck and production build.
4. API typecheck and tests.
5. Domain unit/integration tests.
6. Database migration validation.
7. Adapter contract tests with fixtures.
8. Secret scanning and dependency audit.
9. Optional preview deploy with non-production data only.

Production deploy requires owner-approved environment, verified migrations, backup/restore plan, health checks, rollback plan and post-deploy smoke tests. Never run destructive production migrations without backup and explicit approval.

## 13. Cost, free tiers and provider selection

Maintain a live provider catalog with checked-at date, plan, free allowance, billing unit, overage price, card requirement, concurrency/rate limits, retention, commercial-use terms, region and fallback. Do not hardcode stale pricing as a guarantee.

Initial cost doctrine:
- Begin with genuinely free/no-card allowances when available, but verify current provider account quota.
- Use small bounded tests before high-volume scraping.
- Estimate and enforce cost per task, mission, provider and monthly global budget.
- Cache and deduplicate; do not scrape repeatedly without a freshness reason.
- Never top up, subscribe or invoke paid overage without explicit approval.
- If a free allowance is exhausted, stop/defer rather than silently spend.

Apify vs Scrape.ly must be selected through a source-specific benchmark: coverage, freshness, completeness, success rate, price per accepted evidence, legal permissions and operational reliability. Tavily search and Firecrawl extraction are complementary, not interchangeable. Groq inference is not workflow orchestration.

## 14. Build phases and exit gates

### Phase 0 — Audit and system lock
- Audit every repository file, current code, CI, dependency, migration and deployment.
- Compare against this spec and existing docs.
- Identify broken, unsafe, duplicated and placeholder behavior.
- Produce architecture map, risk register, migration plan and implementation backlog.
**Exit:** owner can review the baseline; no unverified claim.

### Phase 1 — Production foundation
- Complete frontend routing/layout and Hono API boundaries.
- D1 schema, migrations, repository/service layer, R2 private storage.
- Clerk Production integration and DAYANEXA authorization.
- Audit log, rate limits, config/secrets and environment separation.
**Exit:** real Production sign-in and protected API tests pass; role/tenant isolation tests pass.

### Phase 2 — Market intelligence
- Provider registry and cost governor.
- Groq, Tavily, Firecrawl adapters.
- Apify and Scrape.ly benchmark harness and selected adapter.
- Provenance, source permissions, evidence store and demand validation.
**Exit:** reproducible evidence pipeline with cost/provenance and no fabricated demand.

### Phase 3 — Opportunity and capability
- Opportunity assessment and scoring.
- Solution design, catalog, capability inventory and gap resolution plans.
- Human/agent resource selection.
**Exit:** an evidence-backed opportunity can be assessed and translated into an executable solution.

### Phase 4 — Agentic execution
- Mission/task workflow, queue/workflow orchestration, agent/tool registry.
- Human approval gates, budget caps, retries, cancellation, quality review.
- R2 artifacts and secure delivery.
**Exit:** end-to-end mission can execute in controlled sandbox with trace and cost.

### Phase 5 — Commercialization and payments
- Offers, quotes, contracts, checkout, subscriptions/usage model as selected.
- All four payment adapters; provider capability flags and sandbox contract tests.
- Webhook verification, reconciliation, refund and double-entry ledger.
- Single-merchant pilot first; split/payout only after eligibility and legal approval.
**Exit:** payment and settlement are independently reconciled and ledger balances.

### Phase 6 — Full command center
- Complete 14 workspaces bound to live APIs.
- Customer/contributor portals, notifications, reports and governance.
- Operational dashboards with genuine data only.
**Exit:** user roles can complete their authorized end-to-end journeys.

### Phase 7 — Limited pilot and scale
- Pilot with controlled users and limits.
- Monitor VER, acceptance, payment success, margin, cost per outcome, disputes and reliability.
- Expand providers/features only based on measured demand.
**Exit:** repeatable positive economics and safe operations.

## 15. Global Definition of Done

A feature is not done because a screen exists or a commit was made. It is done only when:
- User journey is implemented in frontend and API.
- Server-side authorization and tenant scope are tested.
- Database schema/migration and audit events are correct.
- Provider integration uses official verified contract and fixtures.
- Loading/empty/error/retry states work.
- Idempotency, abuse limits, privacy and failure paths are covered.
- Cost and operational metrics are captured.
- CI passes and deployment smoke tests pass.
- Documentation and runbooks are updated.
- No fake data is represented as live.
- Owner approval is obtained for production, payments and external commitments.

## 16. Current repository state — must be re-audited

The repository has a React/Vite prototype and an initial Workers API/payment scaffold. These are **not** proof of a complete application, working Clerk Production login, provider sandbox validation, real payment processing, payout, reconciliation, or production deployment.

The next implementation agent must audit these artifacts first:
- `src/App.tsx`, `src/main.tsx`, `src/styles.css`
- `apps/api/src/**`, `apps/api/migrations/**`, `apps/api/wrangler.toml`
- `package.json`, CI workflow, environment examples
- `docs/00` through `docs/15`

Do not simply add more code on top of unverified adapters. Verify official API specs and signature examples for each gateway; fix mismatches and create provider-specific contract tests. In particular, merchant-specific Faspay endpoints/channels and each provider's webhook verification must be confirmed against the actual merchant product and sandbox.

## 17. Owner-controlled activation checklist

The implementation agent may prepare code, migrations, tests and setup instructions. It must not claim or perform the following without actual account access, required details and owner approval:
- Create or alter Clerk Production instance, domain, OAuth providers or production keys.
- Create Cloudflare D1/R2/Queues/Workflows or change production DNS/deployments.
- Subscribe, top up or incur paid provider charges.
- Use production payment keys or send live payment/payout/refund requests.
- Enable marketplace split, subaccounts, escrow-like flows or contributor payouts.
- Publish legal policies or make legal/compliance representations.

For each external dependency, report exact required owner action and the evidence needed to mark it ready.

## 18. Canonical related documents

- `docs/00-product-constitution.md`
- `docs/01-master-architecture.md`
- `docs/02-domain-model.md`
- `docs/03-opportunity-lifecycle.md`
- `docs/04-agent-workforce.md`
- `docs/05-demand-intelligence.md`
- `docs/06-capability-foundry.md`
- `docs/07-commercial-economics.md`
- `docs/08-governance-security.md`
- `docs/09-command-center.md`
- `docs/10-roadmap.md`
- `docs/11-implementation-blueprint.md`
- `docs/12-mvp-acceptance.md`
- `docs/13-provider-stack-and-cost-governance.md`
- `docs/14-identity-monetization-and-payments.md`
- `docs/15-implementation-foundation.md`
- `apps/api/README.md`
