---
phase: 12-lia
plan: 1
subsystem: ai
tags: [gemini, firestore, firebase, cloud-functions, sse, zod, react]

# Dependency graph
requires: []
provides:
  - Codebase mapping for all service/controller signatures the Lia AI will call
  - Confirmed Firestore schema for AiUsageDocument and AiConversationDocument
  - Closed all 3 open architecture decisions for the AI assistant
  - Research foundation ready for Fase 2 (Backend Core) and Fase 3 (Tool System)
affects: [12-lia-fase2, 12-lia-fase3, 12-lia-fase4, 12-lia-fase5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI subcollections under tenant: tenants/{tenantId}/aiUsage/{YYYY-MM} and tenants/{tenantId}/aiConversations/{sessionId}"
    - "AI route as Express route /v1/ai/chat inside existing api monolith (not separate function)"
    - "usePathname() for contextual suggestions in LiaPanel — reuses existing pattern from TenantProvider"

key-files:
  created: []
  modified:
    - .planning/phases/12-lia/12-RESEARCH.md
    - .planning/phases/12-lia/12-CONTEXT.md

key-decisions:
  - "Hard delete confirmed across all domains — Lia must always use request_confirmation for DELETE, no exceptions"
  - "Plan limits enforced in controllers — Lia tool executor does not duplicate limit checks, handles 402/403 errors"
  - "No modules array on tenant doc — module gating based on planId tier, not a modules list"
  - "LiaPanel injects into root layout inside ProtectedRoute (no dashboard route group exists)"
  - "aiChat as Express route in existing monolith, not a separate Cloud Function"
  - "Contextual suggestions via usePathname() — closed as yes, low cost high value"
  - "Limit notification: in-app only, no email — user is already on platform"
  - "Conversation export: deferred to v3.1 — Playwright rate limit pressure, secondary priority"

requirements-completed: []

# Metrics
duration: 45min
completed: 2026-04-13
---

# Phase 12 Plan 1: Lia — Arquitetura & Pesquisa Summary

**Codebase mapped end-to-end for the Lia AI assistant: all service signatures, hard-delete patterns, Firestore schema, layout injection point, and 3 open architecture decisions closed**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-13T00:00:00Z
- **Completed:** 2026-04-13T00:45:00Z
- **Tasks:** 9
- **Files modified:** 2

## Accomplishments

- Read and mapped all backend services: proposals, clients, products, transactions (TransactionService), wallets — extracted exact method signatures for the tool executor
- Confirmed all domains use **hard delete** (no `deletedAt` field) — critical for Lia's confirmation dialog design
- Validated `AiUsageDocument` and `AiConversationDocument` schemas — no conflicts with existing Firestore collections
- Confirmed the correct Firestore subcollection pattern: `tenants/{tenantId}/aiUsage/{YYYY-MM}` and `tenants/{tenantId}/aiConversations/{sessionId}`
- Identified no `(dashboard)` layout group — `LiaPanel` injects into root `layout.tsx` inside `ProtectedRoute`
- Confirmed bottom-dock is centered, `bottom-right` corner is free for `LiaTriggerButton` (z-50)
- Closed all 3 open decisions in CONTEXT.md with justified choices

## Task Commits

1. **Tasks 1–8: RESEARCH.md + CONTEXT.md filled and decisions closed** — `1dc3f989` (docs)

## Files Created/Modified

- `.planning/phases/12-lia/12-RESEARCH.md` — Complete codebase findings: service signatures, delete patterns, Firestore schema, layout conflicts, auth patterns, Zod examples, sanitize utilities
- `.planning/phases/12-lia/12-CONTEXT.md` — Closed 3 open decisions: contextual suggestions (yes), limit notification (in-app only), conversation export (deferred)

## Decisions Made

**Hard delete across all domains:** proposals.controller.ts line 2080 `t.delete(proposalRef)`, clients.controller.ts line 338 `transaction.delete(clientRef)`, products.controller.ts line 391, TransactionService.deleteTransaction line 1438 — all permanent. Lia confirmation dialog must communicate irreversibility.

**Plan limits in controllers, not tool executor:** `enforceTenantPlanLimit()` is called inside `createProposal`, `checkClientLimit()` inside `createClient`, etc. The Lia tool executor calls the existing service/controller and handles the 402/403 error response — no duplicate logic.

**No `modules` array on tenant document:** The Tenant type in `src/types/index.ts` has no `modules` field. Module access control is by `planId` tier (via `tenant-plan-policy.ts`) and by plan features. The Lia's `buildAvailableTools()` should gate tools by `planTier`, not a `modules` list.

**aiChat as Express route in existing monolith:** Integrating as `/v1/ai/chat` route inside the existing `api` Cloud Function reuses `validateFirebaseIdToken`, CORS config, and all middleware. SSE works in Cloud Run V2 (Cloud Functions HTTP streaming is supported).

**Contextual suggestions (Decision 9):** `usePathname()` already used in `TenantProvider` (line 18 of tenant-provider.tsx). Low cost to pass `currentPath` into system prompt. Closed as: yes, implement.

**Limit notification (Decision 10):** In-app only via `LiaUsageBadge` color change at 80% + disabled input at 100%. Email adds noise since user is already on platform. Closed as: in-app only.

**Conversation export (Decision 11):** Playwright pipeline is rate-limited (5 req/60s per user). CSV/JSON export could be lightweight alternative but is out of scope for v3.0. Closed as: deferred.

## Deviations from Plan

None — plan executed exactly as written. Research phase only; no code changes.

## Issues Encountered

- File paths in PLAN.md used non-existent filenames (`auth.middleware.ts`, `rateLimit.middleware.ts`, `tenant.middleware.ts`) — actual files are `auth.ts` and `pdf-rate-limiter.ts`. No `tenant.middleware.ts` exists; tenant resolution is in `auth-context.ts` and `auth-helpers.ts`. Handled by exploring actual directory structure (Rule 3).
- `src/providers/AuthProvider.tsx` and `TenantProvider.tsx` referenced with wrong capitalization — actual files are `auth-provider.tsx` and `tenant-provider.tsx` (kebab-case per project conventions). Resolved by finding actual paths.
- `src/app/(dashboard)/layout.tsx` does not exist — there is no dashboard route group. The root `src/app/layout.tsx` is the injection point. Documented in RESEARCH.md.

## Known Stubs

None — this is a research phase. No code was generated.

## Next Phase Readiness

Fase 2 (Backend Core: AI Engine) can begin immediately. The following is confirmed:

- Auth middleware to reuse: `validateFirebaseIdToken` from `functions/src/api/middleware/auth.ts`
- Rate limit pattern for AI: Firestore-based monthly counter at `tenants/{tenantId}/aiUsage/{YYYY-MM}` with `FieldValue.increment(1)` — not in-memory
- Zod validation pattern: `schema.safeParse(input)` → `error.issues[0].message` on failure
- Sanitization: `sanitizeText()` from `functions/src/utils/sanitize.ts`
- Route registration: add `/v1/ai/chat` to `functions/src/api/routes/` and register in `functions/src/api/index.ts`
- Export function: add `aiChat` export in `functions/src/index.ts` if standalone, or just add route to existing `api` monolith
- Frontend proxy: `/api/backend/ai/chat` → Cloud Function (follows split-backend pattern)

No blockers.

## Self-Check: PASSED

- `.planning/phases/12-lia/12-RESEARCH.md` — FOUND
- `.planning/phases/12-lia/12-CONTEXT.md` — FOUND
- `.planning/phases/12-lia/12-1-SUMMARY.md` — FOUND
- Commit `1dc3f989` — FOUND (RESEARCH + CONTEXT)
- Commit `8cee7169` — FOUND (SUMMARY + STATE)

---
*Phase: 12-lia*
*Completed: 2026-04-13*
