---
phase: 15-lia-frontend-chat-ui
plan: "05"
subsystem: frontend/lia
tags: [lia, chat, components, streaming, markdown, input, usage]
dependency_graph:
  requires: ["15-01", "15-02", "15-03", "15-04"]
  provides: ["LiaMessageBubble", "LiaInputBar", "LiaUsageBadge"]
  affects: ["src/components/lia/"]
tech_stack:
  added: []
  patterns:
    - "Two-phase render: raw text during stream, ReactMarkdown post-stream"
    - "Auto-grow textarea capped at 5 lines (120px max height)"
    - "Custom Tooltip component wrapping disabled button for limit state"
key_files:
  created:
    - src/components/lia/lia-usage-badge.tsx
    - src/components/lia/lia-input-bar.tsx
  modified:
    - src/components/lia/lia-message-bubble.tsx
decisions:
  - "react-markdown v10 does not accept className prop on ReactMarkdown — wrapped in div with prose classes instead"
  - "Custom Tooltip API uses content prop directly (not TooltipContent/TooltipTrigger) — adapted LiaInputBar accordingly"
  - "LiaMessageBubble upgraded to use LiaToolResultCard immediately since file already existed from Plan 06 (executed before Plan 05)"
metrics:
  duration: 212
  completed_date: "2026-04-14"
  tasks_completed: 3
  files_changed: 3
requirements: [CHAT-03, CHAT-09]
---

# Phase 15 Plan 05: Interaction Components — LiaMessageBubble, LiaInputBar, LiaUsageBadge Summary

**One-liner:** Three user-facing interaction components — two-phase streaming/markdown message bubble, auto-grow input bar with keyboard shortcut, and three-state usage quota badge.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create LiaUsageBadge | 8060667b | src/components/lia/lia-usage-badge.tsx |
| 2 | Create LiaMessageBubble | b0ed832c | src/components/lia/lia-message-bubble.tsx |
| 3 | Create LiaInputBar | 90c54a71 | src/components/lia/lia-input-bar.tsx |

## What Was Built

**LiaUsageBadge** (`src/components/lia/lia-usage-badge.tsx`):
- Normal state (below 80%): `bg-secondary text-secondary-foreground`
- Near-limit state (80-99%): amber variant with dark mode support
- At-limit state (100%): `bg-destructive/10 text-destructive`
- `aria-label` with format "{used} de {limit} mensagens usadas"

**LiaMessageBubble** (`src/components/lia/lia-message-bubble.tsx`):
- User messages and streaming Lia messages: plain `<span>` text
- Post-stream Lia messages: `<div className="prose prose-sm dark:prose-invert">` wrapping `<ReactMarkdown>`
- Inline error badge with `bg-destructive/10 text-destructive` styling
- Tool results via `LiaToolResultCard` (collapsible, from Plan 06)
- User bubble: `rounded-tr-sm bg-card border border-border`
- Lia bubble: `rounded-tl-sm bg-muted`

**LiaInputBar** (`src/components/lia/lia-input-bar.tsx`):
- Auto-grow textarea: `el.style.height` updated on input, capped at `5 * 24 = 120px`
- Send button: 44x44px `SendHorizontal` icon, `aria-label="Enviar mensagem"`
- Textarea: `aria-label="Mensagem para Lia"`, disabled when `isAtLimit` or `isStreaming`
- Keyboard shortcut: `metaKey || ctrlKey` + `Enter` triggers `handleSend`
- Tooltip wraps send button when `isAtLimit`, showing "Limite atingido. Renova em {resetDate}."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-markdown v10 className prop not supported**
- **Found during:** Task 2
- **Issue:** `react-markdown` v10 `ReactMarkdown` component does not accept a `className` prop — TypeScript error TS2322
- **Fix:** Wrapped `<ReactMarkdown>` in a `<div className="prose prose-sm dark:prose-invert max-w-none">` instead
- **Files modified:** `src/components/lia/lia-message-bubble.tsx`
- **Commit:** b0ed832c

**2. [Rule 3 - Blocking] Custom Tooltip API differs from Radix pattern**
- **Found during:** Task 3
- **Issue:** Plan specified `TooltipProvider/TooltipTrigger/TooltipContent` (Radix API) but project uses a custom Tooltip with `content` prop and children as trigger
- **Fix:** Used `<Tooltip content="..." side="top">{sendButton}</Tooltip>` matching actual component API
- **Files modified:** `src/components/lia/lia-input-bar.tsx`
- **Commit:** 90c54a71

**3. [Rule 2 - Auto-upgrade] LiaToolResultCard already existed — upgraded inline display**
- **Found during:** Task 2 (ESLint auto-import ran)
- **Issue:** Plan said to use inline tool result display as stub for Plan 06, but `lia-tool-result-card.tsx` was already created (Plans 06 and 04 ran before 05 in execution order)
- **Fix:** ESLint auto-imported `LiaToolResultCard`; committed the upgrade as the correct final state
- **Files modified:** `src/components/lia/lia-message-bubble.tsx`
- **Commit:** 90c54a71

## Verification

- `npx tsc --noEmit` — PASSED (zero errors)
- `npm run lint` — PASSED (zero warnings)
- `grep ReactMarkdown src/components/lia/lia-message-bubble.tsx` — matches
- `grep "prose prose-sm" src/components/lia/lia-message-bubble.tsx` — matches
- `grep "SendHorizontal\|Enviar mensagem" src/components/lia/lia-input-bar.tsx` — matches
- `grep "isAtLimit\|isNearLimit" src/components/lia/lia-usage-badge.tsx` — matches

## Known Stubs

None — all components are fully wired. Tool results use real `LiaToolResultCard`.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `ReactMarkdown` XSS threat (T-15-13) is mitigated — react-markdown renders without `dangerouslySetInnerHTML` by default. The auto-grow DoS threat (T-15-14) is mitigated — height is capped at 120px.

## Self-Check: PASSED
