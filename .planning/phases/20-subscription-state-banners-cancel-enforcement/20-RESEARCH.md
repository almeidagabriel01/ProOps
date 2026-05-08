# Phase 20: Subscription State Banners + Cancel Enforcement - Research

**Researched:** 2026-05-07
**Domain:** Billing state UI banners + Stripe subscription cancel enforcement (Next.js + Firebase Functions)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Banner placement:**
- Position: between `Header` and `<main>` inside `ProtectedAppShell`
- Scope: `ProtectedAppShell` only — admin routes (`/admin/*`) use a separate layout and do NOT show billing banners
- Visibility: all tenant users see the banners (no role check)

**Banner priority / dual-state:**
- If `past_due` → show only the red banner (priority state)
- Else if `cancelAtPeriodEnd: true` → show only the yellow banner
- Both conditions true simultaneously → red banner wins, yellow is suppressed

**Red banner (past_due):**
- Color: red/destructive variant
- Cannot be permanently dismissed (session-only state at most, reappears on reload)
- CTA: "Atualizar pagamento" → `StripeService.createPortalSession({ userId })` → redirect to Stripe portal
- Portal return URL: `window.location.href`

**Yellow banner (cancelAtPeriodEnd):**
- Color: yellow/warning variant
- Shows formatted cancel date from `user.cancelAt` (new field)
- Button: "Reativar assinatura" — Phase 21 implements endpoint; this phase renders button as stub/disabled
- Cannot be permanently dismissed

**Frontend data layer:**
- `subscription.cancelAt` must be added to `User` type and mapped in `auth-provider.tsx`
- Read path: `userData.subscription?.cancelAt` only — no top-level fallback
- Existing fields already mapped — no other changes to auth-provider mapping
- All banner state reads from `useAuth()` — no separate Firestore hook

**Cancel enforcement (STATE-03):**
- `past_due` tenant → button enabled, opens modified `AlertDialog` with immediate-cancel warning
- On confirm → calls cancel endpoint → backend calls `stripe.subscriptions.cancel()` (immediate)
- `active/trialing` tenant → unchanged: `stripe.subscriptions.update({ cancel_at_period_end: true })`
- Backend branches on `subscription.status` (Phase 19 canonical field, no top-level fallback)
- No 409 response; `BILLING_CANCEL_BLOCKED_PAST_DUE` error code is NOT implemented

**Cancel button for past_due:**
- Enabled (not disabled)
- Opens modified `AlertDialog` with immediate-cancel warning copy

### Claude's Discretion

- Exact banner component names and file locations (suggest `BillingStateBanner` in `components/layout/` or `components/shared/`)
- Yellow banner copy for cancellation date
- Red banner copy
- Exact `AlertDialog` cancel warning copy (beyond the intent)
- Whether yellow banner "Reativar assinatura" button is stubbed (disabled/placeholder) or omitted until Phase 21

### Deferred Ideas (OUT OF SCOPE)

- "Reativar assinatura" endpoint (`POST /api/stripe/subscription/reactivate`) — Phase 21
- Addon badge cleanup ("Cancelando em X") — Phase 21
- Past_due grace period deadline tracking — future phase

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-01 | Red persistent banner for `past_due` state with "Atualizar pagamento" CTA opening Stripe customer portal | Insertion point confirmed in `ProtectedAppShell`; `StripeService.createPortalSession` already exists and is used by `handleManagePayment` in profile page |
| STATE-02 | Yellow persistent banner for `cancelAtPeriodEnd: true` showing formatted cancellation date and "Reativar assinatura" stub button | `cancelAtPeriodEnd` already mapped in auth-provider; `cancelAt` field needs new mapping from `subscription?.cancelAt`; `formatDateBR()` available |
| STATE-03 | Past_due cancel is immediate (`stripe.subscriptions.cancel()`), not 409-blocked; active cancel is unchanged (at-period-end) | `cancelSubscription` controller at lines 457-539 of `stripe.controller.ts` currently always uses at-period-end; branch on `tenantData.subscription?.status` required. **NOTE: STATE-03 wording in REQUIREMENTS.md is outdated** — it describes the old 409-block behavior; planner must update REQUIREMENTS.md as part of this phase |

