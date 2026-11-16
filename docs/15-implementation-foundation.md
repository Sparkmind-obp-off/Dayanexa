# DAYANEXA Implementation Foundation — V1

Status: initial API and payment integration foundation committed; production activation pending.

## What exists in code

- Cloudflare Workers API application under `apps/api`.
- Clerk JWT verification adapter using the production Clerk public key.
- Internal DAYANEXA user ID mapped uniquely to Clerk subject; business authorization remains in DAYANEXA.
- Provider registry for Duitku, Xendit, Midtrans and Faspay.
- Payment intent endpoint with safe mock mode by default.
- Provider-specific request and callback signature handling foundations.
- D1 migrations for identity, role assignments, payment intents/events, audit events and ledger accounts/journals/entries.
- Health endpoint and provider readiness endpoint.

## Payment safety model

The live switch requires both `PAYMENTS_MODE=live` and `PAYMENT_LIVE_ENABLED=true`. Defaults are mock/off. A gateway being configured is not the same as being approved, enabled or commercially eligible. No credentials are committed.

Provider specifics:
- Duitku: merchant inquiry endpoint, MD5 request/callback signature.
- Xendit: Invoice API, callback token verification.
- Midtrans: Snap transaction API, SHA-512 notification signature.
- Faspay: merchant-specific debit endpoint, request and payment-notification signature SHA1(MD5(...)). Production endpoint URLs are merchant-dashboard-specific and must be supplied by the merchant.

## Important current limits

This is a foundation, not a public-ready payment system. The frontend is not yet connected to the API. Provider sandbox credentials and live merchant accounts have not been configured or tested. Faspay payment channel/product activation is account-specific. Provider callbacks need integration tests against actual sandbox payloads. The ledger schema exists but posting/reconciliation workflows are not yet implemented. No payout or marketplace split is enabled.

## Next build sequence

1. Bind the dashboard to authenticated API and implement controlled registration.
2. Add organization, membership, role, permission and approval policies.
3. Add request idempotency and per-user/provider budget/rate controls.
4. Build payment operations console, webhook replay queue and settlement reconciliation.
5. Implement balanced ledger posting, refunds, disputes and controlled payout requests.
6. Add provider sandbox contract tests and verify each merchant product.
7. Only then enable a limited single-merchant pilot; marketplace split requires separate provider and legal approval.
