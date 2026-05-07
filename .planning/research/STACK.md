# Stack Research

**Domain:** Billing & Payment Hardening — LRU subscription cache, Stripe cancel/past_due guard, MercadoPago fee disclosure, Firestore atomic billing writes
**Researched:** 2026-05-07
**Confidence:** HIGH (lru-cache, Firebase Admin), MEDIUM (Stripe v17 field shapes, MP REST API field names)

---

## Context: What Already Exists

This is a SUBSEQUENT MILESTONE on an existing codebase. The following are already installed and working:

| Already Present | Actual Version in package.json | Notes |
|----------------|-------------------------------|-------|
| `stripe` | `^17.0.0` | CLAUDE.md says v20 — this is incorrect; actual installed is v17 |
| `firebase-admin` | `^13.6.1` | Firestore runTransaction already used in production |
| `@mercadopago/sdk-react` | `^1.0.7` | Frontend only — backend uses raw `axios` to MP REST API |
| `axios` | `^1.13.5` | Used for all MP API calls on the backend |
| `lru-cache` | **NOT INSTALLED** | Prompt says "verify exact version" — it is absent from package.json |

**Critical correction:** The milestone_context says "lru-cache already in package.json (verify exact version)." After reading `apps/functions/package.json` directly, `lru-cache` is NOT a dependency. It must be added.

---

## New Dependency to Add

### lru-cache

| Property | Value |
|----------|-------|
| Package | `lru-cache` |
| Recommended version | `^11.0.0` (latest stable: 11.3.6 as of 2026-05) |
| TypeScript | Built-in types, no `@types/lru-cache` needed (that package is deprecated) |
| Module format | Hybrid ESM/CJS — works with the project's CommonJS target |
| Node requirement | Node 16.14+ (project uses Node 22, fully compatible) |

**Installation:**
```bash
cd apps/functions && npm install lru-cache@^11.0.0
```

---

## Area 1: LRU-Bounded In-Memory Cache for Subscription State

### Problem Being Solved

`tenant-plan-policy.ts` already has a `PLAN_CACHE: Map<tenantId, CachedPlan>` that caches subscription state. A plain `Map` grows unbounded — on Cloud Run instances serving hundreds of tenants it will consume unbounded memory. The milestone replaces it with an LRU-bounded cache.

### Constructor Pattern (HIGH confidence — verified via Context7 `/isaacs/node-lru-cache`)

```typescript
import { LRUCache } from 'lru-cache';

// For subscription state (fixed count, TTL-based expiry)
const subscriptionCache = new LRUCache<string, CachedPlan>({
  max: 500,                    // evict LRU entry after 500 tenants — prevents unbounded growth
  ttl: 30_000,                 // 30s TTL matches existing TENANT_PLAN_CACHE_TTL_MS default
  ttlAutopurge: false,         // do NOT pre-emptively sweep — let gets trigger expiry (cheaper)
  updateAgeOnGet: false,       // do NOT reset TTL on read — cache entry ages out independently
  allowStale: false,           // return undefined for expired entries, not stale data
});
```

**Why these options:**
- `max: 500` caps memory. With ~20 tenants active in production, 500 is safe headroom without waste.
- `ttl: 30_000` matches the existing `TENANT_PLAN_CACHE_TTL_MS` env var default already in code.
- `ttlAutopurge: false` avoids a background sweep timer competing with Cloud Run's concurrency model.
- `updateAgeOnGet: false` ensures TTL always counts from insertion, not last read — avoids a frequently-read tenant never expiring.
- `allowStale: false` is essential for billing correctness: stale subscription status must never be returned.

### Get / Set / Delete API (HIGH confidence)

```typescript
// Read (returns undefined on miss or expired)
const cached = subscriptionCache.get(tenantId);

// Write
subscriptionCache.set(tenantId, cachedPlan);

// Explicit invalidation (call this after any Firestore billing write)
subscriptionCache.delete(tenantId);

// Full wipe (e.g., after admin sync-all)
subscriptionCache.clear();
```

### Migration from existing Map

The existing code in `tenant-plan-policy.ts` exposes `clearTenantPlanCache(tenantId)` which calls `PLAN_CACHE.delete(tenantId)`. The LRU replacement is a drop-in: `LRUCache.delete(key)` has identical semantics to `Map.delete(key)`.

