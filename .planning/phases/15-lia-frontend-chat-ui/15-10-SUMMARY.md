---
phase: 15-lia-frontend-chat-ui
plan: 10
subsystem: frontend/lia
tags: [bug-fix, auth, lia, security]
requirements: [CHAT-08]

dependency_graph:
  requires: []
  provides: [auth-loading-safe-lia-guard]
  affects: [src/components/layout/protected-app-shell.tsx]

tech_stack:
  added: []
  patterns: [explicit-null-guard, auth-loading-safe-render]

key_files:
  modified:
    - src/components/layout/protected-app-shell.tsx

decisions:
  - "user !== null explicit check before user.role access — optional chaining user?.role returns undefined when user is null, which !== 'free' evaluated to true (auth bypass); explicit null check closes this gap"

metrics:
  duration_minutes: 3
  completed_date: "2026-04-14"
  tasks_completed: 1
  files_modified: 1
---

# Phase 15 Plan 10: Auth Loading LiaContainer Guard Fix Summary

One-line explicit null guard prevents LiaContainer from flashing for free plan users during the auth loading window.

## What Was Built

Fixed a logic bug in `protected-app-shell.tsx` where `user?.role !== "free"` evaluated to `true` when `user` was `null` (auth loading state), because `null?.role` returns `undefined` and `undefined !== "free"` is `true`. This caused `LiaContainer` to briefly render for ALL users — including free plan tenants — during the auth initialization window.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add `user !== null` check to LiaContainer guard | 9d837060 | protected-app-shell.tsx |

## Changes Made

**`src/components/layout/protected-app-shell.tsx` (line 33)**

Before:
```tsx
{planTier !== undefined && user?.role !== "free" && <LiaContainer />}
```

After:
```tsx
{planTier !== undefined && user !== null && user.role !== "free" && <LiaContainer />}
```

The three-part guard now correctly handles all states:
1. `planTier !== undefined` — waits for plan data to load
2. `user !== null` — waits for auth to finish loading (short-circuits to `false` when `user` is `null`)
3. `user.role !== "free"` — excludes free plan tenants

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with zero errors
- `grep 'user !== null && user.role !== "free"'` returns match at line 33
- `grep 'user?.role'` returns no results (optional chaining removed)
- Comment updated to document three-part guard semantics

## Known Stubs

None.

## Threat Flags

None. This fix closes threat T-15-10-01 (Elevation of Privilege) — free plan users can no longer access the Lia UI during the auth loading window.

## Self-Check: PASSED

- File `src/components/layout/protected-app-shell.tsx` exists and contains the fix
- Commit `9d837060` exists in git log
