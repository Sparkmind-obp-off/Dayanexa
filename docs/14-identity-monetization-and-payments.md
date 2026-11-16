# DAYANEXA Identity, Monetization & Payment Architecture
Version: 2.0
Status: Architecture decision baseline — implementation pending
Last reviewed: 2026-11-16

## 1. Executive decisions

DAYANEXA adopts a hybrid, provider-agnostic architecture:

1. Clerk Production is the intended production identity provider, subject to configuration and end-to-end verification.
2. DAYANEXA owns internal profiles, organization membership, roles, permissions, contributor status, approvals, audit and economic records. Clerk is the identity/session provider, not the business authorization database.
3. Xendit xenPlatform is the preferred strategic payment candidate if the platform use case, Indonesian entity eligibility, KYC and product activation are approved by Xendit.
4. Duitku and Midtrans remain alternative payment adapters. Do not assume they provide marketplace split settlement equivalent to xenPlatform.
5. DAYANEXA owns the canonical financial ledger and reconciliation. A gateway transaction status is evidence, not the ledger itself.
6. Do not activate live payments, payouts, automatic split, paid gateway plans or public checkout until entity eligibility, gateway approval, refund/dispute flow, accounting and webhook reconciliation have been tested.
7. Do not hold or describe funds as escrow, wallet balances or safeguarded customer funds unless the legal and provider structure explicitly permits it.

## 2. Hybrid architecture

| Layer | DAYANEXA responsibility | Candidate |
|---|---|---|
| Product/domain core | Demand, opportunity, solution, capability, product, offer, mission, delivery, acceptance | TypeScript domain modules |
| Application/API | Dashboard, API, request validation | Cloudflare Workers + Hono |
| Identity | Sign-in, sessions, recovery, authentication events | Clerk Production |
| Authorization | Roles, permissions, organization scope, contributor eligibility, approvals | DAYANEXA policy engine + D1 |
| Workflow | Canonical business lifecycle, retries, checkpoints, approvals | DAYANEXA workflow core; LangGraph later |
| AI/provider adapters | Inference, search, extraction, specialized collection | Cloudflare Workers AI first, Groq optional/disabled, Tavily, Firecrawl, one of Apify/Scrape.ly |
| Persistence | Transactional state, artifacts, events, usage/cost ledger | D1 + R2; queues as needed |
| Payments | Checkout, payment intents, provider events, refunds, payout requests | Xendit preferred; Duitku/Midtrans alternatives |
| Financial truth | Balanced subledger, reconciliation, settlement liabilities | DAYANEXA Economic Ledger |
| Observability | Logs, traces, policy decisions, provider cost | Internal events first; optional LangSmith later |

Each workspace calls DAYANEXA-owned domain services and capability adapters. Do not create one separate vendor integration per workspace.

## 3. Clerk Production identity

### Clerk's role
Clerk handles sign-up/sign-in, supported social login, session issuance/validation/revocation, account recovery and authentication lifecycle webhooks.

DAYANEXA handles the internal user profile and stable ID, organizations and memberships, platform roles, fine-grained permissions, contributor verification, commercial/payout approvals and audit history.

### Identity mapping
Create an internal identity record with:
- id: immutable DAYANEXA-generated user ID.
- clerk_user_id: unique external identity reference.
- status: pending, active, suspended or closed.
- created_at, updated_at and last_synced_at.
- Only profile fields required by product policy.

Never use email as the primary identity key. Never accept a role or permission from browser metadata. Resolve the authenticated Clerk subject to the internal user record, then evaluate DAYANEXA authorization server-side.

### Webhook and session safeguards
- Verify Clerk webhook signatures using the raw request body and configured signing secret.
- Make webhook processing idempotent using provider event ID.
- Handle user lifecycle and relevant security events.
- Reconcile missed events; do not rely on browser redirects to synchronize identity.
- Redact tokens, secrets and unnecessary personal data from logs.
- Apply least privilege and server-side authorization on every protected API.
- Keep development, preview and production instances/keys separated.
- Test exact custom-domain callbacks, allowed origins, logout, expiry, Google sign-in, account linking and webhook delivery.

Clerk's public pricing currently lists Hobby at $0 with up to 50,000 Monthly Retained Users per application and Pro starting at $20/month when billed annually. Features and limits differ by plan and can change; verify the live dashboard before selecting a plan.
Reference: https://clerk.com/pricing

