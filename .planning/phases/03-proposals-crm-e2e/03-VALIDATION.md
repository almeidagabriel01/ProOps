---
phase: 3
slug: proposals-crm-e2e
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test e2e/proposals --reporter=line` |
| **Full suite command** | `npx playwright test --reporter=list` |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/proposals --reporter=line`
- **After every plan wave:** Run `npx playwright test --reporter=list`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | PROP-01 | e2e | `npx playwright test e2e/proposals/proposals.page.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | PROP-01 | e2e | `npx playwright test e2e/proposals/crud.spec.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | PROP-02 | e2e | `npx playwright test e2e/proposals/crud.spec.ts` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 1 | PROP-03 | e2e | `npx playwright test e2e/proposals/crud.spec.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | PROP-04 | e2e | `npx playwright test e2e/proposals/pdf.spec.ts` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 2 | PROP-05 | e2e | `npx playwright test e2e/proposals/share.spec.ts` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 2 | PROP-06 | e2e | `npx playwright test e2e/proposals/status.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/pages/proposals.page.ts` — extend ProposalsPage POM with `createProposal()`, `editProposal()`, `deleteProposal()`
- [ ] `e2e/proposals/crud.spec.ts` — stub file for PROP-01, PROP-02, PROP-03
- [ ] `e2e/proposals/pdf.spec.ts` — stub file for PROP-04
- [ ] `e2e/proposals/share.spec.ts` — stub file for PROP-05
- [ ] `e2e/proposals/status.spec.ts` — stub file for PROP-06

*Existing Playwright + Firebase Emulator infrastructure from Phase 2 is assumed. Wave 0 adds spec stubs only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF visual content quality | PROP-04 | Firebase Emulator doesn't run Chromium/Playwright server-side | Manually trigger `POST /api/backend/proposals/:id/pdf` in dev environment and inspect output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
