# Phase 19: Single-Writer Billing Foundation - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

All billing state writes in the system flow through a single transactional function — `syncTenantPlanBillingSnapshot` — eliminating the race conditions and partial-state bugs caused by multiple independent writers today. This phase covers the backend only (no frontend changes). It also introduces the canonical `subscription.*` nested map on tenant documents, replaces unbounded global Maps with LRU caches, and hardens Stripe event idempotency with a transactional check-and-set.

Out of scope: Phase 20 banners (which will read the subscription.* fields this phase writes), Phase 23 MP webhook hardening.

</domain>

<decisions>
## Implementation Decisions

### subscription.* nested schema

**What goes in subscription.*:** Full reorganization + new tracking fields. The new `subscription` map on tenant documents contains:
- **Core status:** `subscription.status` (active/past_due/canceled/etc.), `subscription.pastDueSince`, `subscription.cancelAtPeriodEnd`, `subscription.cancelAt` (absolute cancel date for Phase 20 banner display)
- **Stripe identifiers:** `subscription.stripeSubscriptionId`, `subscription.stripePriceId`, `subscription.stripeCustomerId`
- **Period fields:** `subscription.currentPeriodStart`, `subscription.currentPeriodEnd`
- **Plan resolution:** `subscription.plan` (tier: starter/pro/enterprise), `subscription.scheduledPlan`, `subscription.scheduledPlanAt`
- **Audit metadata:** `subscription.syncedAt`, `subscription.lastEventId`

**Top-level field removal policy:** Audit each existing top-level field (subscriptionStatus, cancelAtPeriodEnd, currentPeriodEnd, stripePriceId, pastDueSince, scheduledPlan, scheduledPlanAt, etc.) for all read locations in the codebase. If a top-level field has no remaining readers after the new `subscription.*` fields replace it in the write path, delete the top-level field. Keep top-level fields only where they still have active readers that cannot be migrated in this phase. Never delete without confirming the replacement field is correctly written first.

### Consolidation scope — what routes through syncTenantPlanBillingSnapshot

**Must go through the function (billing state):**
- All Stripe webhook handlers: `handleSubscriptionDeleted`, `handleInvoicePaymentFailed`, `handleSubscriptionUpdated` (including deferral writes for `scheduledPlan`/`scheduledPlanAt`), and all existing callers already using the function
- Billing controller: `cancelSubscription`, `syncSubscription`, `confirmCheckoutSession`
- Daily cron: `billing-sync.service.ts` (called by `checkStripeSubscriptions`) — currently writes directly, must be routed through the function

**Stays as direct Firestore write (not billing state):**
- Trial writes: `reserveTrialSlot` (`trialReservedAt`), `markTrialUsed` (`trialUsedAt`, `trialPlanTier`) — one-time trial markers, not ongoing subscription state, unaffected by Phase 20 banners

**End state:** After this phase, `grep -rn "tenantRef\.(set|update)" apps/functions/src/` should return zero billing state write results outside of `syncTenantPlanBillingSnapshot` and the explicitly exempt trial writes.

### LRU cache replacement

**Two caches converted (both are unbounded Maps today):**
1. `billingStateCache` in `apps/functions/src/api/middleware/require-active-subscription.ts` — subscription status cache, checked on every protected request
2. `PLAN_CACHE` in `apps/functions/src/lib/tenant-plan-policy.ts` — plan enforcement cache, also 30s TTL

