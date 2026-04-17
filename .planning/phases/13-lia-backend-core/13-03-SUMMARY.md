---
phase: 13-lia-backend-core
plan: "03"
subsystem: ai-backend
tags: [lia, ai, streaming, sse, firestore-rules, gemini]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [POST /v1/ai/chat SSE endpoint, aiRouter, Firestore rules for aiUsage and aiConversations]
  affects: [functions/src/api/index.ts, firestore.rules]
tech_stack:
  added: []
  patterns: [SSE streaming, Express Router, Gemini generateContentStream, res.setTimeout(0)]
key_files:
  created:
    - functions/src/ai/chat.route.ts
    - functions/src/ai/index.ts
  modified:
    - functions/src/api/index.ts
    - firestore.rules
decisions:
  - "Promise<void> return type on async route handler — use statement-then-return instead of return res.json() to satisfy TypeScript strict mode"
  - "AI route mounted after validateFirebaseIdToken and protectedLimiter — auth enforced globally, no per-route auth needed"
  - "res.setTimeout(0) called before SSE flushHeaders — disables the 20s protected route timeout for long-lived streaming connections"
  - "Tool calls from Gemini logged but not executed (Phase 3 stub) — functionCall parts forwarded to client as tool_call SSE chunks for future use"
metrics:
  duration_minutes: 20
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_changed: 4
---

# Phase 13 Plan 03: SSE Chat Route and Firestore Rules Summary

SSE streaming chat endpoint wiring all AI modules into POST /v1/ai/chat, registered in Express monolith with Gemini streaming, usage tracking, conversation persistence, and Firestore tenant-isolation rules.

## What Was Built

### Task 1: chat.route.ts and ai/index.ts

`functions/src/ai/chat.route.ts` — full SSE streaming handler for `POST /chat`:

1. Validates request body (message required, max 4000 chars, sanitized with `sanitizeText()`)
2. Resolves plan tier via `getTenantPlanProfile()` — always server-side, never from client
3. Blocks free tier with `403 AI_FREE_TIER_BLOCKED` before any AI processing
4. Checks monthly limit with `checkAiLimit()` — returns `429 AI_LIMIT_EXCEEDED` with `resetAt` ISO date
5. Selects Gemini model via `selectModel()` (includes Enterprise complexity routing)
6. Loads conversation history via `loadConversation()` (Pro/Enterprise only)
7. Fetches tenant name/niche from Firestore for system prompt context
8. Builds system prompt via `buildSystemPrompt()`
9. Disables route timeout with `res.setTimeout(0)`, sets SSE headers, flushes
10. Streams Gemini via `chat.sendMessageStream()` — writes `data: ${JSON.stringify(chunk)}\n\n` per text chunk
11. Logs tool calls as Phase 3 stubs (not executed)
12. After stream: increments usage with `incrementAiUsage()`, saves conversation with `saveConversation()`
13. Sends final `usage` SSE chunk and `data: [DONE]\n\n` sentinel
14. Error fallback: JSON if headers not sent; SSE error chunk if already streaming

`functions/src/ai/index.ts` — barrel re-exporting `aiRouter`.

### Task 2: Route Registration and Firestore Rules

`functions/src/api/index.ts`:
- Added `import { aiRouter } from "../ai"` alongside other route imports
- Added `app.use("/v1/ai", aiRouter)` after `notificationsRoutes`, before the global error handler
- Full path: `POST /v1/ai/chat` — protected by existing `validateFirebaseIdToken` and `protectedLimiter`

`firestore.rules`:
- `match /tenants/{tenantId}/aiUsage/{month}` — read if `isAuthenticated() && belongsToTenant(tenantId)`, write denied to clients
- `match /tenants/{tenantId}/aiConversations/{sessionId}` — read if authenticated, belongs to tenant, AND `resource.data.uid == request.auth.uid`; write denied to clients
- All writes go through Admin SDK in Cloud Functions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict return type on async route handler**
- **Found during:** Task 1 verification
- **Issue:** `router.post("/chat", async (req, res) => { ... })` with early `return res.status(...).json(...)` caused TS7030 ("Not all code paths return a value") because the function implicitly returns `undefined` but some branches return `Response`
- **Fix:** Added explicit `: Promise<void>` return type and changed all early exits from `return res.status(...).json(...)` to `res.status(...).json(...); return;` — matching TypeScript strict mode requirements
- **Files modified:** `functions/src/ai/chat.route.ts`
- **Commit:** ba4eb763

## Threat Model Coverage

All T-13-07 through T-13-12 mitigations applied:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-13-07 Spoofing | `tenantId` from `req.user` (auth middleware), never from request body |
| T-13-08 Tampering | `sanitizeText()` strips HTML; message capped at 4000 chars |
| T-13-09 Repudiation | `logger.error/info` logs all interactions with tenantId and uid |
| T-13-10 Information Disclosure | Firestore rules: aiConversations requires uid match; aiUsage requires tenant membership; writes denied |
| T-13-11 Denial of Service | `checkAiLimit()` enforces monthly cap; `protectedLimiter` rate-limits per-minute |
| T-13-12 Elevation of Privilege | Free tier blocked with 403 before any AI processing; tier resolved server-side |

## Known Stubs

- **Tool execution:** `buildAvailableTools()` returns `[]` (Phase 3 stub). Tool calls from Gemini are forwarded to client as `tool_call` SSE chunks but not executed. Tracked in Phase 3 (Tool System).

## Verification Results

1. `cd functions && npm run build` — exits 0
2. `cd functions && npm run lint` — passes, no new errors
3. `grep -n "aiRouter" functions/src/api/index.ts` — shows import (line 22) and registration (line 405)
4. `grep -n "aiUsage" firestore.rules` — shows new rule at line 433
5. `grep -n "aiConversations" firestore.rules` — shows new rule at line 441
6. Route path confirmed: `router.post("/chat")` mounted at `app.use("/v1/ai")` → `POST /v1/ai/chat`

## Self-Check: PASSED

- `functions/src/ai/chat.route.ts` — FOUND
- `functions/src/ai/index.ts` — FOUND
- Task 1 commit ba4eb763 — FOUND
- Task 2 commit e2e7177d — FOUND
