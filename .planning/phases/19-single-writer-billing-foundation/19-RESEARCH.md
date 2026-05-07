# Phase 19: Single-Writer Billing Foundation - Research

**Researched:** 2026-05-07
**Domain:** Firebase Firestore billing state consolidation, LRU cache, Stripe idempotency
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**subscription.* nested schema**

**What goes in subscription.*:** Full reorganization + new tracking fields. The new `subscription` map on tenant documents contains:
- **Core status:** `subscription.status` (active/past_due/canceled/etc.), `subscription.pastDueSince`, `subscription.cancelAtPeriodEnd`, `subscription.cancelAt` (absolute cancel date for Phase 20 banner display)
- **Stripe identifiers:** `subscription.stripeSubscriptionId`, `subscription.stripePriceId`, `subscription.stripeCustomerId`
- **Period fields:** `subscription.currentPeriodStart`, `subscription.currentPeriodEnd`
- **Plan resolution:** `subscription.plan` (tier: starter/pro/enterprise), `subscription.scheduledPlan`, `subscription.scheduledPlanAt`
- **Audit metadata:** `subscription.syncedAt`, `subscription.lastEventId`

**Top-level field removal policy:** Audit each existing top-level field (subscriptionStatus, cancelAtPeriodEnd, currentPeriodEnd, stripePriceId, pastDueSince, scheduledPlan, scheduledPlanAt, etc.) for all read locations in the codebase. If a top-level field has no remaining readers after the new `subscription.*` fields replace it in the write path, delete the top-level field. Keep top-level fields only where they still have active readers that cannot be migrated in this phase. Never delete without confirming the replacement field is correctly written first.

**Consolidation scope — what routes through syncTenantPlanBillingSnapshot**

**Must go through the function (billing state):**
- All Stripe webhook handlers: `handleSubscriptionDeleted`, `handleInvoicePaymentFailed`, `handleSubscriptionUpdated` (including deferral writes for `scheduledPlan`/`scheduledPlanAt`), and all existing callers already using the function
- Billing controller: `cancelSubscription`, `syncSubscription`, `confirmCheckoutSession`
- Daily cron: `billing-sync.service.ts` (called by `checkStripeSubscriptions`) — currently writes directly, must be routed through the function

**Stays as direct Firestore write (not billing state):**
- Trial writes: `reserveTrialSlot` (`trialReservedAt`), `markTrialUsed` (`trialUsedAt`, `trialPlanTier`) — one-time trial markers, not ongoing subscription state, unaffected by Phase 20 banners

**End state:** After this phase, `grep -rn "tenantRef\.(set|update)" apps/functions/src/` should return zero billing state write results outside of `syncTenantPlanBillingSnapshot` and the explicitly exempt trial writes.

**LRU cache replacement**

**Two caches converted (both are unbounded Maps today):**
1. `billingStateCache` in `apps/functions/src/api/middleware/require-active-subscription.ts` — subscription status cache, checked on every protected request
2. `PLAN_CACHE` in `apps/functions/src/lib/tenant-plan-policy.ts` — plan enforcement cache, also 30s TTL

