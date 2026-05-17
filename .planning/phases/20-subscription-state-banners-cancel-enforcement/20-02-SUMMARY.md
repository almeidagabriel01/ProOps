---
phase: 20-subscription-state-banners-cancel-enforcement
plan: "02"
subsystem: backend-billing
tags: [billing, backend, stripe, cancel, single-writer]
dependency_graph:
  requires: [20-01]
  provides: [subscription.cancelAt field populated, past_due immediate cancel]
  affects: [stripe.controller.ts, stripeWebhook.ts, billing-types.ts]
tech_stack:
  added: []
  patterns: [single-writer via syncTenantPlanBillingSnapshot, Phase 19 canonical field reads]
key_files:
  created: []
  modified:
    - apps/functions/src/api/controllers/stripe.controller.ts
    - apps/functions/src/stripe/stripeWebhook.ts
    - apps/functions/src/shared/billing-types.ts
decisions:
  - "Branch decision reads tenantData.subscription?.status (Phase 19 canonical field) — no fallback to tenantData.subscriptionStatus"
  - "past_due cancel passes pastDueSince: null to single writer but writer derives pastDueSince from lifecyclePatch (status-based logic) — for canceled status the lifecycle helper preserves existing pastDueSince; subscription.deleted webhook reconciles on Stripe confirmation"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-08"
  tasks_completed: 2
  files_modified: 3
---

# Phase 20 Plan 02: Backend Cancel Enforcement + cancelAt Wiring Summary

Two surgical fixes to the single-writer flow: past_due tenants can now cancel immediately, and both the controller and webhook now populate `subscription.cancelAt` so the yellow banner has a real date.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | past_due immediate-cancel branch + cancelAt on at-period-end | 8bf842cc | stripe.controller.ts, billing-types.ts |
| 2 | cancelAt + cancelAtPeriodEnd in webhook cancel_at_period_end branch | ee7263d9 | stripeWebhook.ts |

## Diff Summary

### apps/functions/src/api/controllers/stripe.controller.ts
- +53 lines, -8 lines (net +45)
- Added `subscriptionMap` read from `tenantData.subscription` (canonical Phase 19 field)
- Added `if (subscriptionStatus === 'past_due')` branch calling `stripe.subscriptions.cancel()` + single writer with `subscriptionStatus='canceled', plan='free', stripeSubscriptionId=null, cancelAtPeriodEnd=false, pastDueSince=null`
- Added `cancelAtDate` extraction from `updated.cancel_at` (Stripe seconds) with fallback to `current_period_end`
- Passed `cancelAt: cancelAtDate` to existing `syncTenantPlanBillingSnapshot` call on at-period-end path
- Response `cancelAt` now uses `cancelAtDate.toISOString()` instead of `currentPeriodEnd` (more accurate)

### apps/functions/src/stripe/stripeWebhook.ts
- +6 lines, -0 lines
- Added `cancelAt: cancelAt.toDate()` and `cancelAtPeriodEnd: true` to `cancel_at_period_end` branch sync call
- Added `cancelAt: null` and `cancelAtPeriodEnd: false` to rescind branch sync call

### apps/functions/src/shared/billing-types.ts
- +1 line
- Added `"controller.cancelSubscription.past_due_immediate"` to `source` union (compile error auto-fix)

## Confirmations

- **subscription.cancelAt populated by controller**: at-period-end branch now passes `cancelAt: cancelAtDate` (a JS `Date`) to `syncTenantPlanBillingSnapshot`; the writer converts it to ISO string via `params.cancelAt.toISOString()` and writes to `tenants/{tenantId}.subscription.cancelAt`.
- **subscription.cancelAt populated by webhook**: `cancel_at_period_end` webhook branch now passes `cancelAt: cancelAt.toDate()` (Timestamp → Date); same writer path applies.
- **Rescind clears cancelAt**: rescind branch passes `cancelAt: null`; writer conditional `"cancelAt" in params` is satisfied and writes `null` to the field.
- **No parallel writers introduced**: both fixes route exclusively through `syncTenantPlanBillingSnapshot`. No `userRef.set` added for billing fields in the past_due branch. The existing `userRef.set` in the at-period-end path was kept unchanged (user-doc legacy fields only).
- **Phase 19 single-writer contract preserved**: all tenant billing-state writes go through the single writer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing source literal to billing-types.ts**
- **Found during:** Task 1 — TypeScript compile error
- **Issue:** `source` field in `SyncTenantPlanBillingSnapshotParams` is a string literal union; `"controller.cancelSubscription.past_due_immediate"` was not in the union.
- **Fix:** Added `"controller.cancelSubscription.past_due_immediate"` to the `source` union in `billing-types.ts`.
- **Files modified:** `apps/functions/src/shared/billing-types.ts`
- **Commit:** 8bf842cc (included in Task 1 commit)

## Deferred Items

**pastDueSince clearing for canceled status in single writer**: `buildTenantSubscriptionLifecyclePatch` only clears `pastDueSince` for `active` or `trialing` status — not for `canceled`. The `params.pastDueSince: null` passed in the past_due immediate cancel call is not used by the writer (writer uses `lifecyclePatch.pastDueSince` derived from status). For `canceled` status, the existing `pastDueSince` is preserved in Firestore until the `subscription.deleted` webhook fires (which sets `pastDueSince: null` via `handleSubscriptionDeleted`). This is a pre-existing limitation outside the scope of this plan; the `subscription.deleted` webhook is the authoritative reconciliation path.

## Known Stubs

None — both fixes wire real data paths.

## Threat Flags

None — no new network endpoints or auth paths introduced. Changes are internal to existing controller and webhook handlers. Security review per STRIDE register in plan: T-20-02-01 mitigated (branch reads Firestore `tenantData.subscription?.status`, not request body); T-20-02-02 mitigated (existing `assertSubscriptionOwnership` unchanged).

## Self-Check: PASSED

- `apps/functions/src/api/controllers/stripe.controller.ts` — exists, modified
- `apps/functions/src/stripe/stripeWebhook.ts` — exists, modified
- `apps/functions/src/shared/billing-types.ts` — exists, modified
- Commit `8bf842cc` — exists in git log
- Commit `ee7263d9` — exists in git log
- `npm run build` exits 0 — verified
- `npm run lint` exits 0 (0 errors, 7 pre-existing warnings) — verified
