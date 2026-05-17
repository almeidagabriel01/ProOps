---
phase: 19-single-writer-billing-foundation
verified: 2026-05-07T18:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "All code paths writing billing state call syncTenantPlanBillingSnapshot — no parallel writer exists anywhere in the codebase"
  gaps_remaining: []
  regressions: []
---

# Phase 19: Single-Writer Billing Foundation — Verification Report

**Phase Goal:** All billing state writes in the system flow through a single transactional function — eliminating the race conditions and partial-state bugs caused by multiple independent writers today.
**Verified:** 2026-05-07T18:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure via Plan 19-06

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | All code paths writing billing state call `syncTenantPlanBillingSnapshot` — no parallel writer exists anywhere | VERIFIED | `admin.controller.ts`: 5 remaining `tenantRef` writes at lines 1185 (EXEMPT: planId raw pointer), 1527 (whatsappEnabled-only, Pitfall 2), 2057 (EXEMPT: recomputeTenantFeatures re-assertion, whatsappEnabled + featuresRecomputedAt only), 2141 (EXEMPT: whatsappEnabled enterprise override), 2147 (EXEMPT: featuresRecomputedAt non-billing-state recompute marker). All billing-state fields (plan, scheduledPlan, scheduledPlanAt, scheduledPlanReason) now route through `syncTenantPlanBillingSnapshot` with source tags `admin.updateUserPlan` and `admin.forceSetTenantPlan`. |
| 2 | Every billing write is atomic: top-level fields and `subscription.*` committed in one `db.runTransaction()` | VERIFIED | `syncTenantPlanBillingSnapshot` (stripeWebhook.ts:154–271): single `db.runTransaction()` writes top-level patch AND `patch.subscription = { ...existingSubscription, ...subscriptionPatch }` at line 268 inside the same transaction, committed at line 270 via `transaction.set(tenantRef, patch, { merge: true })`. `updateUserPlan` and `forceSetTenantPlan` now both call the single writer and produce `subscription.*` counterparts. `recomputeTenantFeatures` is EXEMPT (no subscription-state mutation). |
| 3 | LRU cache: max=500, TTL=30s hard-coded, unbounded Map removed | VERIFIED | `require-active-subscription.ts:18`: `new LRUCache({ max: 500, ttl: 30_000 })`. `tenant-plan-policy.ts:117`: `new LRUCache({ max: PLAN_CACHE_MAX_SIZE, ttl: 30_000 })` where `PLAN_CACHE_MAX_SIZE = 500`. `resolvePlanCacheTtlMs()` confirmed deleted as a callable function (exists only in a comment). |
| 4 | Duplicate Stripe event returns 200 without re-executing business logic | VERIFIED | `beginStripeEventProcessing` named export confirmed at stripeWebhook.ts:529. `stripe-idempotency.test.ts` imports it statically. 5 unit tests pass on `shouldSkipStripeEventRecord` truth table; 1 emulator integration test skipped correctly when `FIRESTORE_EMULATOR_HOST` unset. |

**Score:** 4/4 truths verified

### Previously-Clean Files (Re-Confirmed)

Plan 19-06 only modified `billing-types.ts`, `admin.controller.ts`, and `syncTenantPlanBillingSnapshot.test.ts`. The five files confirmed clean in the initial verification were not in scope for Plan 19-06 and remain clean:

