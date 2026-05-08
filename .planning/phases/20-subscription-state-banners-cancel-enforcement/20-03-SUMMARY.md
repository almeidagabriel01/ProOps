---
phase: 20-subscription-state-banners-cancel-enforcement
plan: 03
subsystem: ui
tags: [billing, banners, stripe, react, tailwind, subscription]

requires:
  - phase: 19-billing-state-sync
    provides: canonical subscription.cancelAt and subscription.status fields written to Firestore tenant doc
  - phase: 20-02
    provides: backend cancelAt populated from Stripe, Phase 19 billing snapshot fields

provides:
  - BillingStateBanner component with destructive/warning variants
  - ProtectedAppShell renders priority-resolved billing state banner between Header and SubscriptionGuard
  - User.cancelAt field mapped from subscription.cancelAt in auth-provider
  - SubscriptionGuard past_due floating card removed (no double-banner for past_due tenants)

affects: [21-reactivate-subscription, e2e-subscription-state]

tech-stack:
  added: []
  patterns:
    - "BillingStateBanner: thin full-width strip (not floating card), inserted at shell level, not guard level"
    - "Priority logic: past_due → red banner; else cancelAtPeriodEnd → yellow banner; else none"
    - "Disabled stub CTA with title tooltip for phase-deferred feature (Reativar assinatura)"

key-files:
  created:
    - apps/web/src/components/layout/billing-state-banner.tsx
  modified:
    - apps/web/src/types/index.ts
    - apps/web/src/providers/auth-provider.tsx
    - apps/web/src/components/layout/protected-app-shell.tsx
    - apps/web/src/components/shared/subscription-guard.tsx

key-decisions:
  - "cancelAt mapped only from subscription.cancelAt (no top-level fallback) per CONTEXT.md Pitfall 5"
  - "daysRemaining removed from useMemo in SubscriptionGuard — only isGracePeriodExpired returned (was unused after showWarningBanner removal)"
  - "AlertTriangle removed from SubscriptionGuard imports; Clock and CreditCard kept (used by addon banners)"

patterns-established:
  - "Shell-level banner pattern: billing state banners live in ProtectedAppShell, not inside SubscriptionGuard"
  - "Disabled stub with title tooltip: ctaDisabled + title attribute for phase-deferred CTAs"

requirements-completed: [STATE-01, STATE-02]

duration: 5min
completed: 2026-05-08
---

# Phase 20 Plan 03: Subscription State Banners Frontend Summary

**BillingStateBanner component with red (past_due) and yellow (cancelAtPeriodEnd) variants wired into ProtectedAppShell, with SubscriptionGuard's duplicate past_due card removed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-08T13:06:57Z
- **Completed:** 2026-05-08T13:11:31Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Added `cancelAt?: string | null` to the `User` type (including nested `subscription.cancelAt`) and mapped it in auth-provider from `userData.subscription?.cancelAt` only — no top-level fallback per CONTEXT.md Pitfall 5
- Created `BillingStateBanner` component: full-width strip with `destructive` (red) and `warning` (yellow) variants, locked UI-SPEC palette, `data-testid` contracts from Plan 20-01
- Updated `ProtectedAppShell` to render the priority-resolved banner between `<Header />` and `<SubscriptionGuard>`: red banner for `past_due` (CTA opens Stripe portal), yellow banner for `cancelAtPeriodEnd` (disabled stub with "Disponível em breve" tooltip)
- Removed `showWarningBanner` floating yellow card from `SubscriptionGuard` — eliminates double-banner state for `past_due` tenants; addon warnings and redirect-to-`/subscription-blocked` effect are fully preserved

## Task Commits

