---
phase: 23-mp-webhook-hardening
plan: "02"
subsystem: payments
tags: [mercadopago, webhook, external-reference, fee-persistence, checkout-pro, backend]

requires:
  - phase: 23-mp-webhook-hardening
    plan: "01"
    provides: "webhookEvents idempotency gate, handlePaymentEvent exported, jest.mock(axios) scaffold"

provides:
  - "parseExternalReference exported helper: splits '<transactionId>:<attemptId>' from MP external_reference"
  - "deriveMpFeeFields exported pure helper: returns { mpGrossAmount } always, { mpNetAmount, mpFeeAmount } when net > 0"
  - "MPWH-03 fallback resolver in handlePaymentEvent: platform-token API call when primary mpPaymentId lookup empty"
  - "Structured lookup_result logs: primary | fallback_resolved | not_found"
  - "MPWH-04 fee fields: mpGrossAmount/mpNetAmount/mpFeeAmount persisted on transactions/{id} at payment confirmation"
  - "MERCADOPAGO_PLATFORM_ACCESS_TOKEN documented in .env.example"

affects:
  - "apps/functions/src/mercadopagoWebhook.ts"
  - "apps/functions/.env.example"
  - "apps/functions/src/__tests__/mercadopagoWebhook.test.ts"

tech-stack:
  added: []
  patterns:
    - "parseExternalReference is the canonical reverse lookup of the external_reference format set by transaction-payment.service.ts (lines 311, 428, 538, 748)"
    - "jest.mock('axios') at top of test file + jest.doMock('../init') + jest.resetModules() per test = MPWH-03 unit isolation pattern without FIRESTORE_EMULATOR_HOST"
    - "freshAxios = require('axios') inside each doMock test — required because jest.resetModules() creates a new module registry; top-level mockedAxios reference becomes stale"
    - "deriveMpFeeFields returns partial object (omits undefined) — Firestore rejects undefined field values"

key-files:
  created: []
  modified:
    - apps/functions/src/mercadopagoWebhook.ts
    - apps/functions/.env.example
    - apps/functions/src/__tests__/mercadopagoWebhook.test.ts

key-decisions:
  - "Zero net_received_amount treated as missing rather than zero-fee: typeof net === 'number' && net > 0 guard — sandbox payments return net=0 (MP does not charge fees in sandbox); writing mpNetAmount=0 would imply zero fee which is misleading"
  - "Non-integer cent rounding via toBeCloseTo(0.53, 2): IEEE 754 (10.50 - 9.97 = 0.5300000000000011) — strict toBe(0.53) would fail; toBeCloseTo captures the floating-point reality without introducing a rounding helper"
  - "freshAxios pattern for Behaviors 2/3: jest.resetModules() creates a new module registry; the top-level mockedAxios reference points to the original registry instance and becomes stale after reset. Using require('axios') inside the test body gets the fresh instance that the dynamically-required handlePaymentEvent will use"
  - "CLAUDE.md Bug Fix Policy satisfied via git stash workflow: 3 MPWH-03 failure-mode tests FAIL against pre-fix source, 3 PASS against post-fix source"
  - "Platform token (MERCADOPAGO_PLATFORM_ACCESS_TOKEN) used ONLY for fallback fetch — immediately switches to tenant OAuth token via MercadoPagoService.getMercadoPagoData(tenantId) for all subsequent operations (T-23-07 mitigated)"

requirements-completed: [MPWH-03, MPWH-04]

duration: 25min
completed: "2026-05-11"
---

# Phase 23 Plan 02: MP Webhook Hardening (External Reference Fallback + Fee Persistence) Summary

**Checkout Pro payment confirmation bug fixed via external_reference fallback resolution; confirmed payments now carry mpGrossAmount/mpNetAmount/mpFeeAmount fields for Phase 24 Bruto/Taxa/Liquido display**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-11T19:05:00Z
- **Completed:** 2026-05-11T19:35:00Z
- **Tasks:** 3 (TDD: RED→GREEN for Tasks 2 and 3)
- **Files modified:** 3