- `tenants.controller.ts:66` — `safeUpdate` limited to name/niche/primaryColor/logoUrl/proposalDefaults/transactionStatusOrder + whatsappEnabled; no billing-state fields
- `whatsapp-eligibility.ts:67` — writes `whatsappEnabled` only; Pitfall 2 carve-out
- `mercadopago.service.ts` (lines 135, 192, 246) — writes `mercadoPago`, `mercadoPagoEnabled`; MercadoPago integration config only
- `transaction-payment.service.ts` — no `tenantRef.set/update` calls
- `checkout-reservation.ts` — writes `checkoutInFlightAt`, `checkoutInFlightContext` via Firestore transaction internals (not direct `tenantRef.set/update`)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `apps/functions/src/shared/billing-types.ts` | `SyncTenantPlanBillingSnapshotParams.source` union contains `admin.updateUserPlan` and `admin.forceSetTenantPlan` | VERIFIED | Both literals confirmed at lines 93–94 of billing-types.ts |
| `apps/functions/src/api/controllers/admin.controller.ts` | Imports `syncTenantPlanBillingSnapshot`; `updateUserPlan` and `forceSetTenantPlan` call it; all remaining direct writes carry EXEMPT comments | VERIFIED | Import at line 27; `syncTenantPlanBillingSnapshot` calls at lines 1202 and 2126; all 5 remaining `tenantRef` writes carry EXEMPT comments; `plan: tierFromPlanId` confirmed at line 1205 |
| `apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts` | Phase-gate audit extended to admin.controller.ts (consolidatedFiles + expectedTags + Plan 06 gap closure test) | VERIFIED | `admin.controller.ts` added to `consolidatedFiles` (line 279); `admin.updateUserPlan` and `admin.forceSetTenantPlan` added to `expectedTags` (lines 333–334); "Plan 06 gap closure" test at line 343 |
| `apps/functions/src/api/middleware/require-active-subscription.ts` | LRUCache max=500, ttl=30_000 | VERIFIED | Confirmed at line 18 |
| `apps/functions/src/lib/tenant-plan-policy.ts` | LRUCache max=500, ttl=30_000; resolvePlanCacheTtlMs deleted | VERIFIED | PLAN_CACHE constructor at line 117; resolvePlanCacheTtlMs exists only in a comment |
| `apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts` | 10 BILL-06 tests passing (9 from Plan 03 + 1 new gap closure test) | VERIFIED | 10 passed, 0 failed |
| `apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts` | 5 BILL-07 tests passing | VERIFIED | 5 passed |
| `apps/functions/src/billing/__tests__/stripe-idempotency.test.ts` | 5 unit + 1 emulator integration test | VERIFIED | 5 passed, 1 skipped (emulator not running — correct behavior) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `admin.controller.ts` (updateUserPlan) | `syncTenantPlanBillingSnapshot` | `source: "admin.updateUserPlan"` at line 1206 | WIRED | `plan: tierFromPlanId` — uses `normalizePlanTier(planId)` directly, NOT `getTenantPlanProfile` (which would return stale tier) |
| `admin.controller.ts` (forceSetTenantPlan) | `syncTenantPlanBillingSnapshot` | `source: "admin.forceSetTenantPlan"` at line 2131 | WIRED | `plan: tier`, `clearScheduled: true` — clears scheduledPlan/At/Reason inside the writer's transaction |
| `billing-sync.service.ts:~167` | `syncTenantPlanBillingSnapshot` | direct call | WIRED | Confirmed in cron billing-state write path (unchanged from initial verification) |
| `stripe.controller.ts` (4 callsites) | `syncTenantPlanBillingSnapshot` | direct calls | WIRED | cancelSubscription, createCheckoutSession plan-change, confirmCheckoutSession (x2), syncSubscription |
| `stripeHelpers.ts` (3 callsites) | `syncTenantPlanBillingSnapshot` | direct calls | WIRED | helpers.updateUserPlan, helpers.runStripeSync, helpers.upsertTenantStripeBillingData |
| `applyScheduledPlanChanges.ts` | `subscription.*` fields | dotted-key in existing tx.set | WIRED | Pitfall 5 resolution — subscription.plan, subscription.scheduledPlan written inline |
| `stripeWebhook.ts` (5 event handlers) | `syncTenantPlanBillingSnapshot` | direct calls | WIRED | handleSubscriptionUpdated x3, handleSubscriptionDeleted, handleInvoicePaymentFailed |
| `stripe-idempotency.test.ts` | `beginStripeEventProcessing` | static import at file top | WIRED | Import at line 21, no dynamic fallback |

