# DAYANEXA — Provider Runtime Governance & Account Failover

**Version:** 1.0  
**Date:** 16 November 2026  
**Authority:** DAYANEXA V3 Master System and Admin & Resource Control Center  
**Status:** Canonical design requirement. Runtime enforcement implemented in source (`apps/api/src/providers/gateway.ts`, migration 0008, `tests/gateway.test.ts`) — see docs/24 §B. Not production-verified until migration 0008 is applied and deployment parity is proven.

## 1. Purpose

Turn the Provider Registry and Actor Registry into an enforceable runtime control plane. DAYANEXA must know which provider account/credential profile is eligible for a task, what allowance and budget remain, whether the account is healthy, and whether an alternative may legally and contractually be used.

A registry row alone does not enforce anything. Every outbound provider call must pass through the same server-side policy gate and usage accounting path.

## 2. Core safety invariants

1. **Fail closed:** if quota, cost, account status, provider terms, permission, or remaining budget cannot be verified, do not make the external call.
2. **No silent paid use:** paid usage, overage, top-up, subscription, proxy spend, storage/compute charges and paid fallback are disabled unless the owner explicitly approves the exact provider/account, scope, cap, period and effective window.
3. **No limit evasion:** account rotation is not a way to bypass provider rate limits, free-tier restrictions, account suspensions, trial limits, identity restrictions or terms. Use another account only when the provider permits multiple accounts/keys for the stated purpose and the account is independently authorized.
4. **Account separation:** one provider may have multiple registered account profiles, but each profile has its own identity, plan, quota, usage, billing status, credential reference, terms review and health state. Never assume limits pool across accounts.
5. **No invented free quota:** free allowance is recorded only from an official provider source or verified account dashboard, with source, retrieval/verification timestamp, reset timezone/window and confidence. Unknown means zero usable allowance for automated execution.
6. **Reserve before call, reconcile after:** atomically reserve the maximum known/estimated units and cost before dispatch; reconcile actual usage after response. If reservation cannot be made, no call.
7. **One canonical policy path:** UI, API route, queue worker, scheduled task and agent tool must use the same runtime gateway. No direct adapter invocation may bypass it.
8. **Traceability:** every decision, reservation, dispatch, response, error, fallback and reconciliation is recorded with provider/account/Actor, policy version, task, tenant, mission, idempotency key and cost provenance. Never log secret values.

## 3. Provider and account model

Separate the logical Provider from its AccountProfile and CredentialReference.

- **Provider:** vendor and capability family, e.g. Workers AI, Groq, Tavily, Firecrawl, Apify, Scrape.ly.
- **AccountProfile:** provider account identity label, environment, plan, region, billing state, allowed capabilities, terms/permission review, quota windows, rate limits, account status and owner.
- **CredentialReference:** secret-manager binding/name only; never the secret itself. Credentials remain in Cloudflare Worker secrets or the approved secret manager.
- **ProviderPolicy:** enabled state, task/capability allowlist, priority, daily/monthly unit caps, hard spend caps, per-request cap, concurrency, timeout, retry policy, allowed fallback set and paid-use approval.
- **QuotaSnapshot:** allowance, consumed, reserved, remaining, reset time/timezone, source, verified_at, freshness and confidence. Separate provider-reported quota from DAYANEXA's own budget.
- **UsageReservation / UsageEvent / CostReconciliation:** immutable records for pre-call reservation, observed consumption and final cost.
- **FallbackRule:** explicit task scope, source/provider compatibility, eligible account IDs, ordering, trigger conditions, terms authorization, budget requirements, approval and expiry.

Multiple API keys under one provider account are not independent accounts and must not be counted as multiplied free quota.

## 4. Runtime request lifecycle

Every provider operation follows this sequence:

