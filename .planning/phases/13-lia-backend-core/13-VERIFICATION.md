---
phase: 13-lia-backend-core
verified: 2026-04-13T17:05:34Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run the full test suite against Firebase emulators: `npm run test:e2e && npm run test:rules` from project root with emulators running"
    expected: "All existing tests pass without regression; no failures caused by new AI route or Firestore rules"
    why_human: "Cannot run emulator stack statically. The criterion 'Todos os testes passam nos emuladores Firebase locais' requires the live emulator environment. No AI-specific tests (Firestore rules for aiUsage/aiConversations, or E2E for /v1/ai/chat) were written in this phase — the criterion passes only if the existing suite does not regress."
---

# Phase 13: Lia — Backend Core Verification Report

**Phase Goal:** API de chat com streaming SSE, integração com Gemini, controle de usage mensal, persistência de conversa Pro/Enterprise, e rota Express `/v1/ai/chat` integrada ao monolito.
**Verified:** 2026-04-13T17:05:34Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `POST /v1/ai/chat` recebe mensagem e retorna streaming SSE com resposta da Lia via Gemini | VERIFIED | `chat.route.ts` exports `aiRouter`; SSE headers set (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`); streams via `model.startChat().sendMessageStream()`; writes `data: ${JSON.stringify(chunk)}\n\n` per chunk; sends `data: [DONE]\n\n` sentinel; registered at `app.use("/v1/ai", aiRouter)` after `validateFirebaseIdToken` |
| 2 | Tenant Free recebe 403; tenant com limite esgotado recebe 429 com `resetAt` | VERIFIED | `chat.route.ts` lines 49-55: `planProfile.tier === "free"` → `res.status(403)` with `code: "AI_FREE_TIER_BLOCKED"`; lines 61-70: `!limitCheck.allowed` → `res.status(429)` with `resetAt: limitCheck.resetAt`; `resetAt` sourced from `buildMonthlyPeriodWindowUtc()` in usage-tracker.ts |
| 3 | `aiUsage/{YYYY-MM}` incrementado atomicamente após cada mensagem processada | VERIFIED | `usage-tracker.ts` lines 62-73: `FieldValue.increment(1)` for `messagesUsed`, `FieldValue.increment(tokensUsed)` for `totalTokensUsed`, `{ merge: true }` ensures atomic create-or-increment; Firestore path: `tenants/{tenantId}/aiUsage/{YYYY-MM}` via `buildMonthlyPeriodKeyUtc()`; called in `chat.route.ts` line 182 after stream completes |
| 4 | Histórico persiste em `aiConversations/{sessionId}` para planos Pro/Enterprise; Starter retorna array vazio | VERIFIED | `conversation-store.ts`: `loadConversation` returns `[]` when `config.persistHistory === false` (Starter); reads Firestore for Pro/Enterprise; `saveConversation` is no-op for Starter, overwrites full document trimmed to `messages.slice(-20)` for Pro/Enterprise; Firestore path: `tenants/{tenantId}/aiConversations/{sessionId}` |
| 5 | Todos os testes passam nos emuladores Firebase locais | HUMAN NEEDED | No AI-specific test files found. `tests/firestore-rules/firestore.rules.test.ts` has no coverage for `aiUsage` or `aiConversations` collections. Cannot verify emulator test pass/fail statically. |

**Score:** 4/5 truths verified (1 requires human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/ai/ai.types.ts` | AI_LIMITS constant, all TypeScript interfaces | VERIFIED | Exports `AI_LIMITS` (starter/pro/enterprise with correct values), `ENTERPRISE_PRO_KEYWORDS`, `ENTERPRISE_PRO_MODEL`, `AiLimitConfig`, `AiUsageDocument`, `AiConversationDocument`, `AiConversationMessage`, `AiChatRequest`, `AiChatChunk`, `ModelSelection`, `TenantPlanTier` |
| `functions/src/ai/model-router.ts` | selectModel() mapping plan tier to Gemini model | VERIFIED | Exports `selectModel`; throws for free tier with "Plano Free não tem acesso à Lia"; Enterprise keyword routing to `gemini-2.5-pro-preview-05-06`; imports `AI_LIMITS` from `ai.types` |
| `functions/src/ai/usage-tracker.ts` | AI usage check, increment, and read functions | VERIFIED | Exports `checkAiLimit`, `incrementAiUsage`, `getAiUsage`, `AiLimitCheckResult`; atomic increment with `FieldValue.increment + merge:true`; correct Firestore path |
| `functions/src/ai/conversation-store.ts` | Conversation persistence for Pro/Enterprise | VERIFIED | Exports `saveConversation`, `loadConversation`; plan-gated by `persistHistory`; trims to 20 messages; preserves `createdAt` on update |
| `functions/src/ai/context-builder.ts` | System prompt builder and tools stub | VERIFIED | Exports `buildSystemPrompt` (full Lia identity + 19 rules + dynamic context) and `buildAvailableTools` (returns `[]` — intentional Phase 3 stub) |
| `functions/src/ai/chat.route.ts` | Express route handler for POST /ai/chat with SSE streaming | VERIFIED | Full SSE streaming handler; all error paths (401, 400, 403, 429, 500); sanitizes input; uses all AI module functions |
| `functions/src/ai/index.ts` | Module barrel export | VERIFIED | `export { aiRouter } from "./chat.route"` |
| `functions/src/api/index.ts` | Registration of /v1/ai route in Express monolith | VERIFIED | Line 22: `import { aiRouter } from "../ai"`; Line 405: `app.use("/v1/ai", aiRouter)` — after `validateFirebaseIdToken` (line 372) and `protectedLimiter` (line 373) |
| `firestore.rules` | Security rules for aiUsage and aiConversations | VERIFIED | `match /tenants/{tenantId}/aiUsage/{month}`: read if `isAuthenticated() && belongsToTenant(tenantId)`, write `if false`; `match /tenants/{tenantId}/aiConversations/{sessionId}`: read requires uid match + tenant membership, write `if false` |
| `functions/package.json` | @google/generative-ai dependency | VERIFIED | `"@google/generative-ai": "^0.24.1"` in dependencies |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `model-router.ts` | `ai.types.ts` | `import AI_LIMITS` | WIRED | Line 1-7: imports `AI_LIMITS, ENTERPRISE_PRO_KEYWORDS, ENTERPRISE_PRO_MODEL` from `./ai.types` |
| `usage-tracker.ts` | `ai.types.ts` | `import AI_LIMITS, AiUsageDocument` | WIRED | Line 3: `import { AI_LIMITS, type AiUsageDocument, type TenantPlanTier } from "./ai.types"` |
| `conversation-store.ts` | `ai.types.ts` | `import AI_LIMITS, AiConversationDocument, AiConversationMessage` | WIRED | Line 4-8: imports all required types from `./ai.types` |
| `context-builder.ts` | `ai.types.ts` | `import TenantPlanTier` | WIRED | Line 1: `import { AI_LIMITS, type TenantPlanTier } from "./ai.types"` |
| `chat.route.ts` | `model-router.ts` | `import selectModel` | WIRED | Line 8: `import { selectModel } from "./model-router"`; used at line 73 |
| `chat.route.ts` | `usage-tracker.ts` | `import checkAiLimit, incrementAiUsage` | WIRED | Line 9: `import { checkAiLimit, incrementAiUsage, getAiUsage } from "./usage-tracker"`; used at lines 60, 182, 194 |
| `chat.route.ts` | `conversation-store.ts` | `import loadConversation, saveConversation` | WIRED | Line 10: `import { loadConversation, saveConversation } from "./conversation-store"`; used at lines 76, 191 |
| `chat.route.ts` | `context-builder.ts` | `import buildSystemPrompt, buildAvailableTools` | WIRED | Line 11: `import { buildSystemPrompt } from "./context-builder"`; used at line 92. Note: `buildAvailableTools` imported in plan but not imported in actual file — not needed for Phase 2 since tools are empty |
| `api/index.ts` | `ai/index.ts` | `import aiRouter; app.use("/v1/ai")` | WIRED | Line 22: `import { aiRouter } from "../ai"`; line 405: `app.use("/v1/ai", aiRouter)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `chat.route.ts` | `planProfile.tier` | `getTenantPlanProfile(user.tenantId)` reads Firestore `users/{uid}` | Yes — real Firestore read | FLOWING |
| `chat.route.ts` | `limitCheck` | `checkAiLimit()` reads `tenants/{tenantId}/aiUsage/{YYYY-MM}` | Yes — real Firestore read | FLOWING |
| `chat.route.ts` | `history` (conversation) | `loadConversation()` reads `tenants/{tenantId}/aiConversations/{sessionId}` | Yes — real Firestore read (empty for Starter — by design) | FLOWING |
| `chat.route.ts` | `streamResult` | `chat.sendMessageStream(message)` calls Gemini API | Yes — real Gemini API call (requires `GEMINI_API_KEY`) | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running Firebase emulators and a valid GEMINI_API_KEY — neither available in this static verification environment)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIA-02 | 13-01, 13-02, 13-03 | Lia AI assistant backend (SSE chat, usage tracking, conversation persistence, model routing, Firestore rules) | SATISFIED | All artifacts implementing LIA-02 exist, are substantive, and are wired. The full AI backend module is complete and integrated. |

**Note on REQUIREMENTS.md:** `LIA-02` does not appear in `.planning/REQUIREMENTS.md`, which tracks a separate testing-suite milestone. LIA-02 is defined in the ROADMAP.md Lia feature milestone. There is no orphaned requirement mismatch — the REQUIREMENTS.md file is scoped to a different milestone and does not cover Lia feature requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `context-builder.ts` | 21 | JSDoc comment: "module/limits/permissions sections use simplified placeholders" | Info | Comment documents a Phase 3 design decision — not a code stub. The function is fully implemented with a real system prompt and all 19 mandatory rules. |
| `context-builder.ts` | 121 | `return []` in `buildAvailableTools()` | Info | Intentional Phase 3 stub. Explicitly documented: "Phase 3 will replace this with real tool definitions." This is correct behavior for Phase 2 — no tools are registered yet. |
| `functions/.env.example` | — | `GEMINI_API_KEY` missing from env example | Warning | New required env var not documented in `.env.example`. Developers onboarding won't know to set it. The route handles the missing key gracefully (500 with clear message), so this doesn't block the endpoint — but it is a developer onboarding gap. |

### Human Verification Required

#### 1. Emulator Test Suite — Regression + AI Endpoint Smoke Test

**Test:** Start Firebase emulators (`firebase emulators:start`) and run the existing test suite: `npm run test:rules` to verify Firestore rules tests pass (including any regression on unrelated collections), and `npm run test:e2e` to verify E2E suite still passes without regression introduced by the new AI route or Firestore rules.

**Expected:** All existing tests pass. No regressions in previously passing tests. The new `aiUsage` and `aiConversations` Firestore rules do not conflict with or break existing rule tests.

**Why human:** Cannot run Firebase emulator stack statically. This is the only roadmap success criterion that cannot be verified programmatically. Note: no AI-specific tests (rules tests for `aiUsage`/`aiConversations`, or E2E test for `POST /v1/ai/chat`) were written as part of this phase. The Firestore rules test file (`tests/firestore-rules/firestore.rules.test.ts`) has no coverage for the new AI collections. If the success criterion requires AI-specific tests, those would need to be written separately.

#### 2. Live Gemini Streaming — End-to-End AI Response

**Test:** With emulators running and a valid `GEMINI_API_KEY` set in `functions/.env.erp-softcode`, call `POST /v1/ai/chat` as a non-free tenant with `{ "message": "Olá, o que você pode fazer?" }` and verify SSE streaming.

**Expected:** Response streams SSE chunks with `type: "text"` containing Portuguese text, followed by a `type: "usage"` chunk and final `data: [DONE]\n\n` sentinel. No 500 errors.

**Why human:** Requires a real Gemini API key, running emulators, and a seeded tenant with a non-free plan tier. Cannot verify live Gemini streaming statically.

### Gaps Summary

No code gaps blocking the phase goal. All 4 programmatically verifiable success criteria are met:

- `POST /v1/ai/chat` is fully implemented, wired, and registered in the Express monolith
- Free tier → 403, exhausted limit → 429 with `resetAt` are both implemented
- `aiUsage/{YYYY-MM}` is atomically incremented via `FieldValue.increment + merge:true`
- Conversation history is plan-gated (Starter: empty array, Pro/Enterprise: persisted, trimmed to 20 messages)
- Firestore rules enforce tenant isolation on both new subcollections
- TypeScript build passes cleanly; lint has no errors

The only open item is the fifth roadmap criterion (emulator tests), which requires human verification. The `GEMINI_API_KEY` missing from `.env.example` is a documentation gap — it does not block the phase goal.

---

_Verified: 2026-04-13T17:05:34Z_
_Verifier: Claude (gsd-verifier)_
