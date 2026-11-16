# DAYANEXA — Admin & Resource Control Center

**Version:** 1.0  
**Date:** 16 November 2026  
**Authority:** DAYANEXA V3 Demand-to-Execution Master System  
**Status:** Canonical requirement; initial owner-only dashboard shell and read/verify views are implemented. Persistent provider policies, editable Actor registry, budget enforcement controls and full customer administration remain pending. The detailed runtime governance contract is defined in docs/26-provider-runtime-governance.md; runtime enforcement remains pending.

## 1. Purpose

The Admin & Resource Control Center is the owner/operator control plane for DAYANEXA. It manages the people, organizations, providers, Actors, infrastructure visibility, usage, budgets, approvals and audit needed to run the five Demand-to-Execution engines.

It is not a second customer portal and it must not become a shortcut around the canonical APIs, permissions, lifecycle or ledger.

The dashboard must expose real backend state. A button is not considered implemented unless a server-side operation, authorization check, validation, audit event and test exist.

## 2. Dashboard placement and access

Add a dedicated **Admin & Resource Control Center** workspace to the authenticated command center. It is an additional administrative workspace, not a replacement for the existing 14 workspaces.

- Owner: full control, including provider policy and Actor registry administration.
- Operator: customer/contributor operations and approved operational actions; cannot increase provider budgets or activate paid provider use.
- Finance: read provider costs, mission costs, ledger and contributor payables; no provider activation.
- Analyst: read-only aggregate operational intelligence.
- Customer/contributor/member: no access to admin workspace or cross-tenant records.

All routes must enforce permission server-side. Hiding a tab in React is not authorization. Cross-tenant access is limited to explicitly authorized platform staff and every sensitive action is audited.

## 3. Workspace areas

### 3.1 Executive Admin Overview

Show active customers and organizations; active, pending, verified and suspended contributors; active missions, blocked tasks, pending reviews and delivery exceptions; provider calls, units, estimated/actual costs and budget utilization; Actor runs, success/failure, accepted items, cost per accepted item; D1/R2/Workers AI and deployment/CI readiness indicators where a real health check exists; pending approvals, privacy requests, payment exceptions and security events.

Every metric must disclose its period, unit, source and whether estimated or verified. Never display fabricated cost, revenue or health.

### 3.2 Customer Management

Provide searchable organization and customer profiles:
- Organization name, type, status, created date and member count.
- Customer users and verified identity status.
- Requests/demand, quotes, invoices, verified payments, missions, delivery, acceptance and support history.
- Subscription plan, entitlement window and usage.
- Privacy export/deletion requests and retention state.

Permitted operations: view and filter; suspend/reactivate a customer or organization only with a reason and audit event, after impact checks; review support and privacy requests; export only authorized customer data with audit and purpose. Never hard-delete financial, audit or legally retained records from this dashboard.

### 3.3 Contributor Management

Provide application/profile, skills, verification and eligibility; assigned/accepted/declined tasks, submissions, QA, revisions and quality history; compensation promised before task acceptance, earned, payable, paid and disputed amounts; payout request, approval and external transfer reference; contributor availability and suspension status.

Verification, suspension and payout are separate actions. Payout remains manual/external and follows maker-checker approval; the dashboard must not claim escrow or automatic payout.

### 3.4 Provider Registry

Manage capability providers independently from user subscriptions.

Initial providers:
- Cloudflare Workers AI — primary inference.
- Groq — optional inference; disabled by default.
- Tavily — search/discovery.
- Firecrawl — selected-page extraction.
- Apify — specialized Actor execution.
- Scrape.ly — alternative specialized Actor execution.
- Future orchestration/observability tools only when adopted.

For each provider show layer, capability, environment and owner; configured status (presence only; never expose secret values); enabled/paused/disabled state; free-plan allowance and verified-as-of date where known; daily/monthly unit caps, hard currency cap and per-request cap; actual usage, estimated/actual cost, quota exhaustion, failures, latency and last health check; terms/privacy review, data retention and source permissions; fallback policy. Default is no paid fallback.

Provider policy changes must be persisted server-side and enforced before the external call. Increasing caps, enabling paid usage, changing provider selection or enabling a production Actor requires owner authorization and an audit record. A dashboard setting must not silently mutate Cloudflare secrets or provider account billing settings.

### 3.5 Actor Registry

Apify and Scrape.ly are execution platforms; individual Actors are separate executable resources and must each be registered.

Each Actor record includes provider and exact Actor ID; name, purpose, source/platform and supported niche/query modes; README and input-schema review reference; JSON input schema and UI field mapping; output schema/mapping and provenance fields; pricing model, unit rates, platform compute/proxy/storage assumptions and price verification date; per-run hard spend cap, daily/monthly budget, max items, timeout and concurrency; terms, privacy and permission review; status draft → review → approved → paused/rejected; version, reviewer, approval timestamp and immutable run history.

