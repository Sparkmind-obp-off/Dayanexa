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


## 12. Omni-Channel Demand Discovery — member-controlled source selection

Member Discovery must support a flexible, expandable source catalog and three discovery modes. It must not be limited to a fixed set of hard-coded channel buttons.

### 12.1 Three discovery modes

1. **Single-channel:** member selects one channel/source family and optionally a specific public community, subreddit, page, forum, topic or search scope.
2. **Multi-channel:** member selects multiple channel/source families for one coordinated discovery campaign. DAYANEXA runs eligible source tasks, normalizes results, deduplicates cross-channel evidence and compares demand signals.
3. **Omni / automatic:** member provides the demand brief and desired market/category; DAYANEXA recommends and selects the most relevant eligible channels based on source coverage, relevance, permission, provider readiness, available quota, cost and evidence diversity. Show the proposed channels and reasons before dispatch where practical; never silently select an unapproved paid route.

The member can start with one channel and later expand the same brief to more channels, subject to remaining allowance and resource caps.

### 12.2 Channel and community catalog

Provide a discoverable, searchable, extensible catalog of source families and their available public subspaces. Initial examples:
- Threads: public posts, topics, keywords and permitted public conversation sources.
- Reddit: relevant public subreddits and public discussions.
- Facebook: public pages, public posts and public groups only where the precise collection method is permitted.
- YouTube: public videos and accessible public comments/discussions where permitted.
- Web: public forums, Q&A, directories, business websites, public listings and other public pages.
- Additional platforms and specialist communities can be added through reviewed source adapters without redesigning the member workflow.

Catalog entries should expose platform, source type, topic/category, public/private/access status, geography/language, supported discovery intents, provider/Actor route availability, permission/commercial-use review status, freshness, limitations and availability. Do not list an unreviewed source as runnable. Support search by platform, topic, industry, geography, community name and demand category. Support member-supplied public URLs as discovery hints, but validate reachability and permission before collection.

### 12.3 Demand intent and category taxonomy

Members should be able to describe their own intent and optionally select one or more categories, including:
- Service needs and unmet service demand.
- Product needs, product gaps and purchase friction.
- Customer complaints, recurring pain points and workarounds.
- MSME/business operations, marketing, sales and administration needs.
- Software, automation, AI and digital-tool needs.
- B2B procurement, suppliers and operational needs.
- Local/community needs by geography.
- Education, skills and training needs.
- Employment/task/work demand signals, without representing public posts as verified vacancies.
- Other / custom demand brief.

Categories are navigation and classification aids, not restrictive silos. Natural-language briefs and custom keywords must remain supported. DAYANEXA may infer additional categories but must label them as inferred and preserve the member's original intent.

### 12.4 Campaign and quota semantics across channels

A multi-channel or omni search is one **Discovery Campaign** containing one or more source-specific child jobs. The Free baseline of one guaranteed campaign per rolling 30 days (plus one conditional campaign when funded capacity allows) applies to the campaign, not one free run per selected channel. This prevents quota multiplication by selecting many channels.

Each campaign has a visible total resource ceiling and child-job limits: maximum channels, Actors, pages/items, duration, concurrency and estimated/actual provider units/cost. The exact limits are configurable by plan and approved program budget. A campaign must reserve its total bounded resource envelope before dispatch, then reserve/reconcile child tasks atomically. If the campaign cannot fit within available quota or budget, explain which channels are unavailable and offer a smaller compliant scope; never silently exceed limits.

The member can choose:
- One channel.
- Multiple named channels/communities.
- Recommended channels for a category or brief.
- Omni automatic selection.

The member cannot select arbitrary Actor IDs or override provider caps. DAYANEXA resolves each selected source to a reviewed adapter/Actor. If one channel fails, report partial results honestly; do not silently substitute a paid provider or unauthorized source.

### 12.5 Unified evidence and cross-channel intelligence

Normalize source-specific output into canonical Source, Signal and Evidence records while retaining original provenance. Deduplicate identical or near-identical content across channels, identify cross-channel corroboration, distinguish independent sources from reposts, preserve timestamps and links, and avoid treating repeated copies as independent demand. Present:
- Findings grouped by channel/community.
- Common pain points and demand themes.
- Differences between communities or geographies.
- Evidence count and independent-source count separately.
- Confidence, recency, source coverage and limitations.
- Signals versus inferred demand hypotheses versus validated demand.

A campaign summary must not claim market-wide prevalence from a small or biased sample. Report sampling limitations and unavailable channels.

### 12.6 Safety and source eligibility

Channel selection never overrides source access restrictions. Public pages/groups/communities are eligible only when the exact API/Actor method, account access and intended use are permitted. Private groups, closed communities, private messages and access-controlled content are excluded unless a separately reviewed lawful authorization path is explicitly implemented; no bypassing membership, login, CAPTCHA, anti-bot control, rate limit or platform terms. A URL submitted by a member is not proof of permission. No arbitrary Actor marketplace execution, credential exposure, unsolicited outreach or automated posting/messaging.

### 12.7 Additional acceptance criteria

13. Member can launch single-channel, multi-channel and omni campaigns from one Discovery workflow.
14. Channel catalog is searchable/extensible and includes reviewed public community/source entries, not only platform-level names.
15. Member can specify demand categories, natural-language briefs, keywords and geography, or choose a category-first workflow.
16. Omni mode recommends/selects sources using relevance, permission, readiness, quota and cost; it does not imply every platform is always available.
17. A multi-channel campaign consumes one campaign entitlement, with child tasks bounded by a single pre-reserved campaign resource envelope.
18. Cross-channel evidence is normalized and deduplicated while retaining channel provenance and independent-source counts.
19. Selecting many channels cannot multiply Free quota or bypass provider/program budgets.
20. A member-supplied URL or community name is validated before collection; restricted or unreviewed sources are rejected or sent for review.
