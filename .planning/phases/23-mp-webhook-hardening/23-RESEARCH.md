# Phase 23: MP Webhook Hardening - Research

**Researched:** 2026-05-11
**Domain:** Firebase Cloud Functions V2 / MercadoPago Webhook / Firestore idempotency
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **HMAC format fix:** Current broken manifest `${xRequestId};${dataId};${ts}` → correct MP spec format (see HMAC section below for confirmed correct format)
- **Structured logging (MPWH-01):** Log at START of processing: filtered headers, action, hmacValid:true/false, lookup result
- **Idempotency (MPWH-02):** Collection `webhookEvents/{x-request-id}`, `db.runTransaction()` check-and-set (mirrors Phase 19 Stripe pattern), doc shape with `status: "processing"|"done"|"skipped"`
- **Fallback resolution (MPWH-03):** Query mpPaymentId → if empty, call MP API with `MERCADOPAGO_PLATFORM_ACCESS_TOKEN`, parse `external_reference: "${transactionId}:${attemptId}"`, direct doc lookup by attemptId
- **Fallback failure:** Log warn + return 200 (no retry loop)
- **Fee persistence (MPWH-04):** `mpGrossAmount`, `mpNetAmount`, `mpFeeAmount` derived from `MpPaymentResponse` fields, written in existing `db.runTransaction()` block
- **merchant_order:** Log info, return 200, no Firestore writes

### Claude's Discretion

- Exact Firestore document schema for `webhookEvents/*` (field names, types)
- TypeScript type annotations for the extended `MpPaymentResponse`
- Whether to extract `handlePaymentEvent` fallback logic into a helper function or keep inline
- Order of operations in the refactored handler (idempotency gate → signature validation → structured log → business logic)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MPWH-01 | Structured log entry for every webhook event (headers, action, hmacValid, lookup result) | Logger pattern already in file; extend to entry-point log before any early return |
| MPWH-02 | Idempotency gate via `webhookEvents/{x-request-id}` collection with `db.runTransaction()` | Stripe pattern in `beginStripeEventProcessing()` confirmed as canonical reference; Firestore catch-all denies client access |
| MPWH-03 | `external_reference` fallback for Checkout Pro (preferenceId ≠ paymentId bug) | Confirmed in `transaction-payment.service.ts` line 568; fallback needs `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` |
| MPWH-04 | Persist `mpGrossAmount`, `mpNetAmount`, `mpFeeAmount` from MP payment response | `transaction_amount` already fetched; add `transaction_details.net_received_amount` to interface |
</phase_requirements>

---

## Summary

Phase 23 is a surgical hardening of a single backend file: `apps/functions/src/mercadopagoWebhook.ts`. Four requirements all modify this file plus one mandatory bug fix (HMAC format). No frontend changes, no new routes, no schema migrations on existing collections.

The highest-risk change is the HMAC manifest format correction. Official MP documentation confirms the correct format is `id:${dataId};request-id:${xRequestId};ts:${ts};` — with colon separators throughout and trailing semicolons on each segment. The CONTEXT.md specifies `ts=${ts}` (with an equals sign), but the official MP documentation and community cross-references confirm the correct format uses a colon: `ts:${ts};`. This is not a notation variant — one character difference produces 100% HMAC failure post-deploy. See the Conflicts section below for the required user re-confirmation.

The idempotency pattern is a direct mirror of Phase 19's `beginStripeEventProcessing()` in `stripeWebhook.ts`. The Checkout Pro fallback (MPWH-03) resolves a confirmed production bug where `payment_attempts.mpPaymentId` stores the preference ID (not the payment ID), causing direct lookup to always fail for Checkout Pro payments. Fee persistence (MPWH-04) requires no extra API calls — the data is already present in the existing `GET /v1/payments/{id}` response.

**Primary recommendation:** Implement in this sequence — HMAC fix → idempotency gate → structured entry log → fallback resolution → fee fields. Each step is independently testable and safe to deploy incrementally.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HMAC signature validation | API / Backend (Cloud Function) | — | Cryptographic verification must happen server-side before any processing |
| Event deduplication | API / Backend (Cloud Function) | Database / Firestore | Check-and-set requires atomic Firestore transaction |
| Transaction lookup (primary) | Database / Firestore | API / Backend | Query `payment_attempts` by `mpPaymentId` |
| Transaction lookup (fallback) | API / Backend | External (MP API) | Calls `GET /v1/payments/{id}` then parses `external_reference` |
| Fee field persistence | Database / Firestore | API / Backend | Write to `transactions/{id}` inside existing runTransaction block |
| Structured logging | API / Backend (Cloud Function) | — | Emit before any early return for complete observability |

