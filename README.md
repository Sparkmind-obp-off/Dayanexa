# DAYANEXA
**Agentic Opportunity & Execution OS**

> Discover demand. Build the capability. Deliver the outcome.

DAYANEXA is an agentic economic execution system. It discovers real market demand, validates evidence and commercial intent, designs products/services/solutions, forms missing capabilities, orchestrates AI agents and human contributors where appropriate, delivers accepted outcomes, verifies economic events, and learns from results.

## Product doctrine
**Demand defines the opportunity. Intelligence defines the solution. Capability makes it possible. Agents orchestrate execution. Commercialization creates value. Verified outcomes prove success.**

DAYANEXA is not a job board, freelancer marketplace, passive opportunity directory, generic chatbot, or capability-limited service agency. Demand discovery must not be constrained by the capabilities currently installed.

## Current status
- Repository foundation: committed to main.
- Product Constitution, architecture, lifecycle, agent model, governance, economics, provider strategy, roadmap, and ADRs: documented in /docs.
- Runtime: React + TypeScript + Vite command-center prototype plus a Cloudflare Workers API foundation under `apps/api`; not production-ready.
- AI inference direction: Cloudflare Workers AI via the native `env.AI` binding is the primary/default path; GroqCloud is optional and disabled by default. Live model use, quota and billing must be verified against the Cloudflare account.
- CI: GitHub Actions typecheck and production build passed on commit e86193a; latest documentation commits are awaiting CI verification.
- Clerk JWT verification and four payment gateway adapters are scaffolded in `apps/api`; live credentials, sandbox contract tests, payment reconciliation and payouts are not enabled.
- Domain: dayanexa.biz.id (ownership reported by project owner; DNS and deployment not verified here).

## Start locally
```bash
npm install
npm run dev
npm run check
npm run build
```

## Documentation map
- [Product Constitution](docs/00-product-constitution.md)
- [Master Architecture](docs/01-master-architecture.md)
- [Domain Model](docs/02-domain-model.md)
- [Opportunity Lifecycle](docs/03-opportunity-lifecycle.md)
- [Agent Workforce](docs/04-agent-workforce.md)
- [Demand Intelligence](docs/05-demand-intelligence.md)
- [Capability Foundry](docs/06-capability-foundry.md)
- [Commercial & Economic Engine](docs/07-commercial-economics.md)
- [Governance & Security](docs/08-governance-security.md)
- [Command Center](docs/09-command-center.md)
- [Roadmap](docs/10-roadmap.md)
- [Implementation Blueprint](docs/11-implementation-blueprint.md)
- [MVP Acceptance Criteria](docs/12-mvp-acceptance.md)
- [Provider Stack & Cost Governance](docs/13-provider-stack-and-cost-governance.md)
- [Identity, Monetization & Payment Architecture](docs/14-identity-monetization-and-payments.md)
- [Implementation Foundation V1](docs/15-implementation-foundation.md)
- [Master System & Full-Stack Implementation Specification](docs/16-master-system-and-full-stack-implementation.md)
- [Master System / Full-Stack Implementation Prompt](prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md)

## AI inference decision
Cloudflare Workers AI is the default inference runtime through the Cloudflare Worker `env.AI` binding. GroqCloud is retained only as an optional adapter and is not required for baseline operation. See the master system and implementation prompt for model governance, budget controls, AI Gateway boundaries and activation gates.
- [API setup and safety defaults](apps/api/README.md)
- [Architecture Decision Records](docs/adr/)

## Non-negotiable safeguards
No fabricated demand, fake customer intent, deceptive listings, unpaid speculative labor, hidden fees, unauthorized scraping, unapproved spending, unapproved external commitments, or unverified payment claims. Human contributors receive clear scope, compensation, deadline, acceptance criteria, and dispute path before work begins.

## License
All rights reserved unless a separate license is added by the project owner.
