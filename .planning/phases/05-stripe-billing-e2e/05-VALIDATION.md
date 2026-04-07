---
phase: 5
slug: stripe-billing-e2e
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E) + Vitest/Jest (unit/integration) |
| **Config file** | `playwright.config.ts` (existing) |
| **Quick run command** | `npx playwright test --project=chromium e2e/billing/` |
| **Full suite command** | `npx playwright test e2e/billing/` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=chromium e2e/billing/`
- **After every plan wave:** Run `npx playwright test e2e/billing/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | BILL-01, BILL-02, BILL-03 (infra) | e2e | `npx tsc --noEmit --project e2e/tsconfig.json` | No | pending |
| 5-01-02 | 01 | 1 | BILL-01, BILL-02, BILL-03 | e2e | `npx playwright test e2e/billing/subscription.spec.ts --project=chromium` | No | pending |
| 5-02-01 | 02 | 2 | BILL-04 | e2e | `npx playwright test e2e/billing/plan-limits.spec.ts --project=chromium` | No | pending |
| 5-02-02 | 02 | 2 | BILL-05 | e2e | `npx playwright test e2e/billing/whatsapp-overage.spec.ts --project=chromium` | No | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `e2e/helpers/admin-firestore.ts` -- getTestDb() helper for Node-context Firestore access
- [ ] `e2e/seed/data/billing.ts` -- seedBillingState() and restoreTenantState() helpers
- [ ] `e2e/billing/subscription.spec.ts` -- BILL-01, BILL-02, BILL-03 subscription state transition tests
- [ ] `e2e/billing/plan-limits.spec.ts` -- BILL-04 plan limit enforcement tests
- [ ] `e2e/billing/whatsapp-overage.spec.ts` -- BILL-05 overage cron tests
- [ ] `functions/.env.local` with `CRON_SECRET=test-cron-secret` -- required for BILL-05 cron invocation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe webhook signature verification | BILL-02 | Requires real Stripe CLI or signed payload construction | Use `stripe trigger customer.subscription.created` with Stripe CLI pointing at local emulator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