1. Receive a typed internal task request. The caller cannot supply an arbitrary account, secret, model, Actor ID, provider URL or budget override.
2. Resolve tenant, mission, task, purpose, data classification, environment and required capability.
3. Load active ProviderPolicy and approved AccountProfiles; verify policy version and authorization.
4. Check credential reference exists without reading/exposing it to the client.
5. Check account/provider health, terms/permission status, capability compatibility and allowed region/data handling.
6. Check fresh quota snapshot and DAYANEXA daily/monthly/per-request hard caps. Check rate/concurrency limits.
7. Compute a conservative upper-bound reservation from known pricing and expected input/output/compute. If price or quota is unknown, do not run automatically unless an explicit owner-approved fixed hard cap safely bounds the exposure.
8. Atomically reserve units and currency budget with an idempotent transaction/lock. Reject if reservation would exceed any limit.
9. Dispatch through the provider adapter using the selected account credential on the server.
10. Persist request ID, status, timestamps, provider-reported usage, response metadata and retryability. Redact sensitive payloads according to retention policy.
11. Reconcile reserved versus actual units/cost. Release unused reservation; charge actual consumption to the correct provider account, tenant, mission and task.
12. Update quota snapshot and health/circuit-breaker state. Emit audit/metrics and expose a clear operator/customer-safe status.

A timeout with unknown provider-side completion is an ambiguous charge state: do not blindly retry. First query provider run/request status or reconcile using idempotency. If impossible, mark it as unknown_charge, retain the reservation/capacity hold and require safe resolution.

## 5. Quota and limit semantics

Track independent limit dimensions; do not collapse them into a single generic "credits" field:

- Provider plan allowance: requests, tokens, neurons, credits, pages, compute units, proxy usage, storage, bytes or other provider-defined units.
- Provider rate limits: requests per second/minute, concurrency and burst limits.
- DAYANEXA operational caps: per request, daily and monthly units and hard currency cap.
- Mission/task budget: maximum cost allocated to this work.
- Account billing controls: free/trial/paid state, billing enabled/disabled, payment method status where observable, overage and top-up state.
- Reset period: provider-local reset timestamp and timezone, not assumed to be Asia/Jakarta.
- Confidence/freshness: provider API/dashboard verified, official published allowance, stale snapshot, estimated or unknown.

When a quota is exhausted or reaches a configured safety threshold:
- stop dispatching to that account for the affected capability/window;
- mark the account/capability quota_exhausted or paused_by_policy;
- persist next reset time if verified;
- notify Admin Control Center and show the reason/source;
- do not change account, plan or payment settings;
- do not retry through another account unless an explicit valid FallbackRule allows it.

A rate-limit response (429) triggers bounded backoff and provider-defined reset handling. Repeated 429s open a circuit breaker. Do not rotate accounts to evade a rate limit.

## 6. Permitted account selection and fallback

Fallback is an allowlisted routing decision, not an automatic escape hatch.

A candidate account is eligible only if ALL are true:
- it is registered, active, healthy and has a valid credential reference;
- the exact task/capability/source is approved for that account;
- account ownership/authorization and provider terms permit this use and multi-account arrangement;
- it has a fresh enough quota snapshot and sufficient remaining quota;
- its daily/monthly/per-request and mission budget reservations succeed;
- its region, privacy, data retention and security properties are compatible;
- its cost class is allowed (free or specifically owner-approved paid);
- it is not suspended, rate-limited, quota-exhausted or circuit-open.

Fallback may occur only for configured recoverable triggers (e.g. provider outage or capability unavailability), not for a provider ban, policy denial, terms restriction, suspicious activity, account suspension or rate-limit evasion. The system must never use a new account to circumvent a provider-imposed restriction.

If no eligible account exists, stop and return a typed provider_unavailable, quota_exhausted, budget_exceeded, approval_required or policy_denied result. Queue/defer the task only when its workflow permits; otherwise request owner/operator review. Do not silently downgrade quality or switch data-processing region.

## 7. Initial provider-specific policy

- **Cloudflare Workers AI:** primary inference. Use the account's verified Neurons allowance and model-specific rate/availability. Track model ID, Neurons and account billing state. No silent paid model, Workers Paid overage or AI Gateway Unified Billing.
- **Groq:** optional inference adapter, disabled by default. It is not an automatic fallback for Workers AI.
- **Tavily:** search/discovery only. Track request/credit units, search depth/features and plan limits from the current account. A search result is not verified demand.
- **Firecrawl:** crawl/extraction only. Track pages, crawl depth, concurrency and plan credits. A successful extraction is not demand validation.
- **Apify:** Actor execution platform. Track each account and each Actor separately, including Actor ID/version, compute units, proxy, storage, dataset and other chargeable components. Actor approval and per-run hard cap are mandatory.
- **Scrape.ly:** alternative specialized extraction platform. Track its actual account plan and task-specific unit/pricing model. It is not assumed equivalent to Apify.
- **Apify vs Scrape.ly:** choose one per source/task by benchmark and terms review. Use both only when an owner-approved benchmark demonstrates a valid reason and both costs are separately capped.

