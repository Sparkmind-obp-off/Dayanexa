# DAYANEXA V2 — Master Upgrade & Execution Roadmap

**Version:** 2.0  
**Date:** 16 November 2026  
**Authority:** subordinate to `docs/16-master-system-and-full-stack-implementation.md`  
**Execution prompt:** `prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md`

## Strategic objective

Turn the existing DAYANEXA codebase into one reliable Agentic Opportunity & Execution OS where identity, customer value, monetization and delivery economics work end-to-end. This is a delivery plan, not a claim that these capabilities are already live.

## Phase 1 — Authentication and production release

**Problem to solve:** the new Clerk React SDK exists in source, but the deployed site was still on an older ad-hoc deployment; Pages had no connected Git source in the last account inspection; the package lockfile was missing from main.

Deliverables:
- Restore reproducible dependency installation and commit package lock.
- Verify Clerk Core 3 frontend package and compatible backend SDK; validate all component APIs and redirects against official SDK docs.
- Verify Production Clerk instance, Google-only provider, custom domain, OAuth callbacks, JWT/session verification, authorized parties and signed webhooks.
- Verify owner bootstrap and role assignment; protect against email-only or client-metadata privilege escalation.
- Connect GitHub to Pages through an authorized dashboard flow or document the approved deployment route.
- Activate CI in `.github/workflows/ci.yml`, not only under `docs/ci`.
- Execute browser-to-Worker auth tests and record deployment commit/hash.

Acceptance:
- Current deployed asset contains the new SDK.
- Google login works on canonical domain.
- `GET /api/v1/me` returns the correct principal.
- Google-only policy, logout, expired session, owner role and tenant isolation pass.
- No auth secret is present in Git or browser bundle.

Owner-controlled dependencies:
- Clerk dashboard access to verify production domain/provider and webhook.
- Cloudflare Pages Git installation repair/authorization if the account integration remains broken.
- No secret values are to be pasted into chat.

## Phase 2 — Complete customer, contributor and operator journeys

**Problem to solve:** existing UI has request, offers, billing and mission surfaces, but full journey and exception handling are not yet verified as one product.

Customer:
1. Public landing/catalog/pricing/trust/legal.
2. Google sign-in, consent and onboarding.
3. Organization/profile creation and preferences.
4. Draft/save/resume request with context, outcomes, constraints and optional budget.
5. Intake receipt, status timeline, SLA and support.
6. Evidence-led validation, clarification and reasoned decision.
7. Versioned quote with scope, exclusions, deliverables, price, taxes/fees, timeline, acceptance, revisions, refund/dispute and expiry.
8. Explicit acceptance of the exact quote version.
9. Server-calculated checkout and idempotent payment intent.
10. Verified payment event/reconciliation.
11. Mission progress, milestones and customer inputs.
12. Private artifact delivery, acceptance/revision/dispute.
13. Closure, receipt, history, support, export and deletion request.

Contributor:
- Application/profile, skill evidence, availability, consent and review.
- Eligible paid tasks only; scope, deadline, acceptance criteria and compensation visible before acceptance.
- Assignment, work submission, quality review, revisions, payable, approved transfer and reconciled paid status.
- Earnings display only from verified ledger state.

Operator:
- Queues for intake, evidence, quotes, approvals, payment exceptions, blockers, delivery, disputes, refunds and contributor payouts.
- Maker-checker controls and immutable audit for financial and privilege actions.

Acceptance:
- Complete customer journey passes in non-production.
- Complete contributor journey passes with a test compensation record.
- Operator resolves a payment exception and a delivery dispute with audit evidence.
- Every state has a next action, responsible actor and failure/retry route.

## Phase 3 — Monetization layers and economic integrity

### Layer A — SaaS access
| Plan | Price / 30 days | Requests | AI assists | Seats |
|---|---:|---:|---:|---:|
| Free | Rp0 | 2 | 0 | 1 |
| Pro | Rp149.000 | 10 | 50 | 3 |
| Plus | Rp399.000 | 30 | 200 | 10 |

Prices are working hypotheses. Subscription covers product access/entitlements; it does not silently include project execution or contributor costs. No auto-renewal without explicit opt-in and legal review. Resolve the current mismatch between calendar-month usage counters and 30-day subscription periods. Enforce AI quota on the server.

### Layer B — One-time services/projects
| Service | Starting price |
|---|---:|
| Demand Validation | Rp750.000 / project |
| Solution Sprint | Rp3.500.000 / sprint |
| Build & Deliver | Rp9.500.000 / mission |

These are indicative starting prices only. Every actual sale uses a server-generated, versioned quote and explicit acceptance.

### Layer C — Managed recurring outcomes
Managed Operations from Rp4.900.000/month as an indicative price. Define scope, SLA, staffing, cadence, report, renewal and exit. No silent recurring charge.

### Layer D — Usage/add-ons (future)
Additional requests, AI assists, research credits, seats, storage and priority response require explicit unit prices, caps, warning thresholds and confirmation before purchase. No automatic overage or top-up.

### Layer E — Partner/marketplace economics (future gated)
Platform commission, split payment and partner subaccounts remain disabled until provider capability, KYC, merchant approval, legal fund flow and partner contracts are verified. No escrow/custody claims.

Economic controls:
- Separate gross charge, tax, discount, gateway fee, refund/chargeback, net cash, platform revenue, direct AI/provider cost, human compensation, contributor payable, margin and payout.
- Never treat gross checkout as platform revenue.
- Compute gross mission margin and contribution margin before approving an offer.
- Subscription payments and project payments have separate purposes, invoices, intents and ledger events.
- All live transactions, refunds and payouts require explicit owner authorization.

Acceptance:
- Plan entitlement and quota period tests pass.
- Quote amount is server authoritative and immutable after acceptance.
- Sandbox webhook, duplicate, invalid signature, delayed/out-of-order, refund and reconciliation tests pass.
- Ledger balances; margin and contributor liability reconcile.
- Live money movement remains disabled until approved.

## Phase 4 — Intelligence, execution, trust and pilot readiness

- Evidence provenance, source permission, demand validation and transparent fact/inference separation.
- Capability build/acquire/license/partner/contributor route planning.
- Workers AI budgets and task profiles; provider cost, quality and latency traces.
- Source benchmark and policy for Apify vs Scrape.ly.
- Durable mission/task orchestration, cancellation, pause/resume, retries, approvals and compensation.
- Quality gates, private artifact handling, signed downloads, acceptance, revisions and disputes.
- All 14 role-aware workspaces with live data; notifications, support, reports and audit.
- Observability, backups/restore, incident response, data retention/export/deletion, legal review.
- Limited pilot and measurement: Verified Economic Resolution, time-to-offer, quote acceptance, paid conversion, delivery acceptance, dispute/refund, repeat purchase, actual contributor payout, margin and cost per outcome.

Acceptance:
- Repeated demand-backed missions are paid, delivered and accepted.
- Reconciliation is complete and margins are positive under measured costs.
- Contributor payments are evidenced, not inferred.
- Owner approves go/no-go before wider launch.

## Cross-phase release rules

- A source commit is not a deployment.
- A UI screen is not a completed journey.
- A payment redirect is not payment verification.
- A request is not validated demand.
- A generated artifact is not accepted delivery.
- A payout request is not a paid contributor.
- A provider adapter is not a tested integration.
- A pricing hypothesis is not validated willingness to pay.
- Genspark is not required; all work must be executable through repository code, authorized GitHub/Cloudflare operations and verified provider interfaces.
