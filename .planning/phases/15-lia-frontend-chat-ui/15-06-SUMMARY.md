---
phase: 15-lia-frontend-chat-ui
plan: "06"
subsystem: frontend-components
tags: [lia, tool-results, confirmation-dialog, collapsible, radix]
dependency_graph:
  requires: ["15-01", "15-02", "15-03", "15-05"]
  provides: ["LiaToolResultCard", "LiaToolConfirmDialog"]
  affects: ["15-07"]
tech_stack:
  added: []
  patterns: [Radix-Collapsible, Radix-Dialog, chevron-rotation-animation, min-height-touch-target]
key_files:
  created:
    - src/components/lia/lia-tool-result-card.tsx
    - src/components/lia/lia-tool-confirm-dialog.tsx
  modified:
    - src/components/lia/lia-message-bubble.tsx
decisions:
  - "getSummary tries object.message, then count, then array length before falling back to 'Concluído'"
  - "formatResult uses JSON.stringify with null,2 indent — String() fallback on circular reference error"
  - "LiaToolConfirmDialog onOpenChange: fires onCancel when Radix closes via Escape/backdrop (not onConfirm)"
metrics:
  duration_seconds: 108
  completed_date: "2026-04-14T14:00:00Z"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 15 Plan 06: Tool Result Card and Confirm Dialog Summary

**One-liner:** Collapsible Radix tool result card with chevron animation and destructive action confirm dialog, plus LiaMessageBubble upgraded from inline stub to card components.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create LiaToolResultCard | 06d563e6 | src/components/lia/lia-tool-result-card.tsx |
| 2 | Create LiaToolConfirmDialog | e7a910ef | src/components/lia/lia-tool-confirm-dialog.tsx |
| 3 | Upgrade LiaMessageBubble | e84a5a55 | src/components/lia/lia-message-bubble.tsx |

## What Was Built

### LiaToolResultCard (`src/components/lia/lia-tool-result-card.tsx`)
- Radix `Collapsible` wrapper with controlled open state (`useState(false)` — collapsed by default)
- `CollapsibleTrigger`: wrench icon + tool name + 1-line summary + chevron
- Chevron uses `cn(... isOpen && "rotate-180")` with `transition-transform duration-200 ease-in-out`
- Collapsed header: `bg-muted/50 rounded-xl border border-border p-3`
- `CollapsibleContent`: full result in `<pre>` via `JSON.stringify(result, null, 2)`
- `getSummary()` helper: handles string truncation (80 chars), `object.message`, `count` field, array length
- `formatResult()` helper: JSON stringify with try/catch for circular references
- XSS safe: result rendered as text inside `<pre>`, no `dangerouslySetInnerHTML`

### LiaToolConfirmDialog (`src/components/lia/lia-tool-confirm-dialog.tsx`)
- Uses existing `dialog.tsx` Radix Dialog primitive (no new dependencies)
- Title: "Confirmar ação" with `AlertTriangle` icon when `severity === "high"`
- Body: `action` text + affected records list as styled badges
- Cancel button: `variant="outline"`, text "Não, manter", `min-h-[44px]`
- Confirm button: `variant="destructive"`, text "Confirmar", `min-h-[44px]`
- `onOpenChange`: fires `onCancel()` when dialog closes via Escape or backdrop click (T-15-15 mitigated)

### LiaMessageBubble upgrade (`src/components/lia/lia-message-bubble.tsx`)
- Added import: `import { LiaToolResultCard } from "./lia-tool-result-card"`
- Removed: `ToolResultInline` inline function stub (15 lines)
- Replaced: tool results `div` now renders `<LiaToolResultCard key={i} toolName={tr.name} result={tr.result} />`
- Container spacing changed from `mt-2` to `mt-1` to match card's own `mt-2` internal margin

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary crossings introduced. T-15-15 (dialog close triggers onCancel) and T-15-16 (XSS via pre+JSON.stringify) both mitigated as planned.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| lia-tool-result-card.tsx exists | FOUND |
| lia-tool-confirm-dialog.tsx exists | FOUND |
| lia-message-bubble.tsx exists | FOUND |
| Commit 06d563e6 exists | FOUND |
| Commit e7a910ef exists | FOUND |
| Commit e84a5a55 exists | FOUND |
