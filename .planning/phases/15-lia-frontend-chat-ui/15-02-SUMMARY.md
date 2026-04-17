---
phase: 15-lia-frontend-chat-ui
plan: 02
subsystem: ui
tags: [react, hooks, sse, streaming, ai, chat]

# Dependency graph
requires:
  - phase: 15-01
    provides: "ai-service.ts sendChatMessage(), AiStreamCallbacks, AiApiError; types/ai.ts LiaMessage, AiChatChunk, AiUsageData, AiChatRequest"
provides:
  - "useAiChat hook — single source of truth for Lia chat messages, streaming state, confirmation handshake, and usage tracking"
  - "PendingConfirmation interface — confirmation data shape for tool requiring user approval"
  - "UseAiChatReturn interface — full public API surface for the hook"
affects: [15-03, 15-04, 15-05, 15-06, 15-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-phase streaming render: isStreaming=true during SSE accumulation, false on [DONE] to switch LiaMessageBubble from raw text to ReactMarkdown"
    - "sendingRef (useRef boolean) prevents concurrent sends without triggering re-renders"
    - "AbortController stored in ref for clean stream cancellation on startNewSession"
    - "Confirmation gate: tool_result chunk with requiresConfirmation=true halts sends via pendingConfirmation state"
    - "doSend internal callback used by both sendMessage and confirmAction to avoid code duplication"
    - "Hardcoded error strings on onError/onChunk error type — raw server errors never reach the UI"

key-files:
  created:
    - src/hooks/useAiChat.ts
  modified: []

key-decisions:
  - "isOpen captured in doSend closure to drive hasUnread flag — if panel closed when onDone fires, set hasUnread=true"
  - "cancelAction injects synthetic model message 'Tudo bem! Nenhuma alteração foi feita.' rather than calling backend"
  - "doSend accepts confirmed? boolean param — only passed as true from confirmAction, never from sendMessage"

patterns-established:
  - "All Lia UI components read from and write to useAiChat exclusively — no direct state mutations from components"
  - "Error field on LiaMessage (not toast) for stream errors — keeps error in context of the message bubble"

requirements-completed: [CHAT-02, CHAT-04, CHAT-07]

# Metrics
duration: 5min
completed: 2026-04-14
---

# Phase 15 Plan 02: useAiChat Hook Summary

**useAiChat hook implementing two-phase SSE streaming, two-round-trip confirmation handshake, and concurrent-send protection via sendingRef**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-14T13:45:00Z
- **Completed:** 2026-04-14T13:48:08Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Full SSE streaming lifecycle: user bubble added → streaming Lia placeholder created → text chunks accumulated → isStreaming frozen on [DONE]
- Confirmation handshake: `tool_result` chunk with `requiresConfirmation` sets `pendingConfirmation`; `confirmAction()` resends original message with `confirmed: true` using same sessionId
- `cancelAction()` injects synthetic Lia cancel message without a backend round-trip
- `sendingRef` prevents concurrent sends; `AbortController` stored in ref allows clean cancellation on `startNewSession`
- Error messages are hardcoded Portuguese strings — raw server error bodies never reach the UI (T-15-07 mitigated)
- `hasUnread` flag set on `onDone` when panel is closed, cleared on `openPanel()`
- Usage state (`messagesUsed`, `totalTokensUsed`) updated from `usage` SSE chunk

## Task Commits

1. **Task 1: Create useAiChat hook** - `8c4c2b0d` (feat)

**Plan metadata:** _(added in final commit below)_

## Files Created/Modified

- `src/hooks/useAiChat.ts` — Core Lia chat hook: SSE streaming, confirmation handshake, usage tracking, panel open/close state

## Decisions Made

- `isOpen` captured in `doSend` closure to drive `hasUnread` — if panel is closed when `onDone` fires, `hasUnread=true`
- `cancelAction` injects synthetic model message instead of calling backend, matching the Phase 14 design where "Nenhuma alteração foi feita" is a frontend-only acknowledgement
- `doSend(text, sessionId, confirmed?)` internal callback shared by `sendMessage` and `confirmAction` to avoid duplication

## Deviations from Plan

None — plan executed exactly as written. The implementation matches the plan's TypeScript specification verbatim, with all acceptance criteria satisfied.

## Known Stubs

None — `useAiChat` does not contain hardcoded empty arrays, placeholder text, or unconnected data sources. `setMessages` and `setSessionId` are intentionally exposed for `useLiaSession` (Plan 03) to hydrate history.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The hook operates entirely client-side, consuming the ai-service contract established in Plan 01. STRIDE mitigations T-15-05, T-15-06, T-15-07 are all implemented as specified.

## Self-Check: PASSED

- `src/hooks/useAiChat.ts` exists: FOUND
- Commit `8c4c2b0d` exists: FOUND
- `npx tsc --noEmit` exits 0: CONFIRMED
- `grep confirmAction|cancelAction|pendingConfirmation`: matches found
- `grep confirmed.*true`: match found in confirmAction/doSend
