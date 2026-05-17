# Phase 23: MP Webhook Hardening - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-only hardening of `apps/functions/src/mercadopagoWebhook.ts`. The MP webhook becomes observable (structured logs on every event), idempotent (event-level dedup via `webhookEvents/{eventId}`), and correctly resolves transactions (external_reference fallback for Checkout Pro payments + fee field persistence). No frontend changes.

Requirements: MPWH-01, MPWH-02, MPWH-03, MPWH-04.
Out of scope: Phase 24 fee configuration UI and display (reads the fields this phase writes).

</domain>

<decisions>
## Implementation Decisions

### HMAC signature fix (mandatory — not a gray area)

The current HMAC manifest format is WRONG:
- **Current (broken):** `${xRequestId};${dataId};${ts}`
- **Correct (MP spec):** `id:${dataId};request-id:${xRequestId};ts=${ts}`

Fix `validateMPSignature()` in `mercadopagoWebhook.ts`. Since invalid signatures currently return 200 (not retried), no transition period is needed — just fix it. The HMAC secret env var (`MERCADOPAGO_WEBHOOK_SECRET`) stays the same.

### Structured logging (MPWH-01)

Every webhook event must produce a structured log entry via `logger.info` covering:
- Filtered request headers: `x-signature`, `x-request-id` (never log `authorization`)
- `action` field from body
- HMAC validation result: `hmacValid: true/false`
- Transaction lookup result: `found | fallback_resolved | not_found | skipped_idempotent`

Log the entry at the START of processing (before business logic), before any early returns. This guarantees observability even when we drop the event.

### Idempotency (MPWH-02)

Collection: `webhookEvents/{x-request-id}` (exact Firestore path).