## Accomplishments

- **MPWH-03**: Checkout Pro payments no longer silently dropped — when the primary `where("mpPaymentId", "==", dataId)` query returns empty, the handler now calls `GET /v1/payments/{dataId}` with the platform access token, parses `external_reference: "${transactionId}:${attemptId}"`, and looks up `payment_attempts/{attemptId}` directly
- **MPWH-04**: Confirmed payments carry `mpGrossAmount` (always) and `mpNetAmount` + `mpFeeAmount` (when `transaction_details.net_received_amount` is present and non-zero), enabling Phase 24 fee breakdown display
- Structured `lookup_result` logging distinguishes `"primary"` (normal path), `"fallback_resolved"` (Checkout Pro), and `"not_found"` (genuinely unresolvable) — no MP retry loops on unresolvable events
- Three exported pure helpers: `parseExternalReference`, `deriveMpFeeFields`, `validateMPSignature` (Plan 01) — all unit-tested in isolation
- CLAUDE.md Bug Fix Policy satisfied: 3 failure-mode tests FAIL without fix, 3 PASS with fix (verified via `git stash` workflow)

## Task Commits

1. **Task 1: Type contracts + parseExternalReference + env var** - `553abfb8` (feat)
2. **Task 2 RED: MPWH-03 failure mode tests** - `0a74db72` (test)
3. **Task 2 GREEN: MPWH-03 fallback implementation + axios mock fix** - `b1f72e5e` (feat)
4. **Task 3 RED: deriveMpFeeFields unit tests** - `61c3d967` (test)
5. **Task 3 GREEN: deriveMpFeeFields + fee fields in runTransaction** - `3b7c1ab2` (feat)

## Files Created/Modified

- `apps/functions/src/mercadopagoWebhook.ts` — Extended `MpPaymentResponse` interface, added `deriveMpFeeFields` and `parseExternalReference` exported helpers, replaced empty-snapshot early-return with fallback resolver block, spread `feeFields` into `t.update(transactionRef)` inside approved runTransaction
- `apps/functions/.env.example` — Added `MERCADOPAGO_PLATFORM_ACCESS_TOKEN=` with explanation pointing to MPWH-03
- `apps/functions/src/__tests__/mercadopagoWebhook.test.ts` — Added Block C (parseExternalReference unit, 5 tests), Block D (MPWH-03 fallback failure modes, 3 axios-mocked tests), Block E (deriveMpFeeFields unit, 4 tests)

## Decisions Made

- **Zero net treated as missing**: `typeof net === "number" && net > 0` — sandbox payments return `net_received_amount: 0` (MP charges no fees in sandbox). Writing `mpNetAmount: 0` would mislead Phase 24 into showing 0% fee when the data is simply absent.
- **toBeCloseTo for floating-point**: IEEE 754: `10.50 - 9.97 = 0.5300000000000011`. Strict `toBe(0.53)` would fail. `toBeCloseTo(0.53, 2)` captures the reality.
- **freshAxios pattern**: After `jest.resetModules()`, `require("axios")` creates a new module instance. The top-level `mockedAxios` reference becomes stale. Getting `freshAxios = require("axios")` inside the test body (after resetModules) ensures mock setup applies to the same instance the dynamically-required module uses.
- **CLAUDE.md Bug Fix Policy**: `git stash push apps/functions/src/mercadopagoWebhook.ts` → run MPWH-03 tests → 3 fail → `git stash pop` → run MPWH-03 tests → 3 pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed axios mock isolation for Behaviors 2 and 3 (MPWH-03 tests)**
- **Found during:** Task 2 GREEN phase (running tests after implementation)
- **Issue:** `mockedAxios.get.mockRejectedValueOnce(...)` was set on the top-level `mockedAxios` instance before `jest.resetModules()`. After reset, `require("../mercadopagoWebhook")` gets a fresh module registry. The fresh axios import (via `jest.mock("axios")` factory) is a new instance — `mockedAxios` (top-level reference) no longer points to it. The queued mock value was lost, causing axios to return `undefined` → `"Cannot read properties of undefined (reading 'data')"`.
- **Fix:** In Behaviors 2 and 3, added `const freshAxios = require("axios")` AFTER `jest.resetModules()` (inside the test body). Mock setup (`mockRejectedValueOnce`/`mockResolvedValueOnce`) and assertions (`toHaveBeenCalledTimes`) use `freshAxios.get` instead of `mockedAxios.get`.
- **Files modified:** `apps/functions/src/__tests__/mercadopagoWebhook.test.ts`
- **Commit:** `b1f72e5e`

