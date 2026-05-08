---
phase: 20-subscription-state-banners-cancel-enforcement
plan: 04
subsystem: ui
tags: [billing, cancel, dialog, frontend, checkpoint]

requires:
  - phase: 20-02
    provides: backend cancelSubscription branches on past_due for immediate Stripe cancel
  - phase: 20-03
    provides: BillingStateBanner component + User.cancelAt field in type system

provides:
  - MySubscriptionTab cancel AlertDialog branched on subscriptionStatus === 'past_due'
  - Immediate-cancel warning copy shown at confirmation for past_due tenants
  - Success toast branch-aware: past_due shows 'Assinatura cancelada. Seu acesso foi encerrado.'
  - Non-past_due flow preserved byte-equivalent

affects: [e2e-subscription-state, STATE-03]

tech-stack:
  added: []
  patterns:
    - "AlertDialog body runtime branching on subscriptionStatus === 'past_due' — single dialog, no duplication"
    - "isPastDueCancel captured at handler call time for toast branch"

key-files:
  created: []
  modified:
    - apps/web/src/components/profile/MySubscriptionTab.tsx

key-decisions:
  - "Single handleConfirmCancelSubscription handler for both paths — backend (Plan 20-02) routes the Stripe call based on server-side tenant state"
  - "isPastDueCancel captured inside handler (not at render time) to ensure toast reflects actual cancellation context"
  - "canCancelSubscription unchanged — past_due tenants have always been able to reach this dialog; no exclusion existed or was added"

requirements-completed: [STATE-03]

duration: 3min
completed: 2026-05-08
---

# Phase 20 Plan 04: Cancel Dialog Past_due Branch Summary

**Past_due-aware cancel AlertDialog wired into MySubscriptionTab: immediate-cancel warning copy, branched confirm label, and branch-aware success toast — non-past_due flow preserved unchanged**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-08
- **Completed:** 2026-05-08
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint — pending)
- **Files modified:** 1

## Accomplishments

- Updated `handleConfirmCancelSubscription` to capture `isPastDueCancel = subscriptionStatus === "past_due"` at call time, then branch the `toast.success` message: past_due shows "Assinatura cancelada. Seu acesso foi encerrado." while non-past_due shows the existing "Cancelamento agendado!" copy
- Branched `AlertDialogDescription` on `subscriptionStatus === "past_due"`: past_due body is "Você está com pagamento pendente. Ao cancelar, seu acesso será encerrado imediatamente." — non-past_due body is the existing copy with `effectivePlan?.name` and `subscriptionCancelDate` (unchanged)
- Branched `AlertDialogAction` confirm label: "Sim, cancelar agora" for past_due, "Sim, cancelar assinatura" (preserved) for non-past_due
- TypeScript clean (`npx tsc --noEmit` exits 0), lint clean (`npm run lint -- --max-warnings=0` exits 0)

## Task Commits

1. **Task 1: Branch cancel AlertDialog on past_due** — `fcba0836` (feat)

**Plan metadata:** _(docs commit follows after human-verify)_

## Files Modified

- `apps/web/src/components/profile/MySubscriptionTab.tsx` — 25 insertions / 11 deletions; `handleConfirmCancelSubscription` now captures `isPastDueCancel`; AlertDialog description and confirm button label branch on `subscriptionStatus === "past_due"`; all other handlers, states, and JSX blocks untouched

## Decisions Made

- Single `handleConfirmCancelSubscription` handler for both paths — the same function is wired as `onClick` in both the past_due and non-past_due branches. The backend (Plan 20-02) decides whether to call `stripe.subscriptions.cancel()` (immediate) or the at-period-end path based on `tenantData.subscription?.status` server-side — no frontend routing needed.
- `canCancelSubscription` was not changed — advisor review (Plan 20-04 context) confirmed past_due tenants reach this dialog today with no exclusion in the predicate. The plan specified this explicitly.

## Deviations from Plan

None — plan executed exactly as written. Task 1 changes were already partially in place from the Plan 20-02 background agent execution; the file was in the correct final state per plan spec. Verification confirmed all acceptance criteria met.

## Human-Verify Checkpoint Status

**PENDING** — Task 2 is `checkpoint:human-verify`. The verifier needs to confirm the four checks (3 positive + 1 negative) in the emulator before this plan is fully complete.

**Checks required:**
1. Red banner appears for past_due tenant at /dashboard; old floating "Pagamento Pendente" card is gone
2. Yellow banner with formatted date appears for cancelAtPeriodEnd tenant; CTA disabled with tooltip
3. Past_due cancel dialog shows "Sim, cancelar agora" + immediate-cancel body; access ends on confirm
4. Non-past_due cancel dialog shows existing copy unchanged

## BILLING_CANCEL_BLOCKED_PAST_DUE Sweep

`BILLING_CANCEL_BLOCKED_PAST_DUE` does NOT exist anywhere in the codebase. Grep confirms zero matches in `apps/web/src/` and `apps/functions/src/`. This string was removed in Plan 20-02 per STATE.md decision logged under Phase 20 P01.

## Known Stubs

None introduced by this plan. The yellow banner CTA "Reativar assinatura" stub (from Plan 20-03) is tracked in 20-03-SUMMARY.md — Phase 21 wires it.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary surfaces. All changes are UI copy branching on a locally-read `subscriptionStatus` field. The backend routing (immediate vs at-period-end) is server-side and was audited in Plan 20-02 threat model (T-20-02-*).

## Next Phase Readiness

- Human verifier runs four checks in emulator; types "approved" to close the checkpoint
- After approval: STATE-03 E2E test from Plan 20-01 (`billing-cancel-dialog-past-due.spec.ts`) should flip GREEN
- Phase 21 (reactivation endpoint) can proceed — yellow banner CTA is wired and waiting for a real handler

---
*Phase: 20-subscription-state-banners-cancel-enforcement*
*Completed: 2026-05-08 (Task 1); Task 2 pending human-verify*