**No behavioral change needed** — only the declaration changes from:
```typescript
const PLAN_CACHE = new Map<string, CachedPlan>();
```
to:
```typescript
const PLAN_CACHE = new LRUCache<string, CachedPlan>({ max: 500, ttl: TTL_MS, allowStale: false });
```

---

## Area 2: Stripe Subscription Read + Status Check Patterns

### Installed SDK: `stripe@^17.0.0`

**WARNING:** The Stripe Node SDK v18+ introduced a new API version (`2025-03-31.basil`) with billing breaking changes including removal of legacy usage-based billing features and deprecation of `total_count` on lists. **Do not upgrade to v18+ without a dedicated migration review.** The project is correctly pinned at v17.

### Subscription Object Fields (MEDIUM confidence — Stripe docs + stripe-node Context7)

The subscription object returned by `stripe.subscriptions.retrieve(id)` includes these fields relevant to the milestone:

```typescript
// From stripe.subscriptions.retrieve(subscriptionId)
{
  id: string,
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid',
  cancel_at_period_end: boolean,      // true = will cancel at period end, not immediately
  cancel_at: number | null,           // Unix timestamp of scheduled cancellation (null if not set)
  current_period_end: number,         // Unix timestamp — multiply by 1000 for JS Date
  latest_invoice: string | Stripe.Invoice,  // expandable — string (ID) by default
}
```

### TypeScript Type Cast for current_period_end (HIGH confidence — observed in existing stripeHelpers.ts)

**CRITICAL:** In `stripe@^17`, `current_period_end` is NOT directly accessible as a typed property on the subscription object in TypeScript. The existing production code in `stripeHelpers.ts` already uses a cast:

```typescript
// Production pattern in stripeHelpers.ts — implementors MUST replicate this cast
const currentPeriodEndMs = (subscription as any).current_period_end * 1000;
const currentPeriodEnd = new Date(currentPeriodEndMs);
```

Do not attempt `subscription.current_period_end` — TypeScript will error. Use `(subscription as any).current_period_end`. This is the established pattern in the codebase and must be followed for v17 consistency.

### Expanding latest_invoice (MEDIUM confidence)

`latest_invoice` is a string (invoice ID) by default. To read its `status` and `payment_intent.status` inline, you must expand it explicitly:

```typescript
const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
  expand: ['latest_invoice.payment_intent'],
});

// After expand, latest_invoice is a Stripe.Invoice object (not a string)
const invoice = subscription.latest_invoice as Stripe.Invoice;
const invoiceStatus = invoice.status;              // 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
const piStatus = paymentIntent?.status;            // 'requires_payment_method' | 'succeeded' | etc.
```

**Without expand, `latest_invoice` is just a string ID.** This is the most common mistake causing `TypeError: cannot read property 'status' of string`.

### past_due Detection Pattern (MEDIUM confidence)

```typescript
// Definitive past_due check — do NOT rely on Firestore cache alone
const isPastDue = subscription.status === 'past_due';

// Deeper check: is the open invoice still unpaid?
const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
  expand: ['latest_invoice'],
});
const invoice = subscription.latest_invoice as Stripe.Invoice;
const isInvoiceOpen = invoice?.status === 'open';   // open = unpaid but not yet failed
const isInvoicePaid = invoice?.status === 'paid';

// Combined guard for "cancel blocked while past_due" (P5 feature):
const blockCancellation = subscription.status === 'past_due' && isInvoiceOpen;
```

**Note:** `expand: ['latest_invoice']` (without `.payment_intent`) is cheaper and sufficient for status-only checks. Only expand `latest_invoice.payment_intent` when you need payment method details for retry prompting.

### cancel_at_period_end Detection (HIGH confidence — directly observed in existing stripeHelpers.ts)

```typescript
// Already used in this codebase — confirmed working pattern
const willCancel = subscription.cancel_at_period_end === true;

// Banner trigger for "cancelAtPeriodEnd" yellow banner (P4 feature):
if (subscription.status === 'active' && subscription.cancel_at_period_end) {
  // show yellow warning banner
}

// Cancel during past_due is blocked at controller level (P5):
if (subscription.status === 'past_due') {
  return res.status(409).json({ code: 'CANCEL_BLOCKED_PAST_DUE', message: '...' });
}
```

