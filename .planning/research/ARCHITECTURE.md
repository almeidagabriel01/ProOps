# Architecture Research

**Domain:** Billing & Payment Hardening — Single-Writer Consolidation for Multi-Tenant SaaS
**Researched:** 2026-05-07
**Confidence:** HIGH (based on direct code inspection of all affected files)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Stripe Event Sources                            │
│  stripeWebhook.ts (HTTP fn)    stripe.controller.ts (Express API)   │
│  billing-sync.service.ts (cron/on-demand)                           │
└───────────────────────────┬─────────────────────────────────────────┘
                             │  all paths funnel through
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              tenant-subscription-writer.ts  (NEW — single writer)   │
│                                                                     │
│  writeTenantBillingState(tenantId, patch, opts)                     │
│    ├── Firestore transaction: read + merge + write atomically        │
│    ├── Per-tenant event ordering guard (lastProcessedStripeEventAt)  │
│    ├── cancelAtPeriodEnd clear rule: status=canceled → false         │
│    ├── pastDueSince set/clear rules                                  │
│    └── scheduledPlan/At/Reason managed by caller-supplied flags     │
└───────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Firestore: tenants/{tenantId}                     │
│  Canonical source of truth for all billing state                    │
│  subscriptionStatus · plan · cancelAtPeriodEnd · pastDueSince       │
│  currentPeriodEnd · billingInterval · trialEndsAt                   │
│  scheduledPlan · scheduledPlanAt · scheduledPlanReason              │
│  lastProcessedStripeEventAt (new — ordering guard)                  │
└───────────────────────────┬─────────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
   users/{uid}         addons/{id}    require-active-subscription
   (mirror writes       (independent)   middleware cache (30s TTL)
    during migration)
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `stripeWebhook.ts` | Receives Stripe events, resolves tenantId, calls writer | Existing — modify |
| `stripe.controller.ts` | REST API for plan changes, cancel, reactivate | Existing — add reactivate endpoint |
| `billing-sync.service.ts` | On-demand full resync from Stripe API | Existing — call writer instead of direct Firestore |
| `tenant-subscription-writer.ts` | Single transactional writer for tenant billing fields | New |
| `subscription-status.ts` | Pure status normalization (Stripe → internal) | New |
| `addon-state.ts` (backend) | Pure deriver: addons docs → feature gate map | New |
| `addon-state.ts` (frontend) | Mirror of backend deriver, same signature | New |
| `addon-cleanup.cron.ts` | Daily cleanup of stale addon docs using deriver | New |
| `mercadopago-fee-estimate.service.ts` | MP fee preview calculation, no Stripe dependency | New (independent) |
| `require-active-subscription.ts` | Reads tenant doc, 30s in-memory cache, blocks expired | Existing — no change |

---

## Recommended Project Structure

```
apps/functions/src/
├── billing/
│   ├── billing-types.ts              # BillingSnapshot interface (existing)
│   ├── billing-mappers.ts            # mapStripeStatusToBilling etc. (existing)
│   ├── billing-sync.service.ts       # On-demand Stripe resync (existing — calls writer)
│   ├── billing-queue.ts              # Semaphore + rate limiter for sync concurrency (existing)
│   ├── checkout-reservation.ts       # Checkout in-flight guard (existing)
│   ├── duplicate-handler.ts          # Dedup subscriptions (existing)
│   ├── index.ts                      # Re-exports (existing)
│   ├── subscription-status.ts        # NEW: pure status normalizer
│   ├── tenant-subscription-writer.ts # NEW: single transactional writer
│   ├── addon-state.ts                # NEW: pure addon feature deriver
│   └── addon-cleanup.cron.ts         # NEW: cron — cleanup stale addons
├── api/
│   ├── controllers/
│   │   └── stripe.controller.ts      # MODIFY: add reactivateSubscription handler
│   ├── services/
│   │   └── mercadopago-fee-estimate.service.ts  # NEW: MP fee preview
│   └── middleware/
│       └── require-active-subscription.ts       # No change
└── stripe/
    ├── stripeWebhook.ts              # MODIFY: replace inline set() calls with writer
    └── stripeHelpers.ts              # Reduce surface: updateSubscriptionStatus stays (user doc)

apps/web/src/
└── lib/
    └── billing/
        └── addon-state.ts            # NEW: frontend mirror of backend addon deriver
```

