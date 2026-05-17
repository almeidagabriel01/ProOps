---
phase: 19-single-writer-billing-foundation
plan: 01
subsystem: billing
tags: [stripe, billing, lru-cache, typescript, jest, types, foundation]

requires: []
provides:
  - lru-cache@^11.3.6 direct dependency in apps/functions/package.json
  - SubscriptionSnapshot interface — canonical nested map for tenants/{id}.subscription.*
  - SyncTenantPlanBillingSnapshotParams interface — caller-facing param shape for Plan 02 single writer
  - Wave 0 Jest scaffolds for BILL-06 (syncTenantPlanBillingSnapshot), BILL-07 (LRU cache), BILL-08 (stripe idempotency)
affects: [19-02, 19-03, 19-04, 19-05]

tech-stack:
  added: [lru-cache@^11.3.6]
  patterns:
    - "canonical billing types in apps/functions/src/shared/billing-types.ts — single source of truth for Plans 02-05"
    - "Wave 0 scaffold pattern — describe + passing smoke it + test.todo placeholders for downstream plan implementation"

key-files:
  created:
    - apps/functions/src/shared/billing-types.ts
    - apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts
    - apps/functions/src/billing/__tests__/stripe-idempotency.test.ts
    - apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts
  modified:
    - apps/functions/package.json
    - apps/functions/package-lock.json

key-decisions:
  - "BILL-08 scope locked: verification-only in Phase 19; existing db.runTransaction() in beginStripeEventProcessing already prevents cross-instance race; 5-min stuck-processing window accepted risk"
  - "Top-level billing fields kept in parallel with subscription.* map during Phase 19 — active readers on subscriptionStatus and currentPeriodEnd in checkManualSubscriptions.ts filters prevent dropping them"
  - "Requirements BILL-06/07/08 are scaffolded (not implemented) in Plan 01 — actual assertions land in Plans 02/04/05 respectively; requirements not marked complete at this stage"

patterns-established:
  - "billing-types.ts: canonical type file for all billing interfaces — Plans 02-05 import from here"
  - "Wave 0 scaffolds: self-contained test files with no production imports, enabling Plans 02/04/05 to replace test.todo without restructuring"

requirements-completed: []

duration: 4min
completed: 2026-05-08
---

# Phase 19 Plan 01: Wave 0 Foundation Summary

**lru-cache@^11 installed, SubscriptionSnapshot + SyncTenantPlanBillingSnapshotParams types created, and three Wave 0 Jest scaffolds (BILL-06/07/08) established as test.todo placeholders for Plans 02/04/05**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-08T00:18:03Z
- **Completed:** 2026-05-08T00:21:43Z
- **Tasks:** 3
- **Files modified:** 6 (2 package files + 1 type file + 3 test files)

## Accomplishments
- Installed `lru-cache@^11.3.6` as a direct dependency in `apps/functions/package.json` (previously only transitive at v6.0.0)
- Created `apps/functions/src/shared/billing-types.ts` with `SubscriptionSnapshot` and `SyncTenantPlanBillingSnapshotParams` — the canonical type contracts for Plan 02's extended single writer and Plan 03's consolidation targets
- Created three Wave 0 Jest scaffolds (BILL-06, BILL-07, BILL-08) with 14 `test.todo` placeholders total; all 3 files pass Jest with the smoke `it("scaffold present")` assertion

## Task Commits

Each task was committed atomically:

1. **Task 1: Install lru-cache@^11 as direct dependency** - `3d04d429` (chore)
2. **Task 2: Create SubscriptionSnapshot type + extended params interface** - `e354b871` (feat)
3. **Task 3: Create three Wave 0 test scaffolds (BILL-06, BILL-07, BILL-08)** - `723c4d70` (test)

## Files Created/Modified
- `apps/functions/package.json` — added `"lru-cache": "^11.3.6"` under dependencies
- `apps/functions/package-lock.json` — updated lock file for lru-cache@^11
- `apps/functions/src/shared/billing-types.ts` — `SubscriptionSnapshot` (15 fields) and `SyncTenantPlanBillingSnapshotParams` (17 fields + source union) interfaces
- `apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts` — BILL-06 scaffold (5 test.todo)
- `apps/functions/src/billing/__tests__/stripe-idempotency.test.ts` — BILL-08 scaffold (4 test.todo)
- `apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts` — BILL-07 scaffold (5 test.todo)

## lru-cache install details
- **Exact version installed:** 11.3.6
- **Named export:** `LRUCache` — available as `import { LRUCache } from 'lru-cache'`

## Type exports detail
- **`SubscriptionSnapshot`**: status, pastDueSince, cancelAtPeriodEnd, cancelAt, stripeSubscriptionId, stripePriceId, stripeCustomerId, currentPeriodStart, currentPeriodEnd, plan, scheduledPlan, scheduledPlanAt, scheduledPlanReason, syncedAt, lastEventId
- **`SyncTenantPlanBillingSnapshotParams`**: tenantId, subscriptionStatus, stripePriceId, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd, cancelAt, cancelScheduledAt, pastDueSince, trialEndsAt, plan, scheduledPlan, scheduledPlanAt, scheduledPlanReason, billingInterval, clearScheduled, eventId, source

## Test scaffold detail
| File | Requirement | test.todo count | Key keywords |
|------|-------------|-----------------|--------------|
| syncTenantPlanBillingSnapshot.test.ts | BILL-06 | 5 | "single writer", "BILL-06", "db.runTransaction()" |
| stripe-idempotency.test.ts | BILL-08 | 4 | "BILL-08", "idempotency", "eventId", "duplicate" |
| tenant-plan-policy.lru.test.ts | BILL-07 | 5 | "BILL-07", "LRU", "PLAN_CACHE", "clearTenantPlanCache" |

## Decisions Made
- BILL-08 scope is locked as verification-only: the `db.runTransaction()` in `beginStripeEventProcessing` already prevents the cross-instance race; the 5-minute stuck-processing window is accepted risk per plan objective
- Top-level billing fields kept in parallel with `subscription.*` during Phase 19 — `subscriptionStatus` and `currentPeriodEnd` are active Firestore query filters in `checkManualSubscriptions.ts`
- Requirements BILL-06/07/08 are not marked complete — scaffolds created but real assertions land in Plans 02/04/05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs

None — no production code was created in this plan. All files are type definitions and test scaffolds.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Type definitions and test scaffolds only.

## Next Phase Readiness
- Plan 02 (BILL-06): can import `SyncTenantPlanBillingSnapshotParams` from `../shared/billing-types` and replace `syncTenantPlanBillingSnapshot.test.ts` placeholders
- Plan 04 (BILL-07): `lru-cache@^11` is installed and `LRUCache` named export is available; `tenant-plan-policy.lru.test.ts` scaffolds await real LRU assertions
- Plan 05 (BILL-08): `stripe-idempotency.test.ts` scaffold awaits emulator replay test implementation

---
*Phase: 19-single-writer-billing-foundation*
*Completed: 2026-05-08*
