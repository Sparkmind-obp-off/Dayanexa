# DAYANEXA Provider Stack & Cost Governance
Version: 1.0  
Status: Architecture decision — baseline for implementation  
Last reviewed: 2026-11-15

## 1. Executive decision

DAYANEXA is provider-agnostic. Its domain model, opportunity lifecycle, evidence rules, approval policy, mission ledger, and customer/contributor records remain owned by DAYANEXA. External vendors are replaceable adapters, never the source of truth.

Operating posture: **free-first, usage-capped, evidence-led**.
- Build provider interfaces before enabling paid plans.
- Start with free allocations where available.
- Do not attach payment methods, top up balances, or enable paid plans as part of deployment.
- Require explicit operator approval before any paid plan, prepaid top-up, paid Actor, proxy, or usage beyond a free allowance.
- Fail closed when quota is exhausted; never silently switch to a paid provider.
- Cache, deduplicate, and persist provenance to avoid paying twice for the same evidence.
- Review source terms, access rules, privacy implications, and permitted use before collection.

## 2. Provider layers — distinct jobs

| Layer | Responsibility | Candidate |
|---|---|---|
| Model inference | Generate, classify, extract, reason, summarize | GroqCloud initially; alternative model APIs behind adapter |
| Web discovery | Find candidate pages and URLs | Tavily initially |
| Page extraction | Fetch/crawl selected pages and extract content | Firecrawl initially |
| Specialized collection | Run platform/site-specific scrapers | Apify OR Scrape.ly per use case |
| Agent framework | Model/tool abstractions and reusable agent loops | LangChain, only if useful |
| Durable orchestration | Stateful workflows, retries, checkpoints, human approval | DAYANEXA workflow core first; LangGraph optional later |
| Multi-agent collaboration | Bounded collaborative-agent tasks | CrewAI experimental only |
| Observability/evaluation | Traces, evaluations, prompt comparisons | Internal audit/events first; LangSmith optional |
| Application runtime | API, dashboard, authorization, domain logic | Cloudflare Workers + Hono |
| Persistence | Transactional records, files, workflow state | D1 + R2; queues/workflow primitives as needed |

Key distinctions:
- Tavily discovers sources; it does not prove demand.
- Firecrawl extracts page content; it is not a specialist social-network scraper.
- Apify and Scrape.ly are overlapping Actor/scraping platforms. Do not run both for the same collection job.
- LangChain is a framework/integration layer; LangGraph is a lower-level stateful orchestration runtime. LangGraph does not require LangChain.
- CrewAI is a separate framework, not a mandatory dependency of LangGraph or LangChain.
- Groq is an inference provider, not DAYANEXA's workflow engine or decision authority.

## 3. Provider mapping by DAYANEXA domain and command center

| Domain / workspace | Provider assignment | DAYANEXA owns | Initial posture |
|---|---|---|---|
| Market Perception / Market Radar | Tavily discovery; Firecrawl selected-page extraction; Apify OR Scrape.ly only for a justified specialized source | Source registry, permissions, provenance, freshness, deduplication | Search/extraction adapters planned; specialized scraping off |
| Demand Intelligence | Groq classification/extraction; evidence from Tavily/Firecrawl | Demand hypotheses, corroboration, confidence and evidence quality | Internal pipeline first |
| Opportunity Intelligence | Groq bounded analysis; optional LangChain tools | Separate commercial, feasibility, strategic and risk scores | Deterministic rules + model assistance |
| Solution Intelligence / Solution Studio | Groq for options and draft plans | Solution catalog, feasibility, cost and validation | Human approval |
| Capability Foundry | Groq for gap analysis | Build/buy/license/integrate/partner/defer decisions | Internal rules first |
| Product & Commercial Engine / Catalog | Groq for drafts only | Product, offer, price, quote and customer authorization | Human approval |
| Agentic Execution Network / Agent Workforce | DAYANEXA task contracts; LangGraph only for complex durable runs; CrewAI isolated experiments | Mission, task, assignment, permissions, retries and autonomy | Native workflow core first |
| Quality, Delivery & Outcome | Groq review assistance; R2 for artifacts | Acceptance criteria, QA, delivery, disputes and customer acceptance | Deterministic checks first |
| Economic & Settlement Engine / Ledger | Payment provider selected after country/payment research and explicit approval | Ledger, verified payment, cost attribution and settlement | No payment provider activated |
| Learning & Evolution / Intelligence & Learning | Internal event/metrics store; LangSmith optional | Outcome learning, evaluations and provider performance | Internal telemetry first |
| Executive Command | Internal API + D1 | Cross-domain truth and approvals | Dashboard prototype |
| Execution Control | DAYANEXA workflow engine; optional LangGraph worker later | Canonical mission lifecycle | Planned |
| Commercial Control | Internal API | Quotes, authorization and contract status | Planned |
| Governance & Audit | Internal policy, RBAC and audit log | Access, approvals and audit evidence | Planned |

