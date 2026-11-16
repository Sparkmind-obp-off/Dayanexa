# DAYANEXA — Member Discovery Privilege & Real-Demand Access

**Status:** Binding product and entitlement contract. Source implementation, provider funding, tests and production activation must be tracked independently.
**Applies to:** Every eligible active member account, including Free-plan members.

## 1. Principle

Every eligible member receives a baseline Member Discovery Privilege as part of DAYANEXA product access. It is a product entitlement, not a promotional gift, discretionary owner favor, role upgrade or email-specific exception. Entitlement is assigned by plan and active organization membership. Every member under the same plan and policy is treated consistently.

The privilege gives members a genuine opportunity to collect and inspect evidence from permitted public sources through DAYANEXA-managed provider resources. It does not promise unlimited scraping, guaranteed demand, guaranteed income or unrestricted paid capacity.

## 2. Free-plan baseline

Recommended launch policy:
- One guaranteed real-data exploration per eligible active Free member per rolling 30-day period, provided at least one approved source/provider route is operational and funded.
- One additional exploration may be granted in the same period only when verified shared provider capacity and approved program budget have sufficient headroom. Thus Free has one guaranteed run and up to two when the conditional bonus is funded.
- This is a versioned, configurable plan policy, never an email-specific rule.
- One run means one accepted, metered discovery job with a defined source/Actor, input scope, item/page cap, timeout, concurrency and maximum cost.
- An idempotent retry of the same failed job does not consume a second entitlement. A materially new job does.
- Show remaining allowance, reset time, source coverage, run cap and any reason a conditional second run is unavailable.
- If no approved route or funded capacity is available, show the entitlement as pending/unavailable; do not falsely claim it was fulfilled or silently charge the member.

A run is an opportunity to conduct bounded research, not a guarantee of useful results. DAYANEXA selects an eligible route within approved policy and budget.

## 3. Real-data qualification

A qualifying run must accept a discovery brief (topic/problem, market/geography, audience, keywords/filters and purpose), use an approved real external source/provider, record source identity and permitted URL/reference, collection time, method, provider/Actor/version and run ID, enforce permission/privacy/retention/rate limits, reserve resources before dispatch, and return an honest result including empty, partial or failed outcomes.

No synthetic records, fabricated conversations, fixture data or demo results may be represented as live findings. Search results and posts are signals, not automatically validated demand. Preserve evidence provenance and distinguish raw signals, extracted evidence, inferred hypotheses and human-validated demand. Never fabricate customers, intent, demand volume, willingness to pay, jobs, income or opportunity.

## 4. Eligible source families and restrictions

The curated catalog may include public Threads posts, public community/group discussions, public forums and Q&A, public web pages, business websites/listings/directories and approved search results—only when the exact collection method is permitted by the source platform, provider terms and applicable law.

Private or access-restricted groups are not automatically eligible. Never bypass login walls, membership requirements, privacy settings, CAPTCHAs, technical controls, rate limits or platform restrictions. Never collect private messages or non-public member content. A member-supplied group URL does not establish permission. If permission or commercial-use rights are unclear, reject or route for review.

For Threads and other social/community platforms, use only an API/Actor and collection mode whose current documentation, access rights and terms have been reviewed. Marketplace availability of an Actor is not proof of permission or commercial-use rights. No spam, unsolicited outreach, joining closed groups or posting/messaging on behalf of members is part of discovery.

## 5. Provider and Actor resource model

DAYANEXA centrally manages provider accounts and curated Actors. Members receive scoped product access, not provider credentials or global Actor administration.

Potential adapters include Tavily for search/source discovery, Firecrawl for permitted crawling/extraction, Apify for reviewed Actors, and Scrape.ly for reviewed tasks. Other providers require review.

For every Apify/Scrape.ly Actor, maintain exact provider and Actor/task ID, version, supported source, reviewed README/terms, input schema, output mapping, source permission assessment, commercial-use status, pricing model, compute/proxy/storage/dataset costs, maximum items, timeout, concurrency, per-run cap and approval expiry. Do not expose the entire marketplace or allow arbitrary Actor IDs from members. Default to Apify OR Scrape.ly per source/task; use both only after benchmark and owner approval. An advertised free trial or Actor price does not mean DAYANEXA has permission or budget to run it.

Never expose API keys, cookies, session tokens or provider credentials to the browser/member.

## 6. Spend and quota guardrails

Every provider call must pass through the Provider Runtime Gateway. Before dispatch, resolve member, tenant, plan, entitlement, purpose, source, data class and Actor; verify the entitlement is available; verify exact source permission; select an active independently authorized account; check fresh provider quota, rate limits, price, plan eligibility and health; calculate maximum units/cost; and atomically reserve the member run, provider usage and DAYANEXA program budget. Reject before network dispatch if any permission, quota, price or funding state is unknown, stale, unauthorized or over cap.

