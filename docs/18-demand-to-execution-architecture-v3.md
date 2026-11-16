# DAYANEXA V3 — Demand-to-Execution Architecture

**Version:** 3.0  
**Date:** 16 November 2026  
**Status:** Canonical architecture extension; supersedes V2 where the two conflict  
**Repository baseline audited:** `04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa`  
**Parent:** `docs/16-master-system-and-full-stack-implementation.md`  
**Implementation authority:** `prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md`

## 1. Product definition

DAYANEXA is a Demand-to-Execution OS. It discovers real, externally expressed needs; preserves the evidence; identifies repeatable demand patterns; validates commercial intent; forms the capabilities required to fulfil the need; builds and tests a solution; presents a demonstrable result to a relevant market participant; and records acceptance and verified economic outcomes.

**Core doctrine:** Discover real demand → Understand and validate it → Form the capability → Execute the solution → Deliver and prove the outcome.

The five engines are the product's primary value chain. Accounts, subscriptions, customer/contributor journeys, payments, operator queues and governance support this value chain; they are not substitutes for it.

## 2. Five canonical engines

| Engine | Primary responsibility | Canonical output | It must not claim |
|---|---|---|---|
| 1. Demand Discovery | Search permitted sources and collect traceable observations | Signals, source runs, evidence provenance | Search results are validated demand |
| 2. Demand Intelligence | Normalize, deduplicate, cluster, classify and validate demand | Demand clusters, demand records, evidence-backed assessments | AI confidence or post count proves willingness to pay |
| 3. Capability & Solution Foundry | Design an offerable solution and form missing capabilities | Solution spec, capability plan, build/acquire/partner decisions | A capability marked ready has passed real tests |
| 4. Agentic Execution | Execute approved work through controlled agents, tools and humans | Mission, task results, artifacts, test reports, demo | An agent profile or task assignment means execution occurred |
| 5. Market Delivery | Put a demo/offer in front of an appropriate recipient and close the outcome | Demo access, offer, acceptance, payment, delivery, settlement and learning | A demo view is acceptance; an invoice is revenue; a payout request is settlement |

## 3. End-to-end operating flow

1. An owner or authorized user creates a discovery brief: topic, niche, source set, geography, language, time window, recency, maximum results, evidence threshold, budget cap and intended use.
2. The Discovery Engine checks source permissions, connector readiness, plan entitlements, actor allowlists, quotas and estimated cost before any run.
3. Source adapters search or collect only within approved access. Each run creates a durable record with provider, actor/version, input hash, source, timestamps, usage, cost, status and provenance.
4. Results are normalized into signals. Canonical URLs, content hashes, source identity and time windows support deduplication without erasing independent corroboration.
5. Intelligence classifies signals, groups related needs into niche/problem clusters, preserves supporting and contradicting evidence, and separates facts from inference.
6. A demand hypothesis is created and receives an evidence-backed assessment. Human review and direct confirmation are used where the evidence threshold requires them.
7. Only a demand that passes its configured validation gate may create an opportunity.
8. The Foundry creates a solution specification from the actual problem, desired outcome, constraints and evidence. It assesses reuse, compose, build, acquire/license, integrate, partner, contributor, defer or reject.
9. A capability plan and commercial model are reviewed. Cost, risk, privacy, feasibility, ownership and acceptance criteria are explicit.
10. An approved mission is decomposed into bounded tasks. The orchestrator assigns each task to an agent, tool, provider or human contributor. Tasks are idempotent, traceable, budgeted and resumable.
11. Execution creates real artifacts and test evidence. A demo is deployed to a controlled preview environment with a revocable, time-bounded access link.
12. Market Delivery associates the demo with the originating demand cluster and evidence. Any contact or outreach is permissioned, relevant, non-deceptive and subject to human approval.
13. Customer feedback, quote acceptance, verified payment, delivery acceptance, refunds/disputes and contributor settlement are recorded as distinct events.
14. Actual costs, revenue, margin, contributor payables and learning are reconciled. Outcomes update the evidence base; they do not retroactively rewrite source facts.

