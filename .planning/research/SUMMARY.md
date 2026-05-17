# Project Research Summary

**Project:** v4.0 Billing & Payment Hardening
**Domain:** Multi-tenant SaaS billing hardening — Stripe subscription lifecycle, MercadoPago webhook reliability, Firestore atomic writes, LRU cache bounds
**Researched:** 2026-05-07
**Confidence:** HIGH (architecture and stack — direct code inspection); MEDIUM (MP REST API fields, UX patterns)

---

## Executive Summary

ProOps v4.0 addresses a structural debt: five or more independent writers are scattering billing state into `tenants/{tenantId}` without ordering guards, producing race conditions that manifest as ghost addon badges, stale `cancelAtPeriodEnd` flags, and `pastDueSince` never being cleared. The foundational work is consolidating all Stripe billing writes into a single transactional function (`tenant-subscription-writer.ts`) that encodes deterministic rules once and is called by every path — webhooks, cron, and REST API. This consolidation is a hard prerequisite for every subsequent phase; building banners, cancel-block enforcement, or a reactivation endpoint on top of the current multi-writer state would only add new inconsistency. The target is to extend `syncTenantPlanBillingSnapshot` in `stripeWebhook.ts` into the canonical writer — not to create a new parallel implementation.

On the MercadoPago side, three independent reliability gaps require resolution: `external_reference` is absent from webhook notification bodies (must be fetched from the MP Payments API), the `merchant_order` topic fires before the `payment` topic (requiring deferred processing or accept-and-re-poll), and HMAC verification uses a formatted string (`id:<x>;request-id:<x>;ts:<x>;`) rather than the raw body. The webhook must return HTTP 200 within 22 seconds or MP marks it failed and retries. All four of these are silent failure modes — no compile-time or runtime error, just lost or double-processed payments.

The milestone also surfaces a scope conflict that must be resolved before P3 (login redirect) is implemented: AUTH-05 ("Redirect params preserved through auth bounce") is a validated requirement that directly conflicts with "login always redirects to /dashboard." This is not a technical uncertainty — it is a product decision that changes phase scope. The roadmapper must move AUTH-05 explicitly to Out of Scope with documented rationale before P3 is implemented, not treat it as a flag to revisit later.

---

## Key Findings

### Recommended Stack

All required dependencies already exist in the codebase except one. `lru-cache` is absent from `apps/functions/package.json` despite milestone context claiming it is present — it must be added as `lru-cache@^11.0.0` (built-in TypeScript types, hybrid ESM/CJS, Node 22 compatible). All other libraries — `stripe@^17.0.0`, `firebase-admin@^13.6.1`, `axios@^1.13.5` — are installed and at the correct versions. Stripe must NOT be upgraded to v18+ during this milestone: v18 introduced breaking changes in API version `2025-03-31.basil` including billing reorganization.

**Core technologies:**
- `lru-cache@^11.0.0`: replaces the unbounded `Map<string, CachedPlan>` in `tenant-plan-policy.ts` — install with `max: 500, ttl: 30_000, allowStale: false, updateAgeOnGet: false`
- `stripe@^17.0.0` (existing): subscription retrieve, `cancel_at_period_end`, `(subscription as any).current_period_end * 1000` cast required in v17 TypeScript
- `firebase-admin@^13.6.1` (existing): `db.runTransaction()` with reads-before-writes rule; auto-retries on ABORTED up to 5 times
- `axios@^1.13.5` (existing): all MP REST API calls on the backend — the `@mercadopago/sdk-react` package is frontend-only and must NOT be used on the backend

### Expected Features

**Must have — table stakes:**
- `past_due` red banner — persistent at top of layout, "update payment" CTA to Stripe Customer Portal; may not be permanently dismissed
- `cancelAtPeriodEnd` yellow banner with exact end-of-period date + single-click "Reactivate" CTA; re-shown on every login (session-level dismiss only)
- Cancel blocked during `past_due` — 409 from controller, disabled button with tooltip in UI ("Regularize o pagamento antes de cancelar")
- MP webhook idempotency + audit log in `webhookEvents/{eventId}` — check before processing, 200 on duplicate without reprocessing
- `external_reference` fallback: call `GET /v1/payments/{id}` when absent from webhook body; split on `:` to extract `transactionId:attemptId`
- MP fee rates stored in `tenants/{id}.mpFeeRates` (per-tenant, configurable) — prerequisite for all disclosure features; rates are negotiated above volume thresholds and must not be hardcoded
- MP fee preview at transaction launch — gross amount, fee %, fee amount, net amount shown before confirming Checkout Pro launch

**Should have — competitive:**
- MP fee on transaction detail/list (display stored `mpFeeAmount` field written by webhook)
- Reactivation CTA on `cancelAtPeriodEnd` banner — single-click `cancel_at_period_end: false`, no re-entry of payment details
- MP fee settings page section — per-method rates (PIX 0.99%, debit 1.99%, credit à vista ~3.98–4.98%), admin-only edit

**Defer to v4.x:**
- MP fee on transaction detail/list — low risk to defer one phase after webhook writes fee data to production
- MP fee in dashboard summary — aggregate computation, defer until fee fields populated in real data