</phase_requirements>

---

## Summary

Phase 20 adds two persistent billing-state banners to every protected page and changes how past_due tenants cancel their subscription. The frontend work is concentrated in four files: `ProtectedAppShell` (banner insertion), `auth-provider.tsx` (new `cancelAt` mapping), `types/index.ts` (new `User.cancelAt` field), and `MySubscriptionTab.tsx` (modified `AlertDialog` for immediate-cancel warning). The backend change is a single branch added to `cancelSubscription` in `stripe.controller.ts`.

No new npm packages are required. All UI primitives (Alert/Banner pattern, AlertDialog, Button), services (`StripeService.createPortalSession`), and date utilities (`formatDateBR`) already exist in the codebase. The Phase 19 canonical billing state (`subscription.*` map on tenant doc, `SubscriptionSnapshot` type in `billing-types.ts`) is the foundation this phase builds on.

Three implementation concerns require explicit planner decisions before tasks are written: (1) a pre-existing yellow `past_due` warning banner in `SubscriptionGuard` will collide with the new red banner unless one is removed or scoped differently; (2) the `cancelAt` field stored in `subscription.cancelAt` (tenant doc) is not yet surfaced through `useTenant()`, and `useAuth()` maps from the user doc which may lag the tenant doc by one webhook cycle — the planner must decide whether to accept this staleness or also update the `Tenant` type; (3) the `cancel_at_period_end` webhook handler in `stripeWebhook.ts` currently does NOT pass `cancelAt` to `syncTenantPlanBillingSnapshot`, meaning the `subscription.cancelAt` field will remain null and the yellow banner date will be empty unless a webhook handler is updated to populate it.

**Primary recommendation:** Resolve all three concerns before writing Wave 1 tasks — specifically the banner collision (modify `SubscriptionGuard` to remove its existing past_due banner), the `cancelAt` webhook population gap (add `cancelAt` pass-through to the `cancel_at_period_end` branch in `stripeWebhook.ts`), and accept user-doc staleness for `cancelAt` given the existing pattern.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Banner rendering (past_due, cancelAtPeriodEnd) | Browser / Client | — | Client component in ProtectedAppShell; reads from useAuth() which is already client-side state |
| Banner data sourcing (subscriptionStatus, cancelAtPeriodEnd, cancelAt) | Browser / Client | — | Reads from auth-provider User state — no new Firestore hook; user doc updated by webhook |
| cancelAt field mapping | Browser / Client | — | auth-provider.tsx fetchUserData() maps Firestore → User type; new field from subscription?.cancelAt |
| Cancel enforcement branching | API / Backend | — | stripe.controller.ts cancelSubscription reads subscription.status and calls appropriate Stripe API |
| cancelAt population in Firestore | API / Backend | — | stripeWebhook.ts cancel_at_period_end handler must pass cancelAt to syncTenantPlanBillingSnapshot |
| Stripe portal redirect | Browser / Client | API / Backend | Frontend calls StripeService.createPortalSession; backend creates the session URL |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Shadcn/ui (Alert/AlertDialog) | existing in codebase | Banner UI primitives and cancel confirmation dialog | Already used in subscription-guard.tsx and MySubscriptionTab.tsx |
| React useState | React 19.2.1 | Session-only banner dismissal state | Established pattern from Phase 16 Lia banner |
| useAuth() hook | internal | Banner condition reads (subscriptionStatus, cancelAtPeriodEnd, cancelAt) | CONTEXT.md locked decision — single data source |
| stripe SDK | 20.0.0 | stripe.subscriptions.cancel() for immediate cancellation | Already used in stripe.controller.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| formatDateBR() | internal utils | Format cancelAt date for yellow banner display | Already imported in MySubscriptionTab.tsx |
| StripeService.createPortalSession | internal service | Open Stripe customer portal from red banner CTA | Already called in profile page handleManagePayment |
| cn() utility | internal | Class merging for conditional banner styles | Standard throughout component tree |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useAuth() for banner state | useTenant() + useAuth() | useTenant() has cancelAtPeriodEnd and subscriptionStatus but lacks cancelAt; mixing sources adds complexity; CONTEXT.md locked useAuth() |
| Session-only banner state | Persistent dismiss in localStorage | CONTEXT.md locked non-dismissible; session-only is simpler and matches Phase 16 pattern |

