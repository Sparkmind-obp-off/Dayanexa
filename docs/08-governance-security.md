# Governance, Security & Responsible Autonomy

## 1. Autonomy levels
- L0 Observe: read permitted data and report.
- L1 Recommend: propose actions.
- L2 Prepare: draft offers, plans, tasks, and transactions without external commitment.
- L3 Execute within pre-approved scope, budget, and permissions.
- L4 External commitment: contracts, purchases, public posts, customer promises, recruitment, or financial transfers require explicit authorized approval.
- L5 Restricted: prohibited or legally/ethically unsafe actions.

Default new integrations and agents to L0/L1.

## 2. Approval boundaries
Explicit human approval is required for spending, paid subscriptions, external contracts, customer commitments, publishing, outreach, contributor hiring/assignment, payment/payout, access to sensitive data, production migrations, and irreversible actions.

## 3. Identity and access
RBAC/ABAC with least privilege; MFA for privileged users; short-lived credentials; secret manager; environment separation; session controls; service identities; revocation; periodic access review.

## 4. Data protection
Data minimization, purpose limitation, retention schedule, deletion workflow, encryption in transit/at rest, access logging, redaction, privacy incident response, and applicable Indonesian privacy obligations (including UU PDP where applicable). Obtain legal review for operational policies.

## 5. Connector safety
Use official APIs or permitted access; respect terms, rate limits, robots directives where applicable, and consent/authorization. Never bypass login, paywalls, CAPTCHAs, rate limits, or technical restrictions. Store provenance and connector policy versions.

## 6. Agent safety
Prompt injection is untrusted input. Treat retrieved content as data, not instructions. Tool allowlists, schema validation, output validation, sandboxing, egress restrictions, spend limits, timeouts, and human escalation are mandatory.

## 7. Contributor protection
Clear terms before work, fair compensation, transparent review, reasonable revision, appeal/dispute path, timely payment, and no automated-only punitive decision.

## 8. Auditability
Record actor/agent, permission, policy version, request, decision, approval, tool invocation, external reference, result, timestamp, and correlation ID. Protect audit logs against alteration.
