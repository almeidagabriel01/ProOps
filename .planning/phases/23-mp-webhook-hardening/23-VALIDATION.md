---
phase: 23
slug: mp-webhook-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (functions) + Playwright E2E |
| **Config file** | `apps/functions/jest.config.js` |
| **Quick run command** | `cd apps/functions && npm test -- --testPathPattern=mercadopago` |
| **Full suite command** | `npm run test:rules && cd apps/functions && npm test` |
| **Estimated runtime** | ~30 seconds (quick) / ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/functions && npm test -- --testPathPattern=mercadopago`
- **After every plan wave:** Run `npm run test:rules && cd apps/functions && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | MPWH-01/02 | unit | `cd apps/functions && npm test -- --testPathPattern=mercadopago` | ❌ W0 | ⬜ pending |
| 23-01-02 | 01 | 1 | MPWH-02 | unit | `cd apps/functions && npm test -- --testPathPattern=mercadopago` | ❌ W0 | ⬜ pending |
| 23-01-03 | 01 | 2 | MPWH-03 | unit | `cd apps/functions && npm test -- --testPathPattern=mercadopago` | ❌ W0 | ⬜ pending |
| 23-01-04 | 01 | 2 | MPWH-04 | unit | `cd apps/functions && npm test -- --testPathPattern=mercadopago` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/functions/src/__tests__/mercadopagoWebhook.test.ts` — unit test stubs for MPWH-01, MPWH-02, MPWH-03, MPWH-04

*Existing Jest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HMAC validation end-to-end with real MP signature | MPWH-01 | Requires live MP webhook secret and signed payload from MP servers | Send a real test event from MP developer portal → check Cloud Logging for `hmacValid: true` |
| Duplicate event suppression on real MP retry | MPWH-02 | Requires two real webhook deliveries with the same x-request-id | Trigger a payment event, manually re-send same payload → verify second call returns 200 without DB write |
| Fee fields populated in production | MPWH-04 | `net_received_amount` availability varies; sandbox may not return it | Verify a real MP payment transaction document in Firestore shows `mpGrossAmount`, `mpNetAmount`, `mpFeeAmount` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