**Implementation:** Use `lru-cache` npm package (verify it's a transitive dependency before adding; if not, add it). Separate LRU instances — one per cache file. Both instances: 500-entry max, 30s TTL. The previous unbounded global Maps are removed entirely.

**Stripe idempotency hardening**

**Gap being fixed:** `beginStripeEventProcessing()` in `stripeWebhook.ts` reads the `stripe_events/{eventId}` status and writes "processing" in two separate steps — two Cloud Run instances can both read "not processing" and both proceed. Fix: wrap the check-and-set in `db.runTransaction()` so the read + write is atomic across instances.

**Verification:** Write an emulator replay test that sends the same Stripe event twice with the same `eventId`. Assert the second request returns HTTP 200 without re-executing any business logic (verify Firestore snapshot is unchanged after the second call).

### Claude's Discretion
- TypeScript interface/type for the `subscription.*` map (naming, exact field types)
- Whether to introduce a `SubscriptionSnapshot` type alias used by `syncTenantPlanBillingSnapshot` parameters
- The exact parameter signature extension for `syncTenantPlanBillingSnapshot` to support all consolidated callers
- TTL and max size config: use constants rather than magic numbers

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-06 | Single transactional writer — all billing state paths call `syncTenantPlanBillingSnapshot`, which writes top-level + `subscription.*` atomically in `db.runTransaction()` | Codebase audit identified 13 parallel write callsites that must be consolidated; function already uses `db.runTransaction()` — extend, don't replace |
| BILL-07 | LRU cache replacing unbounded Maps — 500-entry max, 30s TTL, in both `require-active-subscription.ts` and `tenant-plan-policy.ts` | `lru-cache` v11 verified via npm; API confirmed: `new LRUCache<K,V>({ max: 500, ttl: 30_000 })`; test helpers in tenant-plan-policy.ts must be updated to use LRU API |
| BILL-08 | Idempotency via `stripe_events/{eventId}` — duplicate Stripe event returns HTTP 200 without reprocessing | `beginStripeEventProcessing` already uses `db.runTransaction()` (lines 452-479); see Open Questions for the remaining gap |
</phase_requirements>

---

## Summary

Phase 19 eliminates a class of billing race conditions by enforcing a single-writer pattern: all subscription state mutations on tenant documents must flow through `syncTenantPlanBillingSnapshot` in `stripeWebhook.ts`. Today, at least thirteen direct `tenantRef.set()` / `tenantRef.update()` callsites write billing fields outside this function — including the daily Stripe sync cron, the cancel/sync/checkout controller actions, and several webhook handlers.

The phase also introduces the canonical `subscription.*` nested map on tenant documents alongside existing top-level fields. CONTEXT.md requires an explicit reader audit per top-level field: fields with zero remaining readers may be dropped; those with active readers stay. The reader audit conducted in this research reveals that **all major top-level billing fields have active readers in Phase 19**, and several (`subscriptionStatus`, `currentPeriodEnd`) are used as Firestore query filters in scheduled crons — making them immovable without Firestore index changes. The audit result is: write to both `subscription.*` AND top-level fields, and do not drop any top-level fields in Phase 19. The planner must include a "reader audit" task that documents this result.

Two unbounded global `Map` instances are replaced with bounded LRU caches via `lru-cache` (v11). The package is currently only a transitive dependency and must be added as a direct dependency. The Stripe idempotency mechanism (`beginStripeEventProcessing`) already uses a Firestore transaction internally; the remaining gap is a 5-minute window where a crashed-during-processing event will not be retried. This is documented in Open Questions for resolution during planning.

**Primary recommendation:** Extend `syncTenantPlanBillingSnapshot` to accept all billing fields, write `subscription.*` alongside top-level fields in the existing transaction, then systematically redirect all parallel writers to call this function. Use the grep end-state check as the phase gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Billing state write | API / Backend (`syncTenantPlanBillingSnapshot`) | — | Single-writer pattern; no client-side billing writes |
| Stripe event idempotency | API / Backend (`stripe_events` collection) | — | Transactional check-and-set; must be in Cloud Function |
| LRU cache (billing status) | API / Backend (per-instance in-process) | — | Cloud Run in-process cache; no Redis needed at this scale |
| LRU cache (plan enforcement) | API / Backend (per-instance in-process) | — | Same as above; per-instance acceptable (10 instances max) |
| subscription.* schema | Database / Storage (Firestore `tenants/{id}`) | — | Firestore document map; write-alongside-old-fields during Phase 19 |
| Trial writes (exempt) | API / Backend (direct Firestore) | — | One-time lifecycle events; not subscription state |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lru-cache` | 11.x (must add as direct dep) | Bounded LRU cache for billing and plan state | De-facto Node.js LRU standard; already in transitive dependency tree; named export `LRUCache` with `{ max, ttl }` options |
| Firebase Admin SDK | 12.7.0 (already installed) | Firestore transactions, document reads/writes | Already in project; `db.runTransaction()` used throughout |
| TypeScript | 5.x (already installed) | Typed `SubscriptionSnapshot` interface | Strict mode enabled; `interface` for data shapes per conventions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `logger` from `../lib/logger` | (project internal) | Structured GCP Cloud Logging | All new billing write log statements |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `lru-cache` | Redis | Overkill for per-instance cache; no cross-instance coordination needed at current scale (10 max) |
| Separate LRU per file | Single shared LRU | Separate instances avoid cross-concern eviction; simpler to reason about |

**Installation:**
```bash
cd apps/functions && npm install --save lru-cache
```

`lru-cache` is currently only a transitive dependency (multiple versions 5.x, 6.x, 10.x, 11.x in `node_modules`). Adding as direct dependency pins v11.x. [VERIFIED: apps/functions/package.json direct dependency check]

---

## Architecture Patterns

### System Architecture Diagram

```
Stripe Event
     │
     ▼
stripeWebhook (HTTP Function)
     │
     ├─► beginStripeEventProcessing()
     │        │
     │        └─► db.runTransaction() {           ← already exists
     │                read stripe_events/{eventId}
     │                check: completed/processing? → 200 early return
     │                write status:"processing"
     │            }
     │            [gap: 5-min stuck-processing window — see Open Questions]
     │
     ├─► routeStripeEvent(event)
     │        │
     │        ├─► handleSubscriptionUpdated()  ─┐
     │        ├─► handleSubscriptionDeleted()   │  All call
     │        ├─► handleInvoicePaymentFailed()  │  syncTenantPlanBillingSnapshot()
     │        └─► handleCheckoutCompleted()    ─┘  (post-phase-19)
     │
     └─► syncTenantPlanBillingSnapshot(tenantId, params)
              │
              └─► db.runTransaction() {           ← already exists, extend it
                      read tenantRef
                      write top-level fields      ← keep for active readers
                      write subscription.* map    ← NEW in Phase 19
                  }
                  + second write: tenantRef.update({ whatsappEnabled })
                  (outside transaction — keep as-is, see Pitfall 2)


Billing Controller (stripe.controller.ts)
     │   cancelSubscription()
     │   syncSubscription()
     │   confirmCheckoutSession()
     └─► syncTenantPlanBillingSnapshot()  (post-phase-19)

Cron: checkStripeSubscriptions → billing-sync.service.ts
     │
     └─► syncTenantPlanBillingSnapshot()  (post-phase-19)

Cron: applyScheduledPlanChanges
     │
     └─► db.runTransaction() {           ← already transactional
             plan, scheduledPlan/*       ← add subscription.* writes here
         }                               (see Open Question 2)


Every Protected Request
     │
     └─► require-active-subscription middleware
              ├─► billingStateCache (LRU 500 entries, 30s TTL)  [BILL-07]
              │       hit → return cached status
              │       miss → read tenantRef → cache → enforce
              └─►
Plan Enforcement (enforceTenantPlanLimit)
     │
     └─► PLAN_CACHE (LRU 500 entries, 30s TTL)  [BILL-07]
             hit → return cached profile
             miss → read tenants/{tenantId} → cache → evaluate
```

### Recommended Project Structure

No new files or folders are required. All changes are in-place edits to existing files:

```
apps/functions/src/
├── stripe/
│   └── stripeWebhook.ts          # syncTenantPlanBillingSnapshot extended;
│                                 # all webhook handlers consolidated to call it
├── billing/
│   └── billing-sync.service.ts   # Direct tenantRef.set() → syncTenantPlanBillingSnapshot
├── api/
│   ├── controllers/
│   │   └── stripe.controller.ts  # cancelSubscription, syncSubscription,
│   │                             # confirmCheckoutSession, createCheckoutSession → function
│   └── middleware/
│       └── require-active-subscription.ts  # Map → LRU
├── lib/
│   └── tenant-plan-policy.ts     # PLAN_CACHE Map → LRU; test helpers updated
├── stripe/
│   └── stripeHelpers.ts          # updateUserPlan, runStripeSync,
│                                 # upsertTenantStripeBillingData → function
└── applyScheduledPlanChanges.ts  # Add subscription.* writes inside existing transaction
```

Optional new file (Claude's Discretion):
```
apps/functions/src/shared/billing-types.ts   # SubscriptionSnapshot interface
```

### Pattern 1: Extending syncTenantPlanBillingSnapshot

**What:** Add `subscription.*` nested map writes alongside existing top-level writes inside the already-existing `db.runTransaction()`.
**When to use:** Every billing state mutation, everywhere in the codebase.
**Example:**
```typescript
// Source: codebase audit of apps/functions/src/stripe/stripeWebhook.ts lines 129-196
// [VERIFIED: direct file read]

// Optional SubscriptionSnapshot type (Claude's Discretion):
interface SubscriptionSnapshot {
  status?: string;
  pastDueSince?: Timestamp | null;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: Timestamp | null;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  plan?: string;
  scheduledPlan?: string | null;
  scheduledPlanAt?: Timestamp | null;
  syncedAt?: Timestamp;
  lastEventId?: string;
}

// Inside the existing db.runTransaction() in syncTenantPlanBillingSnapshot:
tx.set(tenantRef, {
  // Existing top-level fields (keep — all have active readers):
  subscriptionStatus: params.subscriptionStatus,
  plan: params.plan,
  stripePriceId: params.stripePriceId,
  pastDueSince: params.pastDueSince,
  scheduledPlan: params.scheduledPlan,
  currentPeriodEnd: params.currentPeriodEnd,
  // ... other existing fields
  // NEW: subscription.* nested map (merge with existing):
  subscription: {
    ...(existingData.subscription ?? {}),
    status: params.subscriptionStatus,
    plan: params.plan,
    stripePriceId: params.stripePriceId,
    // ... all subscription.* fields from CONTEXT.md
    syncedAt: Timestamp.now(),
    ...(params.eventId ? { lastEventId: params.eventId } : {}),
  },
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
```

### Pattern 2: LRU Cache Replacement

**What:** Replace `new Map<K,V>()` with `new LRUCache<K,V>({ max: 500, ttl: 30_000 })`.
**When to use:** Both `billingStateCache` and `PLAN_CACHE` replacements.
**Example:**
```typescript
// Source: lru-cache v11 API [VERIFIED: npm view lru-cache]
import { LRUCache } from 'lru-cache';

// Constants — not magic numbers (per Claude's Discretion)
const BILLING_CACHE_MAX_SIZE = 500;
const BILLING_CACHE_TTL_MS = 30_000;

// Before: const billingStateCache = new Map<string, CachedBillingState>();
// After:
const billingStateCache = new LRUCache<string, CachedBillingState>({
  max: BILLING_CACHE_MAX_SIZE,
  ttl: BILLING_CACHE_TTL_MS,
});

// API compatibility: .get(), .set(), .delete(), .has(), .clear() all work the same.
// Note: LRUCache.delete() returns boolean — verify no callers chain on the return value.
// Note: LRUCache does NOT support iteration via .entries() / .forEach() — check if any
//       caller iterates the cache before replacing.
```

### Pattern 3: Parallel Writer Consolidation

**What:** Replace direct `tenantRef.set()` / `tenantRef.update()` calls with `syncTenantPlanBillingSnapshot()` calls.
**Example:**
```typescript
// BEFORE (billing-sync.service.ts ~line 71):
await tenantRef.set({
  stripeCustomerId, stripeSubscriptionId, subscriptionStatus, plan,
  stripePriceId, priceId, currentPeriodEnd, cancelAtPeriodEnd, pastDueSince,
  billingSyncedAt, updatedAt,
}, { merge: true });

// AFTER (route through function):
await syncTenantPlanBillingSnapshot(tenantId, {
  subscriptionStatus,
  plan,
  stripePriceId,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  pastDueSince,
  stripeCustomerId,
  stripeSubscriptionId,
  // subscription.* counterparts are written by the function
});
```

### Anti-Patterns to Avoid
- **Creating a new writer function**: Never create a parallel function alongside `syncTenantPlanBillingSnapshot`. Extend the existing one.
- **Speculatively dropping top-level fields**: The reader audit (this research) shows all major top-level fields have active readers in Phase 19. Do not drop any. The correct policy is: audit → confirm zero readers → then drop. The audit result here is: zero fields qualify for removal.
- **Writing `subscription.*` outside the transaction**: The nested map write must be inside `db.runTransaction()`. A second independent `tenantRef.update({ "subscription.status": ... })` outside the transaction creates a race.
- **Putting whatsappEnabled inside the main transaction**: `tenantPlanAllowsWhatsApp` reads addon docs and plan cache — external reads inside a transaction cause contention. Keep as second write after the transaction.
- **Sharing one LRU instance across files**: Evictions in one cache domain should not impact the other. One LRU per file.
- **Nesting db.runTransaction() calls**: Firebase Admin SDK does not support nested transactions. `applyScheduledPlanChanges.ts` has its own transaction; add `subscription.*` writes inside that existing transaction rather than calling `syncTenantPlanBillingSnapshot` from within it.

---

## Writer Inventory (BILL-06 scope)

This table classifies every `tenantRef.set()` / `tenantRef.update()` found in the codebase. The planner must produce a task for each row marked "CONSOLIDATE".

| File | Function / Context | Fields Written | Action |
|------|-------------------|----------------|--------|
| `stripe/stripeWebhook.ts` | `syncTenantPlanBillingSnapshot` | subscriptionStatus, plan, stripePriceId, pastDueSince, scheduledPlan, currentPeriodEnd, billingSyncedAt, updatedAt | EXTEND (this is THE function — add `subscription.*` writes here) |
| `stripe/stripeWebhook.ts` | `syncTenantPlanBillingSnapshot` 2nd write | whatsappEnabled | KEEP AS-IS (outside transaction by design; reads addon/plan cache incompatible with tx) |
| `stripe/stripeWebhook.ts` | `handleSubscriptionUpdated` deferral writes | scheduledPlan, scheduledPlanAt, cancelAtPeriodEnd, currentPeriodEnd | CONSOLIDATE → call function |
| `stripe/stripeWebhook.ts` | `handleInvoicePaymentFailed` | subscriptionStatus (past_due), pastDueSince | CONSOLIDATE → call function |
| `stripe/stripeWebhook.ts` | `handleSubscriptionDeleted` | subscriptionStatus, plan (reset to free), stripePriceId | CONSOLIDATE → call function |
| `stripe/stripeWebhook.ts` | `handleCheckoutCompleted` | trialReservedAt / trialUsedAt | EXEMPT (trial write per CONTEXT.md) |
| `billing/billing-sync.service.ts` | `syncTenantBillingFromStripe` | Full billing patch (stripeCustomerId, stripeSubscriptionId, subscriptionStatus, plan, etc.) | CONSOLIDATE → call function |
| `api/controllers/stripe.controller.ts` | `cancelSubscription` | cancelAtPeriodEnd, cancelScheduledAt, currentPeriodEnd | CONSOLIDATE → call function |
| `api/controllers/stripe.controller.ts` | `confirmCheckoutSession` | subscriptionStatus, plan, currentPeriodEnd, etc. | CONSOLIDATE → call function |
| `api/controllers/stripe.controller.ts` | `syncSubscription` | subscriptionStatus, plan, etc. | CONSOLIDATE → call function |
| `api/controllers/stripe.controller.ts` | `createCheckoutSession` plan-change path | scheduledPlan, plan | CONSOLIDATE → call function |
| `stripe/stripeHelpers.ts` | `updateUserPlan` | plan (tenant doc) | CONSOLIDATE → call function |
| `stripe/stripeHelpers.ts` | `runStripeSync` batch | subscriptionStatus, currentPeriodEnd, billingSyncedAt, updatedAt | CONSOLIDATE → call function |
| `stripe/stripeHelpers.ts` | `upsertTenantStripeBillingData` | stripeCustomerId, stripeSubscriptionId | CONSOLIDATE → call function |
| `applyScheduledPlanChanges.ts` | main handler | plan, scheduledPlan, scheduledPlanAt (inside own `db.runTransaction()`) | AUDIT — add `subscription.*` counterparts directly inside existing tx (cannot nest transactions) |

**Writers NOT in scope (exempt from consolidation):**
- `billing/billing-sync.service.ts` → `updateSubscriptionStatus(adminUid, ...)` — writes to `users/{uid}`, not tenant doc; exempt.
- `admin.controller.ts` tenant writes — verified to be metadata/manual-admin overrides; verify exact fields before final classification in plan.

---

## Top-Level Field Reader Audit

This audit was conducted as part of CONTEXT.md's required "audit each existing top-level field for all read locations" policy.

| Top-Level Field | Active Readers Found | Firestore Query Filter? | Phase 19 Action |
|-----------------|---------------------|------------------------|-----------------|
| `subscriptionStatus` | `require-active-subscription.ts`, `tenant-plan-policy.ts`, `admin.controller.ts`, `ai/chat.route.ts`, `billing-sync.service.ts`, `billing-queue.ts` | Yes — `checkManualSubscriptions.ts` queries `.where("subscriptionStatus", ...)` | KEEP — write to both top-level and `subscription.status` |
| `cancelAtPeriodEnd` | `admin.controller.ts`, `internal.controller.ts`, `stripe.controller.ts` | No | KEEP — write to both; `stripeHelpers.ts` already writes both |
| `currentPeriodEnd` | `billing-sync.service.ts`, `stripe.controller.ts`, `billing-types.ts` | Yes — `checkManualSubscriptions.ts` queries `.where("currentPeriodEnd", ...)` | KEEP — Firestore index depends on top-level field |
| `pastDueSince` | `require-active-subscription.ts`, `tenant-plan-policy.ts`, `ai/chat.route.ts`, `ai/field-gen.route.ts`, `billing-sync.service.ts` | No | KEEP — write to both |
| `stripePriceId` / `priceId` | `tenant-plan-policy.ts` reads `priceId \|\| stripePriceId` | No | KEEP — write to both |
| `scheduledPlan` / `scheduledPlanAt` | `tenant-plan-policy.ts`, `applyScheduledPlanChanges.ts`, `admin.controller.ts` | No | KEEP — write to both |

**Audit verdict: All top-level billing fields have active readers in Phase 19. Zero fields qualify for removal. The planner must not drop any top-level field in this phase.**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded LRU cache | Custom `Map` + manual eviction | `lru-cache` v11 | Edge cases in LRU eviction order, TTL cleanup, concurrent set/delete; already in transitive deps |
| Firestore atomic check-and-set | Two-step read + conditional write outside transaction | `db.runTransaction()` | Two Cloud Run instances can both pass the read check before either write commits |
| Event deduplication key | Timestamp-based or payload hash | `stripe_events/{eventId}` document (existing) | Stripe's `eventId` is globally unique and stable across retries; already established in codebase |

**Key insight:** The temptation to "just add a flag" or "just check first" for idempotency is exactly the race condition this phase eliminates. The transaction is non-negotiable.

---

## Runtime State Inventory

> Included because this phase introduces a new schema (`subscription.*` nested map) and audits top-level field removal.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing tenant documents do NOT have `subscription.*` map. They have top-level fields (subscriptionStatus, plan, stripePriceId, etc.) | No migration needed. Write-alongside strategy: `syncTenantPlanBillingSnapshot` writes both top-level AND `subscription.*` starting from Phase 19. Existing tenant docs get `subscription.*` populated on their next billing event or sync cron run. |
| Stored data | Top-level billing fields (subscriptionStatus, currentPeriodEnd, etc.) have active readers — some are used as Firestore query filters in scheduled crons | No removal in Phase 19. Top-level fields remain. See Top-Level Field Reader Audit above. |
| Stored data | `stripe_events/{eventId}` documents — existing idempotency store | No migration. `beginStripeEventProcessing` already creates these; hardening is the transaction wrap (already present). |
| Live service config | Cloud Run env vars (`TENANT_PLAN_ENFORCEMENT_MODE`, `TENANT_PLAN_CACHE_TTL_MS`, etc.) | No changes in this phase. |
| OS-registered state | None | None — verified by codebase audit. |
| Secrets/env vars | No billing secret keys renamed or added | No action. |
| Build artifacts | `apps/functions/lib/` — compiled CommonJS output | Run `npm run build` in `apps/functions/` after all changes. Standard deploy step. |

---

## Common Pitfalls

### Pitfall 1: Speculatively Removing Top-Level Fields Before Reader Audit
**What goes wrong:** A developer removes `subscriptionStatus` from the write path because it now has `subscription.status`, but `require-active-subscription.ts` still reads the top-level field. Middleware fails to read the field → all tenants treated as unsubscribed → billing enforcement breaks in production.
**Why it happens:** The write is updated but the read side is not audited first.
**How to avoid:** Follow CONTEXT.md policy: audit readers first, then remove only if zero readers remain. The reader audit in this research shows all major fields have active readers — none qualify for removal in Phase 19. The correct implementation writes to BOTH `subscription.*` AND the top-level field simultaneously. Fields with Firestore query filters (`subscriptionStatus`, `currentPeriodEnd`) can never be removed without corresponding index migration — which is out of scope for this phase.
**Warning signs:** Any grep showing a top-level billing field removed from the write path while still appearing in reader code or Firestore queries.

### Pitfall 2: Moving whatsappEnabled Write Inside the Main Transaction
**What goes wrong:** The `whatsappEnabled` update gets moved inside `db.runTransaction()` for "atomicity," but `tenantPlanAllowsWhatsApp()` reads the addon document and plan cache. Reads of external documents inside a Firestore transaction cause lock contention; async reads outside the transaction snapshot are disallowed.
**Why it happens:** Developers want everything in one atomic operation.
**How to avoid:** Keep `whatsappEnabled` as a second write AFTER the transaction, as it is today. It is a derived field — if it lags by milliseconds, no billing correctness issue arises.
**Warning signs:** Any attempt to call `tenantPlanAllowsWhatsApp()` from inside the `db.runTransaction()` callback.

### Pitfall 3: LRU Iteration or Return-Value Chaining
**What goes wrong:** After replacing `Map` with `LRUCache`, code that iterates the cache (`.entries()`, `.forEach()`, `.values()`) fails — LRUCache supports iteration but with different semantics. Code that chains `.delete()` return values also changes.
**Why it happens:** `Map` and `LRUCache` have overlapping but not identical APIs.
**How to avoid:** Before replacing each Map instance, grep for all uses of that variable (`.entries()`, `.forEach()`, `.keys()`, `.values()`). The simple path: `.get()`, `.set()`, `.has()`, `.delete()`, `.clear()` are all compatible. Audit `clearTenantPlanCache()` callers to confirm no caller chains on the `.delete()` return value.
**Warning signs:** TypeScript errors after the swap pointing at iteration methods; unit test failures in tenant-plan-policy tests.

### Pitfall 4: test helpers using Map-specific API break after LRU swap
**What goes wrong:** `setTenantPlanCacheForTest` and `hasTenantPlanCacheForTest` in `tenant-plan-policy.ts` call Map methods directly on the old `PLAN_CACHE` constant. After LRU replacement, these need to use the LRU API.
**Why it happens:** Test helpers are written against the Map API and are easy to overlook.
**How to avoid:** Update test helper implementations in the same task as the cache replacement. LRU `.set()` and `.has()` are directly compatible for simple key-value use.
**Warning signs:** Failing unit tests for plan policy after LRU swap, specifically in `lib/__tests__/tenant-plan-policy.test.ts`.

### Pitfall 5: applyScheduledPlanChanges.ts Skipped
**What goes wrong:** `applyScheduledPlanChanges.ts` writes `plan`, `scheduledPlan`, `scheduledPlanAt` inside its own `db.runTransaction()` but does NOT update `subscription.plan`, `subscription.scheduledPlan`, `subscription.scheduledPlanAt`. After Phase 19, the cron fires and the `subscription.*` counterparts become stale — Phase 20 banners read incorrect state.
**Why it happens:** The cron already has its own transaction and looks "correct," so it gets skipped during consolidation.
**How to avoid:** Add `subscription.plan`, `subscription.scheduledPlan`, `subscription.scheduledPlanAt` writes inside the cron's existing `db.runTransaction()` callback directly. Do NOT call `syncTenantPlanBillingSnapshot` from within another transaction — Firebase Admin SDK does not support nested transactions.
**Warning signs:** `subscription.plan` diverges from top-level `plan` after the scheduled-plan cron runs.

### Pitfall 6: BILL-08 Stuck-Processing Window Overlooked
**What goes wrong:** A Stripe webhook event starts processing, the Cloud Run instance crashes mid-way, and `stripe_events/{eventId}` is left with `status: "processing"`. The `shouldSkipStripeEventRecord` function blocks retries for 5 minutes. Stripe may exhaust its retry budget within that window.
**Why it happens:** The transaction is already present, so the issue looks "fixed," but the 5-minute window is a separate concern not addressed by the transaction.
**How to avoid:** See Open Questions — explicitly decide: (a) accept the 5-minute window as sufficient given Stripe's retry schedule, or (b) shorten/eliminate the window with a different recovery strategy.
**Warning signs:** Stripe Dashboard shows events stuck with no final `completed` status; Firestore `stripe_events/{id}` docs with `status: "processing"` older than 5 minutes.

---

## Code Examples

Verified patterns from codebase audit:

### Current syncTenantPlanBillingSnapshot structure
```typescript
// Source: apps/functions/src/stripe/stripeWebhook.ts lines 129-196 [VERIFIED: direct file read]
// - Already uses db.runTransaction() ✓
// - Writes top-level fields inside transaction ✓
// - Has second write outside transaction for whatsappEnabled ✓
// - Does NOT yet write subscription.* nested map ← gap to fill in Phase 19
```

### beginStripeEventProcessing — already transactional
```typescript
// Source: apps/functions/src/stripe/stripeWebhook.ts lines 452-479 [VERIFIED: direct file read]
// The check-and-set IS already in db.runTransaction().
// The gap is in shouldSkipStripeEventRecord (lines 309-327):
// A 5-minute window allows events stuck in "processing" to be retried,
// but events processed rapidly by Stripe before 5min may not be retried at all.
```

### shouldSkipStripeEventRecord gap
```typescript
// Source: apps/functions/src/stripe/stripeWebhook.ts lines 309-327 [VERIFIED: direct file read]
function shouldSkipStripeEventRecord(data?: FirestoreData): boolean {
  if (!data) return false;
  if (data.status === 'completed') return true;
  if (data.status === 'processing') {
    const startedAt = data.startedAt?.toDate?.();
    if (!startedAt) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return startedAt > fiveMinutesAgo; // skip if started < 5 min ago
    // Gap: if a crash happens and Stripe retries within 5 minutes, the retry
    // is skipped. If Stripe does NOT retry within 5 minutes, the event is
    // eventually retried after the window expires.
  }
  return false;
}
```

### LRU cache instantiation
```typescript
// Source: lru-cache v11 [VERIFIED: npm registry]
import { LRUCache } from 'lru-cache';

const BILLING_CACHE_MAX_SIZE = 500;
const BILLING_CACHE_TTL_MS = 30_000;

const billingStateCache = new LRUCache<string, CachedBillingState>({
  max: BILLING_CACHE_MAX_SIZE,
  ttl: BILLING_CACHE_TTL_MS,
});

// clearTenantPlanCache — API-compatible with LRU:
function clearTenantPlanCache(tenantId?: string): void {
  if (tenantId) {
    PLAN_CACHE.delete(tenantId); // returns boolean (was boolean with Map too)
  } else {
    PLAN_CACHE.clear();
  }
}
```

### stripeHelpers.ts already writes subscription.cancelAtPeriodEnd (notable)
```typescript
// Source: apps/functions/src/stripe/stripeHelpers.ts lines 58, 215 [VERIFIED: direct file read]
// stripeHelpers ALREADY writes both top-level AND subscription.cancelAtPeriodEnd:
updatePayload["subscription.cancelAtPeriodEnd"] = cancelAtPeriodEnd ?? false;
// This means consolidation of stripeHelpers may need to preserve this pattern or
// be careful not to regress the subscription.cancelAtPeriodEnd write.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple independent Firestore writers for billing state | Single writer (`syncTenantPlanBillingSnapshot`) | Phase 19 (this phase) | Eliminates partial-state and race conditions across webhook + cron + controller layers |
| Unbounded `Map` for per-instance cache | LRU with 500-entry max, 30s TTL | Phase 19 (this phase) | Prevents memory growth under high tenant count |
| Flat top-level billing fields only | Nested `subscription.*` map alongside top-level | Phase 19 introduces writes; Phase 20+ migrates readers then drops top-level | Canonical location for Phase 20 banner consumption |

**Notable:** `stripeHelpers.ts` already writes some `subscription.*` fields (e.g., `subscription.cancelAtPeriodEnd`, `subscription.currentPeriodEnd`) in its existing update payloads. This is a partial/ad-hoc implementation — Phase 19 makes it systematic and routes through the single writer.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lru-cache` v11.x will be installed when added as direct dep (current as of research date) | Standard Stack | Could get v10 or v12; verify with `npm view lru-cache version` before installing |
| A2 | `clearTenantPlanCache()` callers only use `.delete()` and `.clear()` semantics — no `.entries()` / `.forEach()` iteration on the Map | Common Pitfalls | If any caller iterates the Map, those calls need updating alongside the LRU swap |
| A3 | `admin.controller.ts` and `tenants.controller.ts` writes to tenantRef are metadata (name, niche) not billing state and are therefore exempt | Writer Inventory | If they write subscriptionStatus or plan, they need consolidation — verify during planning |
| A4 | Firebase Admin SDK does not support nested `db.runTransaction()` calls | Anti-patterns, Pitfall 5 | If SDK evolved to support savepoints, applyScheduledPlanChanges could call syncTenantPlanBillingSnapshot directly — verify current SDK docs if in doubt |

---

## Open Questions

1. **BILL-08: beginStripeEventProcessing is already transactional — what is the actual remaining gap?**
   - What we know: Lines 452-479 of `stripeWebhook.ts` already wrap the check-and-set in `db.runTransaction()`. The race condition CONTEXT.md describes (two instances both read "not processing" and both proceed) is already fixed by the existing transaction.
   - What's unclear: CONTEXT.md says "wrap the check-and-set in `db.runTransaction()`" as if this isn't done. The actual unaddressed gap is the 5-minute stuck-processing window in `shouldSkipStripeEventRecord` (lines 309-327) — a crashed-mid-processing event will not be retried for 5 minutes, and Stripe may exhaust its retry schedule within that window.
   - Recommendation: During planning, confirm with the user whether BILL-08 means (a) verify the transaction is present + write the emulator replay test only (no code change needed to the transaction), or (b) also address the 5-minute stuck window (e.g., shorten the window, or add a recovery mechanism). Do NOT assume.

2. **applyScheduledPlanChanges.ts: add subscription.* writes directly inside its existing transaction**
   - What we know: This cron uses `db.runTransaction()` for its own writes. Calling `syncTenantPlanBillingSnapshot` (which also calls `db.runTransaction()`) from inside an active transaction is not supported in Firebase Admin SDK.
   - Recommendation: Add `subscription.plan`, `subscription.scheduledPlan`, `subscription.scheduledPlanAt`, `subscription.scheduledPlanReason` writes directly inside the cron's existing transaction callback. This keeps the cron's write atomic and avoids nested transaction issues.

3. **stripeHelpers.ts writers: direct import of syncTenantPlanBillingSnapshot or routing through billing-sync.service.ts?**
   - What we know: `updateUserPlan`, `runStripeSync`, and `upsertTenantStripeBillingData` in `stripeHelpers.ts` all write billing fields directly. `syncTenantPlanBillingSnapshot` is currently defined in `stripeWebhook.ts`.
   - Recommendation: Move `syncTenantPlanBillingSnapshot` (and its supporting types) to a dedicated `billing-writer.ts` or `billing-types.ts` shared file so that `stripeHelpers.ts` and other files can import it without a circular dependency on `stripeWebhook.ts`. Alternatively, keep it in `stripeWebhook.ts` and import from there — verify no circular dependency exists before deciding.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `lru-cache` (direct dep) | BILL-07 | Must add | v11.x | None — must install |
| Firebase Emulator | BILL-08 verification test | ✓ | Already in project | — |
| Node.js 22 | Runtime | ✓ | 22.x | — |
| `apps/functions` TypeScript build | All tasks | ✓ | 5.x | — |

**Missing dependencies with no fallback:**
- `lru-cache` as direct dependency: run `cd apps/functions && npm install --save lru-cache` before implementing BILL-07.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (with Firebase Emulator for integration tests) |
| Config file | `apps/functions/jest.config.js` (verify path) |
| Quick run command | `npm run test:rules` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-06 | After consolidation, grep returns zero billing writes outside single function | Static analysis | `grep -rn "tenantRef\.(set\|update)" apps/functions/src/` | ✅ (grep at phase gate) |
| BILL-06 | `syncTenantPlanBillingSnapshot` writes `subscription.*` fields atomically alongside top-level | Integration (emulator) | Jest emulator test asserting Firestore snapshot after call | ❌ Wave 0 |
| BILL-07 | LRU caches have 500-entry max; 501st entry evicts oldest | Unit | Jest unit test inserting 501 entries and asserting size | ❌ Wave 0 |
| BILL-07 | `clearTenantPlanCache()` clears LRU entries (single key and all-clear) | Unit | Jest unit test of clearTenantPlanCache with LRU | ❌ (may exist in tenant-plan-policy.test.ts — verify) |
| BILL-08 | Duplicate Stripe event with same `eventId` returns HTTP 200 on second call without mutating Firestore | Integration (emulator) | Jest emulator test: POST same webhook payload twice, assert doc unchanged | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/functions && npm run build` (TypeScript compile — catches type errors fast)
- **Per wave merge:** `npm run test:rules` (Firestore emulator suite)
- **Phase gate:** Full suite green + grep returns zero parallel writers before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/functions/src/stripe/__tests__/stripeWebhook.billing.test.ts` — covers BILL-06 (subscription.* atomic write) and BILL-08 (duplicate event replay with emulator)
- [ ] `apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts` — covers BILL-07 (LRU eviction, TTL, clearTenantPlanCache with LRU)
- [ ] Verify existing `lib/__tests__/tenant-plan-policy.test.ts` does not break after LRU swap (existing file — update, not create)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Billing writes are server-side only; no auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | Multi-tenant isolation unchanged; all writes remain server-side |
| V5 Input Validation | Yes (partial) | Stripe event payload verified via `stripe.webhooks.constructEvent` HMAC before processing — unchanged |
| V6 Cryptography | No | No new crypto; Stripe HMAC verification unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stripe webhook replay attack | Spoofing | `stripe.webhooks.constructEvent` HMAC (existing); `beginStripeEventProcessing` idempotency (BILL-08) |
| Concurrent billing state write race | Tampering | `db.runTransaction()` in `syncTenantPlanBillingSnapshot` (BILL-06) |
| Memory exhaustion via cache flooding | Denial of Service | LRU 500-entry max eviction (BILL-07) |
| Billing state written for wrong tenant | Tampering | All writes use `tenantId` from auth context (existing middleware); consolidation does not change this |
| Event stuck in processing allows duplicate processing | Tampering | 5-minute window in `shouldSkipStripeEventRecord` — see Open Questions |

---

## Sources

### Primary (HIGH confidence)
- `apps/functions/src/stripe/stripeWebhook.ts` (direct file read) — `syncTenantPlanBillingSnapshot`, `beginStripeEventProcessing`, `shouldSkipStripeEventRecord`, webhook handlers; writer inventory confirmed
- `apps/functions/src/billing/billing-sync.service.ts` (direct file read) — parallel writers at lines 71, 133, 186 confirmed
- `apps/functions/src/api/controllers/stripe.controller.ts` (direct file read) — cancelSubscription, syncSubscription, confirmCheckoutSession, createCheckoutSession parallel writers confirmed
- `apps/functions/src/api/middleware/require-active-subscription.ts` (direct file read) — `billingStateCache` as unbounded Map confirmed; reads `subscriptionStatus` and `pastDueSince` top-level
- `apps/functions/src/lib/tenant-plan-policy.ts` (direct file read) — `PLAN_CACHE` as unbounded Map confirmed; reads `subscriptionStatus`, `pastDueSince`, `scheduledPlan`, `stripePriceId` top-level
- `apps/functions/src/applyScheduledPlanChanges.ts` (direct file read) — existing transaction pattern confirmed; reads `scheduledPlan` top-level
- `apps/functions/src/stripe/stripeHelpers.ts` (direct file read) — additional parallel writers confirmed; already writes `subscription.cancelAtPeriodEnd` and `subscription.currentPeriodEnd`
- `apps/functions/src/checkManualSubscriptions.ts` (direct file read) — Firestore query filters on `subscriptionStatus` and `currentPeriodEnd` top-level fields confirmed
- `apps/functions/package.json` (direct file read) — `lru-cache` not in direct dependencies confirmed
- `.planning/phases/19-single-writer-billing-foundation/19-CONTEXT.md` (direct file read) — locked decisions
- Grep results for `subscriptionStatus`, `cancelAtPeriodEnd`, `pastDueSince`, `scheduledPlan`, `currentPeriodEnd`, `stripePriceId` across `apps/functions/src/` — reader audit basis

### Secondary (MEDIUM confidence)
- npm registry: lru-cache v11.x confirmed as current version; `LRUCache` named export with `{ max, ttl }` constructor API

### Tertiary (LOW confidence)
None — all claims verified against codebase or official package registry.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — lru-cache verified via npm; Firebase Admin SDK already installed
- Architecture: HIGH — all parallel writers verified by direct file read and grep; function internals confirmed
- Pitfalls: HIGH — derived from actual code paths found in codebase; reader audit performed via grep
- Top-level field reader audit: HIGH — grep confirmed all major fields have active readers; two are Firestore query filters
- BILL-08 gap: HIGH — contradiction with CONTEXT.md confirmed by reading the actual function; remaining gap identified precisely

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable backend; lru-cache API stable in v11)
