---
phase: 23-mp-webhook-hardening
verified: 2026-05-11T19:45:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "HMAC validation end-to-end with real MercadoPago signature"
    expected: "Valid signature returns 200 and processes event; tampered/missing signature returns 400 with hmacValid:false log"
    why_human: "Requires live MERCADOPAGO_WEBHOOK_SECRET from MP Developer Portal and a real webhook delivery — cannot simulate correct HMAC-SHA256 signature without the production secret"
  - test: "Duplicate event suppression on real MP retry"
    expected: "Second delivery of same x-request-id returns HTTP 200 without re-executing business logic (Firestore transaction doc NOT modified twice, webhookEvents/{id}.status stays 'done' and 'skipped_idempotent' is logged)"
    why_human: "Requires two real webhook deliveries with the same x-request-id header from MercadoPago — cannot reproduce the actual retry behavior without a live MP sandbox/production environment"
  - test: "Fee fields populated on a real confirmed payment transaction"
    expected: "After a real payment confirmation via MercadoPago, the Firestore transaction doc at transactions/{id} contains mpGrossAmount (always), and mpNetAmount + mpFeeAmount when net_received_amount > 0"
    why_human: "Sandbox payments return net_received_amount=0 (MP charges no fees in sandbox) — verifying mpNetAmount/mpFeeAmount requires a production payment or a sandbox configured to return non-zero net"
---

# Phase 23: MP Webhook Hardening Verification Report

