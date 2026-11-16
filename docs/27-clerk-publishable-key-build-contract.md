# Clerk publishable key — Vite build contract

**Status:** Source fix committed. Historical GitHub Actions CI runs passed for earlier commits, but GitHub Actions CI/CD is now retired by owner decision. Production artifact deployment and Google Sign-In verification remain pending until confirmed on the live domain.
**Scope:** Public Clerk publishable key only. No secret key, JWT verification key or webhook secret is exposed to the browser.

## Incident

The production browser reported:

`VITE_CLERK_PUBLISHABLE_KEY tidak ada. Autentikasi wajib dan tidak pernah diganti mock.`

The frontend reads `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` in `src/main.tsx`. The Pages project and `wrangler.jsonc` held the public key under `CLERK_PUBLISHABLE_KEY`. These are different names. A Pages runtime variable cannot retroactively change an already-built Vite bundle.

## Canonical resolution

`vite.config.ts` resolves the public key in this order:

1. `process.env.VITE_CLERK_PUBLISHABLE_KEY`
2. `process.env.CLERK_PUBLISHABLE_KEY`
3. Vite-loaded `VITE_CLERK_PUBLISHABLE_KEY`
4. Vite-loaded `CLERK_PUBLISHABLE_KEY`
5. Existing canonical `CLERK_PUBLISHABLE_KEY` in `wrangler.jsonc`

The value is injected only into the exact frontend expression consumed by Clerk. Build fails clearly if the value is absent or does not use the expected `pk_live_` / `pk_test_` prefix. The publishable key is intended for browser use; all Clerk secret/JWT/webhook material remains server-side.

## Manual deployment requirements

- Build the production bundle from the intended exact source commit; never deploy a stale `dist/` directory.
- Run `npm ci`, `npm run check`, `npm run audit`, and `npm run build` locally.
- Inspect the generated JS bundle to confirm the expected Clerk publishable key is present and the fatal missing-key branch is not the active production configuration.
- Scan generated output for secret keys, tokens and private environment values. The public publishable key is allowed; Clerk secret/JWT/webhook keys are not.
- Confirm the Wrangler-authenticated Cloudflare account and exact Pages project `dayanexa`.
- Deploy with the repository's `npm run deploy` command and record deployment ID/URL and source commit.
- Verify `https://dayanexa.biz.id` loads the application, then test Google Sign-In, callback, session refresh/sign-out and authenticated `/api/v1/me`.
- Do not change Clerk providers, use mock auth, expose `CLERK_SECRET_KEY` / `CLERK_JWT_KEY`, or alter unrelated Clerk applications.
- Runtime config changes alone are insufficient; this is a Vite build-time value.

## Current execution state (16 November 2026)

- Source fix commit: `630ba760fad7656811bbe5346283041e96accd92`.
- Historical master/prompt commit before manual-release governance: `2cd66e2dc0a9496417df8e2eec7438b016eb0922`.
- Historical GitHub Actions run `43847796716` passed for that exact SHA; this is historical validation only and not a current release gate.
- GitHub Actions CI/CD workflows are retired; use local validation and manual Wrangler deployment.
- No production deployment from the corrected build or post-deployment Google Sign-In verification has been proven in the recorded baseline.
- Canonical release process: `docs/28-production-build-artifact-and-pages-deployment.md`.

## Evidence boundary

A successful local build proves the selected source compiles. It does not prove the production domain is fixed. Production is only fixed after Wrangler deployment and browser/authentication smoke tests.