A workspace does not require a separate vendor. The table maps capabilities, not a mandate to buy software.

## 4. Current public pricing and free-tier notes

Observed on 2026-11-15. USD, before tax, FX and bank fees. Prices, quotas and eligibility change; verify the live dashboard before activation.

### GroqCloud — inference
- Free tier has model-specific RPM/RPD/TPM/TPD limits. Exact limits depend on model and account; read the live Groq Console Limits page.
- Developer tier requires a valid payment method and bills token usage; spend limits are available.
- Published examples: GPT-OSS 20B at $0.075 per million input tokens and $0.30 per million output tokens; GPT-OSS 120B at $0.15 input and $0.60 output per million tokens. Confirm model availability and price before use.
- Policy: start Free; no paid upgrade without approval; use production models, not preview models, for production workloads.
- References: https://console.groq.com/docs/rate-limits ; https://console.groq.com/docs/billing-faqs ; https://console.groq.com/docs/models

### Tavily — search/discovery
- Published Free allocation: 1,000 API credits/month, no card required.
- Public pricing advertises pay-as-you-go at $0.008/credit; paid plan allowances/rates can change.
- Credit consumption depends on operation and search depth. Record operation, request mode, result count, and usage.
- A prior account-specific quota failure was reported by the user; treat Tavily as optional, never a single point of failure.
- References: https://www.tavily.com/pricing ; https://help.tavily.com/articles/8816424538-pricing

### Firecrawl — crawl/extraction
- Published Free allocation: 1,000 credits/month, no card required.
- Basic scrape/crawl: generally 1 credit/page. Search: 2 credits per 10 results. Advanced structured formats can add credits.
- Hobby listed at $19/month monthly or $16/month billed annually for 5,000 credits; verify current billing before purchase.
- Use only for selected URLs after discovery; avoid broad uncontrolled crawls.
- References: https://www.firecrawl.dev/pricing ; https://docs.firecrawl.dev/

### Apify — specialized Actor execution
- Published Free plan: $0 with $5 monthly usage; no card required. Platform compute listed at $0.20 per compute unit on Free/Starter. Store Actor pricing varies by Actor.
- Starter listed at $19/month plus usage. Actors can charge per event, usage, or both.
- Before every run: inspect Actor README/schema; estimate Actor fee + compute + proxy + storage + transfer; set a run cap where supported; store run ID and provenance.
- Do not assume every Store Actor is free because the platform has a free plan.
- Reference: https://apify.com/pricing

### Scrape.ly — alternative Actor runtime
- Published Free plan: $0 with $5 monthly usage credit, no card required; 2 concurrent runs.
- Starter listed at $19 per 4 weeks with $19 usage credit. Compute, proxy, storage, transfer and Store Actor charges are usage-based.
- Prepaid balance and per-run spending caps are advertised; runs not covered by balance are rejected.
- Use instead of Apify for a task only when the Actor, price, output quality and operational limits are better. Do not enable both by default.
- References: https://scrape.ly/pricing ; https://scrape.ly/docs/account

### LangGraph, LangChain, CrewAI, LangSmith
- LangGraph is an MIT-licensed open-source runtime for stateful workflows, durable execution, streaming and human-in-the-loop. The library is free; hosting/infrastructure is not necessarily free.
- LangChain supplies agent/model/tool abstractions and integrations. It is optional; LangGraph can be used without it.
- CrewAI OSS is an open-source framework for collaborative agents and event-driven Flows. Use only for bounded experiments; never let a Crew own canonical mission state.
- LangSmith Developer currently lists $0/seat with 5,000 base traces/month; Plus lists $39/seat/month with additional deployment features. Usage charges and plan details may apply.
- References: https://docs.langchain.com/oss/python/langgraph/overview ; https://www.langchain.com/oss-overview ; https://crewai.com/open-source ; https://www.langchain.com/pricing