---

## Standard Stack

### Core (no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-functions/v2/https` | `^7.2.5` | `onRequest` for the webhook Cloud Function | Already in use; standalone function separate from Express monolith |
| `firebase-admin/firestore` | `^13.6.1` | `db.runTransaction()`, `FieldValue` | Already imported; atomic check-and-set for idempotency |
| `crypto` (Node built-in) | Node 22 | `createHmac`, `timingSafeEqual` | Already imported; no additions needed |
| `axios` | `^1.13.5` | HTTP call to MP API for fallback resolution | Already imported |
| `logger` (internal) | — | Structured JSON logs to GCP Cloud Logging | Already imported from `./lib/logger` |

[VERIFIED: apps/functions/package.json, mercadopagoWebhook.ts imports]

**No new npm packages required.** All tools are already present in the file or Node.js runtime.

---

## Architecture Patterns

### System Architecture Diagram

```
POST /mercadopagoWebhook
  │
  ├─ [1] Body size guard (64KB max) → 200 if exceeded
  │
  ├─ [2] STRUCTURED ENTRY LOG (MPWH-01)
  │       headers: { x-request-id, x-signature (masked) }
  │       action: body.action
  │       (logged before any early return)
  │
  ├─ [3] HMAC SIGNATURE VALIDATION (fixed format)
  │       manifest = "id:{dataId};request-id:{xRequestId};ts:{ts};"
  │       hmacValid = timingSafeEqual(expected, provided)
  │       → if invalid: log { hmacValid: false }, return 200
  │
  ├─ [4] ACTION ROUTING
  │       │
  │       ├─ merchant_order → log info, return 200
  │       ├─ unknown/unhandled → log warn, return 200
  │       └─ payment.created / payment.updated (with data.id) → continue
  │
  ├─ [5] IDEMPOTENCY GATE (MPWH-02)
  │       db.runTransaction():
  │         read webhookEvents/{x-request-id}
  │         if exists (processing/done/skipped) → log skipped_idempotent, return 200
  │         else → write { status: "processing", action, dataId, receivedAt }
  │
  ├─ [6] TRANSACTION LOOKUP (MPWH-03)
  │       Primary: query payment_attempts where mpPaymentId == dataId
  │       │
  │       ├─ FOUND → resolve tenantId, proceed to [7]
  │       └─ NOT FOUND (Checkout Pro case)
  │           Fallback: GET /v1/payments/{dataId} with MERCADOPAGO_PLATFORM_ACCESS_TOKEN
  │           Parse external_reference "transactionId:attemptId"
  │           Direct lookup: payment_attempts.doc(attemptId)
  │           │
  │           ├─ RESOLVED → proceed to [7] with log { result: "fallback_resolved" }
  │           └─ UNRESOLVABLE → log warn, write webhookEvents status: "skipped", return 200
  │
  ├─ [7] PAYMENT PROCESSING (handlePaymentEvent)
  │       GET /v1/payments/{dataId} with tenant access token
  │       db.runTransaction():
  │         inner idempotency check (secondary guard)
  │         if approved:
  │           update transactions/{id}: status=paid, payment.*, wallet balance
  │           + mpGrossAmount, mpNetAmount, mpFeeAmount (MPWH-04)
  │         if rejected/refunded/cancelled:
  │           update payment.status + attempt.status
  │
  └─ [8] FINALIZE
          update webhookEvents/{x-request-id}: status = "done"
          return 200
```

### Recommended Project Structure (no changes needed)

```
apps/functions/src/
├── mercadopagoWebhook.ts   # Single file being modified — all 4 requirements
├── lib/
│   ├── logger.ts            # Already used — no changes
│   └── mercadopago-client.ts # computeHmacSignature helper available (optional reuse)
└── api/services/
    ├── mercadopago.service.ts    # getMercadoPagoData() — already used in file
    └── transaction-payment.service.ts  # Reference only (external_reference format)
```

### Pattern 1: Firestore Idempotency Check-and-Set

Mirrors `beginStripeEventProcessing()` in `stripeWebhook.ts` lines 554-588.

