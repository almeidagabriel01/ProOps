---
phase: 19
slug: single-writer-billing-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (Firebase emulator integration tests) |
| **Config file** | `apps/functions/package.json` jest config |
| **Quick run command** | `cd apps/functions && npm run test -- --testPathPattern=billing` |
| **Full suite command** | `firebase emulators:exec --only firestore,auth "cd apps/functions && npm run test"` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/functions && npm run test -- --testPathPattern=billing`
- **After every plan wave:** Run `firebase emulators:exec --only firestore,auth "cd apps/functions && npm run test"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | BILL-06 | unit | `cd apps/functions && npm run build` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | BILL-06 | integration | `cd apps/functions && npm run test -- --testPathPattern=syncTenantPlanBillingSnapshot` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | BILL-07 | unit | `cd apps/functions && npm run build` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 2 | BILL-08 | integration | `cd apps/functions && npm run test -- --testPathPattern=stripe-idempotency` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts` — stubs for BILL-06 (single writer consolidation)
- [ ] `apps/functions/src/billing/__tests__/stripe-idempotency.test.ts` — BILL-08 emulator replay test (same eventId twice → 200, no mutation)
- [ ] `lru-cache` added to `apps/functions/package.json` — required for BILL-07

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| grep confirms zero parallel writers | BILL-06 | Requires human audit of grep output | `grep -rn "tenantRef\.(set\|update)" apps/functions/src/` must return zero billing state writes outside syncTenantPlanBillingSnapshot and exempt trial writes |
| TypeScript compiles without errors | BILL-06, BILL-07 | Build compilation | `cd apps/functions && npm run build` must exit 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