**Installation:** No new packages required.

---

## Architecture Patterns

### System Architecture Diagram

```
Stripe Webhook
    │
    ▼
stripeWebhook.ts (cancel_at_period_end event)
    │  [GAP: cancelAt not passed to writer — see Open Questions]
    ▼
syncTenantPlanBillingSnapshot()
    │ writes subscription.* map atomically
    ▼
Firestore tenants/{tenantId}
    │ subscription.cancelAtPeriodEnd
    │ subscription.cancelAt        ← needs webhook fix
    │ subscription.status
    │
    ▼
auth-provider.tsx fetchUserData()
    │ maps subscription.cancelAt → user.cancelAt [new]
    │ maps subscription.cancelAtPeriodEnd → user.cancelAtPeriodEnd [existing]
    │ maps subscription.status → user.subscriptionStatus [existing]
    ▼
useAuth() → { user.subscriptionStatus, user.cancelAtPeriodEnd, user.cancelAt }
    │
    ▼
ProtectedAppShell (client component)
    ├─ if past_due → <BillingStateBanner variant="destructive"> [new]
    │     └─ "Atualizar pagamento" → StripeService.createPortalSession()
    ├─ else if cancelAtPeriodEnd → <BillingStateBanner variant="warning"> [new]
    │     └─ shows formatDateBR(cancelAt)
    │     └─ "Reativar assinatura" stub button (Phase 21)
    ▼
<SubscriptionGuard> [existing — past_due yellow banner MUST be removed or scoped]
    └─ <main>{children}</main>

─────────────────────────────────────────────────────────
Cancel flow (MySubscriptionTab.tsx)

User clicks "Cancelar assinatura"
    │
    ├─ if past_due → modified AlertDialog with immediate-cancel warning
    │       └─ confirm → StripeService.cancelSubscription()
    │                        └─ stripe.controller.ts cancelSubscription()
    │                               if subscription.status === 'past_due'
    │                                  → stripe.subscriptions.cancel() [immediate]
    │                               else
    │                                  → stripe.subscriptions.update({ cancel_at_period_end: true })
    │
    └─ if active → existing AlertDialog (unchanged)
            └─ confirm → same endpoint → at-period-end path
```

### Recommended Project Structure

No new directories needed. New/modified files:

```
apps/web/src/
├── components/layout/
│   ├── protected-app-shell.tsx     # modified — insert BillingStateBanner
│   └── billing-state-banner.tsx    # NEW component (name at Claude's discretion)
├── components/shared/
│   └── subscription-guard.tsx      # modified — remove existing past_due yellow banner
├── providers/
│   └── auth-provider.tsx           # modified — add cancelAt mapping
├── types/
│   └── index.ts                    # modified — add cancelAt?: string to User type
└── components/profile/
    └── MySubscriptionTab.tsx        # modified — past_due AlertDialog branch

apps/functions/src/
├── api/controllers/
│   └── stripe.controller.ts         # modified — past_due branch in cancelSubscription
└── stripe/
    └── stripeWebhook.ts             # modified — pass cancelAt in cancel_at_period_end handler
```

### Pattern 1: Banner Component (new)

```typescript
// Source: [VERIFIED: apps/web/src/components/shared/subscription-guard.tsx existing pattern]
// New component: apps/web/src/components/layout/billing-state-banner.tsx

'use client'

interface BillingStateBannerProps {
  variant: 'destructive' | 'warning'
  message: string
  ctaLabel: string
  onCta: () => void
  ctaDisabled?: boolean
}

export function BillingStateBanner({ variant, message, ctaLabel, onCta, ctaDisabled }: BillingStateBannerProps) {
  return (
    <div className={cn(
      "w-full px-4 py-3 flex items-center justify-between",
      variant === 'destructive' ? "bg-destructive/15 border-b border-destructive/30 text-destructive" : "bg-yellow-50 border-b border-yellow-200 text-yellow-800"
    )}>
      <span className="text-sm font-medium">{message}</span>
      <Button variant={variant === 'destructive' ? 'destructive' : 'outline'} size="sm" onClick={onCta} disabled={ctaDisabled}>
        {ctaLabel}
      </Button>
    </div>
  )
}
```

