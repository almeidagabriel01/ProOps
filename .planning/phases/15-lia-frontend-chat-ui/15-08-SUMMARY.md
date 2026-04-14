---
phase: 15-lia-frontend-chat-ui
plan: "08"
subsystem: frontend
tags: [lia, plan-gating, auth, ui-guard]
dependency_graph:
  requires: [15-07]
  provides: [CHAT-08]
  affects: [src/components/layout/protected-app-shell.tsx, src/components/lia/lia-container.tsx]
tech_stack:
  added: []
  patterns: [useAuth role check for UI gating]
key_files:
  modified:
    - src/components/layout/protected-app-shell.tsx
    - src/components/lia/lia-container.tsx
decisions:
  - "Free plan UI gating uses user?.role !== 'free' from useAuth — not planTier, which maps free to starter"
metrics:
  duration: 5
  completed_date: "2026-04-14"
  tasks_completed: 1
  files_modified: 2
---

# Phase 15 Plan 08: Free Plan UI Gating for LiaContainer Summary

**One-liner:** Free-plan users excluded from LiaContainer via `useAuth().user?.role !== "free"` guard in ProtectedAppShell, closing CHAT-08 gap.

## What Was Built

Closed gap CHAT-08: free plan users (role === "free") no longer see the Lia trigger button or panel in the app shell. The guard in `ProtectedAppShell` was extended from `planTier !== undefined` to `planTier !== undefined && user?.role !== "free"`, using the `useAuth()` hook which is the only reliable free-plan signal on the frontend (`usePlanLimits` maps free to "starter", so `planTier` alone never signals free tier). `LiaContainer`'s JSDoc was updated to document the actual gating mechanism.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add free-plan guard to ProtectedAppShell and update LiaContainer JSDoc | fa544ba0 | protected-app-shell.tsx, lia-container.tsx |

## Decisions Made

- **`useAuth().user?.role` is the correct free-plan signal** — `usePlanLimits` maps the free tier to `planTier = "starter"` because `PlanTier` has no `"free"` value; the only reliable discriminant is the raw `role` field from `AuthContext`.
- **Guard expression is `planTier !== undefined && user?.role !== "free"`** — the `planTier !== undefined` check is preserved to suppress LiaContainer during the loading state (before plan data resolves); the role check adds the free-plan exclusion on top.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The UI guard (T-15-08-02) is implemented as planned. Backend enforcement remains a Phase 16 concern per T-15-08-01.

## Self-Check: PASSED

- `src/components/layout/protected-app-shell.tsx` — modified, committed at fa544ba0
- `src/components/lia/lia-container.tsx` — modified, committed at fa544ba0
- Commit fa544ba0 exists in git log
- `npx tsc --noEmit` exited with code 0