`x-request-id` header is the event ID — MP reuses the same `x-request-id` on retries, making it the correct deduplication key (mirrors Stripe's event ID semantics).

Implementation: `db.runTransaction()` check-and-set (same pattern as Phase 19 BILL-08 — `beginStripeEventProcessing`). If doc already exists: log info with `result: "skipped_idempotent"`, return 200, no business logic.

Document shape:
```
webhookEvents/{x-request-id}: {
  action: string,
  dataId: string,
  receivedAt: Timestamp,
  status: "processing" | "done" | "skipped"
}
```

Write `status: "processing"` atomically in the transaction, update to `"done"` after business logic completes.

### Fallback transaction resolution (MPWH-03)

**Root cause:** Checkout Pro payments store the `preferenceId` as `payment_attempts.mpPaymentId`. When the webhook fires, `data.id` is the actual payment ID (different from preferenceId) → direct lookup fails.

**Fallback flow:**
1. Query `payment_attempts` by `mpPaymentId == data.id` (existing code) — if found, proceed normally
2. If not found: call `GET /v1/payments/{data.id}` using `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` env var
3. Parse `external_reference` (format: `${transactionId}:${attemptId}`)
4. Look up `payment_attempts.doc(attemptId)` to get `tenantId` + `transactionId`
5. Continue with normal payment processing using the resolved tenant's access token

**New env var:** `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` — the ProOps MP app's own account token (platform-level, can read any payment made through the app).

**Fallback failure handling:** If `external_reference` is missing, malformed, or the `payment_attempts` doc doesn't exist → log warning with full context (`action`, `data.id`, `external_reference`) → return 200 (silent drop). Do not return 5xx (avoids MP retry loops for genuinely unresolvable events like manual payments outside ProOps).

### Fee field persistence (MPWH-04)

Extend `MpPaymentResponse` interface to include fee fields (no extra API call — data is already in the existing `GET /v1/payments/{id}` call inside `handlePaymentEvent`):

```typescript
interface MpPaymentResponse {
  id: number;
  status: string;
  transaction_amount: number;           // gross
  transaction_details?: {
    net_received_amount?: number;       // net after MP fees
  };
  date_approved?: string;
}
```

**Field derivation:**
- `mpGrossAmount = transaction_amount` (always write when payment is approved)
- `mpNetAmount = transaction_details.net_received_amount` (write only if present and non-zero)
- `mpFeeAmount = mpGrossAmount - mpNetAmount` (derived; write only if both gross and net are available)

**Partial data:** If `net_received_amount` is missing (sandbox edge case), store only `mpGrossAmount`. Do not block payment confirmation or mark the transaction differently — payment proceeds regardless.

**Write location:** Add `mpGrossAmount`, `mpNetAmount`, `mpFeeAmount` to the `t.update(transactionRef, {...})` call inside the `db.runTransaction()` block in `handlePaymentEvent`, alongside the existing `status: "paid"`, `paidAt`, `payment.*` fields.

### merchant_order event handling

MP fires `merchant_order` topic events before `payment.created`/`payment.updated`. These must not trigger business logic (payment data may not be finalized yet).

- `merchant_order` events → log info with topic + action + resource_id, return 200, no Firestore writes
- Unknown/unexpected topics (not `payment.*`, not `merchant_order`) → log warn, return 200
- Both the info and warn cases are covered by the structured log entry from MPWH-01

### Claude's Discretion

- Exact Firestore document schema for `webhookEvents/*` (field names, types)
- TypeScript type annotations for the extended `MpPaymentResponse`
- Whether to extract `handlePaymentEvent` fallback logic into a helper function or keep inline
- Order of operations in the refactored handler (idempotency gate → signature validation → structured log → business logic)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 23 goal, success criteria, architecture note (HMAC format, merchant_order topic)
- `.planning/REQUIREMENTS.md` — MPWH-01, MPWH-02, MPWH-03, MPWH-04 definitions

### Webhook under modification
- `apps/functions/src/mercadopagoWebhook.ts` — the entire file; all four requirements modify this file

### Idempotency pattern reference
- `.planning/phases/19-single-writer-billing-foundation/19-CONTEXT.md` — BILL-08 decision (Stripe idempotency via db.runTransaction() check-and-set)
- `apps/functions/src/stripe/stripeWebhook.ts` — `beginStripeEventProcessing` function (the exact pattern to mirror for MP idempotency)

### Payment creation (external_reference format)
- `apps/functions/src/api/services/transaction-payment.service.ts` — lines ~311, ~428, ~538: `external_reference: \`${transactionId}:${attemptId}\`` format; also shows that Checkout Pro stores preferenceId (not payment ID) in payment_attempts

### MP client and data models
- `apps/functions/src/lib/mercadopago-client.ts` — HMAC helpers, token types, environment derivation
- `apps/functions/src/api/services/mercadopago.service.ts` — `getMercadoPagoData()` (gets tenant access token)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `logger` from `./lib/logger` — already imported in mercadopagoWebhook.ts; use for all structured logs
- `MercadoPagoService.getMercadoPagoData(tenantId)` — resolves tenant MP token with auto-refresh; used in current fallback after tenant is known
- `resolveWalletRef()` from `./lib/finance-helpers` — wallet balance adjustment; already used in handlePaymentEvent
- `db.runTransaction()` — already used in handlePaymentEvent for the approval write; extend to add idempotency gate

### Established Patterns
- Stripe idempotency pattern (Phase 19): `db.runTransaction()` reads existing event doc → if processing/done, return early; if absent, create with `status: "processing"` — replicate exactly for MP
- Structured logging: `logger.info("MP webhook: ...", { tenantId, transactionId, mpPaymentId, ... })` — format already used; just extend
- Silent 200 on unprocessable events: already the pattern for invalid signatures → keep for fallback failures too
- `payment_attempts` document ID is the `attemptId` used in `external_reference` — enables O(1) lookup after resolving external_reference

### Integration Points
- `mercadopagoWebhook.ts` is an `onRequest` Cloud Function (not part of Express monolith) — deployed separately, same region `southamerica-east1`
- New `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` env var must be added to both `apps/functions/.env.erp-softcode` and `apps/functions/.env.erp-softcode-prod`
- `webhookEvents` collection is new — Firestore security rules may need to deny client access (backend-only collection, no client reads needed)
- Fee fields (`mpGrossAmount`, `mpNetAmount`, `mpFeeAmount`) written to `transactions/{id}` — Phase 24 reads these; no migration of existing docs needed (fields simply absent for pre-phase payments)

</code_context>

<specifics>
## Specific Ideas

- The HMAC fix is the highest-risk change: once deployed, any in-flight MP webhook retries that were signed with the old format will be rejected. Since we currently return 200 on invalid signatures anyway, this is safe — MP won't retry on 200. Deploy the HMAC fix and idempotency gate together as the first logical unit.
- The `webhookEvents` Firestore collection should be backend-only. Add a deny rule in `firestore.rules` if the existing DENY-by-default policy doesn't cover it automatically (it should, but verify).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-mp-webhook-hardening*
*Context gathered: 2026-05-11*
