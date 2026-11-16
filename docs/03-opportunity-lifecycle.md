# Opportunity & Mission Lifecycle

## 1. Main lifecycle
```mermaid
stateDiagram-v2
  [*] --> SIGNAL_CAPTURED
  SIGNAL_CAPTURED --> SIGNAL_NORMALIZED
  SIGNAL_NORMALIZED --> SIGNAL_CLASSIFIED
  SIGNAL_CLASSIFIED --> DEMAND_HYPOTHESIS_CREATED
  DEMAND_HYPOTHESIS_CREATED --> DEMAND_EVIDENCE_PENDING
  DEMAND_EVIDENCE_PENDING --> DEMAND_VALIDATED
  DEMAND_EVIDENCE_PENDING --> DEFERRED
  DEMAND_EVIDENCE_PENDING --> REJECTED
  DEMAND_VALIDATED --> OPPORTUNITY_CREATED
  OPPORTUNITY_CREATED --> OPPORTUNITY_ASSESSED
  OPPORTUNITY_ASSESSED --> SOLUTION_DESIGNED
  SOLUTION_DESIGNED --> CAPABILITY_ASSESSMENT
  CAPABILITY_ASSESSMENT --> CAPABILITY_READY
  CAPABILITY_ASSESSMENT --> CAPABILITY_GAP_IDENTIFIED
  CAPABILITY_GAP_IDENTIFIED --> CAPABILITY_FORMATION_PLANNED
  CAPABILITY_FORMATION_PLANNED --> CAPABILITY_READY
  CAPABILITY_READY --> COMMERCIAL_MODEL_DESIGNED
  COMMERCIAL_MODEL_DESIGNED --> OFFER_READY
  OFFER_READY --> CUSTOMER_VALIDATION_PENDING
  CUSTOMER_VALIDATION_PENDING --> COMMERCIAL_AUTHORIZATION_PENDING
  COMMERCIAL_AUTHORIZATION_PENDING --> APPROVED
  APPROVED --> MISSION_PLANNED
  MISSION_PLANNED --> TASKS_DECOMPOSED
  TASKS_DECOMPOSED --> RESOURCES_ASSIGNED
  RESOURCES_ASSIGNED --> EXECUTING
  EXECUTING --> QUALITY_REVIEW
  QUALITY_REVIEW --> EXECUTING
  QUALITY_REVIEW --> READY_FOR_DELIVERY
  READY_FOR_DELIVERY --> DELIVERED
  DELIVERED --> AWAITING_ACCEPTANCE
  AWAITING_ACCEPTANCE --> ACCEPTED
  AWAITING_ACCEPTANCE --> DISPUTED
  ACCEPTED --> PAYMENT_PENDING
  PAYMENT_PENDING --> PAYMENT_VERIFIED
  PAYMENT_VERIFIED --> SETTLEMENT_COMPLETED
  SETTLEMENT_COMPLETED --> LEARNING_RECORDED
  LEARNING_RECORDED --> CLOSED
```

## 2. Exception states
`REJECTED`, `DEFERRED`, `CANCELLED`, `FAILED`, `NEEDS_HUMAN_REVIEW`, `SUSPENDED`, `DISPUTED`, `PAYMENT_FAILED`. Every transition records actor, timestamp, reason, policy, and correlation ID.

## 3. State semantics
- Captured/normalized/classified signals are observations, not proof of demand.
- A hypothesis requires evidence collection and validation.
- An opportunity is a value-creation candidate, not a confirmed sale.
- Capability readiness is proven by tests and declared limits.
- Commercial authorization precedes external commitments or paid execution.
- Quality approval precedes delivery.
- Acceptance is explicit and tied to agreed criteria.
- Payment verification uses a trusted payment/bank/provider signal or reconciled record; never infer it from a screenshot alone without review.
- Settlement is recorded only after obligations are actually fulfilled.

## 4. Product venture lifecycle
A reusable product venture may have a separate lifecycle: Problem Pattern → Segment Validation → Solution Prototype → Willingness-to-Pay Test → Capability Formation → Offer Design → Controlled Launch → Retention/Unit Economics → Scale, Pivot, or Sunset. Do not force a multi-customer product through one customer mission record.

## 5. Transition contract
Every transition must define: allowed prior states, actor/agent permission, required evidence, validation predicate, side effects, idempotency key, timeout/retry policy, compensating action, and audit event. Invalid transitions fail closed.
