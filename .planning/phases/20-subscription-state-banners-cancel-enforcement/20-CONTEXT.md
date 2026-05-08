# Phase 20: Subscription State Banners + Cancel Enforcement - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenants in problematic billing states see persistent, actionable UI banners at the top of every protected page. Phase scope:

1. **Red banner** — `past_due` state: persistent, non-dismissible, "Atualizar pagamento" CTA opens Stripe customer portal
2. **Yellow banner** — `cancelAtPeriodEnd: true`: persistent, shows formatted cancellation date, "Reativar assinatura" button (Phase 21 implements the reactivation endpoint; this phase renders the banner)
3. **Cancel enforcement change** — Past_due tenants CAN cancel, but cancellation is immediate (access ends now). Active tenants use the existing at-period-end flow. STATE-03 updated from 409-block to immediate-cancel path.

Out of scope: Phase 21 reactivation endpoint, Phase 21 addon badge cleanup, Phase 19 (must be deployed first).

</domain>

<decisions>
## Implementation Decisions

### Banner placement
- Position: between `Header` and `<main>` inside `ProtectedAppShell`
- Scope: `ProtectedAppShell` only — admin routes (`/admin/*`) use a separate layout and do NOT show billing banners
- Visibility: all tenant users see the banners (no role check) — even non-masters who can't act on billing should know the account is at risk

### Banner priority / dual-state
- If `past_due` — show only the red banner (priority state)
- Else if `cancelAtPeriodEnd: true` — show only the yellow banner
- Both conditions true simultaneously → red banner wins, yellow is suppressed
- Logic: `if (past_due) → red; else if (cancelAtPeriodEnd) → yellow`

### Red banner (past_due)
- Color: red/destructive variant
- Cannot be permanently dismissed (session-only state at most, reappears on reload)
- CTA: "Atualizar pagamento" button → calls `StripeService.createPortalSession({ userId })` and redirects to Stripe portal
- Portal return URL: `window.location.href` (current page) — consistent with existing `handleManagePayment` pattern

### Yellow banner (cancelAtPeriodEnd)
- Color: yellow/warning variant
- Shows formatted cancel date: from `user.cancelAt` (new field)
- Button: "Reativar assinatura" — Phase 21 implements the endpoint; for this phase, the button can be present but will be wired up in Phase 21 (or shown as placeholder)
- Cannot be permanently dismissed

### Frontend data layer
- `subscription.cancelAt` (absolute cancel date) must be added to the `User` type and mapped in `auth-provider.tsx`
- Read path: `userData.subscription?.cancelAt` — **no top-level fallback** (cancelAt is a new Phase 19 field with no legacy counterpart)
- Existing fields (`user.subscriptionStatus` with `subscription.status` fallback, `user.cancelAtPeriodEnd`) are already mapped — no changes needed there
- All banner state reads from `useAuth()` → no separate Firestore hook

### Cancel enforcement — STATE-03 change (replaces 409-block)
**Old STATE-03 (REQUIREMENTS.md must be updated):** 409 block with `BILLING_CANCEL_BLOCKED_PAST_DUE`
**New behavior:**
- `past_due` tenant clicks "Cancelar assinatura" → button is enabled, opens a warning `AlertDialog` with copy: *"Você está com pagamento pendente. Ao cancelar, seu acesso será encerrado imediatamente."* → on confirm, calls cancel endpoint → backend calls `stripe.subscriptions.cancel()` (immediate) → access ends now
- `active/trialing` tenant → unchanged: at-period-end flow via `stripe.subscriptions.update({ cancel_at_period_end: true })`
- Backend controller branches on `subscription.status`: `if (status === 'past_due') → stripe.subscriptions.cancel()` else → existing at-period-end path
- Controller reads `subscription.status` only (no fallback to top-level `subscriptionStatus`) — Phase 19 canonical fields are trusted
- No 409 response needed; the 409 path and `BILLING_CANCEL_BLOCKED_PAST_DUE` error code are NOT implemented in this phase

### Cancel button state for past_due
- Button is **enabled** (not disabled)
- Clicking opens a modified `AlertDialog` with the immediate-cancel warning copy
- No tooltip needed for past_due — the dialog communicates the consequence