**Phase Goal:** Harden the MercadoPago webhook handler to be observable, idempotent, and payment-accurate — fix broken HMAC signature validation, add structured entry logging, implement event-level idempotency (payment.* events), resolve the Checkout Pro payment confirmation bug (MPWH-03), and persist MP fee data on confirmed transactions (MPWH-04)
**Verified:** 2026-05-11T19:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Structured log entry emitted before any early return with action, HMAC result, and filtered request metadata | VERIFIED | `mercadopagoWebhook.ts` lines 399-405: `logger.info("MP webhook: received", { action, topic, dataId, xRequestId, xSignaturePresent: !!req.headers["x-signature"] })` — xSignaturePresent is boolean (filtered), no raw header value |
| 2 | Duplicate `payment.*` event (same `x-request-id`) returns HTTP 200 without re-executing business logic | VERIFIED | Lines 528-553: `beginMpWebhookProcessing` uses `db.runTransaction` check-and-set on `webhookEvents/{xRequestId}` with status:"processing"; skipped_idempotent path returns 200 at line 471-476; 5-minute stuck window mirrors Stripe Phase 19 pattern |
| 3 | Checkout Pro payment confirmation resolved via `external_reference` fallback when direct `mpPaymentId` lookup returns empty | VERIFIED | Lines 141-209: fallback block calls `axios.get(/v1/payments/{dataId})` with platform token, calls `parseExternalReference(external_reference)` to get `{transactionId, attemptId}`, then looks up `payment_attempts/{attemptId}` directly; lookup_result structured log distinguishes "primary" / "fallback_resolved" / "not_found" |
| 4 | Confirmed payment transaction document contains `mpGrossAmount`, `mpNetAmount`, `mpFeeAmount` | VERIFIED | Lines 294-302: `feeFields = deriveMpFeeFields(mpPayment)` spreads fee fields into `t.update(transactionRef, { ...feeFields })` inside approved branch of `runTransaction`; `deriveMpFeeFields` returns `{mpGrossAmount}` always and `{mpNetAmount, mpFeeAmount}` only when `net_received_amount > 0` (avoids misleading zero-fee in sandbox) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/functions/src/mercadopagoWebhook.ts` | Full webhook handler with HMAC, idempotency, fallback, fee persistence | VERIFIED | 568 lines; exports `validateMPSignature`, `handlePaymentEvent`, `mercadopagoWebhook`, `beginMpWebhookProcessing`, `finalizeMpWebhookProcessing`, `parseExternalReference`, `deriveMpFeeFields` |
| `apps/functions/src/__tests__/mercadopagoWebhook.test.ts` | 5 test blocks covering all MPWH-01 through MPWH-04 behaviors | VERIFIED | 391 lines; Block A (HMAC unit, 2 tests), Block B (idempotency integration, 3 emulator-gated), Block C (parseExternalReference unit, 5 tests), Block D (MPWH-03 fallback failure modes, 3 axios-mocked), Block E (deriveMpFeeFields unit, 4 tests) — 14 pass, 3 skip by design |
| `apps/functions/.env.example` | `MERCADOPAGO_PLATFORM_ACCESS_TOKEN=` documented | VERIFIED | Line confirmed present; 1 occurrence |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mercadopagoWebhook.ts` | `webhookEvents/{xRequestId}` | `db.runTransaction` inside `beginMpWebhookProcessing` | WIRED | Lines 528-553: `db.runTransaction` reads/writes `webhookEvents/{xRequestId}` with check-and-set pattern; idempotency gate called at line 468 |
| `validateMPSignature` | HMAC manifest format | `` `id:${dataId};request-id:${xRequestId};ts:${ts};` `` | WIRED | Line 116: exact manifest string confirmed; `crypto.createHmac("sha256", secret).update(manifest).digest("hex")`; `timingSafeEqual` at line 119 |
| `handlePaymentEvent` | structured entry log | `logger.info("MP webhook: received"` | WIRED | Lines 399-405: entry log fires before topic routing, before signature check |
| `handlePaymentEvent` | `deriveMpFeeFields` | spread into `t.update(transactionRef)` | WIRED | Lines 294-302: `feeFields` spread inside `runTransaction` approved branch |
| `handlePaymentEvent` | `payment_attempts/{attemptId}` | `axios.get(/v1/payments/{dataId})` + `parseExternalReference` | WIRED | Lines 141-209: platform token fetch → parseExternalReference → `payment_attempts.doc(attemptId).get()` |
| `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` | fallback resolver | `process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN` | WIRED | Line 142: `const platformToken = process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN`; missing token → warn "fallback unavailable" + return (no retry loop) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `mercadopagoWebhook.ts` — fee fields | `feeFields` (mpGrossAmount, mpNetAmount, mpFeeAmount) | `deriveMpFeeFields(mpPayment)` where `mpPayment` is fetched from Firestore `payment_attempts` doc | Yes — reads actual `transaction_amount` and `transaction_details.net_received_amount` from MP API response stored in Firestore | FLOWING |
| `mercadopagoWebhook.ts` — fallback resolver | `paymentAttemptSnap` | `payment_attempts.doc(attemptId).get()` via Firestore | Yes — live Firestore read after external_reference parse | FLOWING |
| `mercadopagoWebhook.ts` — idempotency gate | `webhookEventSnap` | `webhookEvents/{xRequestId}` via `db.runTransaction` | Yes — live Firestore transaction read | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Jest unit tests pass | `cd apps/functions && npx jest mercadopagoWebhook.test.ts --no-coverage 2>&1` | 14 passed, 3 skipped (emulator-gated by design) | PASS |
| TypeScript compiles clean | `cd apps/functions && npm run build 2>&1` | 0 errors | PASS |
| Lint: 0 errors | `cd apps/functions && npm run lint 2>&1` | 0 errors (15 unused-eslint-disable warnings — harmless) | PASS |
| `parseExternalReference` handles valid format | Unit tests Block C (5 tests) | All 5 pass including edge cases: valid, empty, null, format-variants | PASS |
| `deriveMpFeeFields` handles sandbox (net=0) | Unit tests Block E (4 tests) | Zero-net treated as absent (correct); floating-point via `toBeCloseTo` | PASS |
| MPWH-03 fallback failure modes | Unit tests Block D (3 tests) | Platform token missing → warn; axios failure → warn; malformed external_reference → warn | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MPWH-01 | Plan 01 | Fix broken HMAC signature validation (manifest format and timing-safe comparison) | SATISFIED | `validateMPSignature` line 116: correct manifest `` `id:${dataId};request-id:${xRequestId};ts:${ts};` ``; `timingSafeEqual` at line 119; Block A unit tests |
| MPWH-02 | Plan 01 | Add structured entry logging + event-level idempotency gate for `payment.*` events | SATISFIED | Entry log lines 399-405; `beginMpWebhookProcessing` lines 528-553 with `db.runTransaction`; action routing BEFORE gate (lines 426-445) |
| MPWH-03 | Plan 02 | Checkout Pro fallback: resolve payment via `external_reference` when direct lookup returns empty | SATISFIED | Lines 141-209: platform token fetch, `parseExternalReference`, `payment_attempts.doc(attemptId)` lookup; lookup_result structured log |
| MPWH-04 | Plan 02 | Persist MP fee fields (`mpGrossAmount`, `mpNetAmount`, `mpFeeAmount`) on confirmed transactions | SATISFIED | Lines 294-302: `deriveMpFeeFields` spread into `t.update(transactionRef)` inside approved `runTransaction` branch |

