# DAYANEXA — Demand-to-Execution OS

**Product doctrine:** Discover demand. Build the capability. Deliver the outcome.

Canonical architecture is now **V3 — Demand-to-Execution**. Start with:
- [V3 Architecture](docs/18-demand-to-execution-architecture-v3.md)
- [Demand Discovery Engine](docs/19-demand-discovery-engine.md)
- [Demand Intelligence Engine](docs/20-demand-intelligence-engine.md)
- [Capability & Solution Foundry](docs/21-capability-solution-foundry.md)
- [Agentic Execution Engine](docs/22-agentic-execution-engine.md)
- [Market Delivery Engine](docs/23-market-delivery-engine.md)
- [Batch V2 Code Audit](docs/24-batch-v2-code-audit.md)
- [Admin & Resource Control Center](docs/25-admin-resource-control-center.md)
- [V3 Roadmap](docs/17-master-upgrade-and-execution-roadmap.md)
- [Master System](docs/16-master-system-and-full-stack-implementation.md)
- [Master Implementation Prompt](prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md)

## V3 product flow

Discovery Brief → real source runs and evidence → niche/demand clusters → validated demand → solution and capability plan → approved agentic mission → tested demo → lawful market presentation → accepted offer → verified payment/delivery/settlement → learning.

The five engines are the product core. Customer, contributor, operator, identity, subscription, payment and ledger capabilities support that chain.

## Current code foundation

- React 18 + TypeScript + Vite; Hono API on Cloudflare Pages Functions.
- Clerk Production Google-only integration using `@clerk/react` and compatible backend SDK.
- Cloudflare D1, private R2 artifacts and Workers AI binding.
- Tavily search, Firecrawl selected-page extraction, Apify/Scrape.ly Actor adapter, Workers AI and optional Groq — **every outbound call goes through the Provider Runtime Gateway** (`apps/api/src/providers/gateway.ts`): policy → authorized account → verified fresh quota → caps → atomic reservation → dispatch with single-use ticket → reconciliation → circuit breaker. Fail closed by default; no account rotation on 429/ban/quota; fallback only for outages via owner-approved, expiring rules. Owner controls: Admin & Resource Control → "Runtime gateway".
- Demand/signal/evidence/opportunity, solution/capability/gap, agent/mission/task, artifact/delivery, quote/payment/invoice/ledger foundations.
- Current subscription hypotheses: Free Rp0, Pro Rp149.000/30 days, Plus Rp399.000/30 days. These are not market-validated. Keep provider credits and mission budgets separate.
- Live payment remains disabled unless owner authorizes a verified merchant setup.

## Audited baseline

Batch V2 source audit: `main @ 04b4bbe4dd37fd2b4710bcab55e90cc42a0db6fa` (16 Nov 2026). The audit found real provider adapter paths and meaningful CRUD/lifecycle foundations, but no complete durable discovery job pipeline, persistent niche cluster engine, verified capability readiness system, actual agent/tool execution runtime, automated isolated demo build/preview pipeline or consent-aware market presentation lifecycle. See [audit](docs/24-batch-v2-code-audit.md).

## Provider Runtime Gateway — activation checklist (owner)

After migration 0008 is applied, providers stay blocked until the owner, per provider: (1) sets the policy (enabled, unit type matching the meter — `neurons`/`tokens`/`credits`/`usd_micros` — and daily/monthly caps > 0); (2) registers an authorized account with capabilities (e.g. `search`, `scrape`, `inference:classification`, `actor:user~actor`), terms review date, unit price (0 = free; empty = unknown → blocked) and per-request/daily/monthly caps; (3) records a verified quota snapshot (dashboard/provider API/official page) with timestamp; (4) for Actors, approves the registry entry with an expiry. Paid use requires a scoped approval with spend cap and expiry.

## Development

Node.js >=20.9.0.
```bash
npm ci
npm run ci
npm run dev:web
```

## Deployment and owner gates

- Cloudflare BYOK deployment is a separate action from a Git push; verify deployed commit/build ID.
- Verify Google sign-in and authenticated browser journeys; source code alone is not proof.
- Active CI workflow is `.github/workflows/ci.yml`; verify its run result after each push. The source template is `docs/ci/ci.workflow.yml`.
- `.env.production` and `.env.development` are prohibited from Git; CI fails if either is tracked. Keep `.env.example` only.
- Verify Clerk webhook secret in Cloudflare; never paste secret values into chat.
- Keep payment mode mock and live payment disabled until sandbox, webhook, reconciliation and owner approval.
- No production D1 migration, paid Actor, provider spend beyond approved caps, external outreach, public demo deployment, refund or payout without explicit approval.
- Respect source permissions, platform terms, privacy, copyright and opt-out requirements.


## Canonical V3 master package

- [Canonical Master System](docs/00-DAYANEXA-CANONICAL-MASTER-SYSTEM.md) — single source of truth for product, architecture, roles, five engines, provider governance, economics, status and exit gates.
- [Full End-to-End Implementation Master Prompt](prompts/DAYANEXA_FULL_IMPLEMENTATION_MASTER_PROMPT.md) — execution instructions from fresh audit through controlled pilot.
- [Provider Runtime Governance](docs/26-provider-runtime-governance.md) — quota enforcement and compliant account failover.

The canonical master and full implementation prompt supersede fragmented task prompts for overall scope and sequencing. Detailed domain documents remain binding contracts.