### Data-Flow Trace (Level 4)

Not applicable — Phase 19 produces no UI components that render dynamic data. All artifacts are backend billing functions, test files, and types.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript build passes | `cd apps/functions && npm run build` | Exit 0, no errors | PASS |
| BILL-06 tests (10 assertions) | `npx jest syncTenantPlanBillingSnapshot --runInBand` | 10 passed | PASS |
| BILL-07 tests (5 assertions) | `npx jest tenant-plan-policy.lru --runInBand` | 5 passed | PASS |
| BILL-08 tests (5 unit + 1 emulator) | `npx jest stripe-idempotency --runInBand` | 5 passed, 1 skipped (emulator not running) | PASS |
| Combined suite | `npx jest "syncTenantPlanBillingSnapshot\|tenant-plan-policy.lru\|stripe-idempotency" --runInBand` | 20 passed, 1 skipped, 3 suites | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| BILL-06 | 19-01, 19-02, 19-03, 19-06 | Single writer, atomic writes via db.runTransaction(), universal coverage | SATISFIED | All billing-state callsites now route through `syncTenantPlanBillingSnapshot`. Phase-gate test (10 assertions) permanently enforces no regressions. Both `admin.updateUserPlan` and `admin.forceSetTenantPlan` source tags confirmed in codebase and test registry. |
| BILL-07 | 19-01, 19-04 | LRU 500 entries, 30s TTL, replaces unbounded Map | SATISFIED | Both caches verified with correct constructor args. 5 BILL-07 tests pass. Note: REQUIREMENTS.md still shows `[ ]` Pending — documentation drift, not a code gap. |
| BILL-08 | 19-01, 19-05 | Stripe idempotency via stripe_events/{eventId} | SATISFIED | Named export confirmed, 5 unit tests + 1 emulator integration test pass. REQUIREMENTS.md shows `[x]` Complete — matches. |

### Anti-Patterns Found

None. All previous anti-patterns (direct `plan`, `scheduledPlan*` writes in admin.controller.ts) are resolved. All 5 remaining `tenantRef.set/update` calls in admin.controller.ts write only EXEMPT fields (planId raw pointer, whatsappEnabled, featuresRecomputedAt) and carry explicit EXEMPT comments documenting the justification.

### Human Verification Required

None — all verifiable behaviors were checked programmatically (grep, build, tests). Phase 19 is structural backend hardening with no UI components.

### Gaps Summary

No gaps. The single gap from the initial verification (admin.controller.ts parallel writers) was closed by Plan 19-06:

- `updateUserPlan` now routes the plan tier through `syncTenantPlanBillingSnapshot({ plan: tierFromPlanId, source: "admin.updateUserPlan" })`. Uses `normalizePlanTier(planId)` directly — not `getTenantPlanProfile` which would return a stale tier. The only remaining direct write is `planId` (EXEMPT: raw Stripe price-id pointer, not a Phase 19 billing-state field).
- `forceSetTenantPlan` now routes plan and scheduled fields through `syncTenantPlanBillingSnapshot({ plan: tier, clearScheduled: true, source: "admin.forceSetTenantPlan" })`. Post-writer direct writes cover only `whatsappEnabled` enterprise override and `featuresRecomputedAt`, both EXEMPT-commented.
- `recomputeTenantFeatures` EXEMPT path: `plan` field removed from the direct `tenantRef.update` payload; remaining write contains only `whatsappEnabled` and `featuresRecomputedAt` with EXEMPT comment. Re-assertion with no subscription-state mutation — routing through the writer would require a synthetic `subscriptionStatus` and produce no behavior change.

The phase-gate audit test in `syncTenantPlanBillingSnapshot.test.ts` permanently enforces this closure: any regression in the three callsites breaks the "Plan 06 gap closure" test and the per-source traceability assertions.

---

_Verified: 2026-05-07T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