**Note:** REQUIREMENTS.md still shows MPWH-03 and MPWH-04 as `[ ] Pending` (checkbox not updated). The code implements both requirements in full. This is a documentation gap in REQUIREMENTS.md, not a code gap. Both plan SUMMARYs confirm `requirements-completed: [MPWH-03, MPWH-04]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `__tests__/mercadopagoWebhook.test.ts` | multiple | `@typescript-eslint/no-var-requires` disable comments now unused | Info | Lint warns about 15 unused disable directives — harmless, zero errors |

No blocking anti-patterns found. No TODO/FIXME/placeholder comments in implementation code. No hardcoded empty returns in handler paths. No stub return patterns.

### Human Verification Required

#### 1. HMAC Validation End-to-End

**Test:** Configure `MERCADOPAGO_WEBHOOK_SECRET` in dev environment with the real value from MercadoPago Developer Portal → ProOps app → Webhooks. Trigger a real test event from MP. Observe Cloud Logging for `MP webhook: received` with `hmacValid: true`. Then replay the event with a tampered `x-signature` header and verify `hmacValid: false` + HTTP 400.

**Expected:** Valid signature → `hmacValid: true` in structured log → event processed. Tampered/missing signature → `hmacValid: false` log → HTTP 400 (no business logic executed).

**Why human:** Requires the live `MERCADOPAGO_WEBHOOK_SECRET` from MP Developer Portal and a real webhook delivery. The unit tests verify the manifest format and comparison logic in isolation, but cannot test the full round-trip with the actual MP-signed payload.

#### 2. Duplicate Event Suppression on Real MP Retry

**Test:** In the MercadoPago Webhooks dashboard, trigger a delivery, then force a retry (MP retries on non-200 responses, or use the "Resend" button if available). Both deliveries must carry the same `x-request-id` header. Verify in Cloud Logging that the second delivery logs `lookup_result: "skipped_idempotent"` and returns HTTP 200, and that the Firestore transaction document was only written once.

**Expected:** First delivery: `webhookEvents/{xRequestId}.status` transitions `processing` → `done`. Second delivery: `beginMpWebhookProcessing` returns `{ result: "skipped_idempotent" }` → HTTP 200 without any Firestore writes to `transactions`.

**Why human:** Requires two real webhook deliveries with the same `x-request-id`. The unit test scaffold (Block B) is emulator-gated and verifies the `db.runTransaction` logic in isolation — the full MP retry cycle requires a live environment.

#### 3. Fee Fields on Real Confirmed Payment

**Test:** Complete a real payment (or production-equivalent test payment) through MercadoPago for a tenant with an active payment attempt. After the `payment.updated` webhook fires with `status: "approved"`, check the corresponding Firestore `transactions/{id}` document for the presence of `mpGrossAmount`, `mpNetAmount`, and `mpFeeAmount` fields.

**Expected:** `mpGrossAmount` always present (equals `transaction_amount`). `mpNetAmount` and `mpFeeAmount` present only when `transaction_details.net_received_amount > 0` (non-sandbox payment). `mpFeeAmount = mpGrossAmount - mpNetAmount`.

**Why human:** Sandbox payments return `net_received_amount: 0` (MP charges no fees in sandbox). The `deriveMpFeeFields` logic correctly treats zero-net as absent to avoid misleading zero-fee display in Phase 24. Verifying `mpNetAmount`/`mpFeeAmount` persistence requires a non-sandbox payment or a sandbox configured to return non-zero net.

### Gaps Summary

No gaps blocking goal achievement. All four MPWH requirements are implemented and wired in `apps/functions/src/mercadopagoWebhook.ts`. Automated verification (unit tests, TypeScript build, lint) passes clean.

Status is `human_needed` because three behaviors require live MercadoPago integration to fully confirm: (1) HMAC round-trip with the real webhook secret, (2) idempotency gate on actual MP retry, and (3) fee field persistence on a real payment. These are integration-level validations that cannot be automated without the production/sandbox secrets and a live MP tenant.

**User action required before production deploy:**
1. Add `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` to `apps/functions/.env.erp-softcode` (dev) and `.env.erp-softcode-prod` (prod) — required for Checkout Pro fallback (MPWH-03)
2. Run the three human verification items above in the dev environment
3. Update REQUIREMENTS.md checkboxes for MPWH-03 and MPWH-04 from `[ ]` to `[x]`

---

_Verified: 2026-05-11T19:45:00Z_
_Verifier: Claude (gsd-verifier)_
