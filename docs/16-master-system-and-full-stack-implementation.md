> **Canonical authority:** Follow [DAYANEXA Canonical Master System](00-DAYANEXA-CANONICAL-MASTER-SYSTEM.md) and [Full Implementation Master Prompt](../prompts/DAYANEXA_FULL_IMPLEMENTATION_MASTER_PROMPT.md) for product scope, status, phase order and end-to-end acceptance. This document remains the detailed technical/domain contract; extend existing code and do not restart the project.

# DAYANEXA V3 — Master System & Full-Stack Implementation Specification

**Version:** 3.0 · **Canonical architecture:** Demand-to-Execution · **Updated:** 16 November 2026

**Document type:** Canonical implementation contract  
**Historical baseline:** V2.0 (retained as implementation history)  
**Date:** 16 November 2026  
**Status:** V3 canonical Demand-to-Execution contract; implementation and production activation remain gated  
**Repository:** `Sparkmind-obp-off/Dayanexa` · `main`  
**Product:** Agentic Opportunity & Execution OS

> Discover demand. Build the capability. Deliver the outcome.

## 0. Purpose and authority

This document consolidates the product constitution, domain architecture, Cloudflare-native inference strategy, provider strategy, identity, monetization, payments and delivery requirements into one implementation contract. It is the governing reference for the complete DAYANEXA build.

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
| AI inference | **Cloudflare Workers AI first via native `env.AI` binding**; model/provider registry; GroqCloud optional adapter only | Classification, extraction assistance, reasoning, generation and bounded agent tasks |
| Search/discovery | Tavily adapter | Search discovery and source finding |
| Crawl/extraction | Firecrawl adapter | Website/page extraction and crawl jobs |
| Specialized scraping | Apify OR Scrape.ly adapters, selected per source benchmark | Platform-specific structured collection |
| Workflow/agent framework | DAYANEXA-native lifecycle first; LangGraph optional later | Canonical workflow state and orchestration |
| Multi-agent framework | CrewAI experimental only, not on critical path | Optional bounded agent collaboration |
| Monitoring | Cloudflare logs/metrics + structured application events; OpenTelemetry-compatible traces where practical | Runtime health, cost, latency and errors |
| Release operations | Manual local validation + Cloudflare Wrangler | Operator-controlled checks, build, Pages deployment and smoke verification; no GitHub Actions workflow |
| Domain/DNS | Cloudflare | DNS, TLS, routing and environment separation |

This is a target design, not a claim that every account, plan, feature or resource is currently activated. Confirm account-specific availability, limits and prices before relying on them.

### Cloudflare-native AI inference baseline

**Default inference provider: Cloudflare Workers AI.** The initial runtime must call the native Workers AI binding from the Cloudflare Worker that owns the API. Use `env.AI.run(modelId, input, options?)`; declare the binding in the API Worker's Wrangler configuration (`ai.binding = "AI"`) and regenerate Worker environment types after configuration changes. Do not expose inference calls or Cloudflare credentials from the browser.

- Use Workers AI model IDs from the current official model catalog. Resolve and pin a tested model ID per task profile in server-side configuration; do not assume a model name remains available forever.
- Keep task profiles distinct (fast classification, structured extraction, multilingual reasoning, tool-capable agent turn, embeddings, vision or other modality). A model is eligible only after checking its current availability, input/output schema, context window, tool/JSON/streaming support, latency, quality and pricing.
- Build a provider-neutral `InferenceProvider` contract so the domain layer does not depend on Workers AI response shapes. Normalize text, structured output, tool calls, token/usage metadata, finish reason, errors and provider request IDs.
- Use Workers AI as the initial/default route. GroqCloud is an optional, disabled-by-default adapter; it is not required for a normal DAYANEXA deployment. Enabling it requires an explicit configuration change, secret stored in Worker secrets, cost ceiling, tests and owner approval.
- AI Gateway may be enabled with the same binding for observability, caching, rate limits, metadata and unified routing when its configuration and billing behavior are verified. Do not confuse AI Gateway with the model itself. Do not enable third-party Unified Billing or prepaid credits without owner approval.
- Local Wrangler inference still consumes the Cloudflare account's Workers AI allocation. Tests that must not call a real model use a deterministic mock adapter; a deliberately marked integration smoke test may call the real binding under a tiny budget.
- Treat the advertised free allocation and rate limits as mutable account-level constraints, not guaranteed capacity. At the time this specification was reviewed (16 Nov 2026), Cloudflare documented 10,000 Neurons/day free allocation, Workers Paid overage at $0.011 per 1,000 Neurons, and text-generation default rate limits of 300 requests/minute subject to model-specific exceptions. Re-check official pricing/limits and the account dashboard before activation; paid-only frontier models may require Workers Paid or prepaid AI Gateway credits.
- Implement a daily and monthly neuron/cost budget, per-request maximum output, input-size limits, concurrency/rate controls, request timeout, cancellation, bounded retry and circuit breaker. Persist estimated and actual usage where available. If usage cannot be measured exactly, mark it estimated and preserve the provider's usage payload.
- When quota is exhausted, rate-limited, unavailable or over budget, fail closed and return a clear deferred/temporarily unavailable result. Do not silently switch to Groq, another paid model, or a third-party AI Gateway provider.

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