```typescript
// Source: apps/functions/src/stripe/stripeWebhook.ts lines 554-588 [VERIFIED]
const eventRef = db.collection("webhookEvents").doc(xRequestId);

await db.runTransaction(async (t) => {
  const snap = await t.get(eventRef);
  if (snap.exists) {
    const data = snap.data()!;
    if (data.status === "done" || data.status === "skipped" ||
        (data.status === "processing" && isWithin5Min(data.receivedAt))) {
      // Already handled — log and short-circuit
      logger.info("MP webhook: duplicate event, skipping", {
        xRequestId,
        existingStatus: data.status,
        result: "skipped_idempotent",
      });
      return; // caller must check and return 200
    }
  }
  // First time: claim the event
  t.set(eventRef, {
    action: body.action ?? "",
    dataId: body.data?.id ?? "",
    receivedAt: FieldValue.serverTimestamp(),
    status: "processing",
  });
});
```

[VERIFIED: stripeWebhook.ts beginStripeEventProcessing pattern]

### Pattern 2: Corrected HMAC Manifest

```typescript
// Source: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
// CONFIRMED format: id:{dataId};request-id:{xRequestId};ts:{ts};
// NOTE: CONTEXT.md has "ts=${ts}" (equals) — official docs use "ts:{ts};" (colon + semicolon)
const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
```

[VERIFIED: official MP docs + WebSearch cross-reference, 2026]

### Pattern 3: Fee Field Derivation

```typescript
// Source: MP API docs — transaction_amount = gross, transaction_details.net_received_amount = net
// [VERIFIED: CONTEXT.md locked decision + MP payment response structure]
const mpGrossAmount = mpPayment.transaction_amount;
const mpNetAmount = mpPayment.transaction_details?.net_received_amount;
const mpFeeAmount =
  mpNetAmount !== undefined && mpNetAmount > 0
    ? mpGrossAmount - mpNetAmount
    : undefined;

// Write only defined values — don't use undefined in Firestore update
const feeFields: Record<string, number> = {
  mpGrossAmount,
  ...(mpNetAmount !== undefined && mpNetAmount > 0 ? { mpNetAmount } : {}),
  ...(mpFeeAmount !== undefined ? { mpFeeAmount } : {}),
};
```

[ASSUMED: Firestore field spread pattern for partial data]

### Anti-Patterns to Avoid

- **Returning 5xx on fallback failure:** MP retries on 5xx. If `external_reference` is absent or malformed (e.g., manual payment outside ProOps), returning 500 creates a retry loop. Return 200 + log warn.
- **Logging raw `x-signature` header:** Contains the HMAC value. Log only `hmacValid: true/false` and optionally `xRequestId`.
- **Placing idempotency check after business logic:** The check must be the first Firestore write after HMAC validation — before any payment processing.
- **Not updating `webhookEvents` status to "done":** If processing succeeds but status stays "processing", a legitimate retry after transient failure would be incorrectly skipped.
- **Extracting `external_reference` from MP API response before confirming `data.id` is a payment ID:** `merchant_order` events may not have a payment ID — route by action field first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time HMAC comparison | Custom string compare | `crypto.timingSafeEqual()` | Timing attack prevention |
| Atomic check-and-set | Manual read-then-write | `db.runTransaction()` | Prevents TOCTOU race on concurrent retries |
| Tenant MP token resolution | Direct env var lookup | `MercadoPagoService.getMercadoPagoData(tenantId)` | Handles token refresh, sandboxing, multi-tenant isolation |
| Structured logging | `console.log` | `logger.info/warn/error` from `./lib/logger` | GCP Cloud Logging severity, auto-Sentry capture on error |

---

## Common Pitfalls

### Pitfall 1: HMAC Manifest `ts` Separator

**What goes wrong:** Using `ts=${ts}` (equals sign) instead of `ts:${ts};` (colon + semicolon). The CONTEXT.md notation uses equals, but the official MP documentation and community examples all use colon with trailing semicolon.

**Why it happens:** The `x-signature` *header* uses `ts=value,v1=value` format (equals signs for parsing the header itself). The *manifest string* for HMAC uses colons and semicolons. Easy to conflate the two.

**How to avoid:** The confirmed correct manifest is `id:${dataId};request-id:${xRequestId};ts:${ts};`. All three segments follow the same `key:value;` pattern.

**Warning signs:** HMAC always fails after deploy even for valid signatures from MP.

[VERIFIED: official MP docs, WebSearch community cross-reference 2025-2026]

### Pitfall 2: Idempotency Gate Scope

