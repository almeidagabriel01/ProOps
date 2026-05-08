---
phase: 19-single-writer-billing-foundation
plan: "03"
subsystem: billing
tags: [billing, stripe, single-writer, consolidation, firestore]
dependency_graph:
  requires: [19-02]
  provides: [BILL-06-complete]
  affects: [billing-sync, stripe-webhook, stripe-helpers, stripe-controller, apply-scheduled-plan]
tech_stack:
  added: []
  patterns:
    - Single-writer billing pattern via syncTenantPlanBillingSnapshot
    - EXEMPT comment pattern for auditable non-billing-state writes
    - Pitfall 5 mitigation — subscription.* dotted-key extension inside existing tx.set
key_files:
  created: []
  modified:
    - apps/functions/src/billing/billing-sync.service.ts
    - apps/functions/src/applyScheduledPlanChanges.ts
    - apps/functions/src/api/controllers/stripe.controller.ts
    - apps/functions/src/stripe/stripeHelpers.ts
    - apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts
decisions:
  - "billing-sync.service.ts passes plan: plan explicitly to syncTenantPlanBillingSnapshot to preserve resolvePlanFromPrice behavior (different from resolvePriceToTier used inside the writer)"
  - "applyScheduledPlanChanges.ts uses dotted-key subscription.* writes inside existing tx.set — cannot nest syncTenantPlanBillingSnapshot call (Pitfall 5)"
  - "upsertTenantStripeBillingData split: stripeCustomerId/stripeSubscriptionId routed through single writer (reading existing subscriptionStatus non-authoritatively per T-19-03-05); addon-item ids remain as EXEMPT direct write"
  - "Three customer-id-only writes in stripe.controller.ts (createAddonCheckoutSession, createCheckoutSession pre-subscription, createPortalSession) marked EXEMPT — no subscription exists yet at those callsites"
  - "executor.test.ts failure (create_transaction confirmed=true assertion) is pre-existing and unrelated to Phase 19; confirmed by running test on stashed state before changes"
metrics:
  duration: ~45min
  completed: "2026-05-08"
  tasks: 3
  files: 5
---

# Phase 19 Plan 03: Billing Writer Consolidation Summary

Single-writer pattern enforced across all Stripe billing-state callsites — all tenant billing-state mutations (subscriptionStatus, plan, stripePriceId, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd, cancelAtPeriodEnd, pastDueSince, trialEndsAt, billingInterval) now flow through `syncTenantPlanBillingSnapshot` from `stripeWebhook.ts`, with EXEMPT comments on every remaining direct write.

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| 1 — billing-sync + applyScheduledPlanChanges | e8a332ac | Route cron billing patch through single writer; extend scheduled-plan tx with subscription.* dotted keys |
| 2 — stripe.controller + stripeHelpers | 22cc59a4 | Consolidate 4 controller callsites + 3 helper callsites; split upsertTenantStripeBillingData |
| 3 — Phase-gate audit + tests | 0f9d5f96 | Add EXEMPT comments to control-plane writes; add 2 new phase-gate tests (9 total in BILL-06) |

## Consolidated Callsites

| File | Function | Source Tag | Line (approx) |
|------|----------|------------|---------------|
| billing/billing-sync.service.ts | syncTenantBillingFromStripe | cron.checkStripeSubscriptions | ~167 |
| api/controllers/stripe.controller.ts | cancelSubscription | controller.cancelSubscription | ~503 |
| api/controllers/stripe.controller.ts | createCheckoutSession (plan-change) | controller.createCheckoutSession | ~973 |
| api/controllers/stripe.controller.ts | confirmCheckoutSession (trialEndsAt) | controller.confirmCheckoutSession | ~1235 |
| api/controllers/stripe.controller.ts | confirmCheckoutSession (main billing) | controller.confirmCheckoutSession | ~1273 |
| api/controllers/stripe.controller.ts | syncSubscription | controller.syncSubscription | ~1823 |
| stripe/stripeHelpers.ts | updateUserPlan | helpers.updateUserPlan | ~120 |
| stripe/stripeHelpers.ts | runStripeSync | helpers.runStripeSync | ~374 |
| stripe/stripeHelpers.ts | upsertTenantStripeBillingData (billing portion) | helpers.upsertTenantStripeBillingData | ~513 |

## EXEMPT Lines (annotated in code)

| File | Line (approx) | Reason |
|------|---------------|--------|
| billing/billing-sync.service.ts | ~70 | billingSyncedAt timestamp only — no billing-state fields |
| billing/billing-sync.service.ts | ~74 | billingSyncing control-plane flag |
| billing/billing-sync.service.ts | ~132 | billingSyncing + billingSyncedAt only (empty-subscription path) |
| billing/billing-sync.service.ts | ~233 | billingSyncing control-plane flag (finally cleanup) |
| stripe/stripeHelpers.ts upsertTenantStripeBillingData | ~547 | Addon-item identifiers (whatsappOveragePriceId/whatsappOverageSubscriptionItemId) — NOT in subscription.* schema |
| api/controllers/stripe.controller.ts createAddonCheckoutSession | ~609 | Customer-id-only write before subscription exists |
| api/controllers/stripe.controller.ts createCheckoutSession | ~1025 | Customer-id-only write before subscription exists |
| api/controllers/stripe.controller.ts createPortalSession | ~1568 | Customer-id-only write before subscription exists |