Production authentication means a production Clerk instance/configuration; it does not mean public launch is approved. Keep registration controlled until abuse controls, terms/privacy, support and operational readiness are complete.

## 4. Monetization architecture

DAYANEXA is not monetized only by charging a commission on human work. It can create and sell products, services, packaged solutions and managed outcomes from validated demand.

### Revenue streams
1. Product revenue — one-time sale of digital or physical products.
2. Package/solution revenue — fixed-scope offers with explicit deliverables and acceptance criteria.
3. Service/implementation fee — setup, integration, customization or delivery.
4. Subscription — recurring access to software, data, workflow or managed capability.
5. Usage-based fee — metered API, automation, execution or consumption.
6. Managed operations — recurring operation of a defined process or outcome.
7. Platform/partner commission — only where a real partner transaction and permitted payment structure exist.
8. Licensing/white-label — rights to use a product, workflow or capability.
9. Outcome-based fee — only when objectively measurable, attributable and contractually defined.

Every offer must define buyer and demand evidence, scope/exclusions, deliverables, acceptance criteria, price/currency/tax treatment, payment schedule, direct execution cost, provider fees, contributor compensation, contingency, refund/cancellation/revision/dispute policy, gross margin estimate, minimum margin and approval requirements.

Do not price solely from competitor prices or model-generated estimates. Validate willingness to pay and actual delivery costs.

### Unit economics
Track gross customer amount, discounts/taxes/gateway fees, net cash received, direct AI/provider costs, contributor/partner compensation, refunds/chargebacks, gross mission margin, contribution margin, settlement liability and unpaid balances.

A mission must not be approved if its budget cap or minimum margin policy is violated without an authorized exception.



## 4A. V2 monetization layers and customer-facing pricing

The following layers define the commercial model. They are separate products and ledger flows; do not bundle them implicitly.

### Layer A — SaaS access subscription

| Plan | Price per 30 days | Requests | AI assists | Seats |
|---|---:|---:|---:|---:|
| Free | Rp0 | 2 | 0 | 1 |
| Pro | Rp149.000 | 10 | 50 | 3 |
| Plus | Rp399.000 | 30 | 200 | 10 |

These are current working hypotheses already represented in the application plan table, not validated market prices. The subscription provides product access, quotas and stated support/priority entitlements. It does not include custom project execution, paid third-party research or contributor compensation unless an accepted quote explicitly says so.

The current application describes 30-day access without automatic renewal. Preserve that posture. A renewal must be an explicit customer decision until an opt-in recurring billing flow is implemented, tested and legally reviewed.

**Required correction:** the current billing implementation uses 30-day subscription periods while usage queries use calendar-month boundaries. Standardize the entitlement window and counters; show the customer the exact reset timestamp and enforce the same rule in UI and API. Enforce AI-assist quotas in the backend, not only by hiding/disabling a button.

### Layer B — One-time project/service charges

| Service | Indicative starting price | Unit |
|---|---:|---|
| Demand Validation | Rp750.000 | per project |
| Solution Sprint | Rp3.500.000 | per sprint |
| Build & Deliver | Rp9.500.000 | per mission |

These starting prices are indicative only. A customer-specific sale requires a versioned quote with scope, assumptions, deliverables, exclusions, timeline, milestones, acceptance criteria, revisions, taxes/fees, payment schedule, expiry and cancellation/refund/dispute terms. The server calculates and snapshots the final price. The client cannot change it.

### Layer C — Managed Operations

Managed Operations starts indicatively at Rp4.900.000/month. It requires a separately accepted service agreement defining included outcomes, scope, cadence, SLA, reporting, responsible operator, dependencies, renewal and termination. The indicative monthly price is not authorization for an automatic recurring charge.

### Layer D — Metered add-ons (future, gated)

Additional request packs, AI assists, research credits, seats, storage/retention, priority handling or additional mission scope may be introduced only after a clear unit price, allowance, cap, warning threshold, tax treatment and explicit purchase confirmation exist. No silent overage, auto-top-up or paid provider spend.

### Layer E — Partner/marketplace economics (future, gated)

Partner commission, platform take-rate, split settlement and partner subaccounts are not part of the first commercial pilot. Enable only after gateway product eligibility, merchant KYC, provider approval, legal fund-flow review, partner agreements and reconciliation tests are documented. Do not advertise escrow or custody. The first pilot remains single-merchant collection with separately approved contributor payout.

