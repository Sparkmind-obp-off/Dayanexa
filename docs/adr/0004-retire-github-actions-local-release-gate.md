# ADR-0004: Retire GitHub Actions CI/CD; local release gate + manual Wrangler deploy
Status: Accepted | Date: 2026-11-16 | Decided by: owner. Operational procedure: docs/28; execution contract: docs/29 §11.

## Context
The owner's updated implementation prompt states: "Use local checks and manual Cloudflare Wrangler deployment only; GitHub Actions CI/CD is retired." Cloudflare Pages was never connected to GitHub; production was always deployed manually via Wrangler (BYOK). A green Actions run never proved deployment, which made it misleading evidence.

## Decision
- Remove `.github/workflows/ci.yml`. `docs/ci/ci.workflow.yml` stays only as a historical reference and must not be re-activated without a new ADR.
- `npm run release:check` (`scripts/release-check.mjs`) is the mandatory gate before any deploy. It covers everything the workflow did and fails if a workflow file is re-added:
  - tracked `.env.production`/`.env.development` rejection and no deprecated Clerk package;
  - typecheck, tests, migration validation, secret scan, production dependency audit and build;
  - a secret scan of the build output.
- `npm run deploy` runs the gate, then `wrangler pages deploy` tagged with the exact commit hash. A deploy remains an explicit, owner-approved action.
- `npm run smoke:prod` makes read-only production checks after a deploy.
- Batch evidence = exact HEAD + local gate output + Wrangler deployment ID/commit + smoke output. "CI URL" in older documents means this evidence.

## Consequences
- No automated verification on push. Every batch report must include the local gate result for the exact commit.
- Release, maintenance and deploy scripts must never delete production, customer, financial or audit data, and must never run production D1 migrations automatically.