### Structure Rationale

- **`billing/tenant-subscription-writer.ts`** is colocated with other billing infrastructure, not under `stripe/`, because it will also be called by `billing-sync.service.ts` and the reactivation controller — it is not Stripe-specific.
- **`billing/subscription-status.ts`** is extracted first (no breaking changes) and consumed by the writer. Pure function, no Firestore dependency. Ships before the writer.
- **`billing/addon-state.ts`** is pure (no Firestore reads inside the deriver) — it takes already-fetched documents as arguments, making it trivially testable and usable in both cron and frontend contexts.
- **`web/src/lib/billing/addon-state.ts`** mirrors the backend deriver with identical signature over the `Tenant` domain type (not raw Firestore data). The frontend tenant doc is fetched via `getDoc` in `tenant-provider.tsx` (one-shot, not live-streamed). The deriver computes from the already-loaded snapshot — no additional network call is needed, but the data reflects the last manual refresh, not a live Firestore stream.

---

## Architectural Patterns

### Pattern 1: Single Transactional Writer with Per-Tenant Ordering Guard

**What:** All writes to tenant billing fields go through one function that executes inside `db.runTransaction()`. The transaction reads the current doc, applies deterministic rules, and writes atomically. A `lastProcessedStripeEventAt` timestamp prevents stale out-of-order Stripe events from overwriting newer state.

**When to use:** Any time subscription status, cancelAtPeriodEnd, pastDueSince, plan tier, or currentPeriodEnd changes on the tenant doc.

**Trade-offs:** Adds ~1 Firestore read RTT per webhook (inside transaction), but eliminates all race conditions. Firestore Admin SDK auto-retries transactions on `ABORTED` up to 5 times — this is the assumed concurrency safety net.

**Example — writer contract:**
```typescript
// apps/functions/src/billing/tenant-subscription-writer.ts

export interface TenantBillingPatch {
  subscriptionStatus: BillingStatus;
  stripePriceId?: string | null;
  plan?: string;
  billingInterval?: "monthly" | "yearly";
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string | null;
  pastDueSince?: string | null; // if absent, writer applies set/clear rule
  scheduledPlan?: string | null;
  scheduledPlanAt?: FirebaseFirestore.Timestamp | null;
  scheduledPlanReason?: string | null;
  clearScheduled?: boolean; // when true, nulls all scheduled fields
  // Ordering guard
  stripeEventCreatedAt?: number; // unix seconds from Stripe event.created
}

export async function writeTenantBillingState(
  tenantId: string,
  patch: TenantBillingPatch,
  opts: { source: BillingSnapshot["source"] },
): Promise<void>
```

**Deterministic rules encoded in writer (not in callers):**
- `status === "canceled"` → `cancelAtPeriodEnd: false` (fixes the stale badge bug)
- `status === "past_due"` → set `pastDueSince` if not already set, preserve existing value
- `status === "active" | "trialing"` → clear `pastDueSince`
- If `stripeEventCreatedAt` is present and `< tenant.lastProcessedStripeEventAt` → skip write, return early (out-of-order guard)

### Pattern 2: Seed from Existing — Extend, Don't Replace

**What:** `syncTenantPlanBillingSnapshot()` in `stripeWebhook.ts` already uses `db.runTransaction()` with the right shape. The new `tenant-subscription-writer.ts` extends this function's logic rather than creating a parallel implementation.

**When to use:** Prevents introducing a 5th writer during migration.

**Trade-offs:** Requires reading `stripeWebhook.ts` carefully to port all rules; one-time complexity, then permanent simplification.

