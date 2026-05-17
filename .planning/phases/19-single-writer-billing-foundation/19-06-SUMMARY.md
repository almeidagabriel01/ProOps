---
phase: 19-single-writer-billing-foundation
plan: "06"
subsystem: billing
tags: [billing, single-writer, admin, gap-closure, firestore, consolidation]
dependency_graph:
  requires: [19-03, 19-05]
  provides: [BILL-06]
  affects: [admin.controller.ts, billing-types.ts, syncTenantPlanBillingSnapshot.test.ts]
tech_stack:
  added: []
  patterns: [single-writer, EXEMPT-comment, phase-gate-audit, source-tag-traceability]
key_files:
  created: []
  modified:
    - apps/functions/src/shared/billing-types.ts
    - apps/functions/src/api/controllers/admin.controller.ts
    - apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts
decisions:
  - "updateUserPlan passes tierFromPlanId (normalizePlanTier(planId)) directly to syncTenantPlanBillingSnapshot — NOT getTenantPlanProfile, which reads tenantData.plan first and would return the stale tier before the doc is updated"
  - "recomputeTenantFeatures EXEMPT path chosen — re-assertion with no subscription-state mutation; plan field removed from direct write so single writer remains sole mutator"
  - "forceSetTenantPlan enterprise whatsappEnabled override preserved as post-writer EXEMPT write for behavioral parity"
metrics:
  duration: ~15 min
  completed: "2026-05-07"
  tasks: 2
  files_modified: 3
---

# Phase 19 Plan 06: Admin Controller Gap Closure Summary

**One-liner:** Routed three superadmin billing-state writers in admin.controller.ts through syncTenantPlanBillingSnapshot, adding two admin.* source literals to the union and extending the phase-gate audit test to enforce the gap closure permanently.

## What Was Done

### Source union extension (`billing-types.ts`)

Two new literals added after `"on_demand"` in `SyncTenantPlanBillingSnapshotParams.source`:
- `"admin.updateUserPlan"`
- `"admin.forceSetTenantPlan"`

These are STRICT literal union members — TypeScript enforces them at call sites (TS2322 prevents unregistered source strings).

### Three callsites consolidated (`admin.controller.ts`)

**1. `updateUserPlan` (formerly lines ~1163–1191)**

- Removed: direct `plan: tierFromPlanId` write via `tenantRef.set`, second `tenantRef.update({ plan: profile.tier, whatsappEnabled })`, `getTenantPlanProfile` call, `tenantPlanAllowsWhatsApp` call
- Added: reads existing `subscriptionStatus` from tenant doc before any write; writes only `planId` (EXEMPT raw price-id pointer) via `tenantRef.set`; routes plan tier through `syncTenantPlanBillingSnapshot({ plan: tierFromPlanId, source: "admin.updateUserPlan" })`
- Critical: uses `tierFromPlanId` (= `normalizePlanTier(planId)`) directly — NOT `getTenantPlanProfile` (which would read stale tier from doc before the writer updates it)

**2. `recomputeTenantFeatures` (EXEMPT path)**

- Removed: `plan: profile.tier` from the `tenantRef.update` payload
- Retained: `whatsappEnabled` and `featuresRecomputedAt` (non-billing-state per Phase 19 schema)
- Added: EXEMPT comment explaining why routing through the writer is unnecessary (re-assertion, no subscription-state mutation, synthetic subscriptionStatus would produce no behavior change)

**3. `forceSetTenantPlan` (formerly lines ~2073–2086)**

- Removed: direct writes of `plan`, `scheduledPlan`, `scheduledPlanAt`, `scheduledPlanReason`, `whatsappEnabled`, `featuresRecomputedAt` in a single `tenantRef.update`; both `clearTenantPlanCache` calls; `tenantPlanAllowsWhatsApp` call
- Added: reads existing `subscriptionStatus` from already-loaded `tenantData`; routes through `syncTenantPlanBillingSnapshot({ plan: tier, clearScheduled: true, source: "admin.forceSetTenantPlan" })`; enterprise branch EXEMPT write for `whatsappEnabled: true` override; non-enterprise branch EXEMPT write for `featuresRecomputedAt` only

### Fields routed through single writer vs. retained as EXEMPT