## 5. What to activate now, later, and not yet

### Phase A — foundation, no mandatory paid subscription
1. Keep existing Cloudflare + React/Vite/Hono direction.
2. Implement provider interfaces and mock adapters.
3. Implement source/evidence registry, event log, cost ledger, usage limits and approval gates.
4. Use Groq Free and Tavily Free only if accounts are available and live quotas permit.
5. Use Firecrawl Free for controlled extraction of selected pages.
6. Keep Apify and Scrape.ly disabled until a concrete source/use case justifies one.
7. Keep LangGraph and CrewAI out of the critical path; implement the first deterministic lifecycle inside DAYANEXA.

### Phase B — evidence-backed market intelligence
- Add one specialized scraping platform only after a source-specific benchmark.
- Compare recall, precision, freshness, duplicate rate, failure rate, terms/privacy risk and cost per accepted evidence item.
- Select Apify OR Scrape.ly per connector. A second provider is a deliberate fallback, not a parallel default.

### Phase C — long-running agent missions
- When missions require checkpointing, durable retries, streaming and human approval, evaluate LangGraph as a separate worker/service.
- DAYANEXA retains mission lifecycle and canonical records. LangGraph state is execution state, not the business ledger.
- Use CrewAI only if multi-agent collaboration demonstrably beats a simpler graph. Do not stack CrewAI + LangChain + LangGraph without a measured need.

### Phase D — observability and scale
- Add LangSmith or another tracing/evaluation product when internal telemetry is insufficient.
- Upgrade plans only from measured workload and approved unit economics.

## 6. Integration architecture

### Adapter contracts
Every external integration implements DAYANEXA-owned contracts, conceptually:
- ModelProvider.generate(input, modelPolicy, budget)
- SearchProvider.search(query, filters, budget)
- ExtractionProvider.extract(url, extractionPolicy, budget)
- ActorProvider.run(actorRef, input, maxCost)
- AgentRuntime.start(runSpec, checkpointRef)
- TelemetryProvider.record(traceEvent)

Adapters return normalized DAYANEXA records, not vendor-native objects as domain truth.

### Provider registry
Persist provider key/category, enabled state, environment scope, secret reference (never secret value), capabilities, model/Actor allowlist, quota/cost policy, timeout/retry policy, data-retention notes, health state and policy-review date.

Secrets belong in Cloudflare Secrets or an equivalent secret manager. Never put secrets in source code, browser bundles, D1 plaintext, logs or committed .env files.

### Cost and usage ledger
Every external call records:
- mission_id, task_id, provider_id and operation
- estimated and actual cost, currency and pricing snapshot/version
- usage units (tokens, credits, pages, compute, proxy bytes, etc.)
- request/response IDs, idempotency key, status and retry count

Enforce per-request, per-mission, per-provider daily/monthly and global daily/monthly budgets. Hard-stop at quota exhaustion. No automatic paid fallback. Require approval before raising limits.

### Reliability
- Bounded exponential backoff with jitter for transient errors.
- Never retry non-idempotent Actor runs without idempotency or reconciliation.
- Persist provider request IDs and workflow checkpoints.
- Circuit breakers and provider health states.
- Cache search/extraction by normalized query/URL and freshness window.
- Dead-letter handling after retry exhaustion.
- Long-running scrapes execute asynchronously; never block customer-facing requests.

### Evidence integrity
Preserve source URL, title, publisher, captured/observed timestamps, content hash, extraction method, provider and terms/policy status. Keep raw artifacts separate from normalized evidence and demand hypotheses. Track independent sources: ten pages copying one press release are not ten independent confirmations. No agent may convert a search snippet into validated demand or a paid mission without lifecycle gates.

## 7. Reference data flow

