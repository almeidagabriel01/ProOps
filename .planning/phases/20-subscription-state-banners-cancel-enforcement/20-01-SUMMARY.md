---
phase: 20-subscription-state-banners-cancel-enforcement
plan: 01
subsystem: testing
tags: [billing, banners, e2e, playwright, firestore, stripe, wave-0]

requires:
  - phase: 19-single-writer-billing-foundation
    provides: canonical subscription.* map fields (SubscriptionSnapshot) written by syncTenantPlanBillingSnapshot

provides:
  - STATE-03 requirement updated to immediate-cancel path (no 409 block)
  - seedBillingStateExtended helper for past_due and cancelAtPeriodEnd E2E seed flows
  - Wave 0 E2E spec stubs for STATE-01, STATE-02, STATE-03 with VALIDATION.md grep strings
  - testid contracts billing-state-banner-past-due and billing-state-banner-cancel-period-end for Plan 20-03

affects:
  - 20-02 (backend cancel enforcement — reads STATE-03 wording)
  - 20-03 (frontend banners — must match testid contracts)
  - 20-04 (cancel dialog — must match "Sim, cancelar agora" button contract)

tech-stack:
  added: []
  patterns:
    - seedBillingStateExtended: extended seed helper writing both legacy top-level fields and Phase 19 canonical subscription.* map
    - Wave 0 stub pattern: E2E tests declared before UI ships, fail closed on missing testids

key-files:
  created:
    - tests/e2e/billing/billing-state-banners.spec.ts
  modified:
    - tests/e2e/seed/data/billing.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "STATE-03 wording updated: BILLING_CANCEL_BLOCKED_PAST_DUE removed; immediate-cancel path (stripe.subscriptions.cancel) is the correct behavior for past_due tenants"
  - "Wave 0 E2E stubs fail closed (banner testid not found) until Plan 20-03 ships — this is intentional Nyquist-compliant feedback"
  - "seedBillingStateExtended writes both legacy top-level fields (subscriptionStatus, cancelAtPeriodEnd) and canonical subscription.* map for dual-read compatibility"
  - "restoreTenantState extended to delete cancelAtPeriodEnd and subscription fields to prevent state leakage between tests"
  - "USER_ADMIN_BETA.uid (user-admin-beta) used directly — no fallback needed, uid was already present in users.ts"

patterns-established:
  - "Extended seed helper pattern: SeedBillingExtendedOptions interface with optional subscriptionMap for Phase 19 canonical fields"
  - "testid contracts declared in Wave 0 stubs constrain Plan 20-03 component naming"

requirements-completed: [STATE-01, STATE-02, STATE-03]

duration: 5min
completed: 2026-05-08
---

# Phase 20 Plan 01: Wave 0 Validation Foundation Summary

**REQUIREMENTS.md STATE-03 rewritten to immediate-cancel path, seedBillingStateExtended helper added for past_due/cancelAtPeriodEnd E2E seeding, and three Wave 0 E2E stubs declared for STATE-01/02/03 with VALIDATION.md grep contracts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-08T13:06:25Z
- **Completed:** 2026-05-08T13:12:05Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- REQUIREMENTS.md STATE-03 now reflects the immediate-cancel behavior (stripe.subscriptions.cancel() for past_due) with zero references to the removed 409/BILLING_CANCEL_BLOCKED_PAST_DUE path
- New `seedBillingStateExtended` helper exports `SeedBillingExtendedOptions` interface supporting past_due, cancelAtPeriodEnd, cancelAt, and pastDueSince states via both legacy top-level fields and Phase 19 canonical `subscription.*` map
- `restoreTenantState` extended to clean up `cancelAtPeriodEnd` and `subscription` fields preventing state leakage across tests
- Three E2E stub tests declared with exact grep strings from VALIDATION.md; testid contracts `billing-state-banner-past-due` and `billing-state-banner-cancel-period-end` established for Plan 20-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Update REQUIREMENTS.md STATE-03** - `00296674` (docs)
2. **Task 2: Extend seedBillingState helper** - `a223ebac` (test)
3. **Task 3: Create E2E spec stubs** - `52e5cb98` (test)

## Files Created/Modified

- `tests/e2e/billing/billing-state-banners.spec.ts` — Wave 0 E2E stubs for STATE-01 (past_due banner), STATE-02 (cancel period end banner), STATE-03 (cancel subscription past_due AlertDialog)
- `tests/e2e/seed/data/billing.ts` — added `SeedBillingExtendedOptions` interface and `seedBillingStateExtended` helper; extended `restoreTenantState` with new field deletions
- `.planning/REQUIREMENTS.md` — STATE-03 line rewritten: immediate-cancel path, no BILLING_CANCEL_BLOCKED_PAST_DUE reference

## STATE-03 Before/After

