# DAYANEXA V3 — Demand Discovery Engine

**Version:** 3.0 · **Layer:** 1 of 5 · **Authority:** `docs/18-demand-to-execution-architecture-v3.md`

## 1. Mission

Find real, externally expressed needs across permitted sources, based on a user-defined research brief. Preserve enough provenance for another person to open, inspect and challenge each finding. The engine discovers signals; it does not declare commercial validation.

## 2. User workflow

A user creates a Discovery Brief with:
- Research question, topic, niche/sub-niche and problem keywords.
- Source selection: web search, selected websites, public social sources, communities, first-party customer/support data, public procurement or authorized partner feeds.
- Geography, language, date range, freshness/recency and result limit.
- Exclusions, source permissions, data purpose and retention.
- Desired output: raw signals, niche groups, demand clusters or a research report.
- Maximum runs/items, per-run budget, daily/monthly budget and whether owner approval is required.

The UI must show the estimated cost, free/paid source status, actor/provider, data scope and expected limits before execution. User submits; the job receives an ID and appears in history with queued/running/partial/completed/failed/cancelled status.

## 3. Source registry and connector contract

Every source is registered with source ID, name, source class, canonical domain/platform, allowed purposes, access method, permission/terms reference, supported query modes, geography/language coverage, freshness, retention, rate limits, attribution rules, provider adapter, status, owner and last verification.

A connector adapter must implement:
- `validateBrief()`: reject unsupported sources, invalid date ranges, unsupported filters and disallowed purposes.
- `estimateUsage()`: estimate provider credits, Actor compute, proxy/storage and maximum items.
- `searchOrCollect()`: bounded call using the approved source access method.
- `normalize()`: map results into a stable signal contract.
- `healthCheck()`: return configured/available/degraded/disabled and dated evidence.
- `reconcileUsage()`: store actual credits/cost, provider run ID and variance from estimate.

Do not expose a provider token to the browser. Do not allow arbitrary Actor IDs or arbitrary user-supplied actor input to bypass the registry.

## 4. Actor registry

Each Apify/Scrape.ly Actor must be reviewed before it can run:
- Actor ID, owner/publisher, version and source coverage.
- README and input/output schema reviewed and archived by version/hash.
- Current platform access method and terms reviewed.
- Required input fields, safe defaults and maximum result limit.
- Output mapping and validation rules.
- Pricing basis, compute, proxy, storage and maximum charge.
- Personal data/copyright risks, rate limits and failure modes.
- Benchmark results by source and task: completeness, freshness, accuracy, duplicate rate, latency, cost/item, error rate and policy compliance.
- Reviewer, approval date, expiry/re-review date and allowlist state.

A benchmark run is not a production selection. The selected actor is a versioned configuration, not a free-form user string. Never run Apify and Scrape.ly in parallel for the same job simply to increase volume.

## 5. Signal contract and provenance

Minimum signal fields:
- Signal ID, organization/owner, source ID and source class.
- Canonical URL or platform-native post/thread identifier, title/text excerpt, language and content hash.
- Published time (if provided by source), observed/captured time, extraction time.
- Author identity only when public, necessary and allowed; otherwise pseudonymous/source reference.
- Provider ID, actor ID/version, provider run ID, collection method and request ID.
- Query/brief ID, source permission/terms version, retention deadline.
- Content integrity status, duplicate group and normalized fields.

Keep raw payloads only where permitted and necessary; otherwise retain excerpt, hash and source pointer. Never invent missing publication dates or authors.

## 6. History and scheduling

Users can view and compare discovery runs, filters, source coverage, failures, cost, signals created, duplicates and exportable results. Saved briefs may be rerun manually. Scheduled monitoring is a separate opt-in feature with explicit cadence, stop date, source quotas and spending ceiling; no recurring paid runs by default.

Historical collection means only history the source/provider is authorized and technically able to return. A search engine's indexed date or a scraper's crawl date must not be represented as the original post date.

## 7. Source-specific rules

- **Web search:** Tavily discovers URLs and excerpts; record query, returned URL, title, snippet, published time if available, score and credits.
- **Website extraction:** Firecrawl extracts selected public URLs only after URL/SSRF validation and source permission checks.
- **Threads and social platforms:** require a verified official/authorized connector or a specifically reviewed Actor that currently supports the requested public content. Verify whether it supports posts, replies, thread context, date filters, language, pagination and historical depth. If unsupported, show the limitation and do not fabricate results.
- **Communities/forums:** follow each platform's public API, terms, robots and rate limits; do not bypass login, private groups or access controls.
- **Customer and partner sources:** require explicit account authorization and tenant-scoped connector permissions.

## 8. Quotas and cost controls

Preflight: entitlement → provider status → actor allowlist → source permission → budget → per-run cap → rate limit → approval. After execution, reconcile actual usage. Fail closed if the provider cost cannot be bounded or usage cannot be reconciled. No paid fallback, automatic top-up, overage or subscription. Keep per-user, per-org, per-provider and per-source caps.

Free users receive only a defined number of permitted free searches/extractions and bounded results. Third-party Actor charges are disabled for Free unless a specific free allowance and maximum cost have been verified. An empty token or empty allowlist means unavailable, not "try another provider".

## 9. Security and resilience

- Defend against SSRF, DNS rebinding, private IPs, redirects to internal addresses and malicious URLs.
- Treat collected content as untrusted prompt-injection material.
- Use request IDs and idempotency keys; retry only safe operations with bounded backoff.
- Store run state before and after external calls; support timeout, partial result and cancellation.
- Enforce tenant access on every brief, job, run and signal query.
- Redact secrets, tokens and personal data from logs.

## 10. Acceptance tests

1. A web brief creates a durable job and traceable Tavily signals.
2. Repeated identical results deduplicate without counting as independent corroboration.
3. Firecrawl extraction rejects private/internal targets and records source/hash/run provenance.
4. An unreviewed or non-allowlisted Actor is blocked.
5. Apify/Scrape.ly selection and per-run cost cap are enforced; no fallback occurs.
6. UI passes the actor's validated schema input, not an empty hardcoded object.
7. A source unsupported for Threads returns a clear unsupported status; no fabricated content appears.
8. Provider timeout/partial failure is visible in run history.
9. Quota exhaustion blocks spend before the provider call.
10. Tenant isolation and source permission checks pass.