An Actor cannot run merely because an API token exists. It must be approved, selected for the source, within budget and have a validated input schema. Use Apify OR Scrape.ly per source/task unless a separately approved benchmark justifies both. Actor runs must use stable idempotency keys and be asynchronous/durable for long jobs.

### 3.6 Cost & Usage Center

Separate provider units (credits, neurons, tokens, pages, compute, requests and bytes); provider cost (USD micros or source currency, estimated versus actual); mission/task direct costs in IDR; contributor compensation and payable liabilities; customer gross charge, tax, gateway fee, refund and net cash; recognized platform revenue and gross margin.

Views include provider → operation → Actor → run; day/week/month and budget utilization; mission/task and opportunity attribution; customer/tenant and internal admin attribution; cost per accepted evidence item, validated demand, demo and accepted mission; estimated vs reconciled cost and missing-cost exceptions.

Do not add USD and IDR without an explicit dated FX source. Do not count provider plan allowance as cash expense unless actually charged. Free-tier usage still consumes quota and must be visible.

### 3.7 Cloudflare & Delivery Operations

Show verified configuration/health for Pages project, active deployment and Git commit provenance; Workers/Pages Functions runtime; D1 binding, migration version and backup/restore status; R2 binding, private bucket status and artifact lifecycle; Workers AI binding and budget status; Queues/Workflows binding and durable job status when implemented; environment separation (local/preview/production); CI workflow path, last run, result, artifact/build SHA and production smoke result.

The application may display presence and health; it must never expose secret values. Secret rotation and billing-plan changes remain in Cloudflare/provider consoles, not a public-facing application endpoint.

### 3.8 Approvals, Audit & Safety

All provider/Actor activation, budget increase, customer suspension, contributor verification/suspension, refund, payout, privacy deletion and production-sensitive actions must be permissioned and audited.

Use maker-checker for financial or high-impact actions. The requester cannot approve their own request. Provider cap exhaustion is a hard stop, not a prompt for automatic paid fallback.

## 4. CI/CD and deletion policy

- Keep the CI workflow. It is required for reproducible verification and must not be deleted as routine cleanup.
- The canonical workflow source remains docs/ci/ci.workflow.yml; the active GitHub Actions workflow must live under .github/workflows/.
- CI verifies lockfile install, typecheck, tests, migration checks, secret scan, dependency audit, build and non-destructive production smoke.
- CI must fail if .env.production or .env.development is tracked. Keep only safe .env.example templates in Git.
- CI/CD must never automatically delete customer, contributor, payment, ledger, audit, D1, R2 or production data.
- Destructive cleanup requires an explicit reviewed migration/runbook, backup and owner approval. No automatic production DB migration or data deletion from the CI workflow.

## 5. Implementation sequence

1. Secure repository hygiene and active CI workflow.
2. Admin workspace shell, role matrix and real overview.
3. Customer and contributor management views using existing canonical records and audited APIs.
4. Persistent provider policies and server-side hard-budget enforcement.
5. Actor registry, schema-driven inputs, review/approval, per-Actor budget and stable idempotency.
6. Cost & Usage Center with unit/currency separation and mission attribution.
7. Cloudflare deployment/infra health visibility, D1 backup/restore evidence and durable job monitoring.
8. Browser, API, permission, tenant-isolation, budget-cap, no-paid-fallback, audit and failure-path tests.

## 6. Definition of done

The Admin & Resource Control Center is complete only when owner/operator roles see only their authorized actions; customer and contributor actions update canonical state and audit events; provider policies are persisted and enforced server-side before every external call; Actor execution requires an approved registry record, validated schema, stable idempotency and hard cost cap; provider/Actor costs reconcile to source usage and mission attribution without mixing currencies; cap exhaustion prevents external calls and paid fallback; Cloudflare/CI indicators come from actual checks, not static labels; and CI/browser tests prove permissions, tenant isolation, approvals and no destructive side effects.


## 7. Runtime enforcement and account failover

Read and implement the canonical contract in [docs/26-provider-runtime-governance.md](26-provider-runtime-governance.md). Provider and Actor administration is incomplete until every outbound provider call is routed through one server-side runtime policy gateway that checks account authorization, terms, quota freshness, rate limits, per-request/daily/monthly/mission caps and an atomic usage reservation before dispatch.

The system may pause an exhausted provider/account and may select another account only through an explicit, owner-approved, terms-compliant fallback allowlist. It must not rotate accounts to evade rate limits, free-tier restrictions, bans, suspensions, trial limits or provider terms. Unknown/stale quota fails closed. Paid use, overage, paid fallback and top-up remain disabled absent explicit scoped owner approval. Every reservation, dispatch, fallback and reconciliation must be auditable. A registry or dashboard field is not proof of runtime enforcement.
