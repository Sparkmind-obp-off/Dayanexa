# DAYANEXA V3 — Market Delivery Engine

**Version:** 3.0 · **Layer:** 5 of 5 · **Authority:** `docs/18-demand-to-execution-architecture-v3.md`

## 1. Mission

Connect a real, tested solution to the market need that motivated it. Present a truthful demo and scoped offer, capture feedback and acceptance, deliver the agreed outcome, verify payment and contributor settlement, and measure economic resolution.

## 2. Demand-to-demo traceability

Every demo must link to:
- Originating discovery brief, source run and demand cluster.
- Validated demand record and evidence references.
- SolutionSpec version and feature-to-problem mapping.
- Mission/task IDs, source commit/build hash and environment.
- Test report, known limitations and data/privacy notes.
- Preview URL, expiry, access policy and revocation status.

A demo must not be represented as commissioned by, endorsed by or approved by the person who originally posted a public need unless that person explicitly did so.

## 3. Demo and preview lifecycle

Draft → build pending → build running → quality review → preview ready → presented → feedback received → expired/revoked. A failed build or failed test cannot become preview ready. Preview links are private by default, time-bounded, scoped and revocable. Production publication is a separate approval and deployment action.

## 4. Market presentation and outreach

Before a demo is shown to a person or organization, record the recipient/segment, reason for relevance, source of contact, lawful basis/consent, channel, message version, demo shown, approver and opt-out/suppression status.

Rules:
- Publicly expressing a need does not automatically grant permission for marketing contact.
- No mass unsolicited DMs, automated spam, impersonation or deceptive "we built this for you" claims.
- Prefer inbound response, platform-permitted replies, opted-in contact, public portfolio/demo pages or approved partner introductions.
- Human approval is required for first contact and any material follow-up until a separate policy is approved.
- Respect platform terms, rate limits, privacy and opt-outs. Suppress future contact after opt-out.

## 5. Offer and customer acceptance

The offer is versioned and immutable once presented. It includes scope, deliverables, exclusions, timeline, milestones, price, tax/fees, payment schedule, revisions, acceptance criteria, support, ownership/license, cancellation/refund/dispute, expiry and assumptions. Customer acceptance must bind to the exact quote version/hash. A demo view, click or positive comment is not quote acceptance.

## 6. Payment, delivery and settlement

Keep separate states and evidence:
- Payment intent created.
- Provider webhook verified and deduplicated.
- Amount/currency/order/merchant reconciled.
- Payment verified.
- Work delivered.
- Customer accepted, requested revision or disputed.
- Revenue recognized under the defined accounting policy.
- Refund/chargeback status reconciled.
- Contributor payable approved and payout reference verified.
- Mission settlement and learning closed.

Never treat checkout redirect, invoice issuance, operator note, payout request or mock simulator as proof of money received or paid. Keep live payments disabled until merchant credentials, callbacks, reconciliation, legal terms and owner approval are complete.

## 7. Economic truth

Maintain distinct ledger entries for gross customer charge, tax liability, discount, gateway fee, refund/chargeback, net cash, subscription revenue, project revenue, managed revenue, provider cost, infrastructure cost, human compensation, contributor payable, payout and margin. Gross checkout is not platform revenue. A demo that is never accepted or paid is not a Verified Economic Resolution.

## 8. Feedback and learning

Capture customer feedback, objections, demo usage (privacy-preserving), feature requests, quote outcome, acceptance/revision/dispute reason, delivery quality, support effort, actual costs, margin, refunds, repeat purchase and contributor experience. Link feedback to the originating demand cluster and solution version. Update future scoring without overwriting historical evidence.

## 9. User-facing workspace

Show originating demand, evidence, demo preview, test results, known limitations, target segment, presentation/consent status, versioned offer, customer response, payment and delivery state, support, disputes, ledger and final outcome. Clearly label "demo", "presented", "requested", "accepted", "paid", "delivered" and "verified outcome" as distinct.

## 10. Acceptance tests

1. A demo cannot be presented without traceable validated demand and test evidence.
2. Preview access expires and can be revoked.
3. No public deployment or domain mutation occurs without approval.
4. A public post author is not auto-enrolled in outreach.
5. Outreach requires a documented lawful/consented basis and opt-out handling.
6. Quote version/hash is immutable and acceptance binds to that exact version.
7. Payment success requires signed webhook/inquiry/reconciliation, not browser redirect.
8. Delivery acceptance, dispute and refund are separate from payment state.
9. Contributor payout is evidenced by reconciled transfer reference.
10. Ledger balances and actual margin can be traced to the originating demand and mission.
11. Demo presentation without customer acceptance is not counted as revenue or VER.