**What goes wrong:** Wrapping only the check inside `runTransaction()` but writing the status update outside — creating a window where two concurrent requests both see "absent" and both proceed.

**Why it happens:** Unclear scope of what must be atomic.

**How to avoid:** The `t.set(eventRef, { status: "processing" })` must be inside the same `runTransaction()` callback as the existence check. See Stripe's `beginStripeEventProcessing` for the canonical pattern.

**Warning signs:** Duplicate payment confirmation writes (wallet balance double-debited).

[VERIFIED: stripeWebhook.ts pattern analysis]

### Pitfall 3: Missing `webhookEvents` Status Update on Handler Error

**What goes wrong:** Handler throws after idempotency gate writes "processing" but before status is updated to "done". Next retry sees "processing" within 5 minutes, skips it. Payment confirmation is permanently lost.

**Why it happens:** Error path doesn't update the `webhookEvents` doc.

**How to avoid:** Use try/finally around business logic to ensure `webhookEvents` is always updated — either to "done" (success) or revert/mark as "failed" on unexpected errors. CONTEXT.md is silent on unexpected error lifecycle — see Open Questions.

**Warning signs:** Payments that never get confirmed even after MP retries exhaust.

[ASSUMED: lifecycle design not fully specified in CONTEXT.md]

### Pitfall 4: `action` vs `type` Routing

**What goes wrong:** Routing on `body.type === "merchant_order"` instead of `body.action`.

**Why it happens:** MP payload has both `type` (e.g., "payment") and `action` (e.g., "payment.created") fields. The current code already uses `action` correctly. The `type` field is the topic category, `action` is the specific event.

**How to avoid:** Keep routing on `action` field (current pattern). `merchant_order` events have `action: "merchant_order.created"` or similar — route by action prefix, not `type`.

**Warning signs:** Merchant order events triggering payment processing.

[VERIFIED: official MP webhook docs, MpWebhookBody interface in mercadopagoWebhook.ts]

### Pitfall 5: Fallback Uses Tenant Token Instead of Platform Token

**What goes wrong:** Calling `GET /v1/payments/{dataId}` with the tenant's access token when the attempt is not yet found (we don't know the tenantId yet at that point).

**Why it happens:** The existing code fetches the tenant token only after finding the `payment_attempts` record. The fallback fires precisely when that lookup failed.

**How to avoid:** Use `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` for the fallback API call. Only switch to the tenant token for subsequent processing after `tenantId` is resolved from `external_reference`.

**Warning signs:** `401 Unauthorized` from MP API on fallback call.

[VERIFIED: CONTEXT.md MPWH-03 decision]

---

## Code Examples

### Confirmed HMAC Fix

```typescript
// Source: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
// [VERIFIED 2026-05-11]

// BEFORE (broken — current line 69):
const manifest = `${xRequestId};${dataId};${ts}`;

// AFTER (correct MP spec — colon separators, trailing semicolons):
const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

// Missing-value handling: if xRequestId is absent, remove that segment:
// e.g., `id:${dataId};ts:${ts};`
```

### Extended MpPaymentResponse Interface

```typescript
// [VERIFIED: CONTEXT.md MPWH-04 locked decision]
interface MpPaymentResponse {
  id: number;
  status: string;
  transaction_amount: number;           // gross amount
  transaction_details?: {
    net_received_amount?: number;       // net after MP platform fees
  };
  date_approved?: string;
  external_reference?: string;          // "transactionId:attemptId" format
}
```

### Fallback: Parse external_reference

```typescript
// Source: transaction-payment.service.ts lines ~311, ~428, ~538 [VERIFIED]
// Format guaranteed by all payment creation paths: "${transactionId}:${attemptId}"

function parseExternalReference(ref: string): { transactionId: string; attemptId: string } | null {
  const parts = ref.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { transactionId: parts[0], attemptId: parts[1] };
}
```

[VERIFIED: transaction-payment.service.ts external_reference format at lines 311, 428, 538]

### Structured Entry Log Pattern

```typescript
// [VERIFIED: logger pattern from apps/functions/src/lib/logger — already imported]
logger.info("MP webhook: received", {
  xRequestId,
  xSignaturePresent: !!req.headers["x-signature"],  // never log raw value
  action: body.action ?? "unknown",
  dataId: body.data?.id ?? null,
  // hmacValid added after validation step
});
```

---

## Runtime State Inventory

