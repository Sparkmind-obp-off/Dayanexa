# DAYANEXA V3 — Agentic Execution Engine

**Version:** 3.0 · **Layer:** 4 of 5 · **Authority:** `docs/18-demand-to-execution-architecture-v3.md`

## 1. Mission

Turn an approved SolutionSpec into a real, testable result through bounded AI agents, tools, providers and human contributors. A registry entry, assigned task or AI-generated plan is not execution. Execution requires actual tool invocation, persisted result, quality evidence and a traceable artifact.

## 2. Orchestration architecture

DAYANEXA owns the canonical mission/task state machine and execution policy. Start with a modular execution service and Cloudflare-native Queues/Workflows for durable asynchronous work where appropriate. Durable Objects are reserved for coordination that truly needs serialized state. Do not add LangGraph, LangChain or CrewAI to the critical path without a measured requirement and architecture decision.

Each mission stores originating demand/opportunity, approved SolutionSpec version, quote/authorization, budget, owner, environment, schedule, cancellation and escalation policy. Each task stores input/output schema, executor type, agent/tool/provider version, acceptance criteria, dependencies, attempt limit, timeout, idempotency key, cost cap, retry/backoff, status and reviewer.

## 3. Agent contract

An agent definition includes:
- Stable ID, name, purpose, version and owner.
- Task profile and allowed task types.
- Model/provider and approved model profile.
- Allowed tools and exact scopes.
- Input/output JSON schemas and maximum context/data classification.
- Daily/run token or neuron budget, timeout and concurrency.
- Retry policy, deterministic/idempotency strategy and failure handling.
- Human escalation conditions and approver.
- Prompt/system instruction version, evaluation suite and quality baseline.
- Status: draft, tested, approved, active, paused, deprecated.

Agents do not inherit owner permissions. Tool authorization is evaluated per invocation, independent of the agent's prompt. All external data is untrusted; prompt injection cannot grant tool access or override system policy.

## 4. Tool registry and invocation

Each tool has a typed input/output contract, capability scope, environment, data access class, provider, rate limit, cost estimate, timeout, idempotency behavior, approval class, audit policy and health state.

Tool invocation sequence:
1. Validate task and agent version.
2. Resolve required capability and tool.
3. Evaluate user/org/mission permissions.
4. Validate data classification and source permissions.
5. Estimate cost and reserve budget atomically.
6. Require approval when policy says so.
7. Execute with least privilege and bounded network access.
8. Validate output schema and content safety.
9. Persist invocation, trace, usage, cost and output/artifact reference.
10. Release unused budget and reconcile actual cost.
11. Retry only when safe; otherwise pause or escalate.
12. Evaluate task acceptance criteria.

## 5. Task and mission lifecycle

Mission: planned → tasks decomposed → resources assigned → executing → quality review → ready for delivery → delivered → awaiting acceptance → accepted → payment/settlement/learning states, with explicit failed, suspended, disputed and cancelled branches.

Task: pending → eligible → assigned → running → succeeded / needs review / retry pending / blocked / failed / cancelled. Store every transition and attempt. Do not let a generic PATCH silently mark an agent task complete without an execution record and validated output.

## 6. Human-in-the-loop

Use a human contributor when the task needs physical work, specialist judgment, local interaction, licensed practice, customer-facing accountability or a policy-defined review. Show scope, due date, acceptance criteria and compensation before the contributor accepts. Human work follows assignment, submission, review, revision, approval, payable and reconciled payout. AI cannot approve its own financial or external commitments.

## 7. Artifact and demo generation

Artifacts must have owner, mission/task, MIME type, size, SHA-256, storage key, version, sensitivity, scan/test status and retention. Store private artifacts in R2. Generate preview links only after tests and policy checks; links must be short-lived, scoped, revocable and logged.

For generated websites/apps:
- Build in an isolated preview environment, not production.
- Pin source commit/build ID and dependency lock.
- Run typecheck, tests, dependency/security scan and preview smoke tests.
- Verify routes, assets, responsive behavior and no secret leakage.
- Produce a preview URL with expiry and revocation.
- Preserve build logs and test report.
- Require human approval before public deployment, domain/DNS changes or production data access.

## 8. Budgets and safety

Every mission has a hard budget. Reserve cost before each call and stop when the cap is reached. Track model tokens/neurons, search/extraction credits, Actor compute/proxy, build minutes, storage, network, human compensation and external licenses separately. No paid fallback, top-up or overage without explicit approval. Use sandbox credentials and mock providers in CI. Production secrets are never passed to model context or written into logs/artifacts.

## 9. Resilience and observability

Persist workflow state before/after each external call. Support pause, resume, cancellation, retry, timeout, partial completion, compensation and human takeover. Use outbox/idempotency for event delivery. Emit structured logs, traces, metrics, cost records and audit events. Dead-letter failed jobs and provide operator queues with retry reason and safe replay controls.

## 10. Acceptance tests

1. An agent cannot execute without an approved mission and task.
2. An unapproved tool or scope is denied even if requested by model output.
3. Prompt injection in source content cannot access secrets or invoke unauthorized tools.
4. Budget reservation prevents concurrent overspend and stops at cap.
5. Idempotent retry does not duplicate external side effects.
6. Tool output schema failures are recorded and escalated.
7. Agent task completion requires actual run record and validated output.
8. Failed workflow can resume without repeating completed non-idempotent work.
9. Artifact hash, access policy, expiry and revocation work.
10. Website demo preview passes build/test/security/smoke gates and exposes no secrets.
11. Human compensation is visible before acceptance and settlement is ledger-backed.
12. Public deploy, external contact, live payment and payout require explicit approval.
