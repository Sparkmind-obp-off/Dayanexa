# DAYANEXA — Member V3 Access & Free Entitlement Contract

**Status:** Required product behavior; implementation and production activation must be tracked separately.  
**Scope:** Make a normal member account able to use the complete customer-usable DAYANEXA V3 product under the Free plan, without platform-role elevation.

## 1. Required account behavior

- `sparkmind.support@gmail.com` remains the platform owner and retains global owner-only controls.
- `elmatador0197@gmail.com` remains a normal member account; it must receive the Free-plan V3 product entitlement.
- Do not change either account's identity, Clerk login method, platform role or membership role as part of this feature.
- All ordinary member accounts should receive the same default Free product entitlement automatically through their active personal/organization workspace. Do not hard-code the two email addresses into product access logic.
- The product entitlement is organization-scoped and applies to every active member of that organization according to its plan and seat limit.

## 2. Root cause in current source

The current implementation separates roles and plans only partially:
- `ROLE_PERMISSIONS.member` currently contains only `customer:self`.
- `AppShell.tsx` renders the 15 command-center workspaces only when `isStaff` is true. Members see the customer portal only.
- Each current command-center workspace is also gated by staff permissions such as `workspace:read`, `ledger:read`, `governance:read` or `provider:admin`.
- `assertOrgAccess()` treats `workspace:read` as platform staff and bypasses ordinary organization scope. Granting this permission to members to expose workspaces would therefore create a cross-tenant security defect.
- Free plan currently has 2 requests per 30 days, 0 AI assists and 1 seat. The customer request page disables AI drafting for Free and directs the user to upgrade.

**Conclusion:** The member is not missing owner role. The application has no separate member-facing V3 product entitlement/workspace. Do not fix this by adding `workspace:read` or other staff permissions to the member role.

## 3. Required authorization model

Three independent checks must be applied:

1. **Platform authority:** platform roles authorize global operations only. `owner` controls Admin & Resource Control, provider accounts/policies, Actor allowlists, global budgets, secret references, cross-tenant operations, platform governance and global financial configuration.
2. **Tenant membership:** every customer-facing request must validate that the principal has an active membership in the target organization. All reads and writes are filtered by that organization. A product entitlement must never bypass tenant isolation.
3. **Product entitlement:** a dedicated capability such as `v3:use` (or equivalent entitlement resolver) determines access to customer-usable V3 product functions. This is not a platform role and must not imply owner/operator/analyst/finance privileges.

Do not reuse `workspace:read` for member product access. Do not show internal operator queues, other customers' demand, global source/Actor registries, provider credentials, internal provider usage, other tenants' missions, global ledger or Admin Control Center to members.

## 4. What “full V3 access on Free” means

Free members can discover and use all customer-usable capabilities of the five V3 engines, with bounded usage:
- Demand Discovery: create discovery briefs, run allowed low-cost discovery, inspect own source runs and evidence.
- Demand Intelligence: inspect and organize their own evidence, clusters, demand hypotheses, validations and opportunity assessments.
- Capability & Solution Foundry: create solution briefs, capability plans and readiness requests; inspect only their own build/acquire/partner decisions.
- Agentic Execution: create/monitor their own approved missions and task graphs, invoke only explicitly allowed no-cost tools, inspect their artifacts and test results.
- Market Delivery: view their own demos/presentations, approve/reject offers, follow verified payment, delivery, acceptance, dispute and settlement states.
- Learning: inspect their own outcome and feedback history.

The member experience may be a separate V3 product workspace; it does not have to expose the internal 14 operator command-center screens. The product must nevertheless support the full customer journey across all five engines and expose meaningful status and actions, not just static links or placeholder cards.

## 5. Free plan behavior and cost rules

- Product capability availability is separate from usage quotas.
- Free is the default plan for new/ordinary member organizations and remains IDR 0.
- Current baseline quota in source is 2 customer requests per rolling 30 days, 1 seat, and 0 AI assists. Zero AI assists conflicts with full AI-enabled V3 product access and must be resolved before declaring this requirement complete.
- Cloudflare Workers AI documentation states a Workers Free allocation of 10,000 Neurons per day, resetting at 00:00 UTC; exceeding this on Workers Free causes further calls to fail rather than incur overage. Some models require Workers Paid and must be excluded from Free. Source: https://developers.cloudflare.com/workers-ai/platform/pricing/
- DAYANEXA must not assume the entire provider free allowance is available to a single member: it is a shared provider/account pool. The platform needs a central hard cap, a protected reserve for platform operations, per-organization daily/monthly sub-caps, per-request reservation, actual usage reconciliation and fail-closed behavior. The default inference configuration already has an 8,000-neuron daily and 200,000-neuron monthly application budget; verify actual binding/account plan and gateway enforcement before increasing or reallocating it.
- Free AI/agent features may use only models and services verified eligible for no-cost use. No paid model, paid plan requirement, Groq, paid scraper, paid fallback, overage, top-up, paid proxy/storage/compute or auto-renewal.
- When the shared free allowance or an organization sub-cap is exhausted, queue/defer the operation and show the reset time. Never silently bill or fall back to paid resources.
- Free plan may have smaller request counts, run depth, concurrency, storage retention, task size or output limits, but the feature itself remains accessible. Any restriction must be explicit and measurable.

## 6. Implementation requirements

1. Add a product entitlement resolver with explicit plan capabilities and quotas; include it in `GET /me` and frontend session types.
2. Add dedicated `v3:use` (or equivalent) product authorization, without adding staff permissions to `member`.
3. Build a member-facing V3 workspace/navigation that is available when the organization has V3 product entitlement. Keep owner-only Admin Control separate.
4. Add tenant-scoped APIs for each customer-facing engine operation. Audit every query and mutation for organization ownership; add IDOR/cross-tenant tests for all resource families.
5. Separate global source/provider/Actor administration from member-run discovery jobs. Members may use curated, approved provider capabilities; they cannot change provider accounts, credentials, terms, global quotas or Actor allowlists.
6. Apply per-org plan quotas and provider global free allowance caps before dispatch. Every metered call passes through the Provider Runtime Gateway and records estimated/reserved/actual usage.
7. Ensure Free has a bounded positive AI capability allocation only after verifying the actual Workers AI free plan, allowed model and central shared budget. Do not simply set an arbitrary monthly AI request count without a neuron budget.
8. Add tests proving: ordinary member can access all customer-facing V3 engine functions; member cannot access Admin Control/global provider controls/cross-tenant records; owner retains all existing authority; Free cannot trigger paid spend; quotas and reset behavior are enforced.
9. Test actual Google sign-in and member browser journey separately from mocked Clerk JWT unit tests.
10. Deploy frontend/API and apply required migrations only through explicit release approval; never treat GitHub merge as production activation.

## 7. Acceptance criteria

- A normal member logs in with the existing Google account and remains `member`.
- `GET /me` returns Free plan plus explicit V3 product entitlement and bounded quota.
- Member can navigate the member-facing V3 experience and complete a permitted test journey through all five engines, with real tenant-scoped persisted records and traceable evidence.
- Member cannot read/write another tenant's records or access any owner-only Admin/Provider/Actor/global financial control.
- All AI/agent calls are metered, hard-capped to verified no-cost allowance, and deferred on exhaustion; no paid fallback occurs.
- Existing customer, owner, contributor, finance and platform isolation tests remain green.
- Browser Google sign-in, member flow and production migration/deployment parity are independently verified.
- No account role, Clerk identity, email login setting or membership role was changed to achieve the result.