### Claude's Discretion
- Exact banner component names and file locations (suggest `BillingStateBanner` in `components/layout/` or `components/shared/`)
- Yellow banner copy for cancellation date (e.g., "Sua assinatura será cancelada em {date}. Reativar?")
- Red banner copy (e.g., "Seu pagamento está em atraso. Regularize para manter o acesso.")
- Exact `AlertDialog` cancel warning copy (beyond the intent captured above)
- Whether the yellow banner's "Reativar assinatura" button is stubbed (disabled/placeholder) or omitted until Phase 21

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 20 goal and success criteria (note: STATE-03 behavior is updated by this CONTEXT — see decisions above)
- `.planning/REQUIREMENTS.md` — STATE-01, STATE-02, STATE-03 (STATE-03 must be updated: 409-block replaced by immediate-cancel path for past_due)

### Frontend integration points
- `apps/web/src/components/layout/protected-app-shell.tsx` — Where banners are inserted (between `<Header>` and `<SubscriptionGuard>/<main>`)
- `apps/web/src/providers/auth-provider.tsx` — Where `cancelAt` field mapping is added (lines ~215-290, subscription.* fallback pattern)
- `apps/web/src/types/index.ts` — `User` type — add `cancelAt?: string` field
- `apps/web/src/components/profile/MySubscriptionTab.tsx` — Cancel button location; `AlertDialog` for past_due immediate-cancel warning

### Backend integration points
- `apps/functions/src/api/controllers/stripe.controller.ts` — `cancelSubscription` function — add `past_due` branch reading `subscription.status`
- `apps/functions/src/shared/billing-types.ts` — `SubscriptionSnapshot` type (canonical billing types from Phase 19)

### Existing patterns to follow
- `apps/web/src/components/shared/subscription-guard.tsx` — Existing billing-state UI gating pattern
- `apps/web/src/app/subscription-blocked/page.tsx` — Existing hard-block billing page (different from banners — soft warning vs hard block)
- `apps/web/src/services/stripe-service.ts` — `createPortalSession` service (already used by `handleManagePayment`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StripeService.createPortalSession({ userId })` in `stripe-service.ts`: Already used by profile page for Stripe portal. Banner "Atualizar pagamento" CTA uses the same call.
- `useAuth()` hook: Already exposes `user.subscriptionStatus`, `user.cancelAtPeriodEnd`, `user.currentPeriodEnd`. Add `user.cancelAt` here.
- `AlertDialog` from Shadcn/ui: Already used in `MySubscriptionTab.tsx` for the cancel confirmation — reuse with new copy for past_due path.
- `formatDateBR()` from `utils/date-format`: Already imported in `MySubscriptionTab.tsx` — use for formatting `cancelAt` date in yellow banner.
- `Tooltip` component: Already used in the codebase for disabled button tooltips — not needed for cancel button (dialog handles it), but available for yellow banner if needed.

### Established Patterns
- Banner persistence: `useState` (session-only) so it reappears on page reload — established in Phase 16 for the Lia usage banner
- Auth-provider billing field mapping: dual-read pattern `userData.fieldName || userData.subscription?.fieldName` — but for `cancelAt`, read `subscription?.cancelAt` only (no legacy top-level field)
- Subscription status branching: `user.subscriptionStatus === 'past_due'` already used in `subscription-blocked/page.tsx`

### Integration Points
- `ProtectedAppShell`: banners insert between `<Header>` and `<SubscriptionGuard>`. Current structure:
  ```
  <Header /> ← above this
  <banners go here>
  <SubscriptionGuard>
    <main>{children}</main>
  </SubscriptionGuard>
  ```
- `cancelSubscription` controller: reads tenant data via `resolveStripeUserContext(req)` — add read of `tenantData.subscription?.status` before deciding immediate vs at-period-end path

</code_context>

<specifics>
## Specific Ideas

- STATE-03 is **changed**: past_due cancellation is immediate (stripe.subscriptions.cancel()), not blocked. The AlertDialog copy makes the consequence explicit before confirming.
- "Reativar assinatura" button in the yellow banner is present in this phase but the endpoint (`POST /api/stripe/subscription/reactivate`) is Phase 21. The button can be rendered disabled or wired to show a Phase 21 placeholder.
- The Stripe portal CTA in the red banner uses `window.location.href` as the return URL (same as existing portal flow).

</specifics>

<deferred>
## Deferred Ideas

- "Reativar assinatura" endpoint (`POST /api/stripe/subscription/reactivate`) — Phase 21
- Addon badge cleanup ("Cancelando em X") — Phase 21
- Past_due grace period deadline tracking (if Stripe communicates a final retry date as a field) — future phase if needed

</deferred>

---

*Phase: 20-subscription-state-banners-cancel-enforcement*
*Context gathered: 2026-05-07*