**Migration order:**
1. Extract `subscription-status.ts` (pure, no risk)
2. Create `tenant-subscription-writer.ts` — port logic from `syncTenantPlanBillingSnapshot` + add ordering guard + deterministic rules
3. Make `syncTenantPlanBillingSnapshot` a thin wrapper that calls the writer
4. Migrate inline `tenantRef.set()` calls in each webhook handler (one handler per commit — independently shippable)
5. Migrate `billing-sync.service.ts` to call the writer instead of its own `tenantRef.set`
6. Add reactivation endpoint in `stripe.controller.ts`, calling the writer

### Pattern 3: Pure Deriver for Addon State (Frontend + Backend Mirror)

**What:** A pure function `deriveAddonState(subscriptionStatus, addons, gracePeriodDays): AddonStateMap` that takes already-fetched data and returns a computed access map. Identical implementation on both sides of the stack.

**When to use:** Whenever any component needs to know if an addon is active, past-due with grace, or expired.

**Trade-offs:** Hand-duplicated logic (two files). Given the function is small and pure, this is acceptable over adding a shared package. Add snapshot tests on both sides to catch drift.

**Sync strategy:** The frontend tenant doc is fetched via `getDoc` in `tenant-provider.tsx` — one-shot per load/refresh, not a live Firestore stream. The deriver runs over the last-fetched snapshot. This means addon state visible to the user reflects the moment of last page load or explicit refresh. After a Stripe webhook writes new state to Firestore, the frontend won't see it until the user triggers a refresh or navigates. This is the existing behavior for all billing fields and is acceptable for v4.0 scope. No additional invalidation is added in this milestone; consider `onSnapshot` for the tenant provider as a future improvement if real-time billing state visibility becomes a requirement.

```typescript
// Shared shape — hand-duplicate in both files
export interface AddonStateMap {
  [addonType: string]: {
    isActive: boolean;
    isGrace: boolean; // past_due within grace period
    isExpired: boolean;
    expiresAt: string | null;
  };
}

export function deriveAddonState(
  subscriptionStatus: BillingStatus,
  addons: PurchasedAddon[],
  gracePeriodDays: number,
  now?: Date,
): AddonStateMap
```

---

## Data Flow

### Stripe Webhook → Tenant Doc (new flow)

```
Stripe POST /stripeWebhook
    ↓
beginStripeEventProcessing() → stripe_events/{id} (idempotency)
    ↓
resolveTenantIdForBillingEvent()
    ↓
[event handler: handleSubscriptionUpdated / handleInvoicePaymentFailed / etc.]
    ↓
writeTenantBillingState(tenantId, patch, { source: "webhook" })
    ↓
db.runTransaction():
    ├── read tenants/{tenantId}
    ├── check lastProcessedStripeEventAt (ordering guard)
    ├── apply deterministic rules (cancelAtPeriodEnd, pastDueSince, etc.)
    └── write patch + lastProcessedStripeEventAt + billingSyncedAt
    ↓
[outside transaction — reads tenant plan]
clearTenantPlanCache(tenantId)
tenantPlanAllowsWhatsApp(tenantId) → update whatsappEnabled
    ↓
updateSubscriptionStatus(userId, ...) → users/{uid}  [migration-phase write]
    ↓
finalizeStripeEventProcessing(event, "processed")
```

### Billing Sync (on-demand/cron) → Tenant Doc (new flow)

```
syncTenantBillingFromStripe(tenantId)
    ↓
stripe.subscriptions.list(customer)
    ↓
normalize: plan, billingInterval, status, periodEnd, cancelAtPeriodEnd
    ↓
writeTenantBillingState(tenantId, patch, { source: "cron" })
    [same transactional writer — no special path]
```

### Frontend Addon State (computed from last-fetched snapshot)

```
TenantProvider (getDoc: tenants/{tenantId} — one-shot, refreshes on explicit trigger)
    ↓ tenant snapshot available in context
PlanProvider
    ├── AddonService.getAddons(tenantId) → addons collection one-shot fetch
    └── deriveAddonState(subscriptionStatus, addons, 7)
        → { financial: { isActive, isGrace, isExpired }, ... }
        consumed by hasFinancial, pastDueAddons, etc.
Note: reflects state at last refresh, not live Firestore stream.
```

