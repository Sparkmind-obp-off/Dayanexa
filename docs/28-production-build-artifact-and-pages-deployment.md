# DAYANEXA — Production Build, Artifact & Cloudflare Pages Deployment Contract

**Status:** Canonical operational contract. Production deployment remains pending until a reproducible artifact is built, deployed and verified.
**Project:** DAYANEXA
**Repository:** `Sparkmind-obp-off/Dayanexa`
**Branch:** `main`
**Cloudflare Pages project:** `dayanexa`
**Production domain:** https://dayanexa.biz.id

## 1. Purpose

A source commit, successful CI run, uploaded build artifact, Cloudflare deployment and working production application are five distinct states. The system must record each state separately and link them by immutable commit SHA, workflow run ID, artifact ID/checksum and Cloudflare deployment ID.

A successful CI build does not prove production deployment. A successful Pages upload does not prove Clerk authentication or customer journeys work.

## 2. Current incident baseline

- The frontend consumes `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`.
- The canonical public Clerk key is available to the build through the resolution contract in `vite.config.ts` and `wrangler.jsonc`.
- The source fix is present in commit `630ba760fad7656811bbe5346283041e96accd92`; subsequent documentation/prompt updates culminated in commit `2cd66e2dc0a9496417df8e2eec7438b016eb0922`.
- GitHub Actions run `43847796716`, for exact commit `2cd66e2dc0a9496417df8e2eec7438b016eb0922`, completed with conclusion `success`.
- The Pages project has previously been observed as ad-hoc/manual, without a connected GitHub source. Re-check current configuration before relying on this historical observation.
- A Pages runtime variable cannot alter an already-built Vite bundle.
- The attempted deployment did not complete. Production remains pending; do not claim the missing-key screen or Google Sign-In issue is fixed.

## 3. Required release pipeline

### Stage A — Verify source

1. Resolve the exact target commit SHA from `main`.
2. Confirm the commit includes the Vite build-time Clerk key contract.
3. Confirm no secret or environment-specific private file is tracked.
4. Run the canonical CI workflow against that exact SHA.

### Stage B — Build a production artifact

1. Use a clean checkout of the exact SHA and the committed lockfile.
2. Install with `npm ci`; do not use an unpinned dependency install.
3. Run typecheck, tests, migration validation, secret scan, dependency audit and production build.
4. Inspect the generated frontend bundle for the expected public Clerk publishable-key prefix and verify that the missing-key fatal branch is not the active production configuration.
5. Scan generated output for secret keys, tokens and private environment values. The public publishable key is allowed; Clerk secret/JWT/webhook keys are not.
6. Package the actual Pages output directory as a CI artifact. Record artifact name, workflow run ID, commit SHA, creation time and checksum.
7. Do not build from an old local `dist/` directory or from a different commit.

### Stage C — Deploy the exact artifact

Preferred path: a dedicated, manually triggered GitHub Actions production deployment workflow, using the previously verified artifact from the same commit and a protected `production` environment.

The deploy job must:
- require explicit manual dispatch and production-environment approval;
- verify the artifact SHA matches the selected release SHA;
- use a narrowly scoped Cloudflare API token and account ID supplied through protected GitHub Actions secrets;
- deploy only the `dayanexa` Pages project;
- never print credentials or expose them to frontend build output;
- never run D1 migrations, change secrets, modify Clerk provider settings, alter payment settings, delete data or change billing;
- record the Cloudflare deployment ID, URL, environment, source commit and timestamp;
- fail closed if required credentials, artifact provenance or project identity cannot be verified.

If the protected secrets or artifact are unavailable, stop and report the exact missing prerequisite. Do not invent credentials, change account security or bypass approvals.

Manual Wrangler deployment is an acceptable controlled alternative only when the operator can verify the exact artifact, project, account and deployment result. Record the same provenance fields.

### Stage D — Production verification

After deployment, verify all of the following against the production domain and exact deployed build:

1. Homepage returns successfully and the fatal missing Clerk key screen is gone.
2. The served JavaScript bundle corresponds to the artifact and commit being deployed.
3. Google Sign-In starts and returns through the configured Clerk callback.
4. Session creation, refresh and sign-out work.
5. Authenticated `/api/v1/me` returns the correct principal and role.
6. Unauthenticated `/api/v1/me` returns 401.
7. Tenant isolation and role authorization remain enforced.
8. No Clerk secret, JWT verification key or webhook signing secret is present in the browser bundle.
9. Clerk webhook configuration and delivery are checked separately; a missing webhook secret remains a blocker for webhook-dependent functions.
10. Customer, contributor and operator journeys are tested in a controlled environment.

Record browser/API evidence, timestamps, deployed commit, Pages deployment ID and remaining failures. A homepage 200 alone is not a production acceptance test.

## 4. Approval and safety boundaries

The user's approval to publish the Clerk bundle is limited to the frontend artifact deployment described here. It does not authorize:
- D1 migrations or data mutation;
- Clerk dashboard/provider/callback changes;
- secret creation, rotation or exposure;
- payment gateway or live-payment changes;
- provider spend, paid fallback or plan upgrades;
- customer/contributor/financial/audit data deletion;
- unrelated Cloudflare project or domain changes.

Any additional action requires its own explicit approval.

## 5. Rollback

Keep the last known-good Pages deployment available. If smoke tests fail, stop promotion and use the Cloudflare Pages rollback/redeployment mechanism for the exact prior deployment, subject to owner authorization. Do not roll back or mutate D1 data as part of a frontend rollback. Record incident, failed deployment and recovery evidence.

## 6. Definition of done

Release is complete only when:
- CI passed for the exact commit;
- production artifact provenance and checksum are recorded;
- exact artifact is deployed to the correct Pages project;
- Cloudflare deployment ID and commit parity are recorded;
- production domain and Google Sign-In/session tests pass;
- unauthenticated/authenticated API checks pass;
- secret scan of the served bundle passes;
- no unauthorized database, Clerk, payment, billing or data changes occurred.

Until all conditions pass, status must remain **DEPLOYMENT PENDING** or **PRODUCTION VERIFICATION PENDING**, whichever is accurate.
