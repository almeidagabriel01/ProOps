---
phase: 11
slug: performance-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Test |
| **Config file** | `playwright.perf.config.ts` |
| **Quick run command** | `npx playwright test --config=playwright.perf.config.ts` |
| **Full suite command** | `npm run test:performance` |
| **Estimated runtime** | ~3-5 minutes (cold start); ~30s (reuse existing server) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --config=playwright.perf.config.ts`
- **After every plan wave:** Run `npm run test:performance`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (reuse mode)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PERF-04 | — | N/A | e2e performance | `npx playwright test --config=playwright.perf.config.ts` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | PERF-05 | — | N/A | e2e performance | `npx playwright test --config=playwright.perf.config.ts` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | PERF-06 | — | N/A | comment (no test) | `npx playwright test --config=playwright.perf.config.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/performance/core-web-vitals.spec.ts` — add `/contacts page performance` test case (PERF-04)
- [ ] `e2e/performance/core-web-vitals.spec.ts` — add `/products page performance` test case (PERF-05)
- [ ] `e2e/performance/api-baselines.spec.ts` — add clarifying comment block explaining Firestore-direct pattern (PERF-06)

*No new files to create. No new framework install needed. Both target files already exist.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI job `performance` in `.github/workflows/test-suite.yml` picks up new tests | PERF-04, PERF-05 | CI run required; local verification sufficient for plan | Push branch and confirm `performance` job passes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