**2. [Rule 2 - Missing Critical] mockedAxios grep count below plan's ≥5 threshold**
- **Context:** Plan verification section requires `grep -c "mockedAxios" ...test.ts → ≥5`. After the axios isolation fix, Behaviors 2/3 use `freshAxios` not `mockedAxios`. The test file contains `mockedAxios` 3 times (declaration + Behavior 1 assertion). Plan's count assumed the original test pattern.
- **Assessment:** Tests are functionally correct and passing. The grep count invariant was written for the original pattern. The `freshAxios` pattern is strictly more correct than the stale-reference pattern the plan assumed.
- **Impact:** Plan verification grep count not met (3, not ≥5). All behavior tests pass. No correctness impact.

---

**Total deviations:** 2 (1 auto-fixed bug, 1 accepted deviation from grep count due to necessary fix)

## CLAUDE.md Bug Fix Policy Verification

**Requirement:** Tests that fix a confirmed bug must FAIL without the fix and PASS with it.

**Method:** `git stash push -m "MPWH-03 implementation" apps/functions/src/mercadopagoWebhook.ts` (stashes MPWH-03 implementation, keeps test file)

**Pre-fix run:** 3 failed — `"MPWH-03 fallback failure modes"` block:
- Behavior 1: `loggerWarnSpy` had 0 calls (expected "fallback unavailable" warn)
- Behavior 2: `loggerWarnSpy` had 0 calls (expected "fallback MP API call failed" warn)
- Behavior 3: `loggerWarnSpy` had 0 calls (expected "external_reference missing or malformed" warn)

Pre-fix code logged `"MP webhook: no payment attempt found, ignoring"` via `logger.info` and returned — no warn envelope, no fallback branch.

**Post-fix run:** 3 passed — all MPWH-03 failure mode tests pass.

## User Setup Required

Before using the fallback in production:
1. Obtain the ProOps MercadoPago app platform-level access token from MercadoPago Developer Portal → ProOps app → Production credentials
2. Add `MERCADOPAGO_PLATFORM_ACCESS_TOKEN=<token>` to `apps/functions/.env.erp-softcode` (dev) and `apps/functions/.env.erp-softcode-prod` (prod)
3. Deploy: `npm run deploy:dev`, validate via Cloud Logging (`lookup_result:"fallback_resolved"`), then `npm run deploy:prod`

Without the env var set, Checkout Pro payments will log `"fallback unavailable — MERCADOPAGO_PLATFORM_ACCESS_TOKEN not configured"` and return 200 (no retry loop). Existing PIX/Boleto payments (primary lookup path) are unaffected.

## Known Stubs

None — all data paths are wired.

## Threat Flags

No new trust boundaries introduced beyond those in the plan's threat model (T-23-07 through T-23-11 — all registered and mitigated or accepted).

## Next Phase Readiness

- Phase 24 can read `mpGrossAmount`, `mpNetAmount`, `mpFeeAmount` from `transactions/{id}` documents to display the Bruto/Taxa/Líquido breakdown
- Both MPWH-03 and MPWH-04 are production-ready pending `MERCADOPAGO_PLATFORM_ACCESS_TOKEN` configuration in secrets files

---
*Phase: 23-mp-webhook-hardening*
*Completed: 2026-05-11*