Additionally preserved (Pitfall 2 pattern — whatsappEnabled second write outside transaction):
- `stripeWebhook.ts` line ~279: `tenantRef.update({ whatsappEnabled })` after syncTenantPlanBillingSnapshot's own transaction
- `applyScheduledPlanChanges.ts` line ~126: `tenantRef.update({ whatsappEnabled })` after cron's own transaction

## applyScheduledPlanChanges.ts — Pitfall 5 Resolution

Cannot call `syncTenantPlanBillingSnapshot` inside the existing `db.runTransaction()` (Firebase Admin SDK does not support nested transactions). Instead, subscription.* dotted-key fields were added directly to the existing `tx.set()` call:

```typescript
tx.set(tenantRef, {
  plan: scheduledTier,
  scheduledPlan: null,
  scheduledPlanAt: null,
  scheduledPlanReason: null,
  updatedAt: new Date().toISOString(),
  // Phase 19: write subscription.* counterparts inside SAME transaction (Pitfall 5)
  "subscription.plan": scheduledTier,
  "subscription.scheduledPlan": null,
  "subscription.scheduledPlanAt": null,
  "subscription.scheduledPlanReason": null,
  "subscription.syncedAt": new Date().toISOString(),
}, { merge: true });
```

## upsertTenantStripeBillingData Split

Function now performs two separate operations:

1. **Billing-state fields** (`stripeCustomerId`, `stripeSubscriptionId`) — routed through `syncTenantPlanBillingSnapshot` with `subscriptionStatus` read from existing doc (non-authoritative read per T-19-03-05 — this function's callers do not mutate status)
2. **Addon-item identifiers** (`whatsappOveragePriceId`, `whatsappOverageSubscriptionItemId`) — remain as direct `tenantRef.set` with `// EXEMPT: addon-item identifiers, not subscription state` comment

## Phase-Gate Grep Results

Before plan: ~12 billing-state writes across 5 files.

After plan, `grep -rn "tenantRef\.(set|update)" apps/functions/src/` within the 5 in-scope files returns only:
- `syncTenantPlanBillingSnapshot` function body in stripeWebhook.ts (the single writer)
- whatsappEnabled second writes (Pitfall 2 pattern) in stripeWebhook.ts and applyScheduledPlanChanges.ts
- EXEMPT-commented control-plane flag writes in billing-sync.service.ts
- EXEMPT-commented customer-id-only writes in stripe.controller.ts
- EXEMPT-commented addon-item-id write in stripeHelpers.ts upsertTenantStripeBillingData

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| syncTenantPlanBillingSnapshot.test.ts (BILL-06) | 9 passed (7 from Plan 02, 2 new) | PASS |
| stripe-idempotency.test.ts (BILL-08) | 5 passed, 1 skipped (emulator-gated) | PASS |
| Full backend suite | 104 passed, 1 skipped, 1 pre-existing fail (executor.test.ts — unrelated to Phase 19) | No regression |

## User-Doc Write Preservation (Audit)

The following `userRef.*` / `db.collection("users")` calls in the four in-scope controller functions were NOT touched:

- `cancelSubscription`: `userRef.set({stripeSubscriptionId, cancelAtPeriodEnd, cancelScheduledAt, currentPeriodEnd, updatedAt})` — preserved
- `createCheckoutSession` plan-change: `userRef.set({stripeId, stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, billingInterval, updatedAt})` — preserved
- `confirmCheckoutSession`: `userRef.set({stripeId, stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, updatedAt})` — preserved
- `syncSubscription`: `userRef.set({stripeSubscriptionId, subscriptionStatus, currentPeriodEnd, updatedAt})` — preserved
- All `updateSubscriptionStatus(userId, ...)` calls — preserved (writes to users/{uid})
- `updateUserPlan`: `userRef.update(updatePayload)` + dotted `subscription.*` writes on userRef — preserved

## Deviations from Plan

None — plan executed exactly as written. The pre-existing `executor.test.ts` failure is documented as out-of-scope.

## Known Stubs

None.

## Threat Flags

None beyond those documented in the plan's threat model (T-19-03-01 through T-19-03-05 — all mitigated).

## Self-Check: PASSED

- billing/billing-sync.service.ts contains "syncTenantPlanBillingSnapshot": confirmed
- applyScheduledPlanChanges.ts contains "subscription.plan": confirmed
- api/controllers/stripe.controller.ts contains all 4 source tags: confirmed
- stripe/stripeHelpers.ts contains all 3 source tags: confirmed
- syncTenantPlanBillingSnapshot.test.ts: 9 tests pass
- npm run build: exits 0
