---
phase: 14-lia-tool-system
plan: "04"
subsystem: ai
tags: [gemini, tool-calling, sse, streaming, context-builder]
dependency_graph:
  requires: ["14-02", "14-03"]
  provides: ["working-lia-tool-loop"]
  affects: ["functions/src/ai/chat.route.ts", "functions/src/ai/context-builder.ts", "functions/src/ai/index.ts"]
tech_stack:
  added: []
  patterns: ["Gemini multi-turn function calling", "SSE streaming with tool loop", "FunctionResponsePart typed multi-turn"]
key_files:
  created: []
  modified:
    - functions/src/ai/chat.route.ts
    - functions/src/ai/context-builder.ts
    - functions/src/ai/index.ts
decisions:
  - "FunctionResponsePart[] typed array satisfies sendMessageStream parameter — avoids the discriminant union mismatch with plain object literal"
  - "responseObj cast to object via intermediate variable (not double-cast) — result.data is unknown, coerced through explicit object assignment"
  - "whatsappEnabled extracted before try-block scope as let variable, set inside tenantSnap.exists guard — accessible to buildAvailableTools call"
metrics:
  duration: 4
  completed_date: "2026-04-13"
  tasks: 2
  files: 3
---

# Phase 14 Plan 04: Chat Route Tool Wiring Summary

**One-liner:** Gemini multi-turn tool calling loop wired into SSE chat route with FunctionResponsePart multi-turn, Phase 13 stub removed, system prompt updated with severity:high delete enforcement.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update chat.route.ts — replace stub with tool calling loop | 07f03cb9 | functions/src/ai/chat.route.ts |
| 2 | Update context-builder.ts and ai/index.ts barrel | debbe036 | functions/src/ai/context-builder.ts, functions/src/ai/index.ts |

## What Was Built

### Task 1: chat.route.ts — Full Tool Calling Loop

Replaced the Phase 13 stub (which only logged tool calls) with a working Gemini multi-turn function calling loop:

- Imports `buildAvailableTools` from `./tools/index` and `executeToolCall` from `./tools/executor`
- Extracts `whatsappEnabled` from tenant document and passes it to `buildAvailableTools`
- Passes `tools` array to `getGenerativeModel` via the `tools` parameter
- Builds `ToolCallContext` from auth context (`tenantId`, `uid`, `role`, `planTier`) plus `body.confirmed` for confirmation handshake
- Outer while loop (`MAX_TOOL_ROUNDS = 5`) prevents infinite model-driven tool loops
- Inner loop collects `functionCall` parts from each stream chunk
- Each tool call: sends `tool_call` SSE chunk → executes via `executeToolCall` → sends `tool_result` SSE chunk
- If `requiresConfirmation`: gets usage metadata, forces loop exit — frontend shows modal, user resends with `confirmed=true`
- Otherwise: builds `FunctionResponsePart[]` and calls `chat.sendMessageStream(functionResponseParts)` for next turn
- After loop: gets usage metadata from final stream, continues to usage increment and conversation save unchanged

### Task 2: context-builder.ts and index.ts barrel

- Removed `buildAvailableTools` stub from `context-builder.ts` (14 lines of dead code)
- Updated system prompt `# Tools disponíveis` section: now explains tools are available, filtered by plan/role/modules, with explicit `severity: "high"` instruction for DELETE confirmations
- Updated `functions/src/ai/index.ts` barrel to export `buildAvailableTools`, `executeToolCall`, `ToolCallContext`, `ToolCallResult`, and `ToolRegistryEntry` — making the full tool system importable from `../ai`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FunctionResponsePart TypeScript type mismatch**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `sendMessageStream(functionResponseParts)` received `Array<{ functionResponse: { name: string; response: unknown } }>` but SDK expects `(string | Part)[]`. The `Part` union has discriminant `never` fields that plain object literals don't satisfy.
- **Fix:** Imported `FunctionResponsePart` from `@google/generative-ai` and typed the array as `FunctionResponsePart[]`. Cast `result.data` to `object` via intermediate `responseObj: object` variable (since `FunctionResponse.response` requires `object`, not `unknown`).
- **Files modified:** `functions/src/ai/chat.route.ts`
- **Commit:** 07f03cb9

## Threat Model Verification

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-14-13 | MAX_TOOL_ROUNDS = 5 in outer while loop | Implemented |
| T-14-14 | confirmed from body.confirmed (not from model args) | Implemented — toolCtx.confirmed = body.confirmed |
| T-14-15 | tenantId, uid, role, planTier all from req.user | Implemented — ToolCallContext built from auth context only |

## Known Stubs

None — all stubs removed. The Phase 13 `buildAvailableTools` stub in `context-builder.ts` is deleted. The real implementation from Plan 02 is now wired in.

## Self-Check: PASSED
