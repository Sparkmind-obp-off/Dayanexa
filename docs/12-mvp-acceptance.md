# MVP Definition of Done & Acceptance

## End-to-end acceptance scenario
1. An authorized source/customer brief creates a traceable Signal.
2. The system normalizes it without losing provenance.
3. Demand hypothesis explicitly distinguishes fact from inference.
4. Evidence supports validation or the system defers/rejects.
5. Opportunity assessment shows separate confidence, commercial, feasibility, strategic, and risk dimensions.
6. Solution options are compared, including product, service, partner, and managed outcome.
7. Capability gaps are identified even when current tools cannot fulfill the need.
8. Build/buy/partner/human-contributor options have cost, time, permission, and risk estimates.
9. Offer contains scope, price, acceptance criteria, and terms.
10. Required commercial approval is recorded before external commitment.
11. Mission tasks have dependencies, owners, budget, and idempotency.
12. AI agents execute only within explicit permissions; human work has agreed compensation and scope.
13. Quality review checks deliverables against acceptance criteria.
14. Delivery and customer acceptance are recorded separately.
15. Payment is independently verified; invoice alone is not payment.
16. Costs, revenue, settlement, and margin reconcile.
17. Learning record links to verified outcome and informs future decisions.

## Minimum non-functional requirements
- Every record has stable ID and timestamps.
- All external data has provenance and retention policy.
- Authorization is enforced server-side.
- All privileged actions are audited.
- Retries cannot duplicate payments, missions, or external commitments.
- Secrets are never exposed to browser code or Git.
- Failures and paused/approval states are visible.
- Accessibility and responsive UI are tested.
- Backups and recovery are demonstrated before production.

## Pilot restrictions
One narrow segment, a small set of permitted sources, low-risk offers, limited budgets, manual approval for external commitments and all money movement. No broad autonomous operation until safety, quality, and unit economics are proven.