### Pattern 2: ProtectedAppShell banner insertion

```typescript
// Source: [VERIFIED: apps/web/src/components/layout/protected-app-shell.tsx lines ~1-50]
// Add to ProtectedAppShell after reading from useAuth():

const { user } = useAuth()
const isPastDue = user?.subscriptionStatus === 'past_due'
const isCancelAtPeriodEnd = !isPastDue && user?.cancelAtPeriodEnd === true

// Insertion point between <Header /> and <SubscriptionGuard>:
{isPastDue && (
  <BillingStateBanner
    variant="destructive"
    message="Seu pagamento está em atraso. Regularize para manter o acesso."
    ctaLabel="Atualizar pagamento"
    onCta={handleUpdatePayment}
  />
)}
{isCancelAtPeriodEnd && (
  <BillingStateBanner
    variant="warning"
    message={`Sua assinatura será cancelada em ${user.cancelAt ? formatDateBR(user.cancelAt) : '—'}. Reativar?`}
    ctaLabel="Reativar assinatura"
    onCta={() => {}} // Phase 21
    ctaDisabled={true}
  />
)}
```

### Pattern 3: auth-provider.tsx cancelAt mapping (new field)

```typescript
// Source: [VERIFIED: apps/web/src/providers/auth-provider.tsx lines ~215-290]
// Existing pattern for cancelAtPeriodEnd:
cancelAtPeriodEnd:
  userData.cancelAtPeriodEnd ||
  userData.subscription?.cancelAtPeriodEnd ||
  false,

// New field — no top-level fallback per CONTEXT.md decision:
cancelAt: userData.subscription?.cancelAt ?? null,
```

### Pattern 4: cancelSubscription controller branch (backend)

```typescript
// Source: [VERIFIED: apps/functions/src/api/controllers/stripe.controller.ts lines 457-539]
// Current code always calls update({ cancel_at_period_end: true })
// New branch — reads Phase 19 canonical field:

const subscriptionStatus = tenantData?.subscription?.status

if (subscriptionStatus === 'past_due') {
  // Immediate cancellation — access ends now
  await stripe.subscriptions.cancel(stripeSubscriptionId)
  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: 'canceled',
    plan: 'free',
    stripeSubscriptionId: null,
    pastDueSince: null,
    source: 'controller.cancelSubscription.past_due_immediate',
  })
} else {
  // Existing at-period-end path (active/trialing)
  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  })
  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: updated.status,
    cancelAtPeriodEnd: true,
    cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000) : null,
    // ...existing params
  })
}
```

### Pattern 5: Webhook cancelAt population (stripeWebhook.ts)

```typescript
// Source: [VERIFIED: apps/functions/src/stripe/stripeWebhook.ts lines 906-926]
// Current cancel_at_period_end handler passes scheduledPlanAt but NOT cancelAt to snapshot writer
// Fix: add cancelAt param when calling syncTenantPlanBillingSnapshot in this branch

if (shouldWriteCancel) {
  await syncTenantPlanBillingSnapshot({
    tenantId,
    subscriptionStatus: subscription.status,
    stripePriceId: primaryPriceId,
    scheduledPlan: "free",
    scheduledPlanAt: cancelAt,          // existing — for plan deferral
    cancelAt: cancelAt.toDate(),        // NEW — for yellow banner date
    cancelAtPeriodEnd: true,            // NEW — ensure flag is set
    scheduledPlanReason: "cancel_at_period_end",
    source: "webhook.subscription.updated",
  });
}
```

### Anti-Patterns to Avoid

