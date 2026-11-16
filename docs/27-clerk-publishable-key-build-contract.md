# Clerk publishable key — Vite build contract

**Status:** Source fix committed; CI/build verification pending. Production deployment not yet performed.
**Scope:** Public Clerk publishable key only. No secret key, JWT verification key or webhook secret is exposed to the browser.

## Incident

The production browser reported:

`VITE_CLERK_PUBLISHABLE_KEY tidak ada. Autentikasi wajib dan tidak pernah diganti mock.`

The frontend reads `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` in `src/main.tsx`. The Pages project and `wrangler.jsonc` held the public key under `CLERK_PUBLISHABLE_KEY`. These are different names. More importantly, a Pages runtime variable cannot retroactively change an already-built Vite bundle.

## Canonical resolution

`vite.config.ts` now resolves the public key in this order:

1. `process.env.VITE_CLERK_PUBLISHABLE_KEY`
2. `process.env.CLERK_PUBLISHABLE_KEY`
3. Vite-loaded `VITE_CLERK_PUBLISHABLE_KEY`
4. Vite-loaded `CLERK_PUBLISHABLE_KEY`
5. Existing canonical `CLERK_PUBLISHABLE_KEY` in `wrangler.jsonc`

The value is injected only into the exact frontend expression consumed by Clerk. Build fails clearly if the value is absent or does not use the expected `pk_live_` / `pk_test_` prefix. The publishable key is intended for browser use; all Clerk secret/JWT/webhook material remains server-side.

## Deployment requirements

- Build the production bundle from the updated commit, not from a stale `dist/` directory.
- Inspect the generated JS bundle to confirm the expected Clerk publishable key is present and the fatal missing-key branch is not active.
- Deploy that exact bundle to the `dayanexa` Pages project and record commit/deployment IDs.
- Verify `https://dayanexa.biz.id` loads the application, then test Google Sign-In, callback, session refresh/sign-out and authenticated `/api/v1/me`.
- Do not change Clerk providers, use mock auth, expose `CLERK_SECRET_KEY` / `CLERK_JWT_KEY`, or alter unrelated Clerk applications.
- Runtime config changes alone are insufficient; this is a Vite build-time value.

## Evidence boundary

A successful GitHub CI build proves the new source compiles and the build-time resolution works in CI. It does not prove the production domain is fixed. Production is only fixed after a new deployment and browser/authentication smoke tests.
