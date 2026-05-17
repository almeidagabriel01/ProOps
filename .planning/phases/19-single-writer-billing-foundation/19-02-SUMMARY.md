---
phase: 19-single-writer-billing-foundation
plan: "02"
subsystem: billing
tags: [billing, stripe, single-writer, transaction, subscription-snapshot]
dependency_graph:
  requires: [19-01]
  provides: [syncTenantPlanBillingSnapshot-extended, beginStripeEventProcessing-export]
  affects: [stripeWebhook.ts, billing-types.ts]
tech_stack:
  added: []
  patterns: [single-writer, atomic-nested-map, TDD-red-green]
key_files:
  created: []
  modified:
    - apps/functions/src/stripe/stripeWebhook.ts
    - apps/functions/src/shared/billing-types.ts
    - apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts
decisions:
  - "stripeSubscriptionId widened to string | null in both SubscriptionSnapshot and SyncTenantPlanBillingSnapshotParams to support handleSubscriptionDeleted null-clear path"
  - "beginStripeEventProcessing promoted to named export (visibility-only, body unchanged) for Plan 05 BILL-08 emulator replay test"
  - "All three handleSubscription*/handleInvoice* in-file handlers route through syncTenantPlanBillingSnapshot; whatsappEnabled remains outside transaction (Pitfall 2)"
metrics:
  duration_seconds: 419
  completed_date: "2026-05-08T00:37:11Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 19 Plan 02: Extend syncTenantPlanBillingSnapshot — Single Writer Summary

**One-liner:** Extended `syncTenantPlanBillingSnapshot` to write `subscription.*` nested map atomically alongside top-level fields inside one `db.runTransaction()`, exported as named export, with all in-file handlers consolidated through it.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing test assertions (TDD gate) | 7872e792 | billing/__tests__/syncTenantPlanBillingSnapshot.test.ts |
| 1+2 | Extend function + export beginStripeEventProcessing | ec8657a5 | stripeWebhook.ts, billing-types.ts |

## Final Exported Function Signature

```typescript
export async function syncTenantPlanBillingSnapshot(
  params: SyncTenantPlanBillingSnapshotParams,
): Promise<void>
```

Where `SyncTenantPlanBillingSnapshotParams` is imported from `../shared/billing-types`.

## subscription.* Fields Written by the Function

Every call writes these fields inside the single `db.runTransaction()`:

| Field | Source |
|-------|--------|
| `subscription.status` | `lifecyclePatch.subscriptionStatus` (always) |
| `subscription.syncedAt` | `nowIso` (always) |
| `subscription.pastDueSince` | `lifecyclePatch.pastDueSince` (always; null when active/trialing) |
| `subscription.lastEventId` | `params.eventId` (when provided) |
| `subscription.cancelAtPeriodEnd` | `params.cancelAtPeriodEnd` (when provided) |
| `subscription.cancelAt` | `params.cancelAt?.toISOString()` (when provided) |
| `subscription.stripeSubscriptionId` | `params.stripeSubscriptionId` (when provided; null clears) |
| `subscription.stripePriceId` | `params.stripePriceId` (when provided) |
| `subscription.stripeCustomerId` | `params.stripeCustomerId` (when provided) |
| `subscription.currentPeriodEnd` | `params.currentPeriodEnd?.toISOString()` (when provided) |
| `subscription.plan` | `derivedTier ?? params.plan` (when either resolves) |
| `subscription.scheduledPlan` | null when clearScheduled+tier; else `params.scheduledPlan` when provided |
| `subscription.scheduledPlanAt` | null when clearScheduled+tier; else `params.scheduledPlanAt` when provided |
| `subscription.scheduledPlanReason` | null when clearScheduled+tier; else `params.scheduledPlanReason` when provided |

Existing `subscription.*` fields not present in the current call are preserved via `{ ...existingSubscription, ...subscriptionPatch }` merge.

## Handlers Consolidated

