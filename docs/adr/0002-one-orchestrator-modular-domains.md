# ADR-0002: One logical orchestrator, modular domains
Status: Accepted | Date: 2026-11-15

## Context
Independent tools and agents without a canonical lifecycle create fragmented state and unclear accountability.

## Decision
Use one logical orchestrator for durable lifecycle coordination, with modular domain services owning business invariants. Start with a modular monolith and event-driven jobs.

## Consequences
- One correlation and audit model.
- Domain boundaries remain explicit.
- Avoid premature microservices and duplicated state machines.
