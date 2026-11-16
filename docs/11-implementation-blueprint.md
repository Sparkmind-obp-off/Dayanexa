# Implementation Blueprint

## 1. Initial technical direction
Start as a modular TypeScript application. Recommended initial stack:
- Web UI: React + TypeScript + Vite.
- API: TypeScript HTTP API with schema validation.
- Database: PostgreSQL for canonical relational records (or a carefully scoped equivalent if deployment constraints require it).
- Object storage: S3-compatible private bucket for artifacts.
- Queue/workflow: durable job queue/workflow engine with retries and idempotency.
- Auth: managed identity provider with server-side authorization.
- Observability: structured logs, traces, metrics, audit events.
- AI: provider adapter abstraction; no model/provider hard-coded into domain logic.

This is a target architecture, not a claim that these services are already provisioned.

## 2. Repository layout target
```text
.
├── docs/
│   ├── adr/
│   └── *.md
├── src/
│   ├── app/
│   ├── components/
│   ├── domains/
│   │   ├── market/
│   │   ├── demand/
│   │   ├── opportunities/
│   │   ├── solutions/
│   │   ├── capabilities/
│   │   ├── commercial/
│   │   ├── execution/
│   │   ├── delivery/
│   │   ├── economics/
│   │   └── governance/
│   ├── adapters/
│   ├── lib/
│   └── styles/
├── tests/
├── migrations/
├── scripts/
└── README.md
```

## 3. Engineering rules
- Strict TypeScript; runtime schema validation at all boundaries.
- Domain modules own their invariants; UI never writes directly to persistence.
- Version APIs and event schemas.
- Idempotency for all retriable commands and financial actions.
- Explicit state machines; no arbitrary status strings.
- Unit tests for scoring and transitions; integration tests for workflows; contract tests for connectors.
- Seed data must be unmistakably synthetic and never appear as live market demand.
- Feature flags for incomplete modules.
- Migrations are reviewed, reversible where possible, and tested against backups.
- No secrets, personal customer data, or production exports in Git.

## 4. Environments
Local → development → staging → production. Separate databases, buckets, OAuth apps, secrets, and connector credentials. Production data must not be copied to local environments without approved anonymization.

## 5. Release gates
Typecheck, lint, unit tests, integration tests, dependency audit, secret scan, migration review, permissions review, smoke tests, backup/restore test, observability, rollback plan, and human release approval.

## 6. Deployment note
Domain ownership does not mean DNS, TLS, hosting, or production deployment is configured. Verify DNS records, Cloudflare account/project, build settings, environment variables, database, storage, and custom-domain certificate before claiming the site is live.