1. Market Radar creates a discovery job.
2. Tavily (or fallback search adapter) returns candidate URLs.
3. DAYANEXA validates source policy, deduplicates and prioritizes URLs.
4. Firecrawl extracts selected pages; a specialized Actor is used only when justified.
5. DAYANEXA stores artifacts and provenance.
6. Groq (or configured model) proposes structured claims/classifications.
7. Deterministic validation, corroboration and human review assess demand evidence.
8. Opportunity Intelligence evaluates commercial potential, execution feasibility, strategic value and risk separately.
9. Only approved opportunities proceed to solution, offer, mission, delivery, acceptance, payment verification and settlement.

## 8. Security, legal and ethical constraints

- Use public or properly authorized data. Do not bypass authentication, paywalls, CAPTCHAs, rate limits or access controls.
- Review source terms and applicable privacy/data-protection obligations before collection.
- Minimize personal data; do not collect sensitive personal data without a lawful, necessary and explicitly approved basis.
- Do not use scraping for spam, unsolicited outreach or discriminatory targeting.
- Keep customer/contributor data private and access-controlled.
- Human approval is mandatory for external commitments, commercially consequential customer communications, payments and contributor settlement.
- Provider output is untrusted input. It cannot change policy, secrets, tool permissions or approval requirements.

## 9. Environment activation matrix

| Provider | Local/dev | Preview | Production |
|---|---|---|---|
| Groq | Mock by default; optional dev key | Disabled unless approved test key/quota | Disabled until model policy, secrets and budgets approved |
| Tavily | Mock by default; optional dev key | Disabled unless approved | Disabled until source policy and budget approved |
| Firecrawl | Mock by default; optional dev key | Disabled unless approved | Disabled until crawl policy and budget approved |
| Apify | Disabled | Disabled | Disabled until Actor review and run cap |
| Scrape.ly | Disabled | Disabled | Disabled until Actor review and run cap |
| LangGraph | Local experiments | Not required | Separate worker only after durability evaluation |
| CrewAI | Local experiments | Disabled | Not in critical path |
| LangSmith | Optional dev tracing | Optional with redaction | Only after privacy, retention and budget review |

No secrets are copied between environments. Preview must not access production database, R2 bucket, provider keys or customer records.

## 10. Provider selection scorecard

Score each candidate 1–5 on output quality/coverage, reliability/rate limits, cost per accepted evidence item or completed task, data rights/privacy fit, integration effort/portability, observability/support, regional availability and hard-spend-cap capability.

A provider is not selected merely because it has an MCP connector or a free tier.

## 11. Implementation sequence

1. Define TypeScript contracts and normalized result schemas.
2. Add provider registry and secret-reference model.
3. Add mock adapters and tests.
4. Add usage/cost ledger and budget enforcement.
5. Add Groq adapter with model allowlist and structured-output validation.
6. Add Tavily search adapter and URL provenance.
7. Add Firecrawl extraction adapter and content hashing.
8. Add one specialized scraper adapter (Apify OR Scrape.ly) after benchmark.
9. Add queue/workflow execution and idempotency.
10. Evaluate LangGraph only when real missions need long-running stateful execution.
11. Evaluate CrewAI only for bounded multi-agent subtasks.
12. Add tracing/evaluation platform only when required.

## 12. Definition of done for an integration

An integration is not production-ready until credentials are stored as secrets; schemas are validated and normalized; timeout/retry/idempotency/circuit-breaker behavior is tested; usage and cost are recorded; hard budget and quota-exhaustion behavior are tested; provenance and policy review are recorded; logs redact secrets/personal data; mock and failure-path tests pass; the provider can be disabled without breaking domain state; and no paid fallback or plan upgrade occurs without explicit authorization.

## 13. Official references

- Groq rate limits: https://console.groq.com/docs/rate-limits
- Groq billing: https://console.groq.com/docs/billing-faqs
- Groq models/pricing: https://console.groq.com/docs/models
- Tavily pricing: https://www.tavily.com/pricing
- Tavily pricing details: https://help.tavily.com/articles/8816424538-pricing
- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Firecrawl docs: https://docs.firecrawl.dev/
- Apify pricing: https://apify.com/pricing
- Scrape.ly pricing: https://scrape.ly/pricing
- Scrape.ly account/credits: https://scrape.ly/docs/account
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangChain OSS: https://www.langchain.com/oss-overview
- CrewAI OSS: https://crewai.com/open-source
- LangSmith pricing: https://www.langchain.com/pricing