### Atomic Subscription Write — Single Writer Pattern

For milestone phases that write billing state from both webhook handlers and cron jobs simultaneously, use a Firestore sub-collection atomic lock. This is already the established pattern in `mercadopago.service.ts` (`connectTenant` uses `mpOAuthCodes` sub-collection as a write lock).

**Replicate this pattern for Stripe billing writes:**

```typescript
// Established pattern: Firestore sub-collection as atomic write lock
// See mercadopago.service.ts connectTenant for the existing precedent
await db.runTransaction(async (t) => {
  const lockRef = db
    .collection('tenants').doc(tenantId)
    .collection('billing_write_lock').doc('lock');

  const lockSnap = await t.get(lockRef);

  const LOCK_TTL_MS = 10_000;
  if (lockSnap.exists) {
    const lockedAt = lockSnap.data()?.lockedAt?.toMillis?.() ?? 0;
    if (Date.now() - lockedAt < LOCK_TTL_MS) {
      throw new Error('BILLING_WRITE_IN_PROGRESS');  // transaction auto-retries
    }
  }

  // Claim lock first, then do other reads
  t.set(lockRef, { lockedAt: FieldValue.serverTimestamp() });

  // ... other reads and writes inside same transaction ...
});
```

**Do NOT introduce a new top-level `billing_locks` collection.** The sub-collection approach under `tenants/{tenantId}/billing_write_lock/lock` is consistent with how the MP OAuth lock works and avoids unrelated collection proliferation.

---

## Area 3: MercadoPago payment.get() — REST API Response Shape

### How the Backend Calls MP (HIGH confidence — read from source)

The backend does NOT use the `@mercadopago/sdk-react` package (that is frontend-only). All backend MP calls use **raw `axios` to the REST API**:

```typescript
// From mercadopagoWebhook.ts and transaction-payment.service.ts
const mpResponse = await axios.get<MpPaymentResponse>(
  `https://api.mercadopago.com/v1/payments/${paymentId}`,
  { headers: { Authorization: `Bearer ${accessToken}` } },
);
```

**Therefore: the fee disclosure feature must type and parse the REST response, not use any SDK method.**

### Current MpPaymentResponse Type (from mercadopagoWebhook.ts)

```typescript
// Existing minimal type — missing fee_details and external_reference
interface MpPaymentResponse {
  id: number;
  status: string;
  transaction_amount: number;
  date_approved?: string;
}
```

### Extended Type Required for Fee Disclosure (MEDIUM confidence — MP REST API docs + WebSearch)

The full response shape for `GET /v1/payments/{id}` relevant to this milestone:

```typescript
interface MpFeeDetail {
  type: 'mercadopago_fee' | 'coupon_fee' | 'financing_fee' | 'shipping_fee' | 'application_fee' | 'discount_fee';
  fee_payer: 'collector' | 'payer';
  amount: number;  // float, in the payment's currency
}

interface MpTransactionDetails {
  net_received_amount: number;     // amount seller actually receives after fees
  total_paid_amount: number;       // what buyer paid (including fees absorbed by buyer)
  installment_amount: number;      // per-installment amount
  overpaid_amount: number;         // overpaid (tickets only)
}

interface MpPaymentResponse {
  id: number;
  status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  status_detail: string;           // e.g. 'accredited', 'pending_contingency'
  transaction_amount: number;      // original charge amount
  date_approved?: string;          // ISO timestamp
  external_reference?: string;     // merchant-side reference set at payment creation
  fee_details: MpFeeDetail[];      // array — may be empty for some payment methods
  transaction_details: MpTransactionDetails;
}
```

### Key Field Notes

**`fee_details`** is an array (not a single object). Each entry has:
- `type`: the fee category — `mercadopago_fee` is the primary processing fee
- `fee_payer`: `'collector'` means the seller absorbs it; `'payer'` means buyer pays it
- `amount`: the fee value (positive number)

**`external_reference`**: CONFIRMED set in this codebase. Reading `transaction-payment.service.ts` directly reveals that ALL four payment creation paths (PIX, boleto, credit card, debit card) set `external_reference` as `` `${transactionId}:${attemptId}` `` (lines 311, 428, 538, 748). The format is `transactionId:attemptId` — a colon-separated compound key.

**Webhook parsing implication:** When looking up a payment by `external_reference` in the webhook handler, split on `:` to extract the `transactionId`:
```typescript
const [transactionId, attemptId] = (response.external_reference ?? '').split(':');
```
Use this as a fallback lookup path when `mpPaymentId` lookup fails (P6 webhook fix).

**`transaction_details.net_received_amount`**: the amount credited to the seller's account after MP deducts fees. Use this for fee disclosure: `fee = transaction_amount - net_received_amount`.

**Fee calculation for disclosure:**
```typescript
const mpFee = response.fee_details
  .filter(f => f.type === 'mercadopago_fee' && f.fee_payer === 'collector')
  .reduce((sum, f) => sum + f.amount, 0);

