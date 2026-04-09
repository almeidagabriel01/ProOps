# Phase 5: Stripe & Billing E2E - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests covering Stripe subscription flows, webhook handling, plan limit enforcement, and WhatsApp overage billing — the async billing paths that must not regress silently. This phase only adds tests; the Stripe integration, billing-helpers, plan enforcement, and overage cron are already implemented.

</domain>

<decisions>
## Implementation Decisions

### BILL-01: Subscription feature unlock
- **D-01:** No real Stripe checkout in emulator — subscription state is simulated via **Admin SDK direct write** (set `planId`, `subscriptionStatus`, `stripeSubscriptionId` on master user doc in Firestore).
- **D-02:** Test pattern: start tenant on `free` plan with `usage.proposals = 5` (at limit), assert `POST /api/backend/v1/proposals` returns **402** (blocked — `ProposalMonthlyLimitError` in `proposals.controller.ts:1327` returns 402, not 403). Then write `planId = "pro"` via Admin SDK. Assert same POST now returns 201 (unblocked). Tests the before/after enforcement consequence — not just data shape.

### BILL-02 + BILL-03: Webhook subscription.created / subscription.cancelled
- **D-03:** Webhook simulation is done via **Admin SDK direct write** — bypasses the `stripeWebhook` Cloud Function signature verification entirely. The `stripeWebhook` function itself is not called in these tests.
- **D-04:** BILL-02 asserts that after writing `planId = "pro"` + `subscriptionStatus = "active"`, a previously-blocked API call is now allowed (API behavior change proves state is respected).
- **D-05:** BILL-03 asserts that after writing `planId = "free"` + `subscriptionStatus = "canceled"`, a previously-allowed action is blocked again (**402** on protected API call — matches `ProposalMonthlyLimitError` status code).

### BILL-04: Plan limit enforcement
- **D-06:** Test is **API level only** — no UI interaction. Set tenant to `free` plan with `usage.proposals` at the free limit (5) via Admin SDK. Then `POST /api/backend/v1/proposals` (authenticated, with valid payload) and assert the response is **402** with the plan limit error message from `checkProposalLimit()` (returns 402, not 403/422).
- **D-07:** Use a **separate seed tenant** for plan limit tests — don't mutate `tenant-alpha` (which is seeded with `planId = "pro"` to avoid polluting other tests). Create a fresh tenant or use `tenant-beta` with temporary plan downgrade.