### SDK compatibility baseline (Core 3)
- Use the supported React package `@clerk/react` (not deprecated `@clerk/clerk-react`) at version `6.18.0` or newer for Frontend API `2026-08-20`.
- Use Node.js `20.9.0` or newer for Clerk Core 3.
- Keep `@clerk/backend` on the compatible Core 2 backend line (`2.33.9` or newer within major 2) unless the official compatibility guide explicitly requires a backend major migration. Do not blindly set a nonexistent backend v3 range.
- Replace `SignedIn`/`SignedOut` with `Show when="signed-in"` / `Show when="signed-out"`; check all auth component imports and redirects against the Core 3 React API.
- Rebuild the lockfile with the selected package manager after migration. Never commit a lockfile that still resolves deprecated `@clerk/clerk-react` or mismatches `package.json`.
- Production acceptance requires the deployed bundle to load the new Clerk SDK; a source-only commit does not fix the live website.

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
- **Cloudflare Workers AI (primary/default):** native inference adapter using the Worker's `env.AI` binding. Use current catalog model IDs, server-side task profiles, normalized output/tool-call contracts, model capability checks, request and usage accounting, daily/monthly budget enforcement, rate limits, caching where appropriate, latency/error tracking and prompt/version traces. No provider API key is required for the native binding, but account-level quotas and paid model/billing rules still apply.
- **Cloudflare AI Gateway (optional Cloudflare control plane):** may sit on the binding path for observability, caching, rate limiting, metadata, and unified billing/routing. Enable only after verifying the gateway ID, billing mode, logs and account permissions. Third-party models through Unified Billing are not automatically free and are disabled until explicitly approved.
- **GroqCloud (optional secondary adapter):** preserve a provider-neutral adapter boundary, but keep Groq disabled by default and never require `GROQ_API_KEY` for baseline operation. Enable only through owner-approved configuration, Worker secret, explicit cost ceiling and contract tests. It must never be an automatic paid fallback.
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

### Inference routing and resilience
- Route by task profile and verified model capability, not by arbitrary agent preference. Store model ID, provider ID, task profile, prompt version, output schema version and policy decision with each inference trace.
- The default route is Workers AI through `env.AI`. Provider/model selection is server-side and allowlisted; clients cannot submit arbitrary model IDs or gateway IDs.
- Retry only transient errors, with bounded exponential backoff and jitter. Do not retry invalid input, policy refusal, unsupported modality or budget exhaustion.
- Keep streaming and non-streaming paths explicit. Validate structured output after generation; never treat syntactically valid JSON as evidence of factual correctness.
- Tool calls are proposals, not permissions. The application validates tool name, schema, user authorization, resource scope, budget and approval before execution.
- Keep a deterministic mock provider for unit/integration tests. Real inference integration tests must be explicitly labeled, low-volume and budgeted.
- Record provider/model, model revision if available, request ID, task type, latency, estimated/actual neurons or tokens, input/output size, cache status, finish reason and normalized error. Redact prompts/results that contain sensitive data according to retention policy.

Never auto-fallback to a paid provider. GroqCloud or any third-party provider through AI Gateway is not an automatic fallback. Any secondary provider requires a configured ceiling and explicit owner approval. If quota/cost limit is exceeded, fail closed, defer or request approval.

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

