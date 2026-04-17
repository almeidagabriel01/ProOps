---
phase: 15-lia-frontend-chat-ui
plan: "01"
subsystem: frontend
tags: [lia, chat, sse, streaming, types, service]
dependency_graph:
  requires: []
  provides: [sse-proxy-passthrough, frontend-ai-types, ai-service-streaming]
  affects: [src/app/api/backend, src/types, src/services]
tech_stack:
  added: [react-markdown@10.1.0, "@tailwindcss/typography@0.5.19", shadcn-collapsible]
  patterns: [SSE-passthrough, streaming-fetch-with-callbacks, AbortController-cancel]
key_files:
  created:
    - src/types/ai.ts
    - src/services/ai-service.ts
    - src/components/ui/collapsible.tsx
  modified:
    - src/app/api/backend/[...path]/route.ts
    - src/app/globals.css
    - package.json
decisions:
  - "SSE passthrough: detect via upstream content-type header (not request Accept) to avoid buffering"
  - "SSE timeout set to 60s (vs 30s standard) to accommodate long streaming responses"
  - "content-encoding added to SAFE_RESPONSE_HEADERS whitelist for correct SSE header passthrough"
  - "sendChatMessage fires fetch in IIFE microtask and returns AbortController immediately — caller can cancel before stream starts"
  - "AiApiError wraps non-2xx responses before streaming begins — separates protocol errors from stream errors"
metrics:
  duration_seconds: 259
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 15 Plan 01: SSE Proxy Passthrough, AI Types, and Streaming Service Summary

**One-liner:** Next.js API proxy patched for SSE passthrough with 60s timeout, frontend AI types mirroring backend contract, and sendChatMessage streaming fetch wrapper with AbortController cancellation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install dependencies and patch SSE proxy | 800b84a2 | route.ts, globals.css, collapsible.tsx, package.json |
| 2 | Create frontend AI types and ai-service.ts | e8cd77f6 | src/types/ai.ts, src/services/ai-service.ts |

## What Was Built

### SSE Proxy Patch (`src/app/api/backend/[...path]/route.ts`)

The existing proxy buffered all responses via `arrayBuffer()`, breaking SSE streaming. The patch:

- Added `SSE_TIMEOUT_MS = 60_000` (vs the 30s standard timeout)
- Detects SSE requests via the `Accept: text/event-stream` request header to select the longer timeout
- Detects SSE responses via upstream `content-type: text/event-stream` header
- Passes `upstreamResponse.body` (ReadableStream) directly for SSE — no buffering
- Added `content-encoding` to `SAFE_RESPONSE_HEADERS` whitelist

### Frontend AI Types (`src/types/ai.ts`)

Mirrors `functions/src/ai/ai.types.ts` with frontend-appropriate adaptations:
- `AiChatRequest`, `AiChatChunk`, `AiConversationMessage` — exact contract match
- `LiaMessage` — UI-layer type with `isStreaming`, `toolCalls`, `toolResults` fields
- `AiUsageData` — Firestore usage document type
- `AI_TIER_LIMITS` — client-side tier limits reference (starter/pro/enterprise)
- Timestamp replaced with `{ seconds; nanoseconds } | Date | string` union (no firebase-admin)

### Streaming Chat Service (`src/services/ai-service.ts`)

- `sendChatMessage(request, callbacks)` — POSTs to `/api/backend/v1/ai/chat` with `Accept: text/event-stream`
- Returns `AbortController` immediately (IIFE pattern) so caller can cancel the stream
- Parses SSE events via `\n\n` splitting and `data: ` prefix stripping
- `[DONE]` sentinel triggers `onDone()`; malformed chunks are silently skipped
- `AiApiError` class wraps non-2xx status codes before streaming begins
- Super admin `viewingAsTenant` header forwarded from `sessionStorage`

### Dependencies and UI

- `react-markdown@10.1.0` — for markdown prose rendering in chat messages
- `@tailwindcss/typography@0.5.19` — registered via `@plugin "@tailwindcss/typography"` in globals.css
- `shadcn/collapsible` — for collapsible tool result cards

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are fully implemented.

## Threat Surface Scan

All changes are consistent with the plan's threat model:

| T-ID | Component | Mitigation Applied |
|------|-----------|-------------------|
| T-15-01 | ai-service.ts | Firebase `getIdToken()` on every request; `Authorization` header forwarded |
| T-15-02 | route.ts | `SAFE_RESPONSE_HEADERS` whitelist enforced; internal headers blocked |
| T-15-03 | route.ts | `SSE_TIMEOUT_MS = 60_000` + AbortController kills connection after 60s |
| T-15-04 | ai-service.ts | `AiApiError` wraps status code only; raw error data not surfaced to user |

No new network endpoints, auth paths, or trust boundary changes beyond those in the plan.

## Self-Check: PASSED

- [x] `src/types/ai.ts` exists
- [x] `src/services/ai-service.ts` exists
- [x] `src/components/ui/collapsible.tsx` exists
- [x] Commits `800b84a2` and `e8cd77f6` exist in git log
- [x] `npx tsc --noEmit` passes with zero errors