**Implementation:** Use `lru-cache` npm package (verify it's a transitive dependency before adding; if not, add it). Separate LRU instances — one per cache file. Both instances: 500-entry max, 30s TTL. The previous unbounded global Maps are removed entirely.

### Stripe idempotency hardening

**Gap being fixed:** `beginStripeEventProcessing()` in `stripeWebhook.ts` reads the `stripe_events/{eventId}` status and writes "processing" in two separate steps — two Cloud Run instances can both read "not processing" and both proceed. Fix: wrap the check-and-set in `db.runTransaction()` so the read + write is atomic across instances.

**Verification:** Write an emulator replay test that sends the same Stripe event twice with the same `eventId`. Assert the second request returns HTTP 200 without re-executing any business logic (verify Firestore snapshot is unchanged after the second call).

### Claude's Discretion
- TypeScript interface/type for the `subscription.*` map (naming, exact field types)
- Whether to introduce a `SubscriptionSnapshot` type alias used by `syncTenantPlanBillingSnapshot` parameters
- The exact parameter signature extension for `syncTenantPlanBillingSnapshot` to support all consolidated callers
- TTL and max size config: use constants rather than magic numbers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 19 goal, success criteria, architecture note (extend syncTenantPlanBillingSnapshot, never create a new parallel writer)
- `.planning/REQUIREMENTS.md` — BILL-06, BILL-07, BILL-08 definitions

### Core billing write function
- `apps/functions/src/stripe/stripeWebhook.ts` — `syncTenantPlanBillingSnapshot` definition (lines ~129-196), all webhook handlers, `beginStripeEventProcessing` idempotency mechanism

### Caches to replace
- `apps/functions/src/api/middleware/require-active-subscription.ts` — `billingStateCache` (unbounded Map, target of BILL-07)
- `apps/functions/src/lib/tenant-plan-policy.ts` — `PLAN_CACHE` (unbounded Map, also targeted)

### Parallel writers to consolidate
- `apps/functions/src/billing/billing-sync.service.ts` — cron billing writes (direct Firestore, must route through function)
- `apps/functions/src/api/controllers/stripe.controller.ts` — `cancelSubscription`, `syncSubscription`, `confirmCheckoutSession` direct writes

### Architecture docs
- `apps/functions/src/CLAUDE.md` — cron function inventory and deployment config
- `apps/functions/src/lib/CLAUDE.md` — tenant-plan-policy.ts and billing-helpers.ts architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `syncTenantPlanBillingSnapshot` in `stripeWebhook.ts`: Already uses `db.runTransaction()`. Extend its params and body to write `subscription.*` map fields alongside top-level fields — do NOT create a new function.
- `beginStripeEventProcessing` in `stripeWebhook.ts`: Existing idempotency mechanism; wrap its check-and-set in `db.runTransaction()` instead of rewriting.
- `clearTenantPlanCache()` in `tenant-plan-policy.ts`: Called after billing writes throughout the codebase — will change behavior once PLAN_CACHE becomes LRU.

### Established Patterns
- Firestore transactions: `db.runTransaction()` already used in `syncTenantPlanBillingSnapshot` — same pattern for idempotency fix.
- Cache invalidation: `clearTenantPlanCache()` is called from 6+ locations (admin controller, whatsapp controller, billing-sync, applyScheduledPlanChanges) — the implementation must remain compatible.
- Error handling: Billing writes use `logger` from `../lib/logger`; maintain structured logging on all writes.

### Integration Points
- `applyScheduledPlanChanges.ts` cron also writes billing state — audit whether it needs consolidation or if it uses a different transaction pattern already.
- `whatsappEnabled` field update in `syncTenantPlanBillingSnapshot`: currently a SECOND write after the transaction (`tenantRef.update({ whatsappEnabled })`). Evaluate whether this can be pulled into the main transaction (read whatsapp eligibility inside the transaction).
- Phase 20 banners will read `subscription.status`, `subscription.cancelAtPeriodEnd`, `subscription.cancelAt` — these MUST be reliably written by the end of this phase.

### Known Risks
- `billing-sync.service.ts` cron also calls `updateSubscriptionStatus(userId, ...)` which writes to `users/{uid}` — this is a user document write, not a tenant billing state write; verify scope.
- `applyScheduledPlanChanges.ts` already uses `db.runTransaction()` for its scheduled-plan transition — confirm it should also be routed through `syncTenantPlanBillingSnapshot` or if its transaction is already sufficient.
- `lru-cache` v10 uses `LRUCache` named export with `{ max, ttl }` constructor options — verify exact API before using.

</code_context>

<specifics>
## Specific Ideas

- "Single writer" = `syncTenantPlanBillingSnapshot` is THE one function that writes to tenant billing state. After this phase, it should be possible to find all billing state writes with a single grep.
- The emulator replay test for BILL-08: write a helper that sends the same synthetic Stripe webhook payload twice and asserts the second call does not mutate Firestore.
- Top-level field cleanup: think of it as a migration — write to `subscription.*` first, then audit readers, then drop the old field. Don't drop fields speculatively.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 19-single-writer-billing-foundation*
*Context gathered: 2026-05-07*
