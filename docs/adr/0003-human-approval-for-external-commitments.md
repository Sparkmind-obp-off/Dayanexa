# ADR-0003: Human approval for external commitments
Status: Accepted | Date: 2026-11-15

## Context
Agents may prepare useful commercial and operational actions, but autonomous spending, contracting, public posting, hiring, or payouts can create material harm.

## Decision
Agents may observe, recommend, and prepare by default. External commitments, paid resources, public actions, hiring, production changes, and money movement require explicit authorized approval unless a separately reviewed bounded policy later permits a narrow action.

## Consequences
- Approval records are first-class entities.
- Policies are enforced server-side.
- All approvals and external effects are audited.