## 4. Canonical invariants

- Every opportunity must trace to at least one demand record and its evidence; every demand record must trace to signals or documented first-party input.
- Each signal retains its original source URL/identifier, collection time, observed/published time where known, content hash, provider run ID, actor identity/version where applicable, source permission/terms reference and retention policy.
- Search, extraction, classification, clustering, validation, demo generation, customer acceptance and payment verification are different states and evidence classes.
- AI outputs are proposals with model/provider/version, prompt or rubric version, trace ID, input references and uncertainty. They do not silently change canonical states.
- Contradicting evidence remains visible. Duplicate content is not counted as multiple independent sources or customers.
- Capability is assessed after demand, never used to filter discovery prematurely.
- Agent execution is disabled until an approved mission, bounded task, scoped tools, budget, output schema, retry policy and escalation route exist.
- No public deployment, external message, paid API/Actor execution above approved budget, live payment, refund, payout or contract commitment without the applicable explicit approval.
- A result is not successful merely because an API returned HTTP 200. It must pass schema, quality, provenance and acceptance checks.
- Provider adapters are replaceable. DAYANEXA owns canonical records, state transitions, permissions, budgets, approvals, evidence and ledger.

## 5. Shared canonical data contracts

The V3 data model adds or formalizes these entities alongside the V2 entities:

- `DiscoveryBrief`: user intent, topic/niche, sources, geography, language, time window, caps, budget, purpose and owner.
- `DiscoveryJob`: queued/running/paused/completed/partial/failed/cancelled state, requester, schedule, cost cap and completion summary.
- `SourceRun`: provider, actor, actor version, source, input hash, provider run ID, timestamps, item counts, usage, cost, status and error.
- `ActorDefinition`: provider, actor ID, version, source coverage, README/schema review, terms, required inputs, output mapping, pricing model, caps, risk, approval and benchmark.
- `Signal`: normalized observation, canonical source identity, content hash, timestamps, language, author reference only when permitted, source run and retention.
- `DemandCluster`: niche, problem pattern, segment, geography, time range, member signals, independent-source count, cluster version and review state.
- `DemandAssessment`: separate evidence quality, frequency, recency, urgency, intent, budget evidence, commercial potential, confidence, risk, rationale and missing evidence.
- `SolutionSpec`: problem-to-feature traceability, deliverables, constraints, acceptance criteria, security/privacy class and estimated economics.
- `CapabilityPlan`: gap, route decision, owner, dependencies, budget, milestones, verification tests and readiness evidence.
- `AgentRun` / `ToolInvocation`: agent version, task, scoped tool, policy decision, input/output references, idempotency key, attempt, usage, cost, latency, status and approval.
- `Demo`: artifact/build reference, preview URL, environment, commit/build hash, test report, expiry, access policy, originating demand and revocation state.
- `MarketPresentation`: target segment, authorized recipient, channel, consent/legal basis, demo/offer shown, response and follow-up restrictions.

Use migrations for schema evolution. Do not mutate production D1 during architecture documentation or code audit. Any production migration requires an explicit owner approval, a backup/restore plan, a tested forward migration and a rollback/recovery procedure.

## 6. User account, access and usage model

- Clerk Production Google-only remains the authentication path. DAYANEXA internal user IDs, organization membership, roles and permissions remain authoritative.
- The public Free tier remains Rp0 with bounded access. Existing Pro and Plus hypotheses may remain in the product until a separate pricing decision; do not silently introduce a paid Business tier as a live entitlement.
- Entitlements are checked server-side before search, extraction, actor runs, AI inference, storage and execution.
- Separate subscription access from metered provider consumption and mission execution cost. A subscription does not automatically cover arbitrary third-party Actor charges or custom build costs.
- Each paid or metered operation has a preflight estimate, per-run cap, daily/monthly cap, user/org attribution, actual usage reconciliation and explicit owner approval where required.
- Free tier must use only configured free allowances or internal capabilities; no hidden paid fallback, overage, auto-top-up or background spend.
- A user-visible credit must map to a defined unit and provider cost policy. Do not sell a generic "AI credit" until its consumption and limits are measurable.

