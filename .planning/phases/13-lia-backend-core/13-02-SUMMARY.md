---
phase: 13-lia-backend-core
plan: 02
subsystem: api
tags: [firebase, firestore, gemini, ai, lia, conversation, system-prompt]

# Dependency graph
requires:
  - phase: 13-01
    provides: "AI_LIMITS, TenantPlanTier, AiConversationDocument, AiConversationMessage types"
provides:
  - "conversation-store.ts: saveConversation and loadConversation for Pro/Enterprise plans"
  - "context-builder.ts: buildSystemPrompt with full Lia identity/rules template"
  - "context-builder.ts: buildAvailableTools stub returning [] for Phase 3"
affects: [13-03, 13-04, lia-backend-core]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Starter tier = no persistence (persistHistory=false), Pro/Enterprise = persist last 20 messages"
    - "Firestore path for conversation history: tenants/{tenantId}/aiConversations/{sessionId}"
    - "System prompt built dynamically per request from SystemPromptContext"
    - "MAX_STORED_MESSAGES = 20 (10 exchanges = user + model pair)"

key-files:
  created:
    - functions/src/ai/conversation-store.ts
    - functions/src/ai/context-builder.ts
  modified: []

key-decisions:
  - "Conversation store overwrites full document on each save (set without merge) — trimmed array is always authoritative"
  - "createdAt preserved on subsequent saves by reading existing doc before write"
  - "buildAvailableTools stub returns [] — real tool definitions deferred to Phase 3 Tool System"
  - "SystemPromptContext.tenantId included even though not used in Phase 2 prompt body — reserved for Phase 3 permission matrix"

patterns-established:
  - "Plan-gated persistence: check config.persistHistory before any Firestore read/write"
  - "Guard empty sessionId before Firestore operations to avoid doc at path with empty segment"

requirements-completed: [LIA-02]

# Metrics
duration: 2min
completed: 2026-04-13
---

# Phase 13 Plan 02: Lia Conversation Store and System Prompt Builder Summary

**Firestore conversation persistence for Pro/Enterprise plans (trimmed to 20 messages) and full dynamic Lia system prompt builder with all mandatory rules from 12-LIA-PROMPT.md**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T16:54:36Z
- **Completed:** 2026-04-13T16:55:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `loadConversation` returns `[]` for Starter (persistHistory=false) and empty sessionId; reads from Firestore for Pro/Enterprise
- `saveConversation` is a no-op for Starter; trims to last 20 messages and overwrites full document for Pro/Enterprise, preserving `createdAt`
- `buildSystemPrompt` generates the complete Lia identity prompt with dynamic tenant context, user role restrictions, contextual page hint, and all 19 mandatory rules
- `buildAvailableTools` stub returns `[]` for Phase 3 Tool System

## Task Commits

Each task was committed atomically:

1. **Task 1: Create conversation-store.ts** - `0733c476` (feat)
2. **Task 2: Create context-builder.ts** - `17916a60` (feat)

## Files Created/Modified
- `functions/src/ai/conversation-store.ts` - Conversation persistence: loadConversation and saveConversation with plan-tier gating
- `functions/src/ai/context-builder.ts` - System prompt builder: buildSystemPrompt (dynamic) and buildAvailableTools (stub)

## Decisions Made
- Conversation store uses full document overwrite (not merge) on save — trimmed message array is always the authoritative state
- `createdAt` is preserved on subsequent saves by reading the existing document before writing
- `buildAvailableTools` returns `[]` stub — real tool definitions come in Phase 3 (filtered by module, role, planTier)
- `SystemPromptContext` includes `tenantId` even though it is not used in Phase 2 prompt output — reserved for Phase 3 permission matrix and module list sections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- conversation-store.ts and context-builder.ts are ready for integration into the AI chat route handler (Plan 03)
- Phase 3 will replace the `buildAvailableTools` stub with real tool definitions from 12-TOOLS.md
- Firestore security rules for `tenants/{tenantId}/aiConversations/{sessionId}` should be added in Plan 03 (T-13-05)

---
*Phase: 13-lia-backend-core*
*Completed: 2026-04-13*
