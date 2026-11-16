# DAYANEXA API foundation

Cloudflare Workers API for Clerk-backed identity, payment gateway adapters and the canonical economic ledger.

## Safety defaults

- `PAYMENTS_MODE=mock` and `PAYMENT_LIVE_ENABLED=false` are the defaults.
- Live payment calls are blocked unless both variables explicitly enable live mode.
- Provider credentials are server-side Worker secrets only. Never add them to Vite variables, source control, or client code.
- Clerk JWT verification uses the production Clerk JWT public key configured as `CLERK_JWT_KEY`; set `CLERK_AUTHORIZED_PARTIES` to the exact production frontend origin(s).
- Xendit callback verification uses the separate `XENDIT_CALLBACK_TOKEN`, not the API secret key.
- The first authenticated user receives an internal DAYANEXA identity. Role grants and privileged actions must remain server-side.

## Setup

1. Create a Cloudflare D1 database and replace the placeholder database ID in `wrangler.toml`.
2. Install dependencies from this folder: `npm install`.
3. Apply migrations: `npx wrangler d1 migrations apply dayanexa-production --local` then `--remote` only after reviewing the target database.
4. Configure Clerk Production JWT public key and authorized parties as Worker secrets/vars.
5. Run `npm run typecheck` and `npm run dev`.
6. Keep payment mode mock until provider sandbox credentials and webhook verification have been tested.

## Routes

- `GET /health` — service health (public).
- `GET /api/v1/payments/providers` — authenticated provider readiness.
- `POST /api/v1/payments/intents` — authenticated payment intent creation. Mock by default.
- `POST /api/v1/payments/webhooks/{duitku|xendit|midtrans|faspay}` — provider webhook endpoints.

## Provider notes

Duitku uses its merchant inquiry API and MD5 signature contract. Xendit uses the Invoice API and callback token. Midtrans uses Snap and SHA-512 notification signature verification. Faspay uses its merchant-specific debit endpoint and SHA1(MD5(...)) signature contract. Faspay production endpoint URLs are merchant-specific and must be copied from the approved merchant dashboard; do not guess them.

The adapters are an integration foundation, not proof that a merchant account is approved or that any provider has enabled production credentials. Confirm each product, payment channel, fee, settlement, refund and payout scope with the provider before switching to live mode.

## Important next hardening

Before a public pilot: implement rate limiting, organization/role policy, CSRF/origin strategy, request idempotency, reconciliation jobs, signed event replay protection, provider status inquiry, refund approval, ledger posting with balanced-journal enforcement, and a dedicated secret rotation procedure. Payment success does not automatically mean customer acceptance or contributor settlement.
