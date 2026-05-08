---
phase: 20
slug: subscription-state-banners-cancel-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright E2E + Jest (Firestore rules) |
| **Config file** | `playwright.config.ts` at repo root |
| **Quick run command** | `npm run test:rules` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~7 minutes (E2E sharded) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:rules`
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 420 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-W0-01 | Wave 0 | 0 | STATE-01/02/03 | E2E stub | `npm run test:e2e -- --grep "billing-state-banners"` | ❌ W0 | ⬜ pending |
| STATE-01 | TBD | 1 | STATE-01 | E2E smoke | `npm run test:e2e -- --grep "past_due banner"` | ❌ W0 | ⬜ pending |
| STATE-02 | TBD | 1 | STATE-02 | E2E smoke | `npm run test:e2e -- --grep "cancel period end banner"` | ❌ W0 | ⬜ pending |
| STATE-03 | TBD | 1 | STATE-03 | E2E smoke | `npm run test:e2e -- --grep "cancel subscription past_due"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/billing-state-banners.spec.ts` — stubs for STATE-01, STATE-02, STATE-03 smoke paths
- [ ] Test fixtures for mocking `subscriptionStatus: 'past_due'` and `cancelAtPeriodEnd: true` in auth state

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Red banner "Atualizar pagamento" CTA opens Stripe portal | STATE-01 | Requires live Stripe portal session URL | Click CTA in emulator env, verify redirect to Stripe portal |
| Yellow banner shows correct formatted cancellation date | STATE-02 | Requires real `cancelAt` timestamp in Firestore | Set `cancelAtPeriodEnd: true` + `cancelAt` in tenant doc, verify date format in banner |
| Immediate cancel AlertDialog copy communicates consequence | STATE-03 | Copy validation is visual | Trigger past_due cancel flow, verify dialog copy matches CONTEXT.md intent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 420s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
