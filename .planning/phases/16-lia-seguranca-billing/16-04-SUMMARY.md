---
phase: 16-lia-seguranca-billing
plan: 04
subsystem: frontend/lia
tags: [lia, usage-limits, ui, warning-banner]
requirements: [AIBI-05]

dependency_graph:
  requires: [16-01]
  provides: [near-limit-warning-banner]
  affects: [src/components/lia/lia-container.tsx]

tech_stack:
  added: []
  patterns: [session-only dismiss state via useState, conditional banner rendering in slot]

key_files:
  created: []
  modified:
    - src/components/lia/lia-container.tsx

decisions:
  - "Banner uses session-only useState (not localStorage) so it reappears on page reload — intentional per spec"
  - "Banner only visible when isNearLimit=true AND isAtLimit=false — avoids double-warning at 100% where input bar is already disabled"
  - "Fragment wrapper (<>) passes banner+LiaInputBar as a single ReactNode to the inputBar slot"
  - "Amber color scheme matches LiaUsageBadge amber state for visual consistency"

metrics:
  duration_minutes: 5
  completed_date: "2026-04-14T21:41:24Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 16 Plan 04: Near-Limit Warning Banner Summary

**One-liner:** Dismissible amber banner in Lia panel warns users at 80% monthly message usage with exact count and reset date in Portuguese.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add near-limit warning banner to LiaContainer | a1b072cf | src/components/lia/lia-container.tsx |

## What Was Built

Modified `LiaContainer` to render a dismissible amber warning banner between the chat window and input bar when `usage.isNearLimit` is true and `usage.isAtLimit` is false.

Key implementation details:
- `nearLimitDismissed` (useState) — session-only dismiss state, resets on page reload
- `showNearLimitBanner` — computed guard: `isNearLimit && !isAtLimit && !nearLimitDismissed`
- Banner text: "Você usou {N} de {M} mensagens este mês. Renova em {date}." (Portuguese)
- X button dismisses with `setNearLimitDismissed(true)` and has `aria-label="Fechar aviso de limite"`
- Amber Tailwind classes: `bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300`
- Fragment `<>` wraps banner and `LiaInputBar` to pass as single ReactNode to `inputBar` slot

## Verification

- `npx tsc --noEmit` — passes with 0 errors
- All acceptance criteria strings confirmed present in file
- `LiaInputBar` component remains intact with all original props

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — banner only shows user's own tenant usage data (enforced by Firestore rules at data source). Dismiss state is client-only UI preference with no security impact.

## Self-Check: PASSED

- File exists: src/components/lia/lia-container.tsx — FOUND
- Commit a1b072cf — FOUND (develop branch HEAD)