1. **Task 1: Add cancelAt field to User type and map it in auth-provider** — `ca47b431` (feat)
2. **Task 2: Create BillingStateBanner, wire ProtectedAppShell, remove SubscriptionGuard past_due card** — `1fb4f4e0` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `apps/web/src/components/layout/billing-state-banner.tsx` — new named-export component; destructive variant uses `bg-destructive/10 border-destructive/30` + destructive Button; warning variant uses yellow Tailwind utilities matching existing codebase pattern; exposes `data-testid={dataTestid}` and `data-testid={dataTestid}-cta`
- `apps/web/src/types/index.ts` — added `cancelAt?: string | null` after `cancelAtPeriodEnd` and `cancelAt?: string | null` inside the nested `subscription` object so TypeScript permits the `userData.subscription?.cancelAt` access in auth-provider
- `apps/web/src/providers/auth-provider.tsx` — added `cancelAt` mapping line after `cancelAtPeriodEnd` block using type cast `(userData.subscription as { cancelAt?: string | null } | undefined)?.cancelAt ?? null`; no other mapping changes
- `apps/web/src/components/layout/protected-app-shell.tsx` — added `BillingStateBanner`, `StripeService`, `formatDateBR` imports; added `isOpeningPortal` state + `handleOpenPortal` callback; renders red banner when `isPastDue`, yellow banner when `isCancelAtPeriodEnd`; all pre-existing imports and behavior (LiaContainer, AppOnboarding, BottomDock) preserved
- `apps/web/src/components/shared/subscription-guard.tsx` — removed `showWarningBanner` variable and its JSX block (lines 131–201 in original); removed `AlertTriangle` from lucide-react import; removed `daysRemaining` from useMemo (only `isGracePeriodExpired` returned); fixed addon offset to always `20 + index * 8`; `Clock`, `CreditCard`, `Package` kept (all used by addon banners); `handleManageBilling`, `isRedirecting`, `addonWarnings`, and redirect effect untouched

## Decisions Made

- `cancelAt` mapped from `subscription.cancelAt` only — no top-level fallback. This is the Pitfall 5 rule from CONTEXT.md: top-level `cancelAt` on the user doc could be stale; the canonical source is the nested `subscription` object written by the Phase 19 single-writer.
- `daysRemaining` removed from SubscriptionGuard's useMemo return — it was only consumed by the `showWarningBanner` block that was removed. The useMemo body is otherwise unchanged (computing `isGracePeriodExpired` for the redirect effect).
- `AlertTriangle` removed from SubscriptionGuard lucide imports; `Clock` and `CreditCard` retained — both are still used by the addon warnings rendering loop.

## Deviations from Plan

None — plan executed exactly as written. The advisor note about not removing `Clock`/`CreditCard` was consistent with the plan's own "verify each by grepping" instruction; applied correctly.

## Issues Encountered

None.

## Confirmation: SubscriptionGuard past_due card

The `showWarningBanner` block (original lines 131–201, including the floating yellow card with "Pagamento Pendente" heading) is fully removed. Grep confirms zero matches for `showWarningBanner` and `Pagamento Pendente` in subscription-guard.tsx. The addon warnings rendering loop (`addonWarnings.map`) is preserved at lines 156–203 in the updated file.

## Confirmation: Admin routes unaffected

Admin routes (`/admin/*`) use `apps/web/src/app/admin/layout.tsx` which mounts `AdminGuard` layout — it never mounts `ProtectedAppShell`. Banners cannot appear in admin context by construction. This was verified by the plan's threat model (T-20-03-04).

## Known Stubs

- `BillingStateBanner` yellow variant CTA "Reativar assinatura" is rendered `disabled` with `onCta={() => {}}` and tooltip "Disponível em breve". This is intentional per plan spec — Phase 21 will wire the reactivation endpoint and remove the disabled state.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary surfaces introduced. Banner reads only from the existing `useAuth()` user object. Stripe portal is reached via the existing `StripeService.createPortalSession` endpoint already in production.

## Next Phase Readiness

- Phase 20-04 (cancel enforcement in MySubscriptionTab) can proceed — the `BillingStateBanner` component is available and the `User.cancelAt` field is in the type system
- Phase 21 (reactivation endpoint) will wire the yellow banner CTA — remove `ctaDisabled` and replace `onCta={() => {}}` with the real handler
- E2E spec from Plan 20-01 (STATE-01, STATE-02 tests) will flip from RED to GREEN once Plan 20-02 (backend) ships and a tenant is seeded with `subscription.cancelAt` populated

---
*Phase: 20-subscription-state-banners-cancel-enforcement*
*Completed: 2026-05-08*