Provider plan quotas and prices change. Never hardcode an advertised free quota as guaranteed. Verify the current official pricing/terms and actual account dashboard before enabling the provider. A free allowance can be changed, revoked or exhausted by account-level usage outside DAYANEXA.

## 8. Owner controls in Admin & Resource Control Center

The dashboard must provide:
- account profile list and status (secrets hidden);
- plan/billing state and quota source/freshness;
- provider-reported allowance, consumed/reserved/remaining;
- DAYANEXA daily/monthly unit and hard-spend caps;
- per-request and mission caps;
- free-only / paid-disabled state;
- provider and account pause/resume;
- fallback allowlist and reason;
- next reset, 429/circuit status, last successful health check;
- recent reservations, calls, failures, actual usage and reconciliation exceptions;
- approval queue for paid-use enablement, budget increases and new account activation.

Default values: provider disabled until configured and verified; paid usage false; paid fallback false; auto top-up false; account rotation false unless a compliant explicit fallback rule exists. An owner action must record actor, before/after values, reason, scope, timestamp, expiry and approval evidence. No UI action can alter provider billing settings directly.

## 9. Operational failure handling

- Missing credential: block before call; do not leak which secret is missing to customers.
- Stale/unknown quota: pause automatic use or require owner approval under a fixed bounded cap.
- Budget reservation race: use atomic conditional update/transaction; one concurrent request must not overspend the last allowance.
- Provider 429: respect retry-after/reset, bounded retry and circuit breaker; no account rotation to evade.
- Provider 5xx/network outage: retry idempotently within budget; optionally use only an approved compatible fallback.
- Provider 4xx invalid input/permission: do not retry unchanged; record schema or policy error.
- Unknown charge: retain reservation and reconcile before retry.
- Cap exhausted: hard stop before external request.
- Policy service/D1 unavailable: fail closed for paid or quota-metered external operations.

## 10. Security, compliance and privacy

Provider credentials never enter browser code, logs, Actor input, prompts or user-visible errors. Secret rotation remains in Cloudflare/provider consoles. Use least privilege, account-scoped credentials, environment separation, redaction, encrypted storage, retention limits and audit. Respect provider terms, source permissions, platform rules, privacy law, rate limits and account restrictions. Do not create or use multiple accounts to evade restrictions or obtain extra free trials/credits.

## 11. Required implementation and acceptance tests

Before marking runtime governance complete, prove:
- every provider adapter call passes through the policy gateway;
- unauthorized/disabled/unverified account is blocked before network dispatch;
- exact quota, per-request, daily, monthly and mission caps are enforced;
- atomic concurrent reservations cannot overspend;
- usage reconciliation handles success, partial response, failure, timeout and unknown charge;
- no free allowance is invented and stale/unknown quota fails closed;
- paid use, overage, top-up and paid fallback remain off without explicit owner approval;
- a compliant approved fallback can select only an allowlisted eligible account;
- 429, ban, suspension, terms denial and rate-limit conditions do not trigger account rotation;
- provider outage fallback is bounded, idempotent, auditable and cost-capped;
- no secret is returned to UI/logs;
- usage/cost is attributable to account, provider, Actor, task, mission and tenant;
- owner policy edits are audited and maker-checker rules are applied where required.

## 12. Implementation sequence

1. Audit all existing provider adapters and locate every call site; create an adapter inventory.
2. Define additive D1 schema for account profiles, policies, quota snapshots, fallback rules, reservations, usage events, reconciliations and approvals.
3. Build a single server-side Provider Runtime Gateway and atomic budget reservation service.
4. Wrap Workers AI, Groq, Tavily, Firecrawl, Apify and Scrape.ly adapters; remove/ban direct call paths.
5. Add account-aware Actor dispatch and per-run budgets.
6. Add quota refresh adapters where official APIs support them; otherwise require timestamped manual verification and visibly mark confidence.
7. Add Admin UI for policy/account/fallback controls with owner-only server authorization.
8. Add observability, reconciliation jobs, alerting and runbooks.
9. Prove acceptance tests in CI and provider sandbox/low-cost smoke only after owner approval.

Production D1 migrations, secret changes, provider activation, paid use, external account connection and production deployment remain gated by explicit owner approval. Documentation or UI completion is not runtime enforcement proof.
