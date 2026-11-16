# DAYANEXA — Manual Production Build & Cloudflare Pages Deployment

**Status:** Canonical operational contract. Production deployment remains pending until the corrected build is deployed and verified.
**Project:** DAYANEXA
**Repository:** `Sparkmind-obp-off/Dayanexa`
**Branch:** `main`
**Cloudflare Pages project:** `dayanexa`
**Production domain:** https://dayanexa.biz.id
**Release method:** Manual local validation and Cloudflare Wrangler. GitHub Actions CI/CD is intentionally retired.

## 1. Operating decision

DAYANEXA does not use GitHub Actions, a GitHub workflow, or automatic CI/CD for validation or deployment. GitHub is the source repository. A push to `main` does not deploy anything.

The operator performs checks locally, builds the exact source checkout, authenticates Wrangler with the intended Cloudflare account, and deploys manually to the Pages project `dayanexa`. Do not recreate a GitHub Actions workflow unless the owner explicitly changes this decision.

The repository may retain local npm scripts such as `check`, `audit`, `build`, and `deploy`. A local script named `ci`, if present, is not a GitHub Actions service; prefer the explicit commands below so the operator can see each stage.

## 2. Current incident baseline

- The frontend consumes `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`.
- The Vite build-time source fix is committed in `630ba760fad7656811bbe5346283041e96accd92`.
- The historical GitHub Actions run `43847796716` passed for `2cd66e2dc0a9496417df8e2eec7438b016eb0922`. This is historical evidence only; GitHub Actions is retired and the run does not prove the latest source or production deployment.
- The prior Pages project was observed as ad-hoc/manual and not connected to GitHub. Reconfirm the actual Wrangler account and project before deployment.
- A Pages runtime variable cannot alter an already-built Vite bundle.
- No production deployment from the corrected build or post-deployment Google Sign-In verification has been proven in the recorded baseline.
- Keep status **SOURCE FIX COMMITTED / PRODUCTION DEPLOYMENT PENDING** until the verification in this document passes.

## 3. Manual release procedure

### Stage A — Confirm source and environment

1. Start from a clean local checkout of `Sparkmind-obp-off/Dayanexa`, branch `main`.
2. Record the exact commit SHA (`git rev-parse HEAD`) and inspect the intended diff.
3. Confirm the Vite Clerk key resolution fix exists in that checkout.
4. Confirm `.env.production` and `.env.development` are not tracked. Keep only safe examples such as `.env.example`.
5. Confirm the local Node version meets the repository requirement and use the committed lockfile.

### Stage B — Run local checks and build

Run these commands in order; stop if any command fails:

```bash
npm ci
npm run check
npm run audit
npm run build
```

Then inspect the generated `dist/` output:

- Confirm the expected public Clerk publishable-key prefix is present in the frontend bundle and the fatal missing-key branch is not the active production configuration.
- Scan the output for secret keys, tokens and private environment values. The public publishable key is allowed; Clerk secret/JWT/webhook keys and provider credentials are not.
- Confirm the output is from the exact checkout/commit recorded in Stage A. Do not deploy a stale or copied `dist/` directory.

### Stage C — Authenticate and deploy with Wrangler

1. Authenticate Wrangler using the operator's Cloudflare login flow (for example, `npx wrangler login`) or an already approved local credential. Never paste tokens into chat, source files or Git.
2. Run `npx wrangler whoami` and verify the returned Cloudflare account is the intended account.
3. Verify the Pages project name is exactly `dayanexa`. If account or project identity is uncertain, stop.
4. Deploy using the repository's `npm run deploy` command. Its current package script runs the production build and then `wrangler pages deploy dist --project-name dayanexa --branch main`.
5. Record the exact source SHA, command result, deployment ID, deployment URL and timestamp. Verify the Cloudflare deployment corresponds to the intended project and branch.

The `npm run deploy` command rebuilds before upload. The separate checks in Stage B are still required because the deploy script itself does not run the complete validation suite.

### Stage D — Production verification

Verify against https://dayanexa.biz.id and the exact deployed build:

1. Homepage returns successfully and the fatal missing Clerk key screen is gone.
2. Served JavaScript bundle corresponds to the corrected build.
3. Google Sign-In starts and returns through the configured Clerk callback.
4. Session creation, refresh and sign-out work.
5. Authenticated `/api/v1/me` returns the correct principal and role.
6. Unauthenticated `/api/v1/me` returns 401.
7. Tenant isolation and role authorization remain enforced.
8. No Clerk secret, JWT verification key, webhook signing secret or provider token is present in the browser bundle.
9. Clerk webhook configuration/delivery is checked separately; a missing webhook secret remains a blocker for webhook-dependent functions.
10. Customer, contributor and operator journeys are tested in a controlled environment.

Record timestamps, browser/API evidence, source SHA, Pages deployment ID/URL and remaining failures. A homepage 200 or successful Wrangler upload alone is not production acceptance.

## 4. Strict scope and safety

The existing approval to publish the corrected frontend bundle is limited to frontend deployment. It does not authorize:

- D1 migrations or production data mutation;
- Clerk dashboard/provider/callback changes;
- secret creation, rotation, deletion or exposure;
- payment gateway, live-payment or billing changes;
- provider spend, paid fallback, top-up or plan upgrades;
- customer, contributor, financial, ledger, audit, D1 or R2 data deletion;
- unrelated Cloudflare project, account, domain or DNS changes.

Do not run `npm run db:migrate:prod` or any production migration as part of a frontend deployment. Do not change Cloudflare secrets or bindings under this release approval. Any additional action requires its own explicit owner approval.

## 5. Rollback

Keep the last known-good Cloudflare Pages deployment available. If smoke tests fail, stop and use the Cloudflare Pages rollback/redeployment mechanism for the exact prior frontend deployment, subject to owner authorization. Never couple frontend rollback to destructive D1 rollback. Record the incident and recovery evidence.

## 6. Definition of done

Release is complete only when:

- the exact source SHA is recorded;
- local install, checks, audit and production build passed;
- generated bundle inspection and secret scan passed;
- Wrangler account and Pages project identity were confirmed;
- the intended build was deployed and deployment ID/URL recorded;
- production domain and Google Sign-In/session tests passed;
- authenticated/unauthenticated API checks passed;
- tenant/role authorization checks passed;
- no unauthorized database, Clerk, payment, billing, provider-spend or data changes occurred.

Until all conditions pass, status must remain **DEPLOYMENT PENDING** or **PRODUCTION VERIFICATION PENDING**, whichever is accurate.