### MP Fee Estimate (independent path)

```
POST /v1/billing/mp-fee-estimate
    ↓
mercadopago-fee-estimate.service.ts
    ├── reads rate table (from Firestore config or hardcoded map)
    └── returns { grossAmount, netAmount, feeAmount, feeRate }
    [no Stripe dependency, no tenant billing write]
```

---

## Integration Points

### Existing Files: What Changes vs What Stays

| File | Change Type | What Changes |
|------|-------------|--------------|
| `stripe/stripeWebhook.ts` | Modify | Replace 4 inline `tenantRef.set()` calls with `writeTenantBillingState()`; `syncTenantPlanBillingSnapshot()` becomes a passthrough |
| `billing/billing-sync.service.ts` | Modify | Replace `tenantRef.set(tenantPatch, { merge: true })` with `writeTenantBillingState()` |
| `stripe/stripeHelpers.ts` | Modify (reduce) | `updateSubscriptionStatus()` and `updateUserPlan()` stay (user doc); `upsertTenantStripeBillingData()` stays (billing IDs); no new tenant billing writes added here |
| `api/controllers/stripe.controller.ts` | Modify | Add `reactivateSubscription` handler |
| `api/middleware/require-active-subscription.ts` | No change | Reads tenant doc correctly; 30s cache is intentional |
| `billing/billing-types.ts` | Extend | Add `lastProcessedStripeEventAt` to schema; update `BillingSnapshot` if needed |
| `web/src/types/index.ts` | Extend | Add `plan` field type guard (already partially present); ensure `cancelAtPeriodEnd` is explicitly typed |

### New Files and Their Integration Constraints

| New File | Integration Constraint |
|----------|------------------------|
| `billing/subscription-status.ts` | No external dependencies. Ships first. Imported by writer and billing-mappers. |
| `billing/tenant-subscription-writer.ts` | Imports: `billing-types`, `subscription-status`, `billing-mappers`, `tenant-plan-policy`, `whatsapp-eligibility`, `logger`. Called by: `stripeWebhook.ts`, `billing-sync.service.ts`, `stripe.controller.ts`. |
| `billing/addon-state.ts` | Pure function — no Firestore imports. Takes `PurchasedAddon[]` (type from `apps/web/src/types/plan.ts`); backend imports the same shared type via `apps/functions/src/shared/`. If that type doesn't exist in shared, add it. |
| `billing/addon-cleanup.cron.ts` | Exported from `apps/functions/src/index.ts` as a new scheduled function. Uses `addon-state.ts` deriver. |
| `api/services/mercadopago-fee-estimate.service.ts` | No billing writer dependency. Independent. Can be developed in parallel. |
| `web/src/lib/billing/addon-state.ts` | Imports from `@/types` (PurchasedAddon, BillingStatus). Called from `plan-provider.tsx`. Replaces inline grace-period logic scattered in `plan-provider.tsx`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `stripeWebhook.ts` → writer | Direct function call | Must pass `stripeEventCreatedAt: event.created` for ordering guard |
| `billing-sync.service.ts` → writer | Direct function call | No `stripeEventCreatedAt` (Stripe API call, not event) — ordering guard skipped |
| `stripe.controller.ts` → writer | Direct function call | Reactivation: sets `cancelAtPeriodEnd: false`, clears scheduled plan |
| Writer → `users/{uid}` | None (writer only touches tenant doc) | User doc writes remain in `updateSubscriptionStatus` / `updateUserPlan` during migration period |
| Frontend `plan-provider.tsx` → `addon-state.ts` | Direct import | Replaces inline `ADDON_GRACE_PERIOD_DAYS` logic already in plan-provider |
| `stripeWebhook.ts` and `api` deploy coupling | Shared module | `tenant-subscription-writer.ts` is imported by both `stripeWebhook` (separate Cloud Function) and the `api` monolith (separate Cloud Function). A change to the writer requires redeploying BOTH functions. Plan deploys accordingly — deploy both together or ensure the writer interface is backward-compatible between deploys. |

---

## Two-Collection Migration: tenant doc vs users doc

