---
phase: 18-fix-lia-5-corre-es-contador-de-uso-hist-rico-quebras-de-linha-minimizar-sem-perder-estado-tool-results-sem-json-bruto
plan: "02"
subsystem: ui
tags: [react, markdown, remark-breaks, lia, chat]

requires:
  - phase: 15-lia-chat-ui
    provides: lia-message-bubble.tsx and lia-tool-result-card.tsx components

provides:
  - whitespace-pre-wrap newline preservation in user/streaming messages
  - remark-breaks plugin for single-newline-to-br in post-stream markdown
  - inline chip design for tool result cards with expandable JSON details

affects: [lia, chat-ui, tool-results]

tech-stack:
  added: [remark-breaks@4.0.0]
  patterns:
    - "remark-breaks plugin on ReactMarkdown converts single \\n to <br> in rendered markdown"
    - "whitespace-pre-wrap on plain-text spans preserves newlines without markdown overhead"
    - "inline chip (rounded-full) collapses tool result metadata; JSON only visible after 'Ver detalhes'"

key-files:
  created: []
  modified:
    - src/components/lia/lia-message-bubble.tsx
    - src/components/lia/lia-tool-result-card.tsx
    - package.json

key-decisions:
  - "remark-breaks handles post-stream markdown newlines; whitespace-pre-wrap handles user/streaming plain-text spans — two separate rendering paths, two separate fixes"
  - "Tool result chip uses inline-flex not block — stays visually attached to message bubble without breaking layout"

patterns-established:
  - "Dual rendering path: user/streaming → whitespace-pre-wrap span; post-stream → ReactMarkdown with remarkBreaks"
  - "Tool results as inline chips: collapsed shows name+summary, expanded shows pre-formatted JSON"

requirements-completed: [BUG-3, BUG-5A]

duration: 5min
completed: "2026-04-15"
---

# Phase 18 Plan 02: Newline Preservation and Tool Result Chip Summary

**remark-breaks installed and whitespace-pre-wrap applied so multi-line messages display correctly; tool result cards replaced with inline chip badges that hide JSON until "Ver detalhes" is clicked**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-15T19:13:00Z
- **Completed:** 2026-04-15T19:18:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- User messages and streaming Lia messages now preserve newlines via `whitespace-pre-wrap` on the plain-text span
- Post-stream Lia markdown messages render single newlines as `<br>` elements via remark-breaks plugin
- Tool result cards redesigned from bordered card to compact `rounded-full` chip; raw JSON hidden by default behind "Ver detalhes" / "Recolher" toggle

## Task Commits

1. **Task 1: Install remark-breaks and fix newline rendering** - `129b2caa` (fix)
2. **Task 2: Redesign LiaToolResultCard as inline chip** - `c48f5b54` (fix)

## Files Created/Modified

- `src/components/lia/lia-message-bubble.tsx` - Added `remarkBreaks` import and plugin; added `whitespace-pre-wrap` to user/streaming span
- `src/components/lia/lia-tool-result-card.tsx` - Full redesign: bordered card → inline chip with expandable pre block; removed `ChevronDown` and `cn` imports
- `package.json` / `package-lock.json` - Added `remark-breaks@^4.0.0` dependency

## Decisions Made

- remark-breaks for post-stream markdown path; whitespace-pre-wrap for user/streaming plain-text path — different rendering contexts require different approaches
- No changes to `lia-input-bar.tsx` — `value.trim()` already preserves internal newlines (only strips leading/trailing whitespace)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Bug 3 (newlines) and Bug 5a (tool result JSON) are resolved
- Remaining Phase 18 plans can proceed: usage counter (18-01), history panel (18-03), minimize-without-losing-state (if applicable)

---
*Phase: 18-fix-lia-5-corre-es-contador-de-uso-hist-rico-quebras-de-linha-minimizar-sem-perder-estado-tool-results-sem-json-bruto*
*Completed: 2026-04-15*