Apify vs Scrape.ly must be selected through a source-specific benchmark: coverage, freshness, completeness, success rate, price per accepted evidence, legal permissions and operational reliability. Tavily search and Firecrawl extraction are complementary, not interchangeable. Workers AI is inference, not workflow orchestration. Cloudflare Workers AI's daily free allocation, rate limits, model catalog and per-model pricing can change; check current Cloudflare documentation and the actual account dashboard before activating models. Local Wrangler inference also consumes account allocation. GroqCloud remains optional and disabled by default; never silently route to a paid model or Unified Billing.

## 14. V2 operating model (historical baseline; superseded by V3 sections 20–28)

DAYANEXA V2 is executed in four ordered phases. Do not skip an earlier gate because a later screen exists. The phases intentionally combine related work so that identity, customer value, monetization and operating control become one coherent product.

### Phase 1 — Identity, access and production release integrity
**Objective:** every legitimate user can enter securely and every protected action is authorized.

Work:
- Complete the migration from deprecated `@clerk/clerk-react` to `@clerk/react` Core 3, keep a compatible `@clerk/backend` v2 line, regenerate and commit the package lockfile, and run a clean install from that lockfile.
- Verify the exact Clerk Production instance, publishable key, secret key, JWT verification key/JWKS strategy, Frontend API/custom domain, Google OAuth redirect URLs, authorized parties, session token claims and webhook signing secret.
- Google is the only enabled social provider. No email/password, magic link or other social provider is to be introduced without an explicit owner decision.
- Confirm the canonical host is `https://dayanexa.biz.id`; `www` behavior must be deliberate and consistent. Verify DNS, TLS, Clerk domain and redirect allowlists independently; a domain merely appearing in Pages configuration is not proof of DNS/TLS health.
- Repair Cloudflare Pages source integration or document a repeatable, authenticated deployment path. Current account inspection showed the Pages project has no source connection and its latest deployment is an ad-hoc build; do not assume a push to GitHub publishes production.
- Use local release validation commands against the committed lockfile: `npm ci`, `npm run check`, `npm run audit`, and `npm run build`. GitHub Actions workflows are intentionally retired; do not recreate CI/CD unless the owner explicitly changes this decision.
- Test sign-up, sign-in, sign-out, refresh, expired/revoked session, protected `/api/v1/me`, Google-only enforcement, owner bootstrap and role/tenant isolation.
- Review owner bootstrap: only a verified Google identity matching the explicitly configured owner allowlist may receive initial owner access; bootstrap must be one-time, auditable, and must not allow self-promotion through client metadata.
- Verify Clerk webhook signature, event deduplication, user update/deletion/suspension handling and safe replay.

**Exit gate:** a clean production deployment serves the new SDK bundle on the canonical domain; a real Google sign-in obtains a valid session; the Worker accepts the session and returns the correct internal principal from `/me`; all authorization and isolation tests pass. Until then, authentication is not production-ready.

### Phase 2 — Complete customer, contributor and operator journeys
**Objective:** a user can move from first visit to a clearly understood, completed outcome without dead ends.

Customer journey (canonical):
1. Public discovery: understand DAYANEXA, trust boundaries, examples that are real, service catalog, pricing, FAQ, policies and support.
2. Account entry: Google sign-in; explicit terms/privacy acknowledgement; verified email; onboarding and profile completion.
3. Workspace setup: create or join an organization, choose customer intent, capture industry/context and notification preferences.
4. Demand submission: structured problem, current process, desired outcome, urgency, constraints, budget indication (optional), attachments and consent. Save draft and resume.
5. Intake triage: confirmation receipt, request ID, status timeline, expected next action and support route. Quota/plan limits must be explained before submission.
6. Validation: operator/agent requests clarifications, records evidence and provenance, separates fact from hypothesis, and decides validate, defer or reject with a reason.
7. Solution and offer: customer receives a versioned quote showing scope, deliverables, exclusions, timeline, milestones, acceptance criteria, revision limits, price, tax/fees where known, payment schedule, cancellation/refund/dispute rules and quote expiry.
8. Authorization: customer explicitly accepts the exact offer version. Acceptance creates a contract/order snapshot; edits require a new version and renewed acceptance.
9. Checkout: server calculates the amount; customer selects an available gateway/method; payment intent is idempotent; checkout status and expiry are visible. Browser return is never payment proof.
10. Payment verification: signed webhook and/or server-side inquiry confirms provider, order, amount, currency and status. Only then may the relevant paid mission be released for execution, unless an explicitly documented milestone/deposit contract says otherwise.
11. Execution: customer sees mission milestones, blockers, requests for input, responsible operator and status history.
12. Delivery: secure private artifacts, versioned delivery note, checklist against acceptance criteria and clear accept/revision/dispute actions.
13. Closure: acceptance, payment, refund/dispute and contributor settlement remain separate states; customer receives receipt/summary and can access history.
14. Retention and support: notification preferences, export/delete request, support ticket and account closure path.

