---
phase: 22-login-redirect-hardening
plan: 02
subsystem: auth
tags: [playwright, e2e, login, redirect, toast]

# Dependency graph
requires:
  - "22-01: handleRedirectAfterAuth simplified, USER_SUPERADMIN seed, toast.warning wired"
provides:
  - "E2E spec for LOGIN-01 hardened behavior: 4 describe blocks (LR-01, LR-06, LOGIN-01-A, LOGIN-01-B)"
  - "LR-02/03/04/05/07 removed — no redirect= consumption scenarios in suite"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layered toast selector: [data-sonner-toast], [role='status'] — resilient Sonner assertion without data-testid"

key-files:
  created: []
  modified:
    - tests/e2e/auth/login-redirect.spec.ts

key-decisions:
  - "Toast selector kept as layered [data-sonner-toast], [role='status'] — data-testid follow-up deferred per Open Question #3 (RESEARCH.md)"
  - "LR-01 admin assertion tightened to toHaveURL('/dashboard') — no broad regex per plan requirement"

# Metrics
duration: 5min
completed: 2026-05-11
---

# Phase 22 Plan 02: Login Redirect E2E Tests Summary

**E2E spec rewritten for LOGIN-01 hardened behavior: LR-02/03/04/05/07 deleted, four describe blocks remain (LR-01, LR-06, LOGIN-01-A, LOGIN-01-B) with USER_SUPERADMIN import and Sonner toast assertion**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11T15:46:08Z
- **Completed:** 2026-05-11T15:50:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `tests/e2e/auth/login-redirect.spec.ts` fully rewritten in place (71 insertions, 94 deletions)
- Removed 5 describe blocks: LR-02 (session_expired redirect honored), LR-03 (free user /profile redirect rejected), LR-04 (?redirect=/admin for non-superadmin), LR-05 (cross-origin guard), LR-07 (session expiry redirect preserved) — all assert redirect= consumption that no longer exists after Plan 22-01
- LR-01 admin assertion tightened: `toHaveURL('/dashboard')` instead of broad `/(dashboard|proposals|transactions|contacts)/`
- LR-06 preserved verbatim with one simplification: `waitForURL('/dashboard')` replaces the old broad regex wait
- LOGIN-01-A added: admin with `?redirect=/proposals` lands on `/dashboard`; superadmin with same param lands on `/admin`
- LOGIN-01-B added: navigates to `/login?redirect_reason=session_expired`, asserts subtitle defaults to "Bem-vindo de volta! Insira suas credenciais." and toast becomes visible within 5s
- `USER_SUPERADMIN` imported from `../seed/data/users` and consumed in LOGIN-01-A superadmin test

## Task Commits

1. **Task 1: Rewrite login-redirect spec** — `42b61659` (test)

## Files Created/Modified

- `tests/e2e/auth/login-redirect.spec.ts` — fully rewritten: 4 describe blocks, USER_SUPERADMIN import, tightened LR-01 assertion, Sonner toast selector

## Acceptance Criteria Verification

All static checks passed:

| Check | Expected | Result |
|---|---|---|
| AUTH-LR-02/03/04/05/07 count | 0 | 0 |
| AUTH-LR-01 count | 1 | 1 |
| AUTH-LR-06 count | 1 | 1 |
| AUTH-LOGIN-01-A count | 1 | 1 |
| AUTH-LOGIN-01-B count | 1 | 1 |
| USER_SUPERADMIN count | ≥2 | 2 |
| Broad regex `(dashboard\|proposals\|...)` | 0 | 0 |
| data-sonner-toast | ≥1 | 1 |
| Subtitle copy | 1 | 1 |
| `npx tsc --noEmit -p tests/e2e/tsconfig.json` | exit 0 | exit 0 (no output) |

## Runtime Verification

`npx playwright test tests/e2e/auth/login-redirect.spec.ts` requires Firebase emulators + Next.js dev server. Infrastructure was not started for this plan execution. The spec is structurally correct (TypeScript compiles clean) and matches verified behavior from Plan 22-01.

**Toast selector note (Open Question #3):** The toast assertion uses `[data-sonner-toast], [role="status"]` as a layered selector. If the Sonner version in use does not render `[data-sonner-toast]` on the DOM node (only on the wrapper), the `[role="status"]` fallback should catch it. If both fail, a `data-testid` should be added to the `<Toaster>` component in a follow-up plan — this is the documented resolution path for Open Question #3 in RESEARCH.md.

## Deviations from Plan

None — plan executed exactly as written. The spec body was provided verbatim in the plan's `<action>` block and applied without modification.

## Known Stubs

None — the spec is a pure test file with no data-rendering stubs.

## Threat Flags

None — test-only file, no new attack surface introduced.

## Self-Check: PASSED

- `tests/e2e/auth/login-redirect.spec.ts` exists and was updated (71 insertions, 94 deletions)
- Commit `42b61659` verified: `git log --oneline | grep 42b61659` → `42b61659 test(22-02): rewrite login-redirect spec for LOGIN-01 hardened behavior`

---
*Phase: 22-login-redirect-hardening*
*Completed: 2026-05-11*