// Or simpler — use net_received_amount directly:
const feeAmount = response.transaction_amount - response.transaction_details.net_received_amount;
const feePercentage = (feeAmount / response.transaction_amount) * 100;
```

---

## Area 4: Firestore runTransaction for Atomic Billing Snapshot Writes

### Pattern (HIGH confidence — verified via Context7 `/firebase/firebase-admin-node` + existing production usage)

**Critical rule: ALL reads must happen before ANY writes inside a transaction callback.**

```typescript
import { db } from '../init';
import { FieldValue } from 'firebase-admin/firestore';

// Atomic billing snapshot: read subscription state + write to both users and tenants
const result = await db.runTransaction(async (t) => {
  // --- ALL READS FIRST ---
  const userRef = db.collection('users').doc(userId);
  const tenantRef = db.collection('tenants').doc(tenantId);

  const [userSnap, tenantSnap] = await Promise.all([
    t.get(userRef),
    t.get(tenantRef),
  ]);

  if (!userSnap.exists || !tenantSnap.exists) {
    throw new Error('BILLING_DOC_NOT_FOUND');
  }

  const userData = userSnap.data()!;
  // ... compute new state from userData + Stripe response ...

  // --- ALL WRITES AFTER READS ---
  t.update(userRef, {
    subscriptionStatus: newStatus,
    cancelAtPeriodEnd: cancelAtPeriodEnd,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    'subscription.status': newStatus,
    'subscription.updatedAt': FieldValue.serverTimestamp(),
  });

  t.update(tenantRef, {
    subscriptionStatus: newStatus.toLowerCase(),
    cancelAtPeriodEnd: cancelAtPeriodEnd,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
    billingSyncedAt: FieldValue.serverTimestamp(),
  });

  return { previousStatus: userData.subscriptionStatus, newStatus };
});
```

### Transaction Semantics

| Property | Behavior |
|----------|----------|
| Reads | Must all occur before any `t.set()`, `t.update()`, or `t.delete()` |
| Contention | Automatically retried by Firestore on write conflict (optimistic concurrency) |
| Max reads | 500 document reads per transaction |
| Max writes | 500 document writes per transaction |
| Rollback | Any thrown exception rolls back all writes atomically |
| Cross-collection | Reads and writes can span multiple collections — used this way in `mercadopago.service.ts` already |

### Idempotency Pattern for Webhook Writers

```typescript
// Pattern: use a processed-events collection to deduplicate webhook retries
await db.runTransaction(async (t) => {
  const eventRef = db.collection('processed_stripe_events').doc(stripeEventId);
  const eventSnap = await t.get(eventRef);

  if (eventSnap.exists) {
    return { skipped: true };  // idempotent — already processed
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await t.get(userRef);

  // ... compute updates ...

  t.set(eventRef, { processedAt: FieldValue.serverTimestamp(), eventType });
  t.update(userRef, updatePayload);
});
```

This is the same pattern already used by `connectTenant` in `mercadopago.service.ts` with the `mpOAuthCodes` collection. Apply consistently for Stripe webhook idempotency.

---

## Installation Summary

```bash
# Only new package required — everything else already exists
cd apps/functions && npm install lru-cache@^11.0.0
```

No `@types/lru-cache` needed — types are bundled since lru-cache v10.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `lru-cache@^11` | `node-cache` | lru-cache has built-in TTL and is already the industry standard for this; node-cache adds no benefit |
| `lru-cache@^11` | Custom `Map` with `setInterval` sweep | Unbounded growth risk; manual sweep has clock-skew bugs |
| `lru-cache@^11` | Redis | Overkill — per-instance cache is intentional on Cloud Run; Redis adds network latency and a new service dependency |
| Raw axios MP calls | `mercadopago` npm SDK | The npm SDK wraps the same REST API but adds 300KB+ to the bundle and changes the response shape from what's already typed in the codebase |
| Sub-collection billing lock (under tenants/) | New top-level `billing_locks` collection | Sub-collection approach is consistent with existing MP OAuth lock pattern; top-level collection adds unnecessary Firestore collection proliferation |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@types/lru-cache` | Deprecated — published 4 years ago, conflicts with v10+ built-in types | No `@types` needed for lru-cache@^10+ |
| `lru-cache@^7` or `^8` | Named export API changed in v10; v7/v8 use default export `const LRUCache = require('lru-cache')` | `lru-cache@^11` with `import { LRUCache } from 'lru-cache'` |
| Stripe SDK `^18+` | Breaking changes in API version `2025-03-31.basil` including billing reorganization | Stay on `stripe@^17.0.0` until dedicated migration |
| `expand: ['latest_invoice.payment_intent']` when only checking status | Fetches more data than needed | Use `expand: ['latest_invoice']` for status-only checks |
| `@mercadopago/sdk-react` on the backend | Frontend-only SDK; incompatible with backend context | Raw `axios` to `api.mercadopago.com` as already used |
| `subscription.current_period_end` (direct access in v17 TS) | Not typed on subscription object in stripe@^17; TypeScript error | `(subscription as any).current_period_end` — the established production pattern in `stripeHelpers.ts` |

---

## Version Compatibility

| Package | Installed Version | Compatible With | Notes |
|---------|------------------|-----------------|-------|
| `lru-cache@^11.0.0` | to be added | Node 22 | Hybrid ESM/CJS, built-in TS types |
| `stripe@^17.0.0` | already installed | firebase-admin@^13, Express 5 | Do NOT upgrade to v18 without migration |
| `firebase-admin@^13.6.1` | already installed | Node 22, Firestore Admin | `runTransaction` API stable |
| `axios@^1.13.5` | already installed | Node 22 | Used for all MP REST calls |

---

## Sources

- Context7 `/isaacs/node-lru-cache` — constructor options, get/set/delete API, TTL semantics (HIGH confidence)
- Context7 `/stripe/stripe-node` — subscription retrieve, expand pattern, cancel_at_period_end, v18 migration warning (MEDIUM confidence — Context7 has v19.1.0 docs, project is on v17; API shape for these fields is stable across v17-v19)
- Context7 `/firebase/firebase-admin-node` — `db.runTransaction`, read-before-write rule, FieldValue (HIGH confidence)
- `apps/functions/package.json` — actual installed versions (lru-cache absent confirmed)
- `apps/functions/src/mercadopagoWebhook.ts` — confirmed raw axios pattern for MP API calls; minimal `MpPaymentResponse` type
- `apps/functions/src/api/services/mercadopago.service.ts` — existing Firestore transaction pattern (lock via `mpOAuthCodes` sub-collection)
- `apps/functions/src/stripe/stripeHelpers.ts` — confirmed `cancel_at_period_end` field usage, `(subscription as any).current_period_end * 1000` cast pattern
- `apps/functions/src/api/services/transaction-payment.service.ts` — confirmed `external_reference: \`${transactionId}:${attemptId}\`` set on lines 311, 428, 538, 748 (all four payment creation paths: PIX, boleto, credit card, debit card)
- `apps/functions/src/api/controllers/stripe.CLAUDE.md` — Firestore schema for `users/` and `tenants/` billing fields
- WebSearch — MercadoPago `fee_details` array structure, `fee_payer`/`type`/`amount` fields, `transaction_details.net_received_amount` (MEDIUM confidence — confirmed by multiple MP developer portal references)
- [MercadoPago Payments GET reference](https://www.mercadopago.com.ar/developers/en/reference/payments/_payments_id/get) — official REST API reference
- [npm lru-cache](https://www.npmjs.com/package/lru-cache) — latest version 11.3.6 confirmed

---
*Stack research for: Billing & Payment Hardening milestone*
*Researched: 2026-05-07*