- **Do not read `subscriptionStatus` from request body in the cancel controller.** Always use `tenantData.subscription?.status` from `resolveStripeUserContext(req)` — per multi-tenancy rule and Phase 19 canonical fields.
- **Do not add a second persistent past_due banner without removing the existing one.** `SubscriptionGuard` already renders a yellow `showWarningBanner` for `past_due` — two banners for one condition is a bug.
- **Do not put auth/billing logic in Server Components.** `ProtectedAppShell` must remain a client component (`'use client'`) when adding `useAuth()` reads and event handlers.
- **Do not use `useTenant()` for banner state.** CONTEXT.md locked all banner reads to `useAuth()`. The `Tenant` type also lacks `cancelAt`, so mixing sources would require a separate type change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe portal redirect | Custom billing page | `StripeService.createPortalSession({ userId })` | Already exists, tested, handles CORS and return URLs |
| Date formatting | Custom date format string | `formatDateBR()` from `utils/date-format` | Already imported in `MySubscriptionTab.tsx`; consistent BR locale |
| Cancel confirmation dialog | Custom modal | Shadcn `AlertDialog` | Already used for the existing cancel flow in `MySubscriptionTab.tsx`; consistent UX |
| Banner dismissal state | localStorage/cookie | `useState` (session-only) | CONTEXT.md locked non-dismissible; same pattern as Phase 16 |

---

## Common Pitfalls

### Pitfall 1: Banner Collision — SubscriptionGuard Already Has a Past_due Yellow Banner (CRITICAL)

**What goes wrong:** `apps/web/src/components/shared/subscription-guard.tsx` renders a yellow `showWarningBanner` when `subscriptionStatus === "past_due"` AND the grace period has not expired. If the new red `past_due` banner is added to `ProtectedAppShell` without removing the SubscriptionGuard banner, users in past_due state will see two banners simultaneously — one yellow (SubscriptionGuard) and one red (new).

**Why it happens:** The SubscriptionGuard banner was built before Phase 20 scope was defined. It serves a similar purpose but uses a different variant and is positioned differently (SubscriptionGuard uses `fixed top-20` toast positioning).

**How to avoid:** The planner must include a task to REMOVE or scope the SubscriptionGuard yellow banner. Options: (a) remove it entirely since the new red banner replaces it; (b) restrict it to expired-grace-period only (i.e., `showWarningBanner = isGracePeriodExpired`). Option (a) is simpler and sufficient since the red banner is non-dismissible and persistent.

**Warning signs:** If both SubscriptionGuard and ProtectedAppShell are touched in the same PR without this coordination, the E2E test for past_due state will show double banners.

**Source:** [VERIFIED: apps/web/src/components/shared/subscription-guard.tsx — line `showWarningBanner = shouldCheckSubscription && subscriptionStatus === "past_due" && !isGracePeriodExpired`]

---

### Pitfall 2: cancelAt Not Being Populated by the Webhook (CRITICAL)

**What goes wrong:** `subscription.cancelAt` in `billing-types.ts` (Phase 19) is the intended source for the yellow banner date. `syncTenantPlanBillingSnapshot` accepts a `cancelAt?: Date | null` param and writes it to `subscription.cancelAt` in Firestore. However, the `cancel_at_period_end` handler in `stripeWebhook.ts` (lines 912-926) calls `syncTenantPlanBillingSnapshot` with `scheduledPlanAt` (for the plan deferral to "free") but does NOT pass `cancelAt`. The result: `subscription.cancelAt` is never written when a user sets `cancel_at_period_end: true`, so `user.cancelAt` remains null, and the yellow banner displays "—" instead of a date.

**Why it happens:** Phase 19 defined `cancelAt` in `billing-types.ts` as "ISO; absolute cancel date for Phase 20 banner" but Phase 19's scope did not include populating it via webhook. The field was created for this phase but left empty.