Contributor journey:
1. Apply with identity/profile, location/timezone if relevant, skills, portfolio/evidence, availability and preferred task types.
2. Consent to contributor terms and data handling; verify identity/KYC only when legally and operationally required.
3. Operator reviews and approves, rejects or requests more information; contributor status is visible.
4. Contributor sees only eligible tasks with scope, deliverables, deadline, dependencies, acceptance criteria, compensation, payment terms and required tools before accepting.
5. Contributor accepts a task; system records assignment and conflict/availability checks.
6. Work submission includes versioned artifacts and completion evidence; revisions and feedback are traceable.
7. Quality reviewer accepts/rejects with reason. A payable is created only according to the approved compensation policy; payment/payout state is independently tracked.
8. Contributor sees earnings ledger, pending/approved/paid status, remittance reference, disputes and support. Never advertise earnings that are not verified.

Operator/admin journey:
- Unified queues for new requests, evidence review, offer approvals, payment exceptions, mission blockers, delivery acceptance, disputes, refunds, contributor verification and payouts.
- Each action has least-privilege permission, reason, actor, timestamp, before/after state and audit event.
- Maker-checker separation for refunds, payouts, manual ledger adjustments and sensitive role changes.
- Operators can pause, defer, reject or escalate; no agent can commit funds or external contracts without policy approval.

Journey-wide requirements:
- One canonical status timeline and notification event model across email/in-app channels; no duplicate or contradictory status.
- Every state has owner, next action, SLA/expected response, failure/retry path and escalation.
- Save/resume, idempotency, accessibility, mobile responsiveness, localization (IDR/Asia-Jakarta), data export/deletion and support are first-class.
- All customer-facing statuses derive from server state; no hardcoded sample metrics or fake activity.
- Ensure empty, loading, stale, validation, success, failure, pending, disputed and cancelled states are designed and tested.

**Exit gate:** one customer can complete request → evidence validation → versioned offer → explicit acceptance → verified sandbox payment → mission → delivery → acceptance/dispute; one contributor can onboard → be approved → accept a compensated task → submit work → receive a reconciled payable status; one operator can manage exceptions with audit evidence.

### Phase 3 — Monetization, pricing, payments and unit economics
**Objective:** monetize transparently without confusing subscription access, project fees, platform revenue or contributor earnings.

DAYANEXA uses a layered hybrid model:

**Layer A — SaaS access subscription (existing price hypothesis; not yet proven willingness-to-pay):**

| Plan | Price / 30 days | Request quota | AI assists | Seats | Intended value |
|---|---:|---:|---:|---:|---|
| Free | Rp0 | 2 | 0 | 1 | Entry, request tracking, offers and delivery history |
| Pro | Rp149.000 | 10 | 50 | 3 | Priority review and bounded AI-assisted intake |
| Plus | Rp399.000 | 30 | 200 | 10 | Managed priority, operator support and mission economics visibility |

- These prices are owner-approved working hypotheses from the current product table, not market-validated facts. Test conversion, retention, support burden, cost-to-serve and willingness-to-pay before raising or locking them.
- Subscription grants software access, quotas and support entitlements. It does **not** include the cost of a customer-specific build, service execution, third-party provider spend or contributor compensation unless a specific offer says so.
- Current commercial copy says 30-day access without automatic renewal. Preserve explicit opt-in renewal only if later implemented and legally reviewed. Do not imply auto-renewal or charge a saved method silently.
- Fix period semantics: usage counters currently use calendar-month boundaries while subscription records use 30-day periods. Choose one canonical quota window (recommended: the active subscription period for paid plans and calendar month for Free only if disclosed) and enforce it server-side consistently in UI and API.
- Enforce `aiAssistsPerMonth` as a real quota, not just a UI entitlement. Show usage, reset date, limit behavior and upgrade route.
- Define upgrade/downgrade timing, pending payment, failed payment, expiration, cancellation, grace period and refund behavior. No ambiguous immediate access before payment verification.