| Field | Disposition | Function |
|-------|-------------|----------|
| `plan` (tier) | Single writer | updateUserPlan, forceSetTenantPlan |
| `scheduledPlan` | Single writer (`clearScheduled: true`) | forceSetTenantPlan |
| `scheduledPlanAt` | Single writer (`clearScheduled: true`) | forceSetTenantPlan |
| `scheduledPlanReason` | Single writer (`clearScheduled: true`) | forceSetTenantPlan |
| `planId` (raw price-id) | EXEMPT direct write | updateUserPlan |
| `whatsappEnabled` enterprise override | EXEMPT direct write | forceSetTenantPlan |
| `whatsappEnabled` | EXEMPT direct write | recomputeTenantFeatures |
| `featuresRecomputedAt` | EXEMPT direct write | recomputeTenantFeatures, forceSetTenantPlan |

### New source tags

- `admin.updateUserPlan` — used in `syncTenantPlanBillingSnapshot` call inside `updateUserPlan`
- `admin.forceSetTenantPlan` — used in `syncTenantPlanBillingSnapshot` call inside `forceSetTenantPlan`

### Phase-gate audit extension (`syncTenantPlanBillingSnapshot.test.ts`)

- Added `"api/controllers/admin.controller.ts"` to the `consolidatedFiles` array (enforces import of single writer)
- Added `["api/controllers/admin.controller.ts", "admin.updateUserPlan"]` and `["api/controllers/admin.controller.ts", "admin.forceSetTenantPlan"]` to the `expectedTags` table
- Added new test: `"Plan 06 gap closure — admin.controller.ts has no naked billing-state writes"` asserting:
  - EXEMPT comments present for recomputeTenantFeatures, planId pointer, enterprise override, featuresRecomputedAt
  - `clearScheduled: true` and `source: "admin.forceSetTenantPlan"` in forceSetTenantPlan
  - No `scheduledPlan*:` or bare `plan:` in direct tenantRef writes inside forceSetTenantPlan
  - No bare `plan:` in direct tenantRef writes inside updateUserPlan
  - `plan: tierFromPlanId` (NOT `plan: profile.tier`) passed to the single writer

**Test counts:** BILL-06 went from 9 to **10 tests** (9 existing + 1 new gap closure test).

## Commits

| Hash | Description |
|------|-------------|
| `bbfd638d` | feat(19-06): consolidate admin.controller.ts billing-state writers through single writer |
| `6dc157ae` | test(19-06): extend phase-gate audit to enforce admin.controller.ts gap closure |

## Verification Results

- `npm run build` — exits 0, no TS2322 on new source literals
- `npx jest syncTenantPlanBillingSnapshot --runInBand` — 10 passed, 0 failed
- `npx jest --runInBand` — 105 passed, 1 skipped, 1 pre-existing failure (executor.test.ts, unrelated to Phase 19)
- `grep -n "tenantRef\.(set|update)"` — all remaining writes carry EXEMPT comments or write only non-billing-state fields

## Gap Closure Confirmation

After this plan, `19-VERIFICATION.md` truth #1 and truth #2 are satisfiable on re-verification:

- **SC#1 ("no parallel writer exists anywhere"):** All three previously-unaudited callsites in admin.controller.ts now route through `syncTenantPlanBillingSnapshot` or carry explicit EXEMPT comments. The phase-gate test permanently enforces this.
- **SC#2 ("every billing write is atomic"):** `updateUserPlan` and `forceSetTenantPlan` now produce `subscription.*` counterparts inside the single writer's `db.runTransaction()`. `recomputeTenantFeatures` is EXEMPT (no subscription-state mutation).

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed stale `allowsWhatsApp` reference in forceSetTenantPlan response**
- **Found during:** Step 1.4 code review
- **Issue:** After removing the `await tenantPlanAllowsWhatsApp(tenantId)` call from the function body, the `res.json` still referenced `allowsWhatsApp` which was now undefined
- **Fix:** Changed the response to `tier === "enterprise" ? true : await tenantPlanAllowsWhatsApp(tenantId)` — computed inline only for the response, not duplicated as a pre-writer side effect
- **Files modified:** apps/functions/src/api/controllers/admin.controller.ts

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Changes are internal to existing superadmin-only endpoints with `isSuperAdminClaim` guards already in place.

## Self-Check: PASSED

- `apps/functions/src/shared/billing-types.ts` — exists, contains `"admin.updateUserPlan"` and `"admin.forceSetTenantPlan"`
- `apps/functions/src/api/controllers/admin.controller.ts` — exists, contains `syncTenantPlanBillingSnapshot`, `admin.updateUserPlan`, `admin.forceSetTenantPlan`, `clearScheduled: true`, all EXEMPT comments
- `apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts` — exists, contains `Plan 06 gap closure`, both new expectedTags entries
- Commit `bbfd638d` — verified in git log
- Commit `6dc157ae` — verified in git log
- Build: exits 0
- Tests: 10 passed
