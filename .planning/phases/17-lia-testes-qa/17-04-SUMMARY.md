---
phase: 17-lia-testes-qa
plan: "04"
subsystem: e2e-tests
tags: [playwright, e2e, ai-isolation, multi-tenant, rbac, delete-confirmation]
dependency_graph:
  requires: [17-01]
  provides: [AI-10-tests, AI-11-tests, AI-12-tests]
  affects: [e2e/ai/isolation.spec.ts]
tech_stack:
  added: []
  patterns:
    - Playwright page.route() SSE mock for tool_result chunk injection
    - Firebase Auth emulator JWT decode for custom claims verification
    - Admin SDK Firestore subcollection scoping isolation test
key_files:
  created:
    - e2e/ai/isolation.spec.ts
  modified: []
decisions:
  - Dialog role is dialog (Shadcn Dialog) not alertdialog — plan described AlertDialog but actual component is Dialog
  - Cancel button text is "Nao, manter" (from lia-tool-confirm-dialog.tsx) — plan said "Cancelar"
  - toolCall chunk uses name field not toolName (verified against src/types/ai.ts AiChatChunk)
  - confirmationData shape is { action, affectedRecords, severity } not { action, entity, entityName, message } as plan proposed
  - decodeJwtPayload imported from firebase-auth-api helper — already exists, no need to inline base64 decode
metrics:
  duration_seconds: 480
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 17 Plan 04: AI Isolation, Member Role, and Delete Confirmation E2E Tests Summary

**One-liner:** Playwright E2E tests for cross-tenant Firestore isolation (AI-10), member JWT claims verification (AI-11), and mocked SSE tool_result delete confirmation dialog (AI-12).

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Write AI-10 cross-tenant isolation and AI-11 member role restriction tests | f00a2a13 | e2e/ai/isolation.spec.ts (created) |
| 2 | Write AI-12 delete confirmation dialog test | f00a2a13 | e2e/ai/isolation.spec.ts (appended) |

Both tasks were implemented together into the single file in one commit (Task 2 extends Task 1's file).

## What Was Built

`e2e/ai/isolation.spec.ts` contains:

**AI-10 describe block (2 tests):**
- Test 1: Sends chat request with a sessionId formatted to look like a tenant-alpha session. Verifies the backend scopes the request to ai-test and does not return a tenant mismatch 403.
- Test 2: Seeds a conversation in `tenants/tenant-alpha/aiConversations/cross-test-session`, then queries `tenants/ai-test/aiConversations` and asserts the cross-tenant doc is not present. Cleans up afterward.

**AI-11 describe block (2 tests):**
- Test 1: Signs in as USER_AI_MEMBER and sends a chat request. Verifies response is NOT 403 (members are allowed at the endpoint level; only restricted at tool executor level).
- Test 2: Signs in as USER_AI_MEMBER, decodes JWT payload via `decodeJwtPayload()`, and asserts `role === "member"`, `tenantId === "ai-test"`, `masterId === "ai-admin-uid"`.

**AI-12 describe block (2 tests):**
- Test 1 (primary): Uses `page.route("**/api/backend/v1/ai/chat")` to mock SSE response with a `tool_call` chunk followed by a `tool_result` chunk with `requiresConfirmation: true`. Logs in as USER_AI_ADMIN, opens Lia, sends a message, waits for `role="dialog"` to appear, asserts "João Silva" in dialog text, clicks "Não, manter", asserts dialog closes.
- Test 2 (Group B stub): Guarded with `test.skip(!process.env.GEMINI_API_KEY, ...)` — deferred to plan 17-05.

## Deviations from Plan

**1. [Rule 1 - Bug] Corrected SSE chunk field names against actual types**
- **Found during:** Task 2 analysis (read src/types/ai.ts)
- **Issue:** Plan proposed `toolCall: { toolName, args }` but actual type is `toolCall: { name, args }`
- **Fix:** Used `name` field in mock `tool_call` chunk as defined in `AiChatChunk` interface
- **Files modified:** e2e/ai/isolation.spec.ts

**2. [Rule 1 - Bug] Corrected confirmationData shape**
- **Found during:** Task 2 analysis (read src/components/lia/lia-tool-confirm-dialog.tsx and src/types/ai.ts)
- **Issue:** Plan proposed `{ action, entity, entityName, message }` but actual shape is `{ action: string; affectedRecords: string[]; severity: "low" | "high" }`
- **Fix:** Used correct shape with `affectedRecords: ["João Silva"]`
- **Files modified:** e2e/ai/isolation.spec.ts

**3. [Rule 1 - Bug] Corrected dialog role selector**
- **Found during:** Task 2 analysis (read src/components/lia/lia-tool-confirm-dialog.tsx)
- **Issue:** Plan used `page.getByRole("alertdialog")` but component uses Shadcn `Dialog` which renders as `role="dialog"`
- **Fix:** Changed selector to `page.getByRole("dialog")`
- **Files modified:** e2e/ai/isolation.spec.ts

**4. [Rule 1 - Bug] Corrected cancel button text**
- **Found during:** Task 2 analysis (read src/components/lia/lia-tool-confirm-dialog.tsx)
- **Issue:** Plan used `/cancelar/i` but actual button text is "Não, manter"
- **Fix:** Used `/não, manter/i` regex for button locator
- **Files modified:** e2e/ai/isolation.spec.ts

**5. [Rule 2 - Enhancement] Used existing decodeJwtPayload helper**
- **Found during:** Task 1 implementation
- **Issue:** Plan inlined a base64 decode for JWT payload, but `firebase-auth-api.ts` already exports `decodeJwtPayload()`
- **Fix:** Imported and used the existing helper instead of duplicating logic
- **Files modified:** e2e/ai/isolation.spec.ts

## Known Stubs

None — all tests have concrete assertions. Group B (GEMINI_API_KEY) test is explicitly skipped with a guard, not stubbed.

## Threat Flags

None — this plan creates E2E test files only. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] e2e/ai/isolation.spec.ts exists
- [x] Commit f00a2a13 exists in git log
- [x] AI-10, AI-11, AI-12 describe blocks verified via grep (26+ matches for AI-10/11, 24+ for AI-12)
- [x] No file deletions in commit