**Layer B — One-time project/service revenue (existing indicative starting prices):**

| Offer | Starting price | Commercial unit |
|---|---:|---|
| Demand Validation | Rp750.000 | per project |
| Solution Sprint | Rp3.500.000 | per sprint |
| Build & Deliver | Rp9.500.000 | per mission |
| Managed Operations | Rp4.900.000 | per month |

These are starting-price hypotheses, not automatic checkout prices. The final versioned quote controls. Subscription fee and project fee are separate line items and must be shown separately. Every quote must include scope, assumptions, deliverables, exclusions, schedule, acceptance, revision, tax, gateway fees if passed through, refund/cancellation, dispute and payment schedule.

**Layer C — Recurring managed operations.**
- Sell ongoing operational outcomes only where scope, cadence, service levels, reporting, staffing, renewal and exit conditions are defined.
- The existing Rp4.900.000/month is an indicative starting price, not a live recurring contract or automatic charge.
- Renewals require explicit agreement and verified payment until a legally reviewed recurring billing capability is implemented.

**Layer D — Metered usage and add-ons (future, not enabled by default).**
- Potential billable units: additional validated requests, AI-assisted tasks, research credits, seats, priority turnaround, storage/retention and additional mission scope.
- Each unit needs a published price, unit definition, included allowance, warning threshold, hard cap, tax treatment and explicit purchase confirmation.
- Never silently overage, auto-top-up or consume a paid provider quota on behalf of a customer.

**Layer E — Partner/marketplace monetization (future gated capability).**
- Potential platform fee/commission, partner service margin or approved split settlement only after provider eligibility, merchant KYC, legal fund-flow review and contributor/partner contract.
- No escrow claim, custody claim, automatic split, sub-account or commission deduction without explicit product and legal approval and verified gateway capability.
- Keep this layer disabled in the MVP. A single-merchant collection plus separately approved contributor payout is the permitted pilot shape until evidence says otherwise.

**Economic truth and price governance:**
- Maintain separate records for gross customer charge, discounts, taxes, gateway fees, refunds/chargebacks, net cash, recognized platform revenue, direct provider cost, contributor/partner compensation, platform gross margin, contribution margin, payout liability and settlement.
- Gross checkout amount is not platform revenue. Subscription revenue, project revenue, pass-through funds and contributor payables must not be conflated.
- Quote price is server-authoritative and versioned; client cannot set price, discount, tax, plan, quota or margin.
- Calculate mission gross margin and contribution margin before offer approval; enforce minimum margin and contingency rules with an audited exception path.
- Validate price with real customer interviews, paid pilots, win/loss reasons and measured delivery cost; never treat an indicative price as validated demand.

**Payment and billing behavior:**
- One normalized interface for Duitku, Xendit, Midtrans and Faspay; provider-specific capability flags for payment methods, inquiry, webhook, refunds, settlement reports and payouts.
- Keep `PAYMENTS_MODE=mock` and `PAYMENT_LIVE_ENABLED=false` until merchant approval, sandbox contract tests, webhook verification, reconciliation and owner authorization are complete.
- Start with one approved collection gateway for a controlled single-merchant pilot; keep the other adapters inactive until tested. Faspay remains fail-closed until merchant-specific contract/channel details are verified.
- Payment intent amount/currency/order are computed server-side from an accepted offer or plan; idempotency key prevents duplicates; webhook signature/replay/deduplication and server-side reconciliation are mandatory.
- Subscription payment and project payment are distinct purposes, products and ledger postings.
- Refunds, chargebacks, payouts and manual adjustments require approval and maker-checker controls. A payout request is not a paid payout.
- Never release a paid mission based on browser redirect or client-supplied status.

**Exit gate:** plan entitlements and period usage are enforced; quote-to-checkout amount is immutable and correct; sandbox payment/webhook/reconciliation/refund scenarios pass; double-entry ledger balances; revenue, costs, margin and contributor payable reconcile; no live money movement occurs without owner approval.

