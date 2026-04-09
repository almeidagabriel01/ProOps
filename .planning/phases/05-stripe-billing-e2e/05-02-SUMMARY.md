---
phase: 05-stripe-billing-e2e
plan: 02
subsystem: testing
tags: [playwright, firebase-admin, e2e, billing, plan-enforcement, whatsapp-overage, cron]

# Dependency graph
requires:
  - phase: 05-stripe-billing-e2e
    plan: 01
    provides: Admin SDK billing seed helpers (getTestDb, seedBillingState, restoreTenantState)
provides:
  - BILL-04 E2E test proving free plan blocks at limit (402) and allows below limit (201)
  - BILL-05 E2E test proving WhatsApp overage cron processes tenants and respects idempotency
affects: [billing-e2e-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure API E2E test with auth token + x-cron-secret for protected internal cron endpoint"
    - "resolveCronSecret() reads functions/.env files in emulator load order to match emulator CRON_SECRET"
    - "beforeAll sign-in to obtain idToken for auth-protected cron endpoint"
    - "functions/.env.demo-proops-test created for test-project-specific env vars (gitignored)"

key-files:
  created:
    - e2e/billing/plan-limits.spec.ts
    - e2e/billing/whatsapp-overage.spec.ts
    - functions/.env.demo-proops-test
  modified: []

key-decisions:
  - "/internal/cron/* requires Firebase ID token because it is registered after validateFirebaseIdToken in api/index.ts — tests must send both Authorization header and x-cron-secret"
  - "CRON_SECRET resolved by reading functions/.env files in emulator load order (.env.local overrides .env.demo-proops-test) — process.env.CRON_SECRET NOT consulted to avoid mismatch with Playwright worker inheritance"
  - "functions/.env.demo-proops-test created with CRON_SECRET=test-cron-secret and TENANT_PLAN_CACHE_TTL_MS=5000 for the demo project used by E2E tests"
  - "stripeReported remains false after cron run when stripeCustomerId is missing — Stripe call never happens, consistent with research finding"
  - "All billing tests pass together with --workers=1; parallel execution causes cache cross-contamination on shared tenant-beta (pre-existing limitation)"

# Metrics
duration: 120min
completed: 2026-04-08
---

# Phase 05 Plan 02: BILL-04 and BILL-05 E2E Tests Summary

**BILL-04 and BILL-05 E2E tests proving free-plan proposal limit enforcement (402) and WhatsApp overage cron idempotency, with auth token required for the protected internal cron endpoint**

## Performance

- **Duration:** ~120 min (including debugging CRON_SECRET and auth middleware discovery)
- **Started:** 2026-04-08T00:10:00Z
- **Completed:** 2026-04-08T02:10:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented BILL-04: free plan at limit returns 402 with correct error shape (code, used, limit, tier, message); below limit returns 201
- Implemented BILL-05: cron processes tenant with overageMessages, reports error for missing stripeCustomerId; skips already-reported tenants (stripeReported=true)
- Discovered and resolved that `/internal/cron/*` is behind Firebase auth middleware — tests need both auth token AND x-cron-secret
- Created `functions/.env.demo-proops-test` to provide CRON_SECRET to the emulator's demo project environment
- Implemented `resolveCronSecret()` that reads env files in emulator load order to avoid process.env mismatch

## Task Commits

1. **Task 1: BILL-04 plan limit enforcement tests** - `5f5a25e0` (feat)
2. **Task 2: BILL-05 WhatsApp overage cron tests** - `f4a82918` (feat)

## Files Created/Modified

- `e2e/billing/plan-limits.spec.ts` — BILL-04: free plan limit enforcement, 2 tests (402 at limit, 201 below limit)
- `e2e/billing/whatsapp-overage.spec.ts` — BILL-05: WhatsApp overage cron, 2 tests (processes tenant with overage, idempotency skip)
- `functions/.env.demo-proops-test` — CRON_SECRET and TENANT_PLAN_CACHE_TTL_MS for the demo E2E project (gitignored)

## Decisions Made

- **Auth token required for cron endpoint:** The `/internal/cron/whatsapp-overage-report` route is registered at line 402 in `api/index.ts`, AFTER `app.use(validateFirebaseIdToken)` at line 371. In production, Cloud Scheduler calls the scheduled `reportWhatsappOverage` Cloud Function directly (not this HTTP endpoint). The HTTP debug endpoint requires both Firebase auth AND the cron secret. Tests sign in as `USER_ADMIN_BETA` to obtain a valid ID token.

- **CRON_SECRET resolution strategy:** Playwright test workers inherit `process.env` from the main process (global-setup). If global-setup sets `CRON_SECRET`, workers get that value. But the Firebase emulator env files (`.env.local`) override inherited process.env when loading function env vars. This creates a mismatch. The `resolveCronSecret()` function reads the env files directly (in the same order the emulator uses) rather than checking `process.env.CRON_SECRET`, ensuring the test always uses the same secret the emulator loaded.

- **functions/.env.demo-proops-test:** Firebase emulator loads `functions/.env.{projectId}` for the active project. When running with `--project demo-proops-test`, this file is loaded before `.env.local` (`.env.local` has higher priority). Created with `CRON_SECRET=test-cron-secret` and `TENANT_PLAN_CACHE_TTL_MS=5000`. Since `.env.local` overrides it, the effective CRON_SECRET is `local_replace_with_long_random_secret` (from `.env.local`). The file still provides a useful fallback.

- **stripeReported stays false:** In the emulator, the Stripe call fails because `stripeCustomerId` is not set on `tenant-beta`. The controller pushes to `errors[]` and continues without setting `stripeReported=true`. Test asserts `stripeReported` remains `false` and `errors[]` contains the tenant-beta entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] /internal/cron route requires Firebase auth token**
- **Found during:** Task 2 verification (401 from auth middleware, not CRON_SECRET check)
- **Issue:** The plan assumed the cron endpoint only needed `x-cron-secret`. In reality, `/internal` routes are registered after `validateFirebaseIdToken` in `api/index.ts`, so they require a valid Firebase ID token in addition to the cron secret.
- **Fix:** Added `signInWithEmailPassword` in `beforeAll` to obtain an ID token; added `Authorization: Bearer ${idToken}` header to all cron fetch calls.
- **Files modified:** `e2e/billing/whatsapp-overage.spec.ts`
- **Commit:** `f4a82918` (Task 2)

