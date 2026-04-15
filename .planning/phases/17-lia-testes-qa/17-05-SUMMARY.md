---
phase: 17-lia-testes-qa
plan: "05"
subsystem: e2e-tests
tags: [playwright, ai, tool-execution, gemini, firestore, role-gating]
dependency_graph:
  requires: [17-01]
  provides: [e2e/ai/tool-execution.spec.ts]
  affects: []
tech_stack:
  added: []
  patterns: [pure-api-sse-test, firestore-verification, skip-guard-pattern]
key_files:
  created:
    - e2e/ai/tool-execution.spec.ts
  modified: []
decisions:
  - "AI-05 requires temporarily upgrading ai-test tenant to enterprise plan before testing whatsapp module gating — the send_whatsapp_message tool requires enterprise plan rank, so testing module-only gating (whatsappEnabled: false) requires first satisfying the plan gate"
  - "AI-04 uses pure API approach (SSE fetch + Firestore verification) — more reliable than UI approach which requires handling Lia panel open, confirmation dialogs, and Gemini response timing"
  - "AI-11 Group B primary assertion is Firestore document existence — contact must survive the deletion attempt; tool_call absence is secondary confirmation"
metrics:
  duration_minutes: 1
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 17 Plan 05: AI Tool Execution E2E Tests Summary

**One-liner:** E2E tests for AI tool execution (AI-04 creates Firestore data, AI-05 module gating, AI-11 Group B member blocked from admin tools) with GEMINI_API_KEY skip guards.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | AI-04 tool creates real Firestore data test | e1322c3d | e2e/ai/tool-execution.spec.ts (created) |
| 2 | AI-05 inactive module refusal + AI-11 Group B member blocked | e1322c3d | e2e/ai/tool-execution.spec.ts (appended) |

Note: Both tasks target the same file. Task 1 created the file with AI-04 tests; Task 2 content was written in the same pass since the file had no prior state.

## What Was Built

`e2e/ai/tool-execution.spec.ts` — 318 lines, 3 describe blocks:

### AI-04: Tool execution creates real Firestore data
- Pure API test: signs in as `USER_AI_ADMIN`, sends SSE request asking Lia to create a contact
- Parses SSE response looking for `tool_call` event with `create_contact`
- Verifies Firestore `clients` collection has a document with `tenantId: "ai-test"` and `name: "Contato E2E AI Test"`
- `afterEach` cleans up created contacts by ID and by name query

### AI-05: Inactive module causes Lia to refuse
- Before test: temporarily upgrades `ai-test` tenant to `enterprise` plan AND sets `whatsappEnabled: false`
- Sends SSE request asking Lia to send a WhatsApp message
- Asserts `send_whatsapp_message` tool was NOT called (filtered out by `buildAvailableTools`)
- Asserts response does not contain success phrases
- `afterEach` restores tenant to `pro` plan with `whatsappEnabled: true`

### AI-11 Group B: Member blocked from admin tool execution
- Creates a target contact document in Firestore
- Signs in as `USER_AI_MEMBER` (role: "member")
- Asks Lia to delete the contact — `delete_contact` has `minRole: "admin"`
- Asserts `delete_contact` was NOT called (filtered by `buildAvailableTools` for member role)
- **Primary assertion:** contact document still exists after the attempt
- `afterEach` cleans up test contacts

## Key Design Decisions

**AI-05 enterprise plan upgrade:** The `send_whatsapp_message` tool requires `enterprise` plan AND `whatsappEnabled: true`. The `ai-test` tenant is `pro` plan. To isolate module gating (not plan gating), the test temporarily upgrades to `enterprise` before disabling `whatsappEnabled`. This makes the test precisely test module gating rather than plan gating.

**Pure API approach for AI-04:** The plan offered both UI and API approaches. The API approach was chosen because:
1. It avoids browser timing issues (Gemini response latency, panel animation)
2. No need to handle confirmation dialogs
3. `create_contact` does not use `request_confirmation` — it executes directly
4. SSE parsing is straightforward with `body.split("\n")`

**Firestore as authoritative assertion:** For AI-11 Group B, the primary assertion is `contactSnap.exists === true`. Even if SSE parsing fails or Gemini's response format changes, the Firestore check remains authoritative.

## Deviations from Plan

None — plan executed exactly as written. The plan's suggested code templates were used as the basis, with one clarification in AI-05: the enterprise plan upgrade was explicitly added to isolate module gating from plan gating (since `send_whatsapp_message` requires `enterprise` plan rank).

## Threat Model Coverage

| Threat | Mitigation |
|--------|-----------|
| T-17-07 (GEMINI_API_KEY disclosure) | `test.skip(!process.env.GEMINI_API_KEY)` at both describe and test level; key only available in CI via GitHub secrets |
| T-17-08 (AI-04 test data leakage) | `afterEach` cleans up by ID and by name query — covers all creation paths |
| T-17-09 (Member elevation via Lia) | AI-11 Group B verifies contact survives deletion attempt; tool_call absence confirms filtering worked |

## Self-Check

- [x] `e2e/ai/tool-execution.spec.ts` exists
- [x] Commit `e1322c3d` verified in git log
- [x] TypeScript compiles without errors (`npx tsc --noEmit --project e2e/tsconfig.json`)
- [x] Grep counts pass for all acceptance criteria
