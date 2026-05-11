---
phase: 22
slug: login-redirect-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E) + Vitest (unit, `apps/web`) |
| **Config file** | `playwright.config.ts` (root), `apps/web/vitest.config.ts` |
| **Quick run command** | `npm run lint` (in `apps/web/`) |
| **Full suite command** | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` |
| **Estimated runtime** | ~30s (lint), ~2 min (E2E spec file) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` in `apps/web/` (catches unused imports instantly)
- **After every plan wave:** Run `npx playwright test tests/e2e/auth/login-redirect.spec.ts`
- **Before `/gsd:verify-work`:** Full E2E suite must be green
- **Max feedback latency:** ~30 seconds (lint), ~120 seconds (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-W0-01 | seed | 0 | LOGIN-01 | E2E seed | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` | ❌ W0 | ⬜ pending |
| 22-01-01 | 01 | 1 | LOGIN-01 | lint | `cd apps/web && npm run lint` | ✅ | ⬜ pending |
| 22-01-02 | 01 | 1 | LOGIN-01 | lint | `cd apps/web && npm run lint` | ✅ | ⬜ pending |
| 22-01-03 | 01 | 1 | LOGIN-01 | lint | `cd apps/web && npm run lint` | ✅ | ⬜ pending |
| 22-02-01 | 02 | 1 | LOGIN-01 | E2E | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/seed/data/users.ts` — add `SeedUserSuperadminRole` interface and `USER_SUPERADMIN` constant; seed the user in `seedUsers()`. Required by the new superadmin E2E scenario in plan 02.

*All other infrastructure (Playwright, `LoginPage` POM, existing test file) already exists.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast is visible at top-center of screen | LOGIN-01 | Toast selector may vary (`[data-sonner-toast]` vs `[role="status"]`) | Navigate to `/login?redirect_reason=session_expired` while logged out; confirm warning toast appears before submitting credentials |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