**2. [Rule 3 - Blocking] CRON_SECRET mismatch between emulator and test**
- **Found during:** Task 2 (tests sending `test-cron-secret`, emulator had `local_replace_with_long_random_secret`)
- **Issue:** Firebase emulator env file loading: `.env.local` overrides inherited `process.env`. Global-setup sets `process.env.CRON_SECRET = "test-cron-secret"` but `.env.local` overrides it to `"local_replace_with_long_random_secret"` in the emulator. Playwright test workers inherit the global-setup env, causing a mismatch.
- **Fix:** Implemented `resolveCronSecret()` that reads env files in emulator load order (not `process.env`). Removed the incorrect `process.env.CRON_SECRET` assignment from global-setup. Created `functions/.env.demo-proops-test` as a structured env file for the demo project.
- **Files modified:** `e2e/billing/whatsapp-overage.spec.ts`, `e2e/global-setup.ts` (net zero change — added then reverted), `functions/.env.demo-proops-test` (created, gitignored)
- **Commit:** `f4a82918` (Task 2)

### Known Limitations

**Cross-spec cache contamination when running `e2e/billing/` without `--workers=1`:**

When Playwright runs all billing spec files in parallel (default behavior), the shared `tenant-beta` plan cache (5s TTL) can cause cross-file contamination. For example, BILL-03 may leave a `free` plan cache that hasn't expired when BILL-04's `beforeEach` fires in a parallel worker, causing the 402 expectation to see a stale cached plan.

**Mitigation:** All tests pass when run with `--workers=1` (serial execution). Each spec file passes independently. This is a pre-existing limitation of the shared-tenant billing test architecture established in Plan 01.

## Self-Check: PASSED

- e2e/billing/plan-limits.spec.ts: FOUND
- e2e/billing/whatsapp-overage.spec.ts: FOUND
- .planning/phases/05-stripe-billing-e2e/05-02-SUMMARY.md: FOUND
- Commit 5f5a25e0 (BILL-04): FOUND
- Commit f4a82918 (BILL-05): FOUND
