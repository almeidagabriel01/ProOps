---
phase: 4
slug: financial-module-e2e
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (existing — Phase 1–3 infra confirmed) |
| **Config file** | `playwright.config.ts` (root) |
| **Quick run command** | `npx playwright test e2e/financial/ --project=chromium` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/financial/ --project=chromium`
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 04-01 Task 1 | 01 | 1 | FIN-01, FIN-02, FIN-03 | POM extension | `npx tsc --noEmit --project tsconfig.json 2>&1 \| tail -5` | ⬜ pending |
| 04-01 Task 2 | 01 | 1 | FIN-01, FIN-02, FIN-03 | E2E | `npx playwright test e2e/financial/transaction-crud.spec.ts --project=chromium` | ⬜ pending |
| 04-02 Task 1 | 02 | 2 | FIN-04, FIN-05 | POM + fixture | `npx tsc --noEmit --project tsconfig.json 2>&1 \| tail -5` | ⬜ pending |
| 04-02 Task 2 | 02 | 2 | FIN-04, FIN-05 | E2E | `npx playwright test e2e/financial/wallet-operations.spec.ts --project=chromium` | ⬜ pending |
| 04-03 Task 1 | 03 | 2 | FIN-06 | E2E Hybrid | `npx playwright test e2e/financial/installments.spec.ts --project=chromium` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave Structure

| Wave | Plans | Tasks | Requirements |
|------|-------|-------|--------------|
| 1 | 04-01 | Task 1 (POM), Task 2 (CRUD tests) | FIN-01, FIN-02, FIN-03 |
| 2 | 04-02, 04-03 | Task 1 (WalletsPage POM), Task 2 (wallet tests), Task 1 (installments test) | FIN-04, FIN-05, FIN-06 |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Installment API payload shape | FIN-06 | Field names assumed (A1) — must verify against `transactions.controller.ts` before implementing FIN-06 setup | Read `functions/src/api/controllers/transactions.controller.ts`, confirm `isInstallment`, `installmentCount`, `paymentMode`, `installmentsWallet` field names |
| Sequential installment payment enforcement | FIN-06 | UI toast validation — Playwright can assert toast text but must be manually confirmed once | Run test, attempt to mark installment 2 before 1, verify toast/rejection appears |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] All tasks green

**Approval:** pending