**Before:**
```
- [ ] **STATE-03**: Tenant em `past_due` não consegue cancelar assinatura — controller retorna 409 com código `BILLING_CANCEL_BLOCKED_PAST_DUE`, botão de cancelar fica desabilitado com tooltip explicativo no UI
```

**After:**
```
- [ ] **STATE-03**: Tenant em `past_due` que clica "Cancelar assinatura" vê AlertDialog com aviso de cancelamento imediato; ao confirmar, controller chama `stripe.subscriptions.cancel()` (cancelamento imediato — acesso encerra agora). Tenant `active`/`trialing` mantém o fluxo at-period-end existente. O botão de cancelar permanece habilitado; não há bloqueio 409.
```

## New Helper Signature

```typescript
export interface SeedBillingExtendedOptions {
  tenantId: string;
  subscriptionStatus: "active" | "past_due" | "canceled" | "trialing";
  cancelAtPeriodEnd?: boolean;
  subscriptionMap?: {
    status: "active" | "past_due" | "canceled" | "trialing";
    cancelAtPeriodEnd?: boolean;
    cancelAt?: string | null;       // ISO date string
    pastDueSince?: string | null;   // ISO date string
  };
  userId?: string;
}

export async function seedBillingStateExtended(
  db: Firestore,
  opts: SeedBillingExtendedOptions,
): Promise<void>;
```

## Testid and Button Contracts for Plans 20-03/04

| Contract | Value | Plan that must implement |
|----------|-------|--------------------------|
| data-testid | `billing-state-banner-past-due` | 20-03 (red banner component) |
| data-testid | `billing-state-banner-cancel-period-end` | 20-03 (yellow banner component) |
| Button name | `Sim, cancelar agora` | 20-04 (cancel dialog confirm button) |

## Decisions Made

- Plan prescribed replacement text for STATE-03 contained `BILLING_CANCEL_BLOCKED_PAST_DUE` in a "Não há ... nem código X" clause, but the acceptance criteria required zero occurrences in the file. The code was removed from the wording while preserving the intent: the requirement now states "não há bloqueio 409" without naming the removed error code. This satisfies both the acceptance criteria and the semantic intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed BILLING_CANCEL_BLOCKED_PAST_DUE from replacement text**
- **Found during:** Task 1 (REQUIREMENTS.md update)
- **Issue:** The plan's prescribed replacement text for STATE-03 included `BILLING_CANCEL_BLOCKED_PAST_DUE` in a negating clause ("nem código BILLING_CANCEL_BLOCKED_PAST_DUE"), but the acceptance criteria required zero occurrences of that pattern in the file. The verify command `powershell ... -not (Select-String ... -Pattern 'BILLING_CANCEL_BLOCKED_PAST_DUE' ...)` would fail.
- **Fix:** Replaced the negating clause with equivalent phrasing: "não há bloqueio 409" — preserves the semantic intent without referencing the removed error code.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** Verify command `PASS`; `Select-String -Pattern 'BILLING_CANCEL_BLOCKED_PAST_DUE'` returns zero matches.
- **Committed in:** `00296674` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: contradictory plan instructions)
**Impact on plan:** Minimal; semantic intent preserved. Acceptance criteria now pass cleanly.

## Issues Encountered

None beyond the Task 1 plan contradiction documented above.

## Known Stubs

The E2E spec file is intentionally stubbed — tests will fail (banner testid not found) until Plan 20-03 ships the UI components. This is the Wave 0 contract per VALIDATION.md. No production code stubs.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Seed helpers write to Firestore emulator only. No threat flags.

## Next Phase Readiness

- **Plan 20-02 (backend):** Can proceed — STATE-03 requirement is updated, no 409 path to implement
- **Plan 20-03 (frontend banners):** Must implement `data-testid="billing-state-banner-past-due"` and `data-testid="billing-state-banner-cancel-period-end"` to make Wave 0 stubs green
- **Plan 20-04 (cancel dialog):** Must implement "Sim, cancelar agora" confirm button copy

## Self-Check: PASSED

- `tests/e2e/billing/billing-state-banners.spec.ts` — FOUND
- `tests/e2e/seed/data/billing.ts` — FOUND
- `.planning/REQUIREMENTS.md` — FOUND
- `.planning/phases/20-subscription-state-banners-cancel-enforcement/20-01-SUMMARY.md` — FOUND
- Commit `00296674` — FOUND (docs: STATE-03 wording)
- Commit `a223ebac` — FOUND (test: seedBillingStateExtended)
- Commit `52e5cb98` — FOUND (test: E2E stubs)
- Commit `dd101c80` — FOUND (docs: metadata)

---
*Phase: 20-subscription-state-banners-cancel-enforcement*
*Completed: 2026-05-08*
