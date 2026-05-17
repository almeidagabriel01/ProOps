---
phase: 23-mp-webhook-hardening
plan: "01"
subsystem: payments
tags: [mercadopago, webhook, hmac, idempotency, firestore, observability, backend]

requires:
  - phase: 19-stripe-billing-hardening
    provides: "beginStripeEventProcessing pattern and itIfEmulator test pattern (BILL-08)"

provides:
  - "Fixed HMAC manifest format: id:<dataId>;request-id:<xRequestId>;ts:<ts>; (was broken semicolon-only format)"
  - "Structured entry log on every MP webhook request before any early return"
  - "webhookEvents/{xRequestId} idempotency gate for payment.* events only (mirrors Stripe BILL-08 pattern)"
  - "beginMpWebhookProcessing and finalizeMpWebhookProcessing exported helpers"
  - "Action routing before idempotency gate: merchant_order and unknown topics return 200 with zero Firestore writes"
  - "Failure lifecycle: unexpected post-gate errors → status:failed → HTTP 500 for MP retries"
  - "Unit + emulator-gated integration tests in apps/functions/src/__tests__/mercadopagoWebhook.test.ts"

affects:
  - "23-mp-webhook-hardening plan 02 — MPWH-03/04 fallback and fee fields build on this idempotency foundation"

tech-stack:
  added: []
  patterns:
    - "MP idempotency gate mirrors beginStripeEventProcessing (Phase 19 BILL-08): db.runTransaction check-and-set in webhookEvents collection"
    - "Action routing BEFORE idempotency gate: non-payment topics (merchant_order, unknown) return early without any Firestore writes"
    - "5-minute stuck-processing window for idempotency (same as Stripe pattern — accepted risk, MP retries far exceed window)"
    - "itIfEmulator test pattern: RUN_INTEGRATION = !!process.env.FIRESTORE_EMULATOR_HOST, integration tests skip cleanly without emulator"

key-files:
  created:
    - apps/functions/src/__tests__/mercadopagoWebhook.test.ts
  modified:
    - apps/functions/src/mercadopagoWebhook.ts

key-decisions:
  - "Idempotency helpers placed after onRequest definition (not before) to satisfy awk ordering invariant: action routing (merchant_order log at line ~317) must textually precede beginMpWebhookProcessing call (line ~357). TypeScript function declarations are hoisted in CommonJS so call from inside onRequest callback is valid."
  - "5-minute stuck-processing window for PROCESSING_STUCK_WINDOW_MS — mirrors Stripe pattern from Phase 19, accepted risk (MP delivery retries far exceed 5 min)"
  - "void mockedAxios to suppress noUnusedLocals tsc error while preserving the jest.mock scaffold for Plan 02 Task 2"
  - "merchant_order topic uses logger.info (not warn) per CONTEXT.md; unknown/unhandled topics use logger.warn"
  - "Raw x-signature header never logged — replaced with xSignaturePresent: boolean (T-23-03 mitigated)"
  - "webhookEvents collection covered by catch-all DENY in firestore.rules — no explicit rule added (verified by grep returning 0 matches)"

patterns-established:
  - "MP webhook idempotency gate: export beginMpWebhookProcessing + finalizeMpWebhookProcessing, scoped to payment.* only"
  - "Structured webhook entry log: xRequestId, xSignaturePresent (boolean), action, type, dataId — fires before any early return"

requirements-completed: [MPWH-01, MPWH-02]

duration: 45min
completed: "2026-05-11"
---

# Phase 23 Plan 01: MP Webhook Hardening (HMAC + Idempotency) Summary

**Fixed broken HMAC manifest format (`id:dataId;request-id:xRequestId;ts:ts;`), added structured entry log, and built `webhookEvents` idempotency gate scoped to `payment.*` events with action routing before the gate**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-11T18:50:00Z
- **Completed:** 2026-05-11T19:35:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- HMAC validation now uses the correct MP spec manifest format — every signature that was silently failing will now validate correctly
- Every webhook request emits a structured `logger.info("MP webhook: received")` with `xRequestId`, `xSignaturePresent` (boolean only — raw header never logged), `action`, `type`, and `dataId` before any early return
- `webhookEvents/{xRequestId}` idempotency gate prevents duplicate payment processing via `db.runTransaction()` check-and-set — mirrors Phase 19 BILL-08 Stripe pattern
- `merchant_order` and unknown topic events return HTTP 200 with zero Firestore writes (action routing precedes idempotency gate per CONTEXT.md requirement)
- Unexpected post-gate errors flip `webhookEvents` doc to `status:"failed"` and return HTTP 500 so MercadoPago retries
- Unit tests (HMAC format, 2 passing) + emulator-gated integration tests (idempotency lifecycle, 3 skip cleanly without emulator)