### Revenue recognition and customer disclosure

- Subscription access, project revenue, managed-operations revenue, taxes, gateway fees, pass-through funds and contributor payables are distinct.
- Gross customer checkout is not automatically DAYANEXA revenue.
- Quote and contract snapshots must remain immutable after acceptance; changes require a new version and renewed customer acceptance.
- Customer-visible UI must clearly separate plan fee from project/mission fee.
- No automatic renewal, silent overage, hidden platform commission or live payment until owner approval.
- Record willingness-to-pay, conversion, retention, cost-to-serve, refund/dispute and contribution margin to validate each pricing hypothesis.

## 5. Payment provider assessment

### Preferred strategic option — Xendit xenPlatform
XenPlatform is designed for platform/marketplace models with master and sub-accounts, partner onboarding, payment routing, split fees, transfers and payouts.
- Overview: https://docs.xendit.co/docs/xenplatform-overview
- Split payments: https://docs.xendit.co/docs/split-payments
- Sub-account setup: https://docs.xendit.co/xenplatform-global-accounts-setup
- Indonesia Help Center: https://help.xendit.co/hc/id/articles/4408655256589-Bagaimana-Cara-Membuat-Sub-Akun-pada-xenPlatform

Eligibility caveats:
- Sub-accounts require business verification/KYC.
- Owned sub-accounts are disabled by default for Indonesia-based accounts according to Xendit's help documentation; request access if needed.
- Split routing is subject to same-currency and country restrictions. Verify exact Indonesian account configuration and legal structure with Xendit.
- Split payments can fail independently after the original payment succeeds. Reconcile split status and provide controlled manual recovery.
- Refunds do not automatically reverse split fees in all cases; model refund and chargeback allocation explicitly.

Xendit public fees vary by payment method and include payment-method charges, processing fees and payout fees. The public fee table includes Indonesia payout pricing of 1% with minimum IDR 2,500 plus IDR 4,000 processing fee; verify exact applicable product/contract and tax.
Reference: https://www.xendit.co/id/biaya

### Duitku — alternative for payment acceptance and disbursement
Published pricing lists QRIS 0.7%, multiple VA fees, and disbursement methods including BI-FAST at IDR 2,500 and online transfer at IDR 5,000. Documentation states disbursement is available to entity merchants and supports bank/e-wallet destinations. Duitku's pricing FAQ says refunds are handled by the merchant rather than provided as an automatic gateway refund service.
- Pricing: https://www.duitku.com/en/pricing/
- Disbursement docs: https://docs.duitku.com/disbursement-feature/overview/

Duitku may suit a single-merchant MVP with separately controlled contributor settlement, subject to merchant onboarding and contract approval. Do not treat it as a native marketplace split solution.

### Midtrans — alternative for broad payment acceptance
Published prices include VA at IDR 4,000, QRIS at 0.7%, and bank payout at IDR 5,000, subject to applicable tax and terms. Midtrans is a candidate for single-merchant collection and payout; do not assume a dedicated sub-merchant split-payment product equivalent to xenPlatform.
- Pricing: https://midtrans.com/pricing

### Faspay and other providers
Keep Faspay behind the same adapter interface if future commercial, channel or merchant eligibility makes it competitive. Before ranking it, obtain current written pricing, settlement schedule, refund/chargeback terms, payout capabilities, marketplace/sub-merchant support, KYC requirements, API/webhook quality and contract eligibility.

## 6. DAYANEXA payment architecture

### Core entities
PaymentProvider, ProviderAccount, PaymentIntent, PaymentAttempt, ProviderTransaction, PaymentEvent, Refund, Dispute, PayoutRequest, Settlement, SettlementItem, FeeRecord, LedgerAccount, LedgerEntry, ReconciliationRun and FinancialApproval.

Provider IDs are external references. DAYANEXA IDs remain canonical and immutable.

### Payment lifecycle
DRAFT → AWAITING_CUSTOMER_AUTHORIZATION → PAYMENT_CREATED → PENDING → SUCCEEDED / FAILED / EXPIRED → RECONCILIATION_PENDING → RECONCILED.

Refund lifecycle:
REFUND_REQUESTED → REFUND_APPROVAL_PENDING → REFUND_SUBMITTED → REFUND_PENDING → REFUNDED / REFUND_FAILED.