### Phase 4 — Intelligence, execution reliability and scale readiness
**Objective:** operate DAYANEXA as a trustworthy economic resolution system, not merely a customer portal.

Work:
- Complete evidence provenance, source permissions, demand confidence and human validation; separate observed facts, inferred hypotheses and decisions.
- Workers AI task profiles, deterministic test mocks, usage budgets, latency/quality tracking and model versioning; no automatic paid fallback to Groq or other vendors.
- Source-specific Apify vs Scrape.ly benchmark; choose one per task and enforce source policy, quotas and retention.
- Capability Foundry tracks build/buy/license/integrate/partner/human routes with cost, lead time, ownership, maintenance and risk.
- Durable mission orchestration: task dependencies, retries, idempotency, cancellation, pause/resume, deadline/SLA, human approval and compensation.
- Quality gates, artifact versioning, private R2 access, malware/MIME/size checks, signed short-lived download links, acceptance, revision and dispute workflows.
- Complete all 14 workspaces with live, permission-filtered APIs; add operational queues, notifications, support, audit explorer, economic ledger and owner dashboards.
- Observability: structured traces, correlation IDs, provider cost, payment health, queue age, SLA breaches, error budget, backups/restore and incident runbooks.
- Privacy and legal readiness: retention/deletion/export, consent, processor inventory, data subject requests, reviewed Terms/Privacy/refund/contributor terms and incident response.
- Controlled pilot with a narrow customer segment and low execution budgets; measure Verified Economic Resolution, request-to-offer time, offer acceptance, paid conversion, delivery acceptance, dispute/refund rate, repeat purchase, contributor earnings actually paid, margin per mission, cost per outcome and customer retention.
- Scale only after repeatable positive unit economics, reliability and safe contributor operations.

**Exit gate:** a limited pilot completes repeated, evidence-backed, paid, accepted missions with reconciled economics, safe contributor settlement, controlled risk and no fabricated metrics. Wider launch requires an explicit owner go/no-go.

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

## 16. Current repository state — verified baseline 16 Nov 2026

The repository currently contains a React/Vite application, Hono API bundle, five D1 migrations, Workers AI binding, R2 binding, Clerk Core 3 source migration, pricing/plan routes, customer UI and four payment adapter files. Their presence is not proof of production operation. The latest inspected Pages deployment was ad-hoc, the Pages project API returned no connected Git source, and its deployed commit was older than the Clerk migration. The package lockfile was absent from the inspected main tree after the SDK update and must be regenerated and committed before CI can use a reproducible clean install. Real Google sign-in, Clerk webhook, payment gateway sandbox/live, contributor payout and complete end-to-end customer journeys remain unverified. The connected Clerk workspaces inspected during this update did not expose an application whose Production publishable key matches the DAYANEXA domain; do not modify the unrelated Oltavyn/Runner/other Clerk instances. The DAYANEXA Clerk instance must be accessed through its correct authorized workspace before configuration can be verified or changed.

The next implementation agent must audit these artifacts first:
- `src/App.tsx`, `src/main.tsx`, `src/styles.css`
- `apps/api/src/**`, `apps/api/migrations/**`, `wrangler.jsonc`
- `package.json`, local validation scripts, Wrangler configuration, environment examples
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
- `docs/14-identity-monetization-and-payments.md` (V2 monetization layers and payment architecture)
- `docs/15-implementation-foundation.md`
- `docs/17-master-upgrade-and-execution-roadmap.md`
- `apps/api/README.md`

## 19. V2 decision log (historical baseline; V3 overrides where explicitly stated)
- Canonical brand/product remains DAYANEXA; repo `Sparkmind-obp-off/Dayanexa`, branch `main`.
- Genspark is not a required build or execution dependency. Implementation must be executable through the repository, Cloudflare, GitHub and verified provider interfaces.
- Google-only Clerk Production remains the selected identity policy.
- Workers AI remains default inference; Groq remains optional and disabled.
- Existing Free/Pro/Plus and service starting prices remain hypotheses to test, not guaranteed revenue.
- No paid provider usage, live payment, payout, refund, DNS mutation, production secret rotation or production deployment without the relevant explicit owner authorization.


---

# V3 — Demand-to-Execution Architecture (canonical upgrade)

**Current version:** 3.0  
**Date:** 16 November 2026  
**Audited Batch V2 baseline:** `04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa`  
**V3 authority:** `docs/18-demand-to-execution-architecture-v3.md`

