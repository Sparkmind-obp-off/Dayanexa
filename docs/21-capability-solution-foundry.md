# DAYANEXA V3 — Capability & Solution Foundry

**Version:** 3.0 · **Layer:** 3 of 5 · **Authority:** `docs/18-demand-to-execution-architecture-v3.md`

## 1. Mission

Design a solution for a validated demand and form the capability required to deliver it—even when the capability is not currently available. The Foundry is demand-led, capability-independent and economics-aware.

## 2. Inputs and outputs

**Inputs:** validated demand/opportunity, evidence bundle, target segment, desired outcome, constraints, acceptance hypothesis, risk profile and preliminary budget.

**Outputs:** versioned SolutionSpec, product/service/package/managed-outcome proposal, capability assessment, gap register, build/acquire/partner plan, cost model, quality plan, commercial proposal and execution-ready scope.

## 3. Solution design workflow

1. Translate the demand into a problem statement without losing the source wording and context.
2. Define user/persona at segment level, job-to-be-done, current workaround, desired outcome and measurable acceptance criteria.
3. Produce at least one feasible solution option; compare alternatives when material.
4. Trace every feature/deliverable to a demand signal or explicit product rationale.
5. Define scope, exclusions, dependencies, assumptions, data handling, support, delivery milestones and revision policy.
6. Estimate provider, infrastructure, human, maintenance, tax/fee and contingency costs.
7. Evaluate commercial price, contribution margin, delivery capacity, legal constraints and risks.
8. Create a capability gap for every missing ability.
9. Select a resolution route and require approval for spend, licensing, partnership or external commitment.
10. Run readiness checks before the solution can become execution-ready.

## 4. Capability resolution routes

For each gap, consider and document:
- **Reuse:** a verified existing internal capability.
- **Compose:** combine existing tools/services into a tested workflow.
- **Build:** create a reusable DAYANEXA-owned component.
- **Acquire/license:** obtain a tool, model or service under approved terms and cost.
- **Integrate:** connect an external API/provider through a secure adapter.
- **Partner:** contract a capable partner for an accountable part of the outcome.
- **Contributor:** assign a verified human contributor for judgment or physical/local work.
- **Defer:** wait for evidence, budget or readiness.
- **Reject:** decline when risk, economics or feasibility are unacceptable.

No route is selected merely because an integration is already configured. Capability absence must never erase the underlying demand.

## 5. SolutionSpec contract

Each spec includes: problem and demand references; target segment; desired outcome; user journeys; features/deliverables; acceptance criteria; non-functional requirements; data classification; security/privacy requirements; dependencies; scope/exclusions; milestones; estimated duration; provider and human roles; cost estimate with confidence range; price hypothesis; margin; operational support; maintenance; risk register; approval status; version and change history.

## 6. Capability readiness

A capability can be marked ready only with:
- Owner and purpose.
- Input/output contract and version.
- Required permissions/secrets stored securely.
- Limits, rate limits, timeout and cost model.
- Unit, integration, security and failure tests.
- Observability and audit events.
- Runbook and escalation route.
- Proof of actual execution in the target environment.
- Rollback/deactivation procedure.

A row in the capabilities table or an agent profile is inventory, not proof of readiness.

## 7. Commercial and delivery readiness

Before execution approval:
- Scope and acceptance criteria are testable.
- Price is represented by a versioned quote, not a mutable UI amount.
- Direct costs, provider charges and contributor compensation are estimated.
- Margin policy is satisfied or an authorized exception is recorded.
- Data rights, third-party licenses, hosting, customer access and maintenance are clear.
- Customer commitments and any external purchase require explicit approval.

## 8. User experience

The Solution Studio must show demand evidence next to the solution plan, features mapped to problems, capability gaps and route decisions, build-vs-buy comparison, estimated cost and margin, risk, approvals, readiness test evidence and a clear "ready for execution" gate. Do not present a blank CRUD form as an intelligent solution designer.

## 9. Acceptance tests

1. A solution cannot be detached from its validated demand evidence.
2. Every deliverable maps to a problem/outcome and acceptance criterion.
3. Capability gaps have one of the allowed resolution routes and a named owner.
4. A paid acquisition or external contract is blocked without owner approval.
5. A capability cannot become ready without tests and proof.
6. Cost estimate includes external provider and human contributor costs.
7. Low-margin exception requires reason and approval.
8. Solution version changes preserve history and invalidate stale quotes where required.
9. Missing capability does not prevent discovery or assessment of demand.
10. Execution approval rejects unresolved critical security, legal or quality gaps.
