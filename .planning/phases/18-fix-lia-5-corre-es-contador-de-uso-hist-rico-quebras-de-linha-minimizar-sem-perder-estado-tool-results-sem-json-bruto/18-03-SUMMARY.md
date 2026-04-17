---
phase: 18-fix-lia-5-corre-es-contador-de-uso-hist-rico-quebras-de-linha-minimizar-sem-perder-estado-tool-results-sem-json-bruto
plan: "03"
subsystem: ui
tags: [react, nextjs, hooks, localStorage, animation, lia, chat]

requires:
  - phase: 15-lia-frontend
    provides: LiaTriggerButton, LiaPanel, useLiaSession — original implementations this plan fixes
  - phase: 18-01
    provides: usage counter fixes that run alongside these panel/session fixes

provides:
  - LiaTriggerButton always mounted in DOM; CSS transition hides/shows on open (Bug 4 fixed)
  - useLiaSession deferred restoration pattern via isRestoredRef (Bug 2 fixed)
  - data-state attribute on LiaPanel aside element for testing/accessibility

affects:
  - lia-chat
  - session-persistence
  - pro-enterprise-history

tech-stack:
  added: []
  patterns:
    - "Always-mounted + CSS visibility: render trigger always, use opacity-0/scale-75/pointer-events-none to hide instead of conditional render"
    - "Deferred localStorage restoration: useRef guard (isRestoredRef) ensures persistence effect only fires after restoration effect has run"

key-files:
  created: []
  modified:
    - src/components/lia/lia-container.tsx
    - src/components/lia/lia-trigger-button.tsx
    - src/components/lia/lia-panel.tsx
    - src/hooks/useLiaSession.ts

key-decisions:
  - "Bug 4 fix: LiaTriggerButton is always mounted; isOpen prop drives CSS visibility classes (opacity-0 scale-75 pointer-events-none) instead of conditional render — preserves chat state across close/reopen"
  - "Bug 2 fix: sessionId useState initializer uses generateSessionId() directly (no localStorage read); restoration deferred to useEffect that fires once when persistHistory and tenantId are both available"
  - "isRestoredRef prevents persist effect from overwriting localStorage with random ID before restoration effect runs"

patterns-established:
  - "Always-mounted visibility pattern: applicable to any fixed-position widget that must preserve state across open/close cycles"
  - "isRestoredRef guard: prevents race between async data availability and synchronous initialization in useState"

requirements-completed: [BUG-4, BUG-2]

duration: 2min
completed: 2026-04-15
---

# Phase 18 Plan 03: Minimize Without Losing State + Session Restoration Summary

**LiaTriggerButton kept always-mounted with CSS fade/scale transitions, and Pro/Enterprise sessionId restoration deferred to useEffect with isRestoredRef guard to eliminate race condition**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-15T16:32:42Z
- **Completed:** 2026-04-15T16:34:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Removed `{!chat.isOpen && <LiaTriggerButton>}` conditional render — trigger is always in the DOM so closing the panel no longer unmounts the entire chat state tree
- Added `opacity-0 scale-75 pointer-events-none` / `opacity-100 scale-100 hover:scale-105` CSS transition classes to LiaTriggerButton; smooth 300ms fade-and-scale animation on open/close
- Fixed sessionId initialization race: `useState` no longer reads `localStorage` synchronously (when `tenantId` may still be null); restoration deferred to `useEffect` with `isRestoredRef` guard ensuring Pro/Enterprise users correctly recover their last session after auth context loads
- Added `data-state={isOpen ? "open" : "closed"}` to `<aside>` in LiaPanel for improved testability and accessibility tooling

## Task Commits

1. **Task 1: Always render LiaTriggerButton, CSS transitions for hide/show (Bug 4)** - `731d4bd2` (fix)
2. **Task 2: Defer sessionId restoration to useEffect, guard persist with isRestoredRef (Bug 2)** - `b14621bf` (fix)

## Files Created/Modified

- `src/components/lia/lia-container.tsx` - Removed conditional `{!chat.isOpen && ...}` wrapper; LiaTriggerButton now always rendered with `isOpen={chat.isOpen}`
- `src/components/lia/lia-trigger-button.tsx` - Replaced `hover:scale-105 transition-transform duration-200` with `transition-all duration-300` + conditional opacity/scale/pointer-events classes
- `src/components/lia/lia-panel.tsx` - Added `data-state={isOpen ? "open" : "closed"}` to aside element
- `src/hooks/useLiaSession.ts` - Added `useRef` import; replaced localStorage-reading useState initializer with `generateSessionId`; added `isRestoredRef` + restoration useEffect; guarded persist useEffect with `isRestoredRef.current`

## Decisions Made

- Bug 4 fix uses always-mount + CSS visibility pattern rather than React `key` reset or portal tricks — simplest approach with zero risk of state loss
- Bug 2 fix uses `useRef` (not `useState`) for `isRestoredRef` because the guard state does not need to trigger re-renders — ref mutation is sufficient and avoids extra render cycles

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Bug 4 (minimize loses state) and Bug 2 (sessionId race condition) both resolved
- Phase 18 plan 03 of 3 complete — all 5 Lia bug fixes across the phase should now be in place
- No blockers for next work

---
*Phase: 18-fix-lia-5-corre-es-contador-de-uso-hist-rico-quebras-de-linha-minimizar-sem-perder-estado-tool-results-sem-json-bruto*
*Completed: 2026-04-15*