### BILL-05: WhatsApp overage cron
- **D-08:** Test is a **direct HTTP test — no browser / no Playwright page**. Use Node `fetch` (or Playwright's `request` fixture) directly.
- **D-09:** Test flow: seed Firestore with `whatsappUsage/{tenantId}/months/{YYYY-MM}` doc having `overageMessages > 0` and `stripeReported = false` (no `stripeCustomerId` on tenant doc). Then `POST /internal/cron/whatsapp-overage-report` with `x-cron-secret` header. Then **read back the Firestore doc** and assert `stripeReported = false` (Stripe call fails in emulator — expected) and `errors[]` array is non-empty containing an entry with `tenantId` matching the seeded tenant. This exercises the pre-Stripe guard path and idempotency boundary without requiring a live Stripe call.
- **D-10:** The `x-cron-secret` value for tests must match `CRON_SECRET` in `functions/.env` — add a known test value to the Functions emulator env or read from the existing env.

### Claude's Discretion
- Exact Firestore document path for `whatsapp_usage` data (read `internal.controller.ts` to find the collection + document structure)
- Whether BILL-04 test uses `tenant-beta` directly or creates a throwaway tenant
- Exact error message/status code from `checkProposalLimit()` (read `billing-helpers.ts` — it throws with a Portuguese message)
- Whether BILL-02/03 use a single test with sequential state transitions or two separate tests
- How to read Firestore state in a pure HTTP test (Admin SDK in test helper, not page.route)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1–4 infrastructure (extend, don't rewrite)
- `e2e/fixtures/auth.fixture.ts` — `authenticatedPage` fixture; `interceptFirebaseRequests()`
- `e2e/fixtures/base.fixture.ts` — `setupEmulatorRoutes()` including the `/v1/stripe/plans` stub
- `e2e/seed/data/users.ts` — Note: admin users are seeded with `planId = "pro"` to avoid free-plan limits; BILL-04 tests need to override this
- `e2e/global-setup.ts` — Admin SDK initialization pattern (emulator env vars, project ID `demo-proops-test`)

### Billing logic (CRITICAL — read before implementing)
- `functions/src/lib/billing-helpers.ts` — `checkProposalLimit()`, `checkClientLimit()`, `checkUserLimit()`, `LEGACY_PROPOSAL_LIMITS` (free = 5 proposals). Exact error message and throw shape.
- `functions/src/lib/tenant-plan-policy.ts` — `TenantPlanTier`, `TenantPlanLimits`, `TenantPlanProfile`, enforcement modes

### Stripe webhook & subscription (read to understand data shape)
- `functions/src/stripe/stripeWebhook.ts` — Handles `customer.subscription.updated` (line ~924) and `customer.subscription.deleted` (line ~930). Shows exact Firestore write shape: `planId`, `subscriptionStatus`, `stripeSubscriptionId` fields on master user doc
- `functions/src/lib/auth-helpers.ts` — `UserDoc` interface with `planId`, `subscription`, `usage` field definitions

### WhatsApp overage cron
- `functions/src/api/controllers/internal.controller.ts` — `reportWhatsappOverageManual()`: reads Firestore `whatsapp_usage` collection, idempotency key pattern, Stripe usage API call
- `functions/src/api/routes/internal.routes.ts` — Route: `POST /internal/cron/whatsapp-overage-report` (requires `x-cron-secret` header)

### Emulator topology (established in prior phases)
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `http://127.0.0.1:8080`
- Functions emulator (Express `/api`): `http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api`
- Project ID: `demo-proops-test`

### Requirements
- `.planning/REQUIREMENTS.md` — BILL-01 through BILL-05 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `authenticatedPage` fixture: Used for all browser-based tests in prior phases — reuse for any UI assertions in BILL-01/02/03
- Admin SDK pattern: `e2e/global-setup.ts` already initializes Firebase Admin with emulator env — replicate pattern in seed helpers for test-level Firestore writes
- `e2e/seed/seed-factory.ts`: Pattern for direct Firestore writes via Admin SDK — add a `seedBillingState()` helper for plan + usage manipulation

### Established Patterns
- API-driven state setup (Phase 3/4): Use Admin SDK / API calls to set up state, not UI flows — especially critical here since Stripe checkout UI is not testable in emulator
- `create-then-delete` / cleanup pattern: Restore tenant state after billing tests to avoid polluting other tests
- Stripe plans stub (just established): `**/api/backend/v1/stripe/plans` returns `{ plans: [] }` — prevents dashboard 504 on test load

### Integration Points
- `functions/src/api/index.ts`: Express app with `stripeRoutes` (protected) and `publicStripeRoutes` (public, includes `GET /plans`) mounted
- `stripe.routes.ts`: `POST /sync` exists as a manual subscription sync endpoint — may be useful but calls real Stripe API; use Admin SDK writes instead
- `internal.routes.ts`: `POST /cron/whatsapp-overage-report` — cron endpoint under the Express `/api` function (not a separate Cloud Function)

### Key Technical Notes
- `stripeWebhook` is a **separate Cloud Function** at a different emulator URL from `/api` — not reachable via the same Express app. Admin SDK approach is correct.
- Plan enforcement reads `planId` from the master user doc at request time — Admin SDK write to the master user doc is sufficient to change enforcement behavior immediately.
- Free plan proposal limit (5) is in `LEGACY_PROPOSAL_LIMITS` and is a hard-coded constant — no Firestore plans collection read needed for free tier.
- `x-cron-secret` header value must match `CRON_SECRET` from `functions/.env` — the emulator loads this from the env file at startup.

</code_context>

<specifics>
## Specific Ideas

No specific references from discussion — open to standard approaches following established Phase 3/4 patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-stripe-billing-e2e*
*Context gathered: 2026-04-07*
