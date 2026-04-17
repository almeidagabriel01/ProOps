---
phase: 15-lia-frontend-chat-ui
plan: "04"
subsystem: frontend/lia
tags: [lia, ui-components, chat-panel, floating-button]
dependency_graph:
  requires: ["15-01", "15-02", "15-03"]
  provides: ["LiaTriggerButton", "LiaChatWindow", "LiaPanel"]
  affects: ["15-05", "15-06", "15-07"]
tech_stack:
  added: []
  patterns: ["composition slots via props", "CSS translate-x slide panel", "useEffect auto-scroll"]
key_files:
  created:
    - src/components/lia/lia-trigger-button.tsx
    - src/components/lia/lia-chat-window.tsx
    - src/components/lia/lia-panel.tsx
  modified: []
decisions:
  - "LiaPanel uses chatWindow/inputBar as ReactNode props (composition slots) instead of children to keep slot usage explicit"
  - "avatarColor falls back to hsl(var(--primary)) CSS variable when tenant.primaryColor is undefined"
  - "LiaTriggerButton uses relative span wrapper for icon cross-fade to avoid absolute-in-absolute stacking issues"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-14T13:54:48Z"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 15 Plan 04: LIA Shell UI Components Summary

Three structural Lia UI components: floating trigger button with animated icon swap, scrollable chat window with auto-scroll and typing indicator, and 420px slide-in panel with header composition slots.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create LiaTriggerButton | 70209cf3 | src/components/lia/lia-trigger-button.tsx |
| 2 | Create LiaChatWindow | e593cdc3 | src/components/lia/lia-chat-window.tsx |
| 3 | Create LiaPanel | b2fabbfb | src/components/lia/lia-panel.tsx |

## What Was Built

**LiaTriggerButton** (`lia-trigger-button.tsx`): Fixed 52x52px circular button at bottom-6 right-6. Sparkles icon transitions to X icon with 200ms opacity+rotate animation when `isOpen` changes. Pulse notification dot appears when `hasUnread && !isOpen`. Aria-labels swap between "Abrir Lia" and "Fechar Lia".

**LiaChatWindow** (`lia-chat-window.tsx`): Scrollable `role="log"` container with `aria-live="polite"`. Auto-scrolls to bottom via `scrollIntoView` in a `useEffect` triggered by `messages` and `isStreaming` changes. Shows `TypingIndicator` (three 8px dots with `animate-bounce` and staggered 0/150/300ms `animationDelay`) when `isStreaming` is true.

**LiaPanel** (`lia-panel.tsx`): Fixed 420px `<aside>` sliding in/out via `translate-x-0`/`translate-x-full` with 300ms ease-in-out transition. Header contains: avatar with tenant `primaryColor` background and "LI" initials, "Lia"/"Assistente ProOps" title block, usage badge slot prop, and MoreHorizontal dropdown with "Novo Chat" item. Accepts `chatWindow` and `inputBar` as explicit ReactNode slot props. Sets `aria-hidden={!isOpen}` per T-15-11 mitigation.

## Decisions Made

- **LiaPanel composition slots:** `chatWindow` and `inputBar` are named ReactNode props rather than a generic `children` to make slot usage explicit and type-safe at the callsite.
- **avatarColor fallback:** Falls back to `hsl(var(--primary))` CSS variable (string) when `tenant?.primaryColor` is undefined — no XSS vector since value is assigned to inline `style.backgroundColor`, not `innerHTML` (T-15-12 mitigated).
- **Icon cross-fade wrapper:** Sparkles and X icons sit inside a `relative w-5 h-5` span with each icon `absolute inset-0`. This avoids stacking context issues that arise from absolutely positioning elements directly inside a flex container.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no hardcoded empty values or placeholder data flows introduced in this plan.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] src/components/lia/lia-trigger-button.tsx exists
- [x] src/components/lia/lia-chat-window.tsx exists
- [x] src/components/lia/lia-panel.tsx exists
- [x] Commit 70209cf3 exists
- [x] Commit e593cdc3 exists
- [x] Commit b2fabbfb exists
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint` exits 0
