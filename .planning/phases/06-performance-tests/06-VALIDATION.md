---
phase: 6
slug: performance-tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Test |
| **Config file** | `playwright.perf.config.ts` (created in Wave 1) |
| **Quick run command** | `npx playwright test --config=playwright.perf.config.ts` |
| **Full suite command** | `npm run test:performance` |
| **Estimated runtime** | ~3–5 minutes (includes emulator + Next.js startup) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --config=playwright.perf.config.ts`
- **After every plan wave:** Run `npm run test:performance`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 minutes (dominated by emulator startup)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | PERF-01 | config | `npx playwright test --config=playwright.perf.config.ts --list` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | PERF-01 | e2e | `npm run test:performance` (core-web-vitals.spec.ts) | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 1 | PERF-03 | e2e | `npm run test:performance` (api-baselines.spec.ts) | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 2 | PERF-02 | ci | Validate `performance` job exists in test-suite.yml | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.perf.config.ts` — Playwright config pointing to `e2e/performance/`
- [ ] `e2e/performance/core-web-vitals.spec.ts` — test stubs (`test.todo()`) for 4 pages
- [ ] `e2e/performance/api-baselines.spec.ts` — test stubs for 2 API endpoints

*Wave 0 creates config and stubs so the suite can run (with skipped/todo tests) before implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI `performance` job fails when threshold is exceeded | PERF-02 | Requires a PR with a deliberately broken threshold to trigger CI failure | Temporarily set LCP threshold to 1ms, push branch, verify job fails in GitHub Actions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