**How to avoid:** Add a task in Wave 0 or Wave 1 to update the `cancel_at_period_end` handler in `stripeWebhook.ts` to also pass `cancelAt: cancelAt.toDate()` (same value as `scheduledPlanAt` — both represent the subscription's `current_period_end` at the time of cancellation). See Pattern 5 above.

**Warning signs:** Yellow banner renders with `—` for date instead of a formatted date. `subscription.cancelAt` is null in Firestore after triggering `cancel_at_period_end` via Stripe.

**Source:** [VERIFIED: apps/functions/src/stripe/stripeWebhook.ts lines 907-925 — `cancelAt` Timestamp created for `scheduledPlanAt` only, not passed as `cancelAt` param]

---

### Pitfall 3: User Doc Staleness vs Tenant Doc for Banner State

**What goes wrong:** CONTEXT.md locked banner state reads to `useAuth()`, which maps from the user Firestore doc (`users/{uid}`). The Phase 19 canonical pattern (used in `SubscriptionGuard`) reads `tenant?.subscriptionStatus ?? user.subscriptionStatus` because the tenant doc is the authoritative source updated by the webhook. If the user doc update lags the tenant doc by one webhook cycle, the banner may not appear immediately after a billing state change.

**Why it happens:** The webhook updates both docs, but timing is non-atomic. The user doc is secondary to the tenant doc in the Phase 19 canonical design.

**How to avoid:** The staleness is accepted as a known limitation (consistent with CONTEXT.md decision "All banner state reads from `useAuth()`"). The planner should NOT change this decision — it would require adding `cancelAt` to the `Tenant` type and updating `useTenant()`, which is out of scope. Document the limitation in the plan: "banner may lag by up to one webhook cycle after billing state changes; this is acceptable for soft-warning banners."

**Warning signs:** If staleness becomes a user complaint, the fix is to add `cancelAt` to `Tenant` type and use `useTenant()` — a Phase 21+ improvement.

**Source:** [VERIFIED: apps/web/src/components/shared/subscription-guard.tsx line `tenant?.subscriptionStatus ?? user.subscriptionStatus`] [VERIFIED: apps/web/src/types/index.ts — `Tenant` type has no `cancelAt` field]

---

### Pitfall 4: REQUIREMENTS.md STATE-03 Wording is Outdated

**What goes wrong:** `.planning/REQUIREMENTS.md` STATE-03 still describes the old 409-block behavior ("controller retorna 409 com código BILLING_CANCEL_BLOCKED_PAST_DUE, botão de cancelar fica desabilitado"). If the planner does not update this requirement, the plan will conflict with the accepted new behavior.

**How to avoid:** Include a task in Wave 0 to update STATE-03 in `REQUIREMENTS.md` to reflect the immediate-cancel path.

**Source:** [VERIFIED: .planning/phases/20-subscription-state-banners-cancel-enforcement/20-CONTEXT.md — "New behavior" section under Cancel enforcement]

---

### Pitfall 5: cancelAt Mapping in auth-provider Must Not Use Top-Level Fallback

**What goes wrong:** The standard dual-read pattern in `auth-provider.tsx` reads `userData.fieldName || userData.subscription?.fieldName`. If the same pattern is applied to `cancelAt`, a stale top-level `cancelAt` on the user doc from a previous implementation could shadow the correct `subscription.cancelAt`.

**How to avoid:** Map `cancelAt` as `userData.subscription?.cancelAt ?? null` only — no top-level fallback. This is explicitly locked in CONTEXT.md.

**Source:** [VERIFIED: 20-CONTEXT.md — "Read path: userData.subscription?.cancelAt — no top-level fallback"]

---

## Code Examples

### Existing portal session call pattern (unchanged, for reference)

```typescript
// Source: [VERIFIED: apps/web/src/components/shared/subscription-guard.tsx line 141]
const handleManageBilling = async () => {
  const result = await StripeService.createPortalSession({ userId: user.id })
  window.location.href = result.url
}
```

### cancelSubscription current behavior (to be modified)

```typescript
// Source: [VERIFIED: apps/functions/src/api/controllers/stripe.controller.ts lines 457-539]
// Current: always calls stripe.subscriptions.update({ cancel_at_period_end: true })
// Task: add branch on tenantData.subscription?.status === 'past_due'
```

### Existing AlertDialog pattern (reused with new copy for past_due)

```typescript
// Source: [VERIFIED: apps/web/src/components/profile/MySubscriptionTab.tsx lines 831-877]
// canCancelSubscription = Boolean(effectivePlan) && !cancelAtPeriodEnd && hasStripeSubscription
// Task: change condition so past_due tenants can also cancel (remove !past_due guard if present)
```

### SyncTenantPlanBillingSnapshotParams cancelAt field

```typescript
// Source: [VERIFIED: apps/functions/src/shared/billing-types.ts]
// SubscriptionSnapshot: { cancelAt?: string | null } — "ISO; absolute cancel date for Phase 20 banner"
// SyncTenantPlanBillingSnapshotParams: { cancelAt?: Date | null }
// Writer (stripeWebhook.ts lines 232-234):
//   ...("cancelAt" in params && {
//     cancelAt: params.cancelAt != null ? params.cancelAt.toISOString() : null,
//   }),
```

---

## Runtime State Inventory

This is not a rename/refactor phase. No runtime state inventory required.

---

## Environment Availability

This phase makes no new external service calls. All dependencies are already in use:
- Firebase Functions (deployed) — existing
- Stripe SDK 20.0.0 — existing in `apps/functions/`
- Next.js 16.1.6 frontend — existing

No blocking missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright E2E + Jest (Firestore rules) |
| Config file | `playwright.config.ts` at repo root |
| Quick run command | `npm run test:rules` (firestore rules only) |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | Red banner visible when subscriptionStatus is past_due | E2E smoke | `npm run test:e2e -- --grep "past_due banner"` | No — Wave 0 |
| STATE-02 | Yellow banner visible when cancelAtPeriodEnd is true, shows formatted date | E2E smoke | `npm run test:e2e -- --grep "cancel period end banner"` | No — Wave 0 |
| STATE-03 | Cancel from past_due state calls immediate cancel endpoint | Manual / E2E | `npm run test:e2e -- --grep "cancel subscription past_due"` | No — Wave 0 |

### Wave 0 Gaps

- [ ] `tests/e2e/billing-state-banners.spec.ts` — covers STATE-01, STATE-02, STATE-03 smoke paths
- [ ] Test fixtures for mocking `subscriptionStatus: 'past_due'` and `cancelAtPeriodEnd: true` in auth state

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth ID token validation — existing middleware, no change |
| V4 Access Control | yes | Banner reads tenant billing state from authenticated user context only; `tenantId` always from auth claims |
| V5 Input Validation | yes | `stripe.subscriptions.cancel()` receives `stripeSubscriptionId` from server-side tenant doc — never from request body |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant A cancels Tenant B's subscription | Tampering | `resolveStripeUserContext(req)` reads subscription ID from server-side tenant doc keyed by `req.user.tenantId` — not from body |
| Replay cancel request to force immediate cancellation for active subscription | Tampering | Backend branches on `tenantData.subscription?.status` (server-side read) — cannot be spoofed by client |
| Billing state banner leaking subscription details to non-master users | Information Disclosure | CONTEXT.md decision: all tenant users see banners intentionally; no sensitive financial data exposed (status + date only) |

---

## Open Questions

### 1. SubscriptionGuard past_due banner — which resolution?

**What we know:** `SubscriptionGuard` renders a yellow `showWarningBanner` when `subscriptionStatus === "past_due"` AND grace period is not expired. CONTEXT.md proposes a new red banner for the same state in `ProtectedAppShell`.

**What's unclear:** Should the SubscriptionGuard banner be (a) removed entirely, (b) restricted to expired-grace-period only, or (c) kept as-is and the new red banner only shown after grace period expires?

**Recommendation:** Remove the SubscriptionGuard past_due yellow banner entirely (option a). The new persistent red banner covers the same condition more prominently. The hard-block page (`/subscription-blocked/page.tsx`) handles the expired-grace-period case. Keeping two banners adds confusion with no benefit.

**Decision required before:** Wave 1 task writing for STATE-01.

---

### 2. cancelAt webhook population — confirm scope in stripeWebhook.ts

**What we know:** `syncTenantPlanBillingSnapshot` accepts `cancelAt?: Date | null` and writes it to `subscription.cancelAt`. The `cancel_at_period_end` handler in `stripeWebhook.ts` uses `cancelAt` as a local Timestamp variable (line 907) for `scheduledPlanAt` — but does NOT pass it as the `cancelAt` param to the snapshot writer.

**What's unclear:** Is this gap a Wave 0 task (fix webhook before implementing the banner) or Wave 1 (implement banner and webhook fix in parallel)?

**Recommendation:** Fix the webhook handler in Wave 1 alongside the frontend `cancelAt` mapping. Both are required before the yellow banner is functional. They can be in separate tasks but the same wave. The fix is small: add `cancelAt: cancelAt.toDate()` to the existing `syncTenantPlanBillingSnapshot` call at line 913.

---

### 3. cancelAt in MySubscriptionTab — should cancelSubscription controller also write cancelAt?

**What we know:** Pattern 4 above shows the at-period-end path calling `syncTenantPlanBillingSnapshot` with `cancelAt`. The Stripe `subscriptions.update()` response includes `cancel_at` (Unix timestamp) when `cancel_at_period_end: true`.

**What's unclear:** The existing `cancelSubscription` controller code (lines 457-539) may or may not currently pass `cancelAt` to the snapshot writer after calling `update({ cancel_at_period_end: true })`.

**Recommendation:** The planner should verify lines 457-539 in detail and include a task to ensure `cancelAt` is extracted from the Stripe response and passed to the snapshot writer in the at-period-end branch. This closes the same gap from the controller path that the webhook fix closes from the webhook path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `handleManageBilling` pattern in SubscriptionGuard is the correct reference for the red banner CTA | Code Examples | CTA might need different params; verify `StripeService.createPortalSession` signature accepts `{ userId }` |
| A2 | The `cancel_at_period_end` handler variable `cancelAt` (line 907) holds `current_period_end` in milliseconds, which is the correct value to pass as `subscription.cancelAt` | Pitfall 2 / Pattern 5 | If `cancel_at` on Stripe subscription object differs from `current_period_end` at the time `cancel_at_period_end` is set, the date would be wrong |
| A3 | MySubscriptionTab `canCancelSubscription` does not currently guard against past_due (it only checks `!cancelAtPeriodEnd`) | Pattern: Cancel button state | If past_due is already gated elsewhere in the component, the AlertDialog branch may need different conditions |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: apps/web/src/components/shared/subscription-guard.tsx] — existing past_due banner, `showWarningBanner` logic, `handleManageBilling` pattern
- [VERIFIED: apps/web/src/components/layout/protected-app-shell.tsx] — current structure, `useAuth()` usage, banner insertion point
- [VERIFIED: apps/web/src/providers/auth-provider.tsx] — dual-read mapping pattern, subscription.* field mappings
- [VERIFIED: apps/web/src/types/index.ts] — `User` type fields, `Tenant` type fields (confirmed no `cancelAt` in either)
- [VERIFIED: apps/functions/src/api/controllers/stripe.controller.ts] — `cancelSubscription` function, current at-period-end-only path
- [VERIFIED: apps/functions/src/shared/billing-types.ts] — `SubscriptionSnapshot.cancelAt`, `SyncTenantPlanBillingSnapshotParams.cancelAt`
- [VERIFIED: apps/functions/src/stripe/stripeWebhook.ts] — writer accept/write path for `cancelAt` (lines 232-234), `cancel_at_period_end` handler (lines 906-926), confirmed `cancelAt` param NOT passed in handler
- [VERIFIED: apps/web/src/components/profile/MySubscriptionTab.tsx] — existing AlertDialog, `canCancelSubscription` condition, `handleConfirmCancelSubscription`
- [VERIFIED: .planning/phases/20-subscription-state-banners-cancel-enforcement/20-CONTEXT.md] — all locked decisions

### Secondary (MEDIUM confidence)
- [VERIFIED: .planning/REQUIREMENTS.md] — STATE-01, STATE-02, STATE-03 wording (STATE-03 confirmed outdated)
- [VERIFIED: .planning/STATE.md] — Phase 19 completion status, `syncTenantPlanBillingSnapshot` canonical writer note

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all primitives verified in existing codebase files
- Architecture: HIGH — insertion points, data flow, and blocking gaps all verified from source
- Pitfalls: HIGH — all three critical concerns verified from direct file reads, not assumed
- Backend branching: HIGH — `cancelSubscription` controller verified; Stripe API usage pattern follows existing controller code

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable domain; no fast-moving dependencies)