**Defer to v5+:**
- MP fee in proposals — PDF pipeline change, regression risk
- Webhook replay from admin UI — requires rollback logic not yet built
- Prorated refunds on cancellation during `past_due` — Stripe proration on a failing subscription worsens the `past_due` state

### Architecture Approach

The architecture centers on a single canonical writer (`billing/tenant-subscription-writer.ts`) called by all billing mutation paths. It wraps `db.runTransaction()`, reads the current tenant doc inside the transaction, applies deterministic rules (never in callers), and writes atomically. A `lastProcessedStripeEventAt` ordering guard prevents out-of-order Stripe events from overwriting newer state. Both data shapes must be written atomically — top-level fields (`subscriptionStatus`, `cancelAtPeriodEnd`, `currentPeriodEnd`) AND nested `subscription.*` fields — in the same transaction payload. The writer is the only place where rules like "status=canceled clears cancelAtPeriodEnd" and "status=past_due sets pastDueSince if not already set" are encoded.

**Major components:**
1. `billing/subscription-status.ts` — pure status normalizer; no Firestore dependency; ships first
2. `billing/tenant-subscription-writer.ts` — single transactional writer; extends `syncTenantPlanBillingSnapshot` logic
3. `billing/addon-state.ts` (backend + frontend mirror) — pure deriver; no Firestore reads inside the function
4. `billing/addon-cleanup.cron.ts` — daily cleanup of stale addon docs
5. `api/services/mercadopago-fee-estimate.service.ts` — independent MP fee preview; no Stripe dependency
6. Firestore write lock: sub-collection `tenants/{tenantId}/billing_write_lock/lock` — consistent with existing MP OAuth lock pattern

### Critical Pitfalls

1. **Adding a new parallel writer instead of extending the existing one** — every inline `tenantRef.set()` bypasses the ordering guard. All new billing field writes go through `writeTenantBillingState()`; encode the rule in the writer, not the caller.

2. **`external_reference` absent from MP webhook body** — webhook notification only contains the payment ID. Calling `GET /v1/payments/{id}` is required. Format: `transactionId:attemptId` — split on `:`.

3. **MP HMAC verification on wrong input** — uses formatted string `id:<paymentId>;request-id:<requestId>;ts:<timestamp>;`, NOT raw request body.

4. **`merchant_order` topic fires before `payment` topic** — process only `payment` topic events; ignore or queue `merchant_order`.

5. **MP webhook response latency > 22 seconds** — return 200 immediately, defer slow MP API calls or ensure they complete within budget.

6. **`lru-cache` v7/v8 import syntax** — install `lru-cache@^11.0.0` and use named export `import { LRUCache } from 'lru-cache'`.

7. **`stripe@^17` TypeScript type: `current_period_end`** — use `(subscription as any).current_period_end * 1000`. Established production pattern in `stripeHelpers.ts`.

8. **Encoding billing rules in callers instead of the writer** — all deterministic rules live in the writer only.

9. **AUTH-05 conflict with P3** — AUTH-05 is a validated requirement that directly conflicts with "login always → /dashboard." Must be moved to Out of Scope with documented rationale before P3 is planned.

---

## Implications for Roadmap

### Phase 1: Single-Writer Foundation
Prerequisite for everything. Extend `syncTenantPlanBillingSnapshot` into the canonical writer. Write both top-level fields AND nested `subscription.*` fields atomically. Migrate all inline `tenantRef.set()` calls in webhook handlers. Replace unbounded Map with LRU cache.

### Phase 2: Subscription State Banners + Cancel Enforcement
Depends on Phase 1 canonical state. `past_due` red banner, `cancelAtPeriodEnd` yellow banner, 409 cancel-block + disabled UI button.

### Phase 3: Reactivation + Addon State Deriver
Depends on Phases 1–2. `reactivateSubscription` endpoint, `addon-state.ts` backend + frontend mirror, `addon-cleanup.cron.ts`, reactivation CTA on yellow banner.

### Phase 4: MP Webhook Hardening
Highest implementation risk. Audit log, idempotency, `external_reference` fallback via MP Payments API, HMAC fix (formatted string), `mpFeeAmount`/`mpNetAmount` written to transaction doc. Test with actual MP test webhooks in staging before production.

### Phase 5: MP Fee Configuration + Preview
Depends on Phase 4. `mpFeeRates` per-tenant in settings, settings page section, `mercadopago-fee-estimate.service.ts`, fee preview at transaction launch.

### Phase 6: Login Redirect (P3)
**GATED** — AUTH-05 must be moved to Out of Scope with documented rationale before this phase is planned. No implementation until product decision is recorded.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct code inspection of all affected files |
| Features | MEDIUM-HIGH | MP fee rates HIGH (official MP help page); UX patterns MEDIUM |
| Architecture | HIGH | Direct code inspection of 8+ affected files |
| Pitfalls | MEDIUM | Extracted from STACK.md/ARCHITECTURE.md anti-patterns + context themes |

**Gaps to address:**
- AUTH-05 vs P3: product scope decision before Phase 6
- Addon type in `apps/functions/src/shared/`: confirm before Phase 3
- `billingSyncing` field: confirmed zero readers, safe to remove in Phase 1
- MP fee rate source: hardcoded map + env-var override sufficient for v4.0

---

*Research completed: 2026-05-07*
*Ready for roadmap: yes*