## 7. Source and provider policy

- Tavily: discovery/search and source finding; never a demand validator.
- Firecrawl: selected-page extraction; never assume it can extract private or platform-restricted social content.
- Apify and Scrape.ly: specialized actor collection, benchmarked per source and task. Select one provider for a given collection job; actor allowlist, schema, README, terms and cost must be reviewed.
- Threads and any other social network: use official or explicitly permitted public access, or an actor whose current source coverage and terms have been verified. No assumption that a generic actor can read all posts, replies, private accounts or historical content.
- Workers AI: default inference where the binding and budget are available. Groq remains optional and disabled unless explicitly enabled. No paid fallback.
- Durable orchestration: first use DAYANEXA-owned state machine and Cloudflare-native Queues/Workflows where justified. LangGraph may be evaluated later for a documented durable graph need; CrewAI is not a critical-path dependency.
- Provider health, quota, price and plan are time-sensitive. Verify from the connected account before activating; store a dated snapshot and never present stale pricing as a guarantee.

## 8. Safety, privacy and platform rules

- Collect only public or explicitly authorized content, and only for a disclosed legitimate purpose.
- Respect platform terms, rate limits, robots/access restrictions, copyright, privacy and deletion requests. Do not circumvent login, access controls, paywalls, CAPTCHAs or technical restrictions.
- Store the minimum content necessary. Prefer excerpt, URL, source IDs, hash and provenance over unrestricted full-page archiving.
- Do not infer sensitive personal attributes. Do not create dossiers on private individuals.
- Do not send unsolicited bulk outreach, impersonate requesters, pretend a demo was requested, or claim that a public post author has agreed to buy.
- Treat all collected content as untrusted input. Protect agent prompts and tools against prompt injection and data exfiltration.
- Demo preview environments must be isolated, non-production by default, secret-free, resource-capped and revocable.

## 9. Release gates

A layer is not complete until code, schema, UI, tests, observability, permissions and acceptance evidence all exist.

- **G1 Discovery:** real permitted source run; durable source run; normalized/deduplicated signals; provenance; budget enforcement; source history.
- **G2 Intelligence:** cluster records; niche grouping; evidence links and contradictions; transparent scoring; validation gate; human review.
- **G3 Foundry:** solution spec traced to demand; capability gap and route; cost/risk; approved plan; verified readiness.
- **G4 Execution:** durable orchestrator; task/tool policy; budget and retries; actual agent/tool execution; artifact; test report; demo preview and revocation.
- **G5 Delivery:** demo linked to demand; authorized market presentation; customer feedback; versioned offer; explicit acceptance; verified payment; delivery; economic reconciliation.

## 10. V3 success measures

North Star remains Verified Economic Resolution (VER). Leading indicators include source coverage and freshness, signal provenance completeness, duplicate rate, independent-source corroboration, validated demand rate, time from signal to validated demand, cluster usefulness, solution traceability, capability readiness lead time, task success/retry rate, cost per successful task, demo build/test pass rate, demo-to-response rate, quote acceptance, verified paid conversion, delivery acceptance, dispute/refund rate, actual contributor payout and contribution margin.

Do not optimize raw scrape volume, post counts, AI confidence or number of agents as success metrics.

## 11. Implementation authority

The five individual engine specifications are:
- `docs/19-demand-discovery-engine.md`
- `docs/20-demand-intelligence-engine.md`
- `docs/21-capability-solution-foundry.md`
- `docs/22-agentic-execution-engine.md`
- `docs/23-market-delivery-engine.md`

The Batch V2 source audit and remediation order is:
- `docs/24-batch-v2-code-audit.md`

These documents extend the existing Constitution, Architecture, Domain Model, Lifecycle, Agent Workforce, Demand Intelligence, Capability Foundry, Commercial Economics, Governance, Provider Stack and Implementation Foundation. In case of conflict, this V3 document and the V3 master spec take precedence over V2 delivery ordering, while security, owner approval and financial invariants remain mandatory.