## Task Commits

1. **Task 1: Test scaffold (RED)** - `5ffe3765` (test)
2. **Task 2: HMAC fix + entry log** - `81c1b156` (feat)
3. **Task 3: Idempotency gate + action routing** - `d49d162f` (feat)

## Files Created/Modified

- `apps/functions/src/__tests__/mercadopagoWebhook.test.ts` — Unit tests (Block A: HMAC format) + emulator-gated integration tests (Block B: idempotency lifecycle); `jest.mock("axios")` scaffolding for Plan 02
- `apps/functions/src/mercadopagoWebhook.ts` — Fixed HMAC manifest, structured entry log, `validateMPSignature` exported, `beginMpWebhookProcessing` + `finalizeMpWebhookProcessing` exported helpers, restructured handler with action routing before idempotency gate

## Decisions Made

- **Idempotency helpers placed AFTER `onRequest`** to satisfy the awk ordering invariant (merchant_order log must textually precede first `beginMpWebhookProcessing(` match). TypeScript function declarations are hoisted in CommonJS so calling them from inside the `onRequest` handler callback (which executes at runtime) is valid.
- **5-minute `PROCESSING_STUCK_WINDOW_MS`** mirrors Phase 19 Stripe accepted risk — MP delivery retries occur hours apart, far exceeding the 5-minute window.
- **`void mockedAxios`** suppresses `noUnusedLocals` tsc error on the Plan 02 scaffolding variable without removing the `jest.mock("axios")` that Plan 02 Task 2 requires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved idempotency helpers after `onRequest` to satisfy ordering invariant**
- **Found during:** Task 3 (idempotency gate implementation)
- **Issue:** Plan said to add helpers ABOVE `onRequest`, but the awk ordering check in acceptance criteria uses `/beginMpWebhookProcessing\(/` which matches the function definition before the handler's merchant_order log line, causing the invariant to fail.
- **Fix:** Placed `beginMpWebhookProcessing` and `finalizeMpWebhookProcessing` function declarations AFTER the `onRequest` export. Function declarations are hoisted in CommonJS, so the runtime behavior is identical.
- **Files modified:** `apps/functions/src/mercadopagoWebhook.ts`
- **Verification:** `awk` ordering check exits 0; `npm run build` passes; tests pass.
- **Committed in:** `d49d162f`

**2. [Rule 3 - Blocking] Added `void mockedAxios` to suppress `noUnusedLocals` tsc error**
- **Found during:** Task 2 (build verification)
- **Issue:** `tsconfig.json` has `noUnusedLocals: true`. The `const mockedAxios` scaffold variable (required by Plan 02) caused `tsc` build failure.
- **Fix:** Added `void mockedAxios;` after the declaration to consume the variable without affecting runtime behavior.
- **Files modified:** `apps/functions/src/__tests__/mercadopagoWebhook.test.ts`
- **Verification:** `npm run build` exits 0; lint passes.
- **Committed in:** `d49d162f`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both fixes required for acceptance criteria compliance. No scope creep.

## Issues Encountered

- TDD sequencing: Task 2's `npm run build` acceptance criteria required Task 3's exports to exist (test file imports them). Resolved by implementing Tasks 2 and 3 back-to-back with intermediate commits, then a final Task 3 commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (MPWH-03/04) can now add MP API fallback logic and fee fields to `handlePaymentEvent` — the idempotency gate is in place so duplicate retries during Plan 02 work won't cause double wallet credits
- `jest.mock("axios")` scaffold is in place in the test file — Plan 02 Task 2 can add axios-mocked test cases without restructuring the test file
- `finalizeMpWebhookProcessing` is exported — Plan 02 can call it from error paths in `handlePaymentEvent` if needed

---
*Phase: 23-mp-webhook-hardening*
*Completed: 2026-05-11*