> Not applicable — this is a hardening/bugfix phase with no rename or migration.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silent drop on any non-payment.* action | Log info for merchant_order, log warn for unknown | Phase 23 | Full observability on all event types |
| No event-level deduplication | `webhookEvents/{x-request-id}` check-and-set | Phase 23 | MP retries are idempotent |
| Inner-only idempotency (transaction field check) | Event-level gate first, transaction check as secondary | Phase 23 | Protects against concurrent retries racing on Firestore |
| Checkout Pro silent drop on webhook | Fallback via external_reference | Phase 23 | Checkout Pro payments actually get confirmed |

**Deprecated in this phase:**
- Inner idempotency check at line 150 (`paymentField?.mpPaymentId === dataId && txData.status === "paid"`) remains valid as secondary guard but becomes redundant for most cases after event-level gate is added. CONTEXT.md is silent on removing it — keep as safety net.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `merchant_order` events carry `action` field with value like `"merchant_order.created"` | Architecture diagram | If merchant_order events don't include `action`, current routing logic may not filter them |
| A2 | `webhookEvents` doc status update to `"done"` on unexpected handler error should write `"failed"` and re-throw (enabling MP retry), not `"done"` + 200 (suppressing retry) | Pitfall 3, Open Questions | Payment confirmation permanently lost vs. duplicate processing — design decision not locked in CONTEXT.md |
| A3 | Partial fee data (mpGrossAmount only, no mpNetAmount) is acceptable to write without blocking payment confirmation | Fee fields, Pattern 3 | If Phase 24 display assumes both fields always present together, it could show null/NaN fees |

---

## Conflicts With CONTEXT.md

> These are primary-source findings that contradict a locked decision. The planner MUST NOT encode the CONTEXT.md value without user re-confirmation.

### C1: HMAC manifest `ts` separator

**CONTEXT.md says:** `id:${dataId};request-id:${xRequestId};ts=${ts}` (equals sign for ts)

**Official MP docs say:** `id:${dataId};request-id:${xRequestId};ts:${ts};` (colon for all segments, trailing semicolons)