> This section supersedes V2 operating phases and any earlier wording that treats the dashboard, provider adapter, agent registry, task assignment or payment surface as the primary product outcome. The earlier V2 sections remain useful implementation history and reusable constraints.

## 20. Product center: five Demand-to-Execution engines

DAYANEXA's primary product is the connected five-engine chain:

1. Demand Discovery Engine — real permitted search and collection, source/Actor registry, discovery briefs/jobs/history, provenance and bounded spend.
2. Demand Intelligence Engine — normalization, deduplication, niche clustering, supporting/contradicting evidence, transparent assessment and validation.
3. Capability & Solution Foundry — demand-traceable solution specification and capability formation through reuse, compose, build, acquire/license, integrate, partner, contributor, defer or reject.
4. Agentic Execution Engine — approved mission/task orchestration, real scoped agent/tool invocation, human escalation, budget reservation, durable retries, artifact generation, testing and demo preview.
5. Market Delivery Engine — traceable demo presentation, consent/approval, feedback, immutable offer, acceptance, verified payment, delivery, settlement and learning.

The canonical flow is DiscoveryBrief → DiscoveryJob/SourceRun → Signal → DemandCluster → Demand hypothesis/evidence/assessment → validated Demand → Opportunity → SolutionSpec → CapabilityPlan → approved Mission/Tasks → AgentRun/ToolInvocation/Contributor work → Artifact/TestReport/Demo → MarketPresentation/Feedback → Offer/Acceptance → Payment/Delivery/Settlement → LearningRecord.

## 21. V3 canonical records and events

Add the V3 entities defined in `docs/18-demand-to-execution-architecture-v3.md`: DiscoveryBrief, DiscoveryJob, SourceRun, ActorDefinition, DemandCluster, DemandAssessment, SolutionSpec, CapabilityPlan, AgentRun, ToolInvocation, Demo and MarketPresentation. Implement only through additive, reviewed migrations. Preserve source snapshots, versioning, provenance, costs, approvals and retention. Do not modify production D1 without explicit owner approval.

## 22. Source/provider and Actor architecture

Provider adapters are replaceable and are not canonical state. Tavily is search/discovery; Firecrawl is selected-page extraction; Apify OR Scrape.ly is specialized collection selected by source/task benchmark. Threads support must be verified against the actual official/authorized connector or Actor, its current input/output schema, public coverage, history/pagination and platform terms. Never claim support based only on provider brand.

The Actor Registry must hold reviewed Actor version, README/schema, source coverage, required inputs, output mapping, pricing, cost cap, terms, risk, benchmark and owner approval. The UI must render the approved schema rather than send an empty input object. Persist stable idempotency keys and run history. No automatic paid fallback or top-up.

## 23. Demand evidence and validation

Signals are observations, not demand. AI classification and cluster membership are inference. A demand becomes validated only under a versioned policy that checks source independence, evidence quality, contradictions, recency and a human/first-party validation method appropriate to the claim. Likes, views, search volume and duplicate posts do not prove buying intent. Opportunity creation requires validated demand or a separately audited exception.

## 24. Solution and capability formation

A SolutionSpec must map each deliverable to the demand evidence and a measurable acceptance criterion. Every capability gap must have a documented resolution route, cost, risk, owner, dependency and readiness test. A capability record or "ready" toggle alone is not readiness proof. Paid acquisition, licensing, external contracts and partner commitments require explicit approval.

## 25. Agentic execution contract

Agent profiles are not execution engines. Implement a Tool Registry, AgentRun, ToolInvocation, task schemas, scoped authorization, atomic budget reservation, idempotency, durable orchestration, retries, output validation, audit and human escalation. DAYANEXA owns the canonical workflow. Prefer Cloudflare-native Queues/Workflows when durable execution is needed; optional orchestration frameworks require an ADR and measured need. No agent can grant itself permissions or approve its own external/financial action.

Website/application demos must be built in an isolated preview environment, tested, scanned for secrets and dependencies, linked to source commit/build hash and demand, and published through short-lived revocable preview access. Production deployment requires approval.

## 26. Market delivery and economic proof

