> **Canonical authority:** [DAYANEXA Canonical Master System](00-DAYANEXA-CANONICAL-MASTER-SYSTEM.md) is the single top-level scope and sequencing authority. The [Full Implementation Master Prompt](../prompts/DAYANEXA_FULL_IMPLEMENTATION_MASTER_PROMPT.md) is the execution contract. This roadmap is the phase tracker and must stay synchronized.

# DAYANEXA V3 — Master Upgrade & Execution Roadmap

**Version:** 3.0  
**Date:** 16 November 2026  
**Authority:** `docs/16-master-system-and-full-stack-implementation.md` and `docs/18-demand-to-execution-architecture-v3.md`  
**Execution prompt:** `prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md`  
**Audited baseline:** `main @ 04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa`

## Strategic objective

Evolve Batch V2 into a real Demand-to-Execution OS. The five engines become the primary product workflow. Preserve V2 customer identity, commercial and economic controls; do not rebuild working foundations without evidence.

## Phase 0 — Baseline and release integrity

- Pin the exact source commit and deployed build.
- Run clean install, typecheck, tests, migration checks, secret scan, audit and production build.
- Verify current production deployment commit and Cloudflare bindings.
- Verify Google-only Clerk sign-in and authenticated API in browser.
- Verify local validation scripts and Wrangler CLI/account access; GitHub Actions CI/CD is intentionally not used.
- Remove committed environment-specific files and retain safe examples.
- No production migration or secret mutation without owner approval.

**Exit:** reproducible local validation and Wrangler deployment evidence; real auth browser test; known production baseline; no unreviewed secret or deployment drift.

## Phase 1 — Demand Discovery Engine

- Discovery briefs and durable jobs/history.
- Source registry with permissions, terms, supported query modes and retention.
- Persisted Actor registry with README/schema review, input form, output mapping, pricing, cost cap and approval.
- Tavily search and Firecrawl selected-page extraction.
- Apify OR Scrape.ly source-specific adapter, benchmark and stable idempotency.
- Verify social source coverage (Threads candidate) before enabling; no assumption of universal access.
- Schema-driven UI, provenance, pagination, retries, cancellation, partial failure and usage reconciliation.

**Exit:** one real permitted web discovery run and one separately verified social/public source run produce inspectable, deduplicated signals with provenance and cost records; unsupported source is explicitly reported.

## Phase 2 — Demand Intelligence Engine

- Persistent DemandCluster and membership/version history.
- Niche/sub-niche taxonomy and problem/outcome normalization.
- Exact/near-duplicate handling and independent-source counts.
- Supporting/contradicting evidence and source reliability.
- Versioned transparent scoring and missing-evidence output.
- Human review, requester confirmation and validation experiments.
- Opportunity gate requires validated demand or audited exception.

**Exit:** research brief produces explainable niche clusters with clickable source evidence; false positives, duplicates and contradictory evidence are visible; validation decision is reproducible.

## Phase 3 — Capability & Solution Foundry

- Structured SolutionSpec with demand-to-feature traceability.
- Capability assessment and gap plan.
- Reuse/compose/build/acquire/license/integrate/partner/contributor/defer/reject decision.
- Build/acquire milestones, dependencies, cost and risk.
- Capability readiness proof, test evidence and approvals.
- Commercial quote and margin alignment.

**Exit:** one validated demand has an approved, versioned solution spec, resolved capability plan and testable acceptance criteria.

## Phase 4 — Agentic Execution Engine

- Agent and Tool registries with versions, permissions and schemas.
- AgentRun and ToolInvocation persistence.
- Durable Cloudflare-native orchestration, task state, idempotency and retries.
- Per-task/mission budgets and provider cost reconciliation.
- Human escalation and contributor compensation.
- Isolated build/test/security pipeline and private artifacts.
- Working demo preview with expiry/revocation.

**Exit:** one approved mission executes actual agent/tool tasks and produces a working, tested, traceable demo; failures can resume safely and spend stays within cap.

## Phase 5 — Market Delivery Engine

- Demo and market presentation records.
- Lawful/consented presentation workflow, human approval and opt-out.
- Customer feedback and follow-up state.
- Immutable quote acceptance and current payment/ledger flows.
- Delivery acceptance, dispute/refund and contributor payout reconciliation.
- Demand-to-demo-to-acceptance-to-economic-outcome traceability.

**Exit:** a real market participant can inspect a demo, provide feedback, accept a scoped offer, and (where applicable) complete verified payment and delivery. A demo view alone is not success.

## Admin & Resource Control Center workstream

Implement `docs/25-admin-resource-control-center.md` as a cross-cutting workstream, starting with repository hygiene and local validation scripts, then customer/contributor administration, persisted provider policies, Actor registry, cost attribution and Cloudflare operations visibility. It supports all five engines and is not optional dashboard decoration. Provider policy enforcement must precede any production Actor expansion.

## Cross-cutting gates

- Free-first, explicit paid spend approval, no paid fallback or auto top-up.
- Tenant isolation, role checks, least-privilege tools and immutable audit.
- Public source permissions, privacy, copyright and platform terms.
- Prompt-injection defenses and secret isolation.
- Observability, backup/restore, incident response and legal review.
- User account entitlement and provider usage are separate.
- No public deployment, outbound contact, live payment, refund, payout or production migration without the required owner approval.

## Batch V2 reuse and gap assessment

See `docs/24-batch-v2-code-audit.md`. Current code already contains source adapters, signal/evidence records, demand/opportunity workflows, capability/solution records, agent registry, missions/tasks, private artifacts, offers, payments and ledger. The audit classifies these as partial foundations where runtime proof is absent. Do not mark any V3 engine complete from UI presence or database CRUD alone.

## Required reporting after each batch

Report:
1. Commit and changed files.
2. Implemented code paths, schema and UI.
3. Commands actually run and exact test results.
4. Provider calls actually made, source and actual usage/cost.
5. Browser/deployment evidence, if available.
6. Remaining defects and owner actions.
7. Explicitly state what was not tested.


## Execution rule — no plan-only completion

Use `docs/29-end-to-end-implementation-and-defect-resolution-contract.md` as the binding phase/acceptance checklist. Each roadmap phase requires actual source implementation, integration, tests and evidence. Update docs/24 with the exact audited HEAD. If a provider credential or owner approval blocks production execution, finish safe code-side work and continue with independent phases. Do not stop after planning, documentation, a dashboard shell or CRUD.
