# Canonical Domain Model

## 1. Core entities
- **Source:** authorized origin of market or customer information; includes owner, access method, terms, allowed purposes, rate limits, retention, and health.
- **Signal:** raw or normalized observation with timestamp, source, content reference, and provenance.
- **Evidence:** independently reviewable support for or against a demand hypothesis.
- **Requester:** person or organization associated with a need; identity and verification level are separate.
- **Demand:** structured problem/need with segment, context, urgency, frequency, desired outcome, constraints.
- **DemandCluster:** related demands grouped by common problem, not merely keyword similarity.
- **Opportunity:** assessed potential to create value by resolving one or more demands.
- **Solution:** proposed way to resolve demand; may be product, service, software, partner, or managed outcome.
- **Capability:** reusable ability with owner, dependencies, cost, reliability, limits, and readiness.
- **CapabilityGap / CapabilityBuild:** missing ability and approved plan to form it.
- **Product / Service / Offer:** catalog item, delivery definition, and priced commercial proposition.
- **Customer / Contract / Quote:** commercial relationship and its enforceable scope.
- **Mission / Task / Assignment:** outcome-level work, decomposed units, and resource allocation.
- **Agent / Tool / Provider / Contributor:** execution resources with permission, capability, cost, and performance metadata.
- **Execution / Artifact / QualityReview:** work attempt, produced asset, and quality decision.
- **Delivery / Acceptance / Dispute:** customer handoff, explicit acceptance, and contested outcome.
- **Transaction / Payment / Settlement / LedgerEntry:** economic records with external references and reconciliation status.
- **CostRecord / RevenueRecord:** attributable economics with currency, tax treatment, source, and verification.
- **Policy / Permission / Approval / AuditEvent:** governance controls and immutable evidence of decisions.
- **LearningRecord / PerformanceRecord:** evaluated outcome and reusable operational insight.

## 2. Entity relationships
A Source emits many Signals. Signals support or contradict Evidence. Evidence informs Demand hypotheses. Demands may belong to clusters and produce Opportunities. An Opportunity has assessments and one or more Solutions. A Solution requires Capabilities; gaps may generate CapabilityBuilds. A commercialized Solution produces Products/Services/Offers. An accepted Offer may produce a Contract and Mission. Missions contain Tasks and Assignments. Assignments use Agents, Tools, Providers, or Contributors. Executions produce Artifacts reviewed by QualityReviews. Delivery leads to Acceptance or Dispute. Economic events create Revenue, Cost, Payment, Settlement, and Ledger records. Outcomes produce LearningRecords.

## 3. Required provenance fields
For source-derived data: `source_id`, `source_uri` (when permitted), `observed_at`, `captured_at`, `collection_method`, `terms_snapshot`, `raw_payload_hash`, `retention_until`, `confidence`. Do not store credentials or unnecessary personal data in evidence records.

## 4. Record identity and lifecycle
Use opaque stable IDs (UUID/ULID), UTC timestamps, explicit currency codes (ISO 4217), integer minor units for money, versioned schemas, and soft deletion only where lawful/appropriate. Preserve financial and audit records according to applicable retention rules.

## 5. Separate assessments
Never collapse all judgments into one opaque score. Keep:
- `demand_confidence`
- `commercial_potential`
- `execution_feasibility`
- `strategic_value`
- `risk_level`

Each assessment stores dimension values, rationale, evidence references, model/rubric version, reviewer, and timestamp.