A demo must trace to validated demand, SolutionSpec, mission, build and test evidence. Showing a demo is not customer acceptance. A public post does not grant marketing consent. Outreach requires a documented lawful/consented basis, platform compliance, human approval and opt-out suppression. Offer acceptance binds to the exact immutable quote version. Payment verification, delivery acceptance, revenue recognition, contributor payable and payout remain separate reconciled states.

## 27. Account tiers, entitlements and provider consumption

Clerk Production Google-only remains the identity path. The current Free/Pro/Plus subscription hypotheses remain distinct from search credits, extraction credits, Actor usage and execution budgets. Enforce entitlements server-side before every metered action. Free means bounded verified free allowance, not an unlimited provider promise. No silent overage, auto top-up, paid fallback or unapproved Business tier. Do not change prices or live entitlements as part of V3 architecture documentation.

## 28. V3 release gates and canonical documents

The five engine specifications, Batch V2 audit and roadmap are:
- `docs/18-demand-to-execution-architecture-v3.md`
- `docs/19-demand-discovery-engine.md`
- `docs/20-demand-intelligence-engine.md`
- `docs/21-capability-solution-foundry.md`
- `docs/22-agentic-execution-engine.md`
- `docs/23-market-delivery-engine.md`
- `docs/24-batch-v2-code-audit.md`
- `docs/25-admin-resource-control-center.md`
- `docs/17-master-upgrade-and-execution-roadmap.md`

V3 is complete only when each engine passes its own code, schema, UI, permission, test, observability and acceptance gates. A provider adapter, CRUD screen, task assignment, mock payment or generated text is not proof of a completed engine.

## 29. Admin & Resource Control Center

The canonical owner/operator control plane is specified in `docs/25-admin-resource-control-center.md`. It adds an administrative workspace alongside the existing 14 workspaces for customer management, contributor management, provider and Actor registry, cost/usage governance, Cloudflare operations visibility, approvals and audit. Provider policies must be persisted and enforced server-side; the dashboard must never expose secrets or imply control over Cloudflare billing. GitHub Actions CI/CD workflow and its unused template are retired by owner decision. Keep the local validation scripts and the manual Wrangler release contract; never perform destructive production data cleanup. The Admin Control Center is incomplete until API, schema, UI, role enforcement, tests and operational evidence all exist.


## 30. Provider Runtime Governance & Account Failover

The Provider Registry and Actor Registry are runtime control-plane policy, not passive inventory. The canonical detailed contract is [docs/26-provider-runtime-governance.md](26-provider-runtime-governance.md).

Mandatory invariants:
- All Workers AI, Groq, Tavily, Firecrawl, Apify and Scrape.ly calls—including API, queue, scheduled and agent-tool paths—must pass through one server-side Provider Runtime Gateway.
- Before every external call: verify provider/account activation, credential reference, terms/permission, capability, environment, quota snapshot freshness, provider rate limit, DAYANEXA per-request/daily/monthly cap and mission budget; atomically reserve maximum expected usage/cost.
- Reconcile actual units/cost after execution and release unused reservation. Unknown provider-side completion is not blindly retried; preserve the reservation and reconcile first.
- Provider plan quota, provider rate limits, DAYANEXA caps, mission budgets and account billing/paid state are distinct dimensions with independent units and reset windows.
- If quota is exhausted, pause that provider/account for the affected capability/window and stop before dispatch. Resume only after a verified reset or authorized policy change.
- Account alternatives are allowed only through an explicit owner-approved, source/task-specific, terms-compliant fallback allowlist. Never rotate accounts to evade rate limits, bans, suspension, free-tier/trial restrictions, billing controls or terms.
- Unknown or stale quota/pricing fails closed for automated execution. No invented free credits. Paid use, overage, top-up, paid fallback and third-party billing remain disabled unless the owner approves exact scope, account, cap and period.
- Credentials stay in server-side secret stores. The browser sees status and masked references only.
- Persist account-level quota snapshots, reservations, usage events, reconciliation, fallback decisions and audit events with provenance and idempotency.

Do not mark this feature complete from a registry CRUD screen. Completion requires adapter call-site inventory, additive D1 schema, server-side gateway, atomic budget reservation, adapter integration, owner-only controls, cost reconciliation, observability and CI tests proving caps, fail-closed behavior, compliant fallback, no limit evasion and no paid use without approval. Production migrations, secret changes, provider activation and deployment remain owner-approval gated.
