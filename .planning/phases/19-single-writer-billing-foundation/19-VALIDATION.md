---
phase: 19
slug: single-writer-billing-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-07
updated: 2026-05-07
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

## Per-Plan Map

| Plan | Wave | Requirements | Notes |
|------|------|--------------|-------|
| 19-01 | 1 | BILL-06, BILL-07, BILL-08 | Wave 0 foundation: lru-cache install, SubscriptionSnapshot type, three test scaffolds (one per requirement). |
| 19-02 | 2 | BILL-06 | Extends syncTenantPlanBillingSnapshot to write subscription.* atomically; consolidates in-file webhook handlers; exports `beginStripeEventProcessing` for Plan 05 emulator replay test. |
| 19-03 | 3 | BILL-06 | Cross-file consolidation: billing-sync.service.ts, stripe.controller.ts, stripeHelpers.ts route through single writer; applyScheduledPlanChanges.ts adds subscription.* dotted-key writes inside its existing tx. |
| 19-04 | 2 | BILL-07 | Replaces unbounded Maps with LRUCache instances (max=500, ttl=30_000 hard-coded per CONTEXT.md) in require-active-subscription.ts and tenant-plan-policy.ts. |
| 19-05 | 3 | BILL-08 | Replaces Wave 0 BILL-08 scaffold with real unit tests on shouldSkipStripeEventRecord + emulator replay test that imports `beginStripeEventProcessing` (exported in Plan 02) and calls it twice with the same eventId. |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | BILL-06/07/08 (foundation) | unit | `cd apps/functions && npm run build` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | BILL-06 (types) | unit | `cd apps/functions && npm run build` | ✅ | ⬜ pending |
| 19-01-03 | 01 | 1 | BILL-06/07/08 (test scaffolds) | unit | `cd apps/functions && npm test -- --testPathPattern="(syncTenantPlanBillingSnapshot\|stripe-idempotency\|tenant-plan-policy.lru)"` | ✅ (after Task 1.3) | ⬜ pending |
| 19-02-01 | 02 | 2 | BILL-06 | unit + integration | `cd apps/functions && npm test -- --testPathPattern=syncTenantPlanBillingSnapshot` | ❌ W0 (Plan 01 Task 3) | ⬜ pending |
| 19-03-01 | 03 | 3 | BILL-06 | unit | `cd apps/functions && npm test -- --testPathPattern=billing` | ✅ | ⬜ pending |
| 19-03-02 | 03 | 3 | BILL-06 | unit | `cd apps/functions && npm test -- --testPathPattern=stripe` | ✅ | ⬜ pending |
| 19-03-03 | 03 | 3 | BILL-06 | unit | `cd apps/functions && npm test -- --testPathPattern=syncTenantPlanBillingSnapshot` | ❌ W0 (Plan 01 Task 3) | ⬜ pending |
| 19-04-01 | 04 | 2 | BILL-07 | unit | `cd apps/functions && npm test -- --testPathPattern=require-active-subscription --passWithNoTests` | ✅ | ⬜ pending |
| 19-04-02 | 04 | 2 | BILL-07 | unit | `cd apps/functions && npm test -- --testPathPattern=tenant-plan-policy` | ❌ W0 (Plan 01 Task 3) | ⬜ pending |
| 19-05-01 | 05 | 3 | BILL-08 | unit + integration (emulator) | `cd apps/functions && npm test -- --testPathPattern=stripe-idempotency` | ❌ W0 (Plan 01 Task 3) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 tasks are bundled inside Plan 01 (Task 3). They MUST execute before Plans 02, 04, and 05 can replace `test.todo` placeholders with real assertions.

- [ ] `apps/functions/src/billing/__tests__/syncTenantPlanBillingSnapshot.test.ts` — scaffold for BILL-06 (single writer + atomic subscription.* write); replaced with real assertions in Plan 02 + extended in Plan 03
- [ ] `apps/functions/src/billing/__tests__/stripe-idempotency.test.ts` — scaffold for BILL-08 (emulator replay); replaced with real assertions in Plan 05
- [ ] `apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts` — scaffold for BILL-07 (LRU eviction + TTL); replaced with real assertions in Plan 04
- [ ] `lru-cache@^11` added to `apps/functions/package.json` — required for BILL-07

`wave_0_complete: false` until Plan 01 has executed and committed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| grep confirms zero parallel writers | BILL-06 | Requires human audit of grep output for EXEMPT-comment classification | `grep -rn "tenantRef\.(set\|update)" apps/functions/src/` must return ONLY (a) syncTenantPlanBillingSnapshot body, (b) whatsappEnabled second writes (Pitfall 2), (c) lines preceded by `// EXEMPT:` comments (trial writes, billingSyncing flags, customer-id-only writes, applyScheduledPlanChanges' tx with subscription.* dotted keys) |
| TypeScript compiles without errors | BILL-06, BILL-07 | Build compilation | `cd apps/functions && npm run build` must exit 0 |
| Emulator replay assertion (Plan 05 integration test) | BILL-08 | Requires Firestore emulator running at FIRESTORE_EMULATOR_HOST | Start `firebase emulators:start --only firestore`, then `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 cd apps/functions && npm test -- --testPathPattern=stripe-idempotency`. The integration test calls `beginStripeEventProcessing` twice with the same eventId; first call returns "process", second returns "skip", Firestore status remains "processed". |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (Wave 0 itself shipped by Plan 01 Task 3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task in Plans 01-05 has at least one `<automated>` block)
- [x] Wave 0 covers all MISSING references (3 test scaffolds + lru-cache install bundled in Plan 01)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (jest --testPathPattern scoped runs complete in ~5-15s each)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved-after-revision (gap-closure for BILL-08 export decision recorded in Plans 02 + 05)