Dispute lifecycle:
DISPUTE_OPENED → EVIDENCE_REQUIRED → UNDER_REVIEW → WON / LOST / CLOSED.

Payout lifecycle:
PAYOUT_DRAFT → ELIGIBILITY_CHECK → APPROVAL_PENDING → APPROVED → SUBMITTED → PENDING → PAID / FAILED → RECONCILED.

A payment success webhook must not directly mark a mission accepted or contributor paid. Customer acceptance, payment verification, settlement eligibility and payout are distinct events.

### Webhook security and reconciliation
- Verify provider signatures and timestamps.
- Store raw event reference and normalized event separately; restrict raw payload access.
- Deduplicate by provider event ID and transaction ID.
- Handle out-of-order and repeated events.
- Never trust a browser redirect as proof of payment.
- Confirm payment through a signed webhook and/or server-side provider API lookup.
- Compare provider settlement reports with DAYANEXA ledger.
- Maintain an operator queue for unknown, delayed, mismatched or duplicate events.
- Require explicit approval for manual financial adjustments.
- Never log full bank account numbers, payment tokens or sensitive personal data.

### Ledger invariants
- Use integer minor units (IDR whole rupiah) and explicit currency.
- Every posted journal must balance; corrections use reversing/adjusting entries, not destructive edits.
- Keep pending, available, reserved/committed and paid states distinct.
- Customer cash receipt, platform revenue recognition, provider fee, contributor payable and payout are separate ledger events.
- Gross checkout amount is not automatically DAYANEXA revenue.
- A payout request is not a successful payout.
- Every financial event links to a source transaction, mission/offer where relevant, actor, timestamp and audit event.

## 7. MVP payment posture

### Phase 0 — no live money movement
Build provider contracts, mock gateway and webhook simulator; build ledger, payment lifecycle and reconciliation UI; test duplicate, delayed, invalid-signature, out-of-order, refund, payout-failure and mismatch cases. No live API key and no customer checkout.

### Phase 1 — single-merchant controlled pilot
Complete legal/business and gateway onboarding. Select one collection gateway based on actual approval and fees. Collect payment into the approved merchant account. Keep contributor settlement as a separate approved payout workflow. Use low limits, manual review and reconciliation. Do not advertise escrow or automatic split.

### Phase 2 — platform/partner settlement
Apply for Xendit xenPlatform and required sub-account activation. Complete partner KYC and legal review. Implement split/payout adapter and webhook reconciliation. Test failed split, refund, chargeback, partner suspension and account closure. Enable only after written confirmation of the permitted fund flow.

## 8. Activation checklist

### Clerk Production
- [ ] Production instance selected and domain configuration reviewed.
- [ ] Exact sign-in/sign-up and callback URLs configured.
- [ ] Google/social connection verified.
- [ ] Production secret keys stored only in server-side secret store.
- [ ] Webhook signing secret configured and signature tests pass.
- [ ] Internal identity mapping and authorization policies implemented.
- [ ] Session expiry, logout, account linking, suspension and deletion tested.
- [ ] Preview and production credentials/data isolated.
- [ ] Registration controlled/invite-only until launch approval.

### Payment gateway
- [ ] Merchant entity and website/business model accepted by provider.
- [ ] KYC and bank account verified.
- [ ] Fees, taxes, settlement schedule, limits and reserves confirmed.
- [ ] Refund, chargeback and dispute responsibilities documented.
- [ ] Marketplace/sub-account/split eligibility confirmed if needed.
- [ ] Webhook signatures, idempotency and reconciliation tested.
- [ ] Ledger invariants and payout approval tested.
- [ ] Terms, privacy, cancellation and refund policy published.
- [ ] Live transactions enabled only after operator approval.

## 9. Official references
- Clerk pricing: https://clerk.com/pricing
- Xendit xenPlatform overview: https://docs.xendit.co/docs/xenplatform-overview
- Xendit split payments: https://docs.xendit.co/docs/split-payments
- Xendit sub-account setup: https://docs.xendit.co/xenplatform-global-accounts-setup
- Xendit pricing: https://www.xendit.co/id/biaya
- Duitku pricing: https://www.duitku.com/en/pricing/
- Duitku disbursement: https://docs.duitku.com/disbursement-feature/overview/
- Midtrans pricing: https://midtrans.com/pricing