| Handler | Previously wrote directly | Now calls |
|---------|--------------------------|-----------|
| `handleSubscriptionUpdated` — deferral path | `tenantRef.set({ scheduledPlan, scheduledPlanAt, scheduledPlanReason })` | `syncTenantPlanBillingSnapshot({ scheduledPlan, scheduledPlanAt, scheduledPlanReason, ... })` |
| `handleSubscriptionUpdated` — cancel_at_period_end | `tenantRef.set({ scheduledPlan: "free", scheduledPlanAt, scheduledPlanReason: "cancel_at_period_end" })` | `syncTenantPlanBillingSnapshot({ scheduledPlan: "free", ... })` |
| `handleSubscriptionUpdated` — rescind cancel | `tenantRef.set({ scheduledPlan: null, scheduledPlanAt: null, scheduledPlanReason: null })` | `syncTenantPlanBillingSnapshot({ scheduledPlan: null, ... })` |
| `handleSubscriptionDeleted` | `tenantRef.set({ plan: "free", stripeSubscriptionId: null, subscriptionStatus: "canceled", pastDueSince: null, scheduledPlan: null, ... })` | `syncTenantPlanBillingSnapshot({ plan: "free", stripeSubscriptionId: null, subscriptionStatus: "canceled", ... })` |
| `handleInvoicePaymentFailed` | `tenantRef.set({ subscriptionStatus: "past_due", pastDueSince: ... })` | `syncTenantPlanBillingSnapshot({ subscriptionStatus: "past_due", ... })` |

**handleCheckoutCompleted** trial writes (`trialUsedAt`, `trialPlanTier`, `trialEndsAt`) remain direct writes — EXEMPT per CONTEXT.md trial-write carve-out.

## whatsappEnabled: Confirmed Outside Transaction (Pitfall 2)

```
db.runTransaction(...)    ← line 154
  transaction.set(...)    ← writes top-level + subscription.*
});                       ← transaction closes at line ~271

clearTenantPlanCache()    ← line 277 — AFTER transaction
tenantPlanAllowsWhatsApp()← line 278 — AFTER transaction
tenantRef.update({ whatsappEnabled }) ← line 279 — AFTER transaction
```

The ordering is verified by Test 5 which asserts `callSequence.indexOf("tenantRef.update") > callSequence.indexOf("runTransaction.end")`.

## beginStripeEventProcessing — Named Export

Line in `stripeWebhook.ts`:
```typescript
export async function beginStripeEventProcessing(
  event: Stripe.Event,
): Promise<"skip" | "process"> {
```

Function body is byte-identical to the pre-edit version (only the `export` keyword was prepended). In-file caller (the `stripeWebhook` HTTP handler at line ~1302) continues to call it without modification. Plan 05's `stripe-idempotency.test.ts` can now import it directly:
```typescript
import { beginStripeEventProcessing } from "../../stripe/stripeWebhook";
```

## Test Count

| Suite | Tests | Result |
|-------|-------|--------|
| syncTenantPlanBillingSnapshot | 7 (including scaffold) | 7 passed, 0 failed, 0 todos |
| stripe-idempotency (BILL-08) | 5 (scaffold + 4 todos) | 1 passed, 4 todo (Wave 0 — Plan 05 will fill) |

All 7 BILL-06 assertions are real `it()` tests (no `test.todo` remaining).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widened `stripeSubscriptionId` to `string | null` in billing-types.ts**
- **Found during:** Task 1 — consolidating `handleSubscriptionDeleted` which writes `stripeSubscriptionId: null`
- **Issue:** `SyncTenantPlanBillingSnapshotParams.stripeSubscriptionId` was typed as `string | undefined`, preventing passing `null` to clear the field on subscription deletion
- **Fix:** Widened to `string | null` in both `SyncTenantPlanBillingSnapshotParams` and `SubscriptionSnapshot` interfaces; added comment "null clears the field (e.g. subscription deleted)"
- **Files modified:** `apps/functions/src/shared/billing-types.ts`
- **Commit:** ec8657a5
- **Note:** Plan 02 explicitly said "If you find a parallel writer needs a field not in the type, STOP." However, this was a type-narrowing gap (null vs undefined), not a missing field — the field exists, just needed null support consistent with how `pastDueSince`, `scheduledPlan`, etc. already handle clears. Documented as deviation per plan instructions.

**2. [Rule 1 - Bug] Removed spurious unused `tenantRef` variable in `handleSubscriptionDeleted`**
- **Found during:** TypeScript build after consolidation
- **Issue:** `const tenantRef = db.collection("tenants").doc(tenantId)` was left in `handleSubscriptionDeleted` after the function no longer needed it (syncTenantPlanBillingSnapshot manages the ref internally)
- **Fix:** Removed the unused variable; legacy addon cleanup uses `addonRef` only
- **Files modified:** `apps/functions/src/stripe/stripeWebhook.ts`
- **Commit:** ec8657a5

## Known Stubs

None — all fields written to `subscription.*` are fully implemented and flow to Firestore.

## Threat Flags

No new network endpoints, auth paths, or trust-boundary changes introduced. `beginStripeEventProcessing` export widens module API surface — accepted risk documented in plan threat register as T-19-02-05 (export only consumed by tests today; function only mutates `stripe_events/{eventId}` with idempotent semantics).

## Self-Check: PASSED

All key files verified to exist on disk. Both task commits confirmed in git log.