**Evidence:**
- [VERIFIED: https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks] — template shown as `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
- [VERIFIED: WebSearch 2025-2026 community example] — confirmed manifest `id:999999999;request-id:abc123;ts:1704908010;`

**Impact:** One character difference (`=` vs `:`) causes 100% HMAC validation failure post-deploy. All webhooks would silently pass (returning 200) because the current code already returns 200 on invalid signatures, but the HMAC would never validate correctly.

**Required action:** User must confirm which format is correct before the planner encodes it. Research finding points to `ts:${ts};` (colon, consistent with the other two segments).

---

## Open Questions

1. **webhookEvents lifecycle on unexpected handler error**
   - What we know: CONTEXT.md says fallback failure → return 200 (no retry). Does not address unexpected errors in `handlePaymentEvent()` itself.
   - What's unclear: If the handler throws after the idempotency gate writes "processing", should we: (a) mark `status: "failed"` + re-throw → 500 → MP retries, or (b) mark `status: "done"` + return 200 → suppress retry?
   - Recommendation: Planner should default to option (a) for unexpected errors: mark `"failed"`, return 500, allow MP to retry. Only return 200 for *expected* unresolvable cases (missing external_reference). The `"failed"` status also makes debugging easier in Cloud Logging.

2. **merchant_order `action` field format**
   - What we know: Official MP docs confirm `action` exists in payment events (e.g., "payment.created"). The `merchant_order` routing in current code catches everything not matching `payment.*` via the else branch.
   - What's unclear: Whether merchant_order events set `action` or only set `type: "merchant_order"`.
   - Recommendation: Log `body.action` and `body.type` both in the entry log. Route on `action` prefix "payment." to handle payment events; everything else including merchant_order falls to the safe log-and-return-200 path. Current code already does this correctly.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `MERCADOPAGO_WEBHOOK_SECRET` | HMAC validation | ✓ (existing) | — | None — validation disabled without it |
| `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` | MPWH-03 fallback | ✗ (new) | — | Fallback path returns 200 + logs warn |
| `MERCADOPAGO_SANDBOX_ACCESS_TOKEN` | Sandbox payment fetch | ✓ (existing) | — | Falls back to tenant access token |
| Firebase Admin / Firestore | Idempotency, writes | ✓ | firebase-admin ^13.6.1 | — |
| `axios` | MP API calls | ✓ | ^1.13.5 | — |

**Missing dependencies with no fallback:**
- `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` must be added to both `.env.erp-softcode` and `.env.erp-softcode-prod` before the fallback path can function. The code degrades gracefully (returns 200 + logs warning) but Checkout Pro payments will not be confirmed until this is configured.

**Missing dependencies with fallback:**
- None beyond the env var above.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (apps/functions/) |
| Config file | `apps/functions/package.json` jest config |
| Quick run command | `cd apps/functions && npx jest --testPathPattern mercadopago --no-coverage` |
| Full suite command | `cd apps/functions && npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MPWH-01 | Entry log emitted before HMAC rejection | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-01 | Entry log omits raw x-signature value | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-02 | Duplicate x-request-id returns 200 without re-processing | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-02 | First event writes "processing", updates to "done" | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-03 | Checkout Pro payment resolved via external_reference | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-03 | Missing external_reference returns 200 + logs warn | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-04 | mpGrossAmount, mpNetAmount, mpFeeAmount written on approved | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| MPWH-04 | Partial data (no net_received_amount): only mpGrossAmount written | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| HMAC fix | `id:${dataId};request-id:${xRequestId};ts:${ts};` validates correctly | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |
| HMAC fix | Old broken format `${xRequestId};${dataId};${ts}` rejected | unit | `jest --testPathPattern mercadopago-webhook` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/functions && npx jest --testPathPattern mercadopago-webhook --no-coverage`
- **Per wave merge:** `cd apps/functions && npx jest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/functions/src/__tests__/mercadopago-webhook.test.ts` — covers all MPWH-* requirements and HMAC fix
- [ ] Firestore mock setup for `webhookEvents` collection (can reuse existing Firebase test utilities if present)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a (webhook uses HMAC, not user auth) |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | `webhookEvents` collection: DENY-by-default catch-all in firestore.rules already covers it |
| V5 Input Validation | yes | Body size guard (64KB), `data.id` presence check, `external_reference` format validation |
| V6 Cryptography | yes | `crypto.timingSafeEqual()` for HMAC comparison — no hand-rolling |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replay attack (duplicate webhook delivery) | Repudiation | `webhookEvents/{x-request-id}` idempotency gate |
| HMAC bypass (wrong manifest format) | Spoofing | Fix manifest to `id:${dataId};request-id:${xRequestId};ts:${ts};` |
| Retry loop (5xx response triggers infinite retries) | DoS | Return 200 for unresolvable events (missing external_reference, merchant_order) |
| Log data leak (raw HMAC token) | Information Disclosure | Log only `hmacValid: true/false`, not raw `x-signature` value |
| Platform token scope creep | Elevation of Privilege | `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` used only for fallback fetch — not stored, not passed to tenant handlers |
| SSRF via external_reference | Tampering | Fallback calls only fixed MP API URL (`api.mercadopago.com`), not user-supplied URLs |

---

## Sources

### Primary (HIGH confidence)

- Official MercadoPago docs (`mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks`) — HMAC manifest format, webhook payload structure
- `apps/functions/src/mercadopagoWebhook.ts` (verified source) — current broken manifest line 69, MpPaymentResponse interface, action routing
- `apps/functions/src/stripe/stripeWebhook.ts` lines 554-610 (verified source) — `beginStripeEventProcessing` canonical idempotency pattern
- `apps/functions/src/api/services/transaction-payment.service.ts` lines 311, 428, 538, 568 (verified source) — external_reference format, preferenceId bug
- `firebase/firestore.rules` lines 551-553 (verified source) — catch-all DENY covers `webhookEvents` collection

### Secondary (MEDIUM confidence)

- WebSearch 2025-2026 community results confirming manifest format `id:${dataId};request-id:${xRequestId};ts:${ts};`
- `apps/functions/src/lib/mercadopago-client.ts` (verified) — token types, environment derivation

### Tertiary (LOW confidence)

- A1, A2, A3 in Assumptions Log — design decisions not explicitly verified against test behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies confirmed in package.json and existing imports
- HMAC format: HIGH — confirmed via official MP docs + WebSearch cross-reference; conflicts with CONTEXT.md ts= notation (see Conflicts section)
- Architecture: HIGH — all patterns verified in existing codebase (Stripe mirror, logger pattern, external_reference format)
- Fee field derivation: MEDIUM — API field names confirmed in CONTEXT.md; sandbox behavior of `transaction_details.net_received_amount` being absent is ASSUMED
- Pitfalls: HIGH for verified items; MEDIUM for Assumption A2 (error lifecycle design)

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (MP API stable; Firestore patterns are stable)
