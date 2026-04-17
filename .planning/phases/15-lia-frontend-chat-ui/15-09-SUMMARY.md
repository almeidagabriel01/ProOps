---
phase: 15-lia-frontend-chat-ui
plan: "09"
subsystem: dashboard / proposal-service
tags: [bug-fix, null-safety, dashboard, proposals]
dependency_graph:
  requires: []
  provides: [null-safe-clientName-rendering]
  affects: [dashboard, proposal-service]
tech_stack:
  added: []
  patterns: [defensive-defaults-after-spread]
key_files:
  modified:
    - src/app/dashboard/_components/recent-lists.tsx
    - src/services/proposal-service.ts
decisions:
  - "clientName fallback placed after ...data spread in mapProposalDoc so it overrides any undefined value coming from Firestore"
  - "Rendering layer uses '??' as avatar fallback and 'Cliente sem nome' as display fallback — two distinct UX contexts need different strings"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_modified: 2
---

# Phase 15 Plan 09: Dashboard clientName Null Safety Summary

**One-liner:** Null-safe `clientName` access in dashboard avatar and display — fixes TypeError for Firestore proposals lacking the field via defensive default in `mapProposalDoc` and OR-fallback in `recent-lists.tsx`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add null-safe clientName access in recent-lists.tsx | a042d2f4 | src/app/dashboard/_components/recent-lists.tsx |
| 2 | Add clientName fallback in mapProposalDoc | a042d2f4 | src/services/proposal-service.ts |

## What Was Built

Fixed a dashboard `TypeError` that crashed the `RecentProposalsList` component when rendering proposals whose Firestore documents lacked a `clientName` field. The fix operates at two layers:

1. **Rendering layer** (`recent-lists.tsx`): replaced `p.clientName.substring(0, 2)` with `(p.clientName || "??").substring(0, 2)` at the avatar, and `{p.clientName}` with `{p.clientName || "Cliente sem nome"}` in the display text.

2. **Data mapping layer** (`proposal-service.ts`): added `clientName: (data.clientName as string) || ""` as an explicit field in `mapProposalDoc`'s return object, placed after the `...data` spread so it overrides any `undefined` coming from Firestore.

## Verification Results

- `npx tsc --noEmit` — zero errors
- `grep 'p.clientName.substring'` — no match (unsafe pattern removed)
- `grep '(p.clientName || "??").substring'` — match at line 157
- `grep 'p.clientName || "Cliente sem nome"'` — match at line 161
- `grep 'clientName: (data.clientName as string) || ""'` — match at line 203

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — changes are purely defensive read-side defaults; no new network endpoints or auth paths introduced.

## Self-Check: PASSED

- [x] `src/app/dashboard/_components/recent-lists.tsx` modified — FOUND
- [x] `src/services/proposal-service.ts` modified — FOUND
- [x] Commit a042d2f4 — FOUND