After dispatch, persist provider request/run ID, Actor/version, idempotency key, status, timestamps, provenance and estimated/reserved/actual units and cost. Reconcile actual usage and release unused reservations. Apply fair entitlement accounting for pre-dispatch failures, idempotent retries, cancellations and partial results. Audit denials, approvals, dispatches, failures, cancellations and reconciliation with secrets redacted.

**No silent paid use:** paid Actor execution, paid proxies, overage, top-up and paid fallback are OFF unless the owner explicitly approves a bounded allocation specifying provider/account, exact capabilities/Actors/sources, currency, maximum spend, period and expiry. The Free entitlement is funded only from a separately approved DAYANEXA allocation or verified no-cost allowance; it never authorizes charging a member or the platform without approval.

If capacity is exhausted or unknown, stop/defer and show reset/review state. Never rotate accounts to evade limits, bans, 429s, trial restrictions or provider terms. Multiple keys on one account do not multiply quota.

## 7. Member experience and fairness

Every eligible member can open Discovery from the member-facing V3 workspace, create a brief, choose from approved source families/recipes, see allowance and funding class before starting, run bounded real-data research, inspect own run history/evidence/provenance/errors/remaining allowance, and use evidence in their own demand hypotheses and opportunity assessments.

Entitlement applies consistently by plan/policy and active membership, not email or favoritism. Apply per-member, per-organization, per-Actor, per-source and global caps. Shared budgets require transparent reservation and allocation so one tenant cannot exhaust the pool. Owner/admin may pause an unsafe or exhausted source globally, but unused member entitlement remains unused and the pause is explained. All member runs and evidence are tenant-scoped.

## 8. Privacy, provenance and governance

Respect source terms, commercial-use restrictions, privacy laws, platform policies, copyright, opt-outs and retention. Minimize personal data; avoid sensitive personal information and discard unnecessary identifiers. Separate permission to collect from permission to republish, contact, sell, profile or otherwise reuse content. Keep source provenance, evidence confidence, collection timestamp and provider/Actor version. Require human review where permission, commercial-use rights, sensitive data or interpretation is uncertain.

## 9. Canonical data and policy concepts

Map to existing canonical entities where possible; do not duplicate models:
- MemberDiscoveryPolicy: plan, policy version, rolling period, guaranteed runs, conditional bonus runs, reset semantics, run dimensions and status.
- MemberDiscoveryEntitlement: member/organization scope, period, granted, reserved, consumed, remaining, state and policy version.
- DiscoveryBrief; DiscoveryJob/SourceRun; ActorRegistryEntry/ActorVersion.
- UsageReservation, ProviderUsageEvent, CostReconciliation and DiscoveryProgramBudget.
- Source/Evidence with provenance, source reference, timestamps, classification and tenant scope.
- AuditEvent with actor, tenant, decision, source, provider, action and reason.

Use existing entities when equivalent and add only audited additive migrations. Documentation does not create a live entitlement.

## 10. Acceptance criteria

1. Every eligible active Free member receives the same policy-driven privilege without role elevation or email-specific logic.
2. Free receives one guaranteed real-data exploration per rolling 30 days and may receive one additional run only when verified shared capacity and approved program budget permit.
3. A qualifying run collects actual permitted external data through a reviewed provider/Actor and persists traceable provenance.
4. Demo fixtures cannot be mistaken for live data; signals are not labelled validated demand.
5. Members cannot run arbitrary Actors, access provider credentials, bypass caps or inspect another tenant's data.
6. Concurrent runs cannot overspend member entitlement, Actor cap, provider quota or program budget.
7. Unknown/stale quota, price, permission or funding blocks dispatch before network call.
8. No paid spend occurs without explicit bounded owner approval; no member is silently charged.
9. Retry, failure, cancellation, reset, partial result and exhaustion have correct entitlement accounting and clear UI states.
10. Usage/cost is reconciled and decisions are audited.
11. Tests cover source allowlists, restricted-source denial, tenant isolation, fairness, concurrency, idempotency, quota exhaustion, paid-use denial, 429 and no account rotation.
12. Production activation remains pending until source, tests, provider terms, budget approval, migrations and deployment are independently verified.

## 11. Implementation sequence

Audit existing discovery routes, migrations, provider gateway, Actor registry and plan resolver; implement policy and atomic entitlement reservations; curate sources/Actor recipes and permission review; build member Discovery UI and tenant-scoped APIs; integrate real providers only through the gateway; implement usage/cost reconciliation and audit; add deterministic tests and opt-in, capped, owner-approved provider smoke tests; update the source audit with implemented/tested/blocked/production-verified states separately.

**Non-negotiable:** A real, bounded opportunity for every member to discover real demand is required. Static UI, sample data, mocked Actors, documentation-only promises or unmetered provider calls do not satisfy this contract.