The recent commit history confirms an in-progress migration: billing fields are moving from `users/{uid}` (legacy) to `tenants/{tenantId}` (canonical). The architecture for this milestone:

**Rule:** `tenants/{tenantId}` is canonical for all billing decisions. `require-active-subscription.ts` already reads only the tenant doc. The writer only writes the tenant doc.

**During migration:** `updateSubscriptionStatus()` and `updateUserPlan()` (in `stripeHelpers.ts`) continue to write user doc in parallel. These calls are NOT removed in this milestone. The writer does not replace them — it adds the tenant-canonical write.

**After migration completes (future milestone):** User-doc billing field writes are removed from webhook handlers. The `subscription-status.ts` and writer are already positioned for this.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (10 instances × 80 concurrency = 800 max concurrent webhooks) | Firestore transaction with Admin SDK auto-retry (5 attempts on ABORTED) is sufficient. Per-tenant ordering guard prevents stale overwrites across concurrent deliveries of the same subscription. |
| Stripe webhook burst (e.g., plan migration for many tenants simultaneously) | `billing-queue.ts` semaphore (max 5 concurrent syncs) already handles `billing-sync.service.ts`. Webhook events process independently per-tenant with transaction safety. No additional queueing needed at current scale. |
| High contention on single tenant doc | Unlikely in practice (one tenant can't generate concurrent webhook events). Transaction contention window is under 1ms. |

---

## Anti-Patterns

### Anti-Pattern 1: Adding Inline `tenantRef.set()` Calls in Webhook Handlers

**What people do:** Add a special-case billing field write directly in a new webhook handler function to "just fix this one thing."

**Why it's wrong:** It creates a new writer and re-introduces the race condition that caused the ghost addon badge, the stale cancelAtPeriodEnd, and the out-of-order event overwrites. Every inline write bypasses the ordering guard and the deterministic rules.

**Do this instead:** Add the field to `TenantBillingPatch` in the writer interface, encode the rule in the writer, and call `writeTenantBillingState()` from the handler.

### Anti-Pattern 2: Encoding Business Rules in Callers Instead of the Writer

**What people do:** Add `if (status === "canceled") patch.cancelAtPeriodEnd = false` inside `handleSubscriptionDeleted()`, then again in `handleSubscriptionUpdated()`, then again in `billing-sync.service.ts`.

**Why it's wrong:** Rules diverge. This is exactly how the current codebase reached three inconsistent paths — `handleInvoicePaymentFailed` doesn't clear cancelAtPeriodEnd, `handleSubscriptionDeleted` does.

**Do this instead:** The writer encodes all deterministic rules. Callers pass raw data from Stripe; the writer derives the correct final state.

### Anti-Pattern 3: Reading Tenant Doc Before the Transaction to Check Ordering

**What people do:** `const snap = await tenantRef.get()` before calling the writer, to decide whether to call it.

**Why it's wrong:** Creates a TOCTOU gap — another Cloud Run instance can write between your read and the writer's transaction.

**Do this instead:** Pass `stripeEventCreatedAt` to the writer. The ordering check happens inside the transaction where it is atomic.

### Anti-Pattern 4: Sharing In-Memory State for Concurrency Control Across Instances

**What people do:** Use a module-level `Map` (like `WEBHOOK_RATE_LIMIT_STATE` already in stripeWebhook.ts) to track "which tenants are currently being processed."

**Why it's wrong:** Cloud Run has up to 10 instances. Module-level state is per-instance. No cross-instance coordination.

**Do this instead:** The Firestore `stripe_events` collection with `beginStripeEventProcessing()` already handles cross-instance idempotency correctly. The ordering guard inside the writer transaction handles concurrent same-subscription events. Do not add new in-memory cross-tenant state.

---

## Build Order for Phases

The dependency chain is strictly one-directional. Each step is independently deployable:

```
Step 1: subscription-status.ts (pure — no dependencies, no breaking changes)
    ↓
Step 2: tenant-subscription-writer.ts
        (depends on subscription-status.ts, billing-types.ts, billing-mappers.ts)
        (syncTenantPlanBillingSnapshot becomes a passthrough wrapper)
    ↓
Step 3: Migrate stripeWebhook.ts inline set() calls to writer
        (handler by handler — each sub-step independently deployable)
        Priority order:
          a. handleInvoicePaymentFailed (pastDueSince fix — the reported bug)
          b. handleSubscriptionUpdated inline scheduledPlan writes
          c. handleSubscriptionDeleted
          d. handleCheckoutCompleted (already mostly uses syncTenantPlanBillingSnapshot)
    ↓
Step 4: Migrate billing-sync.service.ts to call writer
    ↓
Step 5: Add reactivation endpoint in stripe.controller.ts (calls writer)
    ↓
Step 6: addon-state.ts backend deriver (pure — no Firestore calls)
    ↓
Step 7: addon-state.ts frontend mirror (imports Tenant type — no network calls)
        plan-provider.tsx uses deriver instead of inline grace logic
    ↓
Step 8: addon-cleanup.cron.ts (depends on addon-state deriver)
        Export in index.ts
    ↓
Step 9: mercadopago-fee-estimate.service.ts
        (independent — can be developed in parallel with steps 3-8)
```

---

## Open Questions (for implementing phases)

**Q1: Writer input: raw `Stripe.Subscription` or normalized intermediate?**
A normalized `TenantBillingPatch` is recommended (more testable, decouples Stripe SDK from writer). Each event handler normalizes its Stripe object into a patch before calling the writer. This means the writer has no Stripe SDK import. Confirm during implementation.

**Q2: Addon type location in shared types.**
`PurchasedAddon` type is currently in `apps/web/src/types/plan.ts`. Backend needs the same shape for `addon-state.ts`. Check whether `apps/functions/src/shared/` already has an equivalent or needs one added. If not, add a minimal `AddonDocument` interface to `apps/functions/src/shared/` matching the Firestore shape.

**Q3: `billingSyncing` flag.**
Verified: `billingSyncing` has no frontend readers (grep across `apps/web` returns zero matches). It is only written and read within `billing-sync.service.ts`. In the new flow, it should either be set inside the writer transaction (adds complexity) or removed (the queue semaphore already limits concurrency). Removing it from the Firestore doc is safe — confirm during implementation and drop the field from `BillingSnapshot` at the same time.

**Q4: MP fee rate source.**
`mercadopago-fee-estimate.service.ts` needs a fee rate table. Whether this is hardcoded, from a Firestore config doc, or from the MP API must be decided before implementation. Hardcoded with env-var override is sufficient for v4.0 scope.

---

## Sources

- Direct code inspection: `apps/functions/src/stripe/stripeWebhook.ts` (1100+ lines)
- Direct code inspection: `apps/functions/src/billing/billing-sync.service.ts`
- Direct code inspection: `apps/functions/src/billing/billing-queue.ts`
- Direct code inspection: `apps/functions/src/billing/billing-types.ts`
- Direct code inspection: `apps/functions/src/billing/billing-mappers.ts`
- Direct code inspection: `apps/functions/src/stripe/stripeHelpers.ts`
- Direct code inspection: `apps/functions/src/api/middleware/require-active-subscription.ts`
- Direct code inspection: `apps/functions/src/api/controllers/stripe.controller.ts`
- Direct code inspection: `apps/web/src/providers/tenant-provider.tsx` (confirmed: `getDoc`-based, not `onSnapshot`)
- Direct code inspection: `apps/web/src/providers/plan-provider.tsx`
- Direct code inspection: `apps/web/src/types/index.ts`
- Verified: `billingSyncing` has zero readers in `apps/web` (grep confirmed)
- Firestore transaction semantics: Admin SDK auto-retries on ABORTED up to 5 times (HIGH confidence — documented behavior)
- Cloud Run concurrency model: 10 instances × 80 concurrency = 800 max concurrent (from `deploymentConfig.ts` and CLAUDE.md)

---
*Architecture research for: Billing & Payment Hardening — Single-Writer Consolidation*
*Researched: 2026-05-07*
