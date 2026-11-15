# Agent Workforce & Orchestration

## 1. Agent families
1. Market Scout — discovers permitted public/customer signals.
2. Source Policy Agent — checks connector permissions and source terms.
3. Signal Normalizer — structures observations and deduplicates.
4. Entity Resolution Agent — links organizations/products/problems carefully.
5. Demand Analyst — extracts problem, urgency, frequency, context.
6. Evidence Analyst — grades evidence and contradictory information.
7. Requester Verification Agent — assesses authenticity and commercial authority.
8. Demand Cluster Agent — finds repeated unmet needs.
9. Opportunity Analyst — scores potential and risk dimensions.
10. Market Research Agent — estimates alternatives, market size, and competition.
11. Solution Architect Agent — proposes product/service/solution options.
12. Capability Analyst — maps requirements to available capability.
13. Capability Builder Agent — prepares build/integrate/acquire plans.
14. Product Strategist — packages repeatable solutions.
15. Commercial Analyst — pricing, costs, willingness-to-pay hypotheses.
16. Offer/Proposal Agent — prepares quotes and proposals for approval.
17. Mission Planner — decomposes outcomes into tasks and dependencies.
18. Resource Router — selects agents/tools/providers/contributors.
19. Execution Agents — perform bounded domain work.
20. QA Agent — checks deliverables against acceptance criteria.
21. Delivery Agent — prepares handoff and records acceptance.
22. Finance/Reconciliation Agent — reconciles payment and costs; cannot self-approve its own claims.
23. Learning Agent — extracts reusable insights from verified outcomes.

## 2. Agent contract
Every agent declares: purpose, owner, model/version, tools, allowed data, permissions, input/output schema, confidence behavior, cost limits, timeout, retry policy, failure modes, escalation rules, evaluation suite, and audit requirements.

## 3. Execution pattern
Plan → authorize → allocate → execute → validate → persist artifact → QA → deliver. Use structured outputs and typed tool contracts. Agents do not directly mutate arbitrary database state; they issue domain commands through policy-enforcing services.

## 4. Agent hierarchy
One central orchestrator coordinates domain-level supervisors and specialist agents. Agents may delegate only within explicitly granted scope. No hidden agent-to-agent authority escalation.

## 5. Human-in-the-loop
Escalate when evidence is ambiguous, identity/authority is uncertain, legal or safety risk is high, quality is subjective, physical work is required, customer dispute occurs, or a budget/commitment boundary is reached.

## 6. Evaluation
Measure task success, groundedness, tool correctness, cost, latency, rework, escalation precision, policy compliance, and downstream accepted outcomes. Do not optimize for token volume or agent count.
