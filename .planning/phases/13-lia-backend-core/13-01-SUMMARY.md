---
phase: 13-lia-backend-core
plan: 01
subsystem: api
tags: [ai, gemini, firestore, typescript, usage-tracking]

requires:
  - phase: 12-lia
    provides: Architecture decisions for Lia AI assistant, AI_LIMITS values, AiUsageDocument/AiConversationDocument schemas

provides:
  - AI_LIMITS constant mapping plan tiers (starter/pro/enterprise) to Gemini models and monthly limits
  - selectModel() function routing plan tiers to correct Gemini models with Enterprise complexity routing
  - checkAiLimit() / incrementAiUsage() / getAiUsage() for Firestore-backed monthly AI usage enforcement
  - Full TypeScript type layer for AI module (AiUsageDocument, AiConversationDocument, AiChatRequest, AiChatChunk, ModelSelection)
  - @google/generative-ai SDK installed in functions

affects:
  - 13-02 (chat controller depends on selectModel, checkAiLimit, incrementAiUsage)
  - 13-03 (AI tools depend on ai.types.ts interfaces)

tech-stack:
  added:
    - "@google/generative-ai ^0.24.1"
  patterns:
    - "AI_LIMITS as single source of truth for plan-based AI access control"
    - "Monthly AI usage tracked in Firestore subcollection: tenants/{id}/aiUsage/{YYYY-MM}"
    - "FieldValue.increment + merge:true for atomic document creation and counter updates"
    - "buildMonthlyPeriodKeyUtc() from tenant-plan-policy.ts reused for consistent monthly keys"

key-files:
  created:
    - functions/src/ai/ai.types.ts
    - functions/src/ai/model-router.ts
    - functions/src/ai/usage-tracker.ts
  modified:
    - functions/package.json

key-decisions:
  - "AI_LIMITS keys are starter/pro/enterprise only (free excluded via Exclude<TenantPlanTier, 'free'>)"
  - "Enterprise complexity routing: keyword match in message → gemini-2.5-pro-preview-05-06 (~20% of requests)"
  - "Usage reset is automatic: new monthly document per YYYY-MM key, no cron needed"
  - "Free tier blocked at route level with 403 before checkAiLimit is called"

patterns-established:
  - "All AI module files import TenantPlanTier from tenant-plan-policy.ts (no redefinition)"
  - "Usage tracker uses set() with merge:true for auto-creation on first message of month"

requirements-completed: [LIA-02]

duration: 2min
completed: 2026-04-13
---

# Phase 13 Plan 01: AI Foundation — Types, Model Router, and Usage Tracker Summary

**Three-file AI module foundation: AI_LIMITS constant, Gemini model router with Enterprise complexity routing, and Firestore-backed monthly usage tracking with atomic increments**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T16:50:34Z
- **Completed:** 2026-04-13T16:52:43Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Installed `@google/generative-ai ^0.24.1` as a functions dependency
- Created `ai.types.ts` with `AI_LIMITS` constant (starter: 80 msgs/gemini-2.0-flash, pro: 400/gemini-2.5-flash, enterprise: 2000/gemini-2.5-flash), all interfaces, and `ENTERPRISE_PRO_KEYWORDS` for complexity routing
- Created `model-router.ts` with `selectModel()` that throws for free tier and routes enterprise complex queries to `gemini-2.5-pro-preview-05-06` via keyword detection
- Created `usage-tracker.ts` with `checkAiLimit()`, `incrementAiUsage()` (atomic via `FieldValue.increment + merge:true`), and `getAiUsage()` against `tenants/{id}/aiUsage/{YYYY-MM}`
- Full TypeScript build passes cleanly (`npm run build`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @google/generative-ai and create ai.types.ts** - `06bafd49` (feat)
2. **Task 2: Create model-router.ts with selectModel()** - `9b9a68c6` (feat)
3. **Task 3: Create usage-tracker.ts with checkAiLimit, incrementAiUsage, getAiUsage** - `689db335` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `functions/src/ai/ai.types.ts` - AI_LIMITS constant, all TypeScript interfaces for the AI module
- `functions/src/ai/model-router.ts` - selectModel() routing tier to Gemini model with Enterprise complexity detection
- `functions/src/ai/usage-tracker.ts` - Firestore-backed monthly usage check, increment, and read
- `functions/package.json` - Added @google/generative-ai ^0.24.1

## Decisions Made
- `TenantPlanTier` is imported and re-exported from `tenant-plan-policy.ts` — no redefinition to avoid drift
- `AI_LIMITS` excludes `"free"` via TypeScript `Exclude<TenantPlanTier, "free">` — free tier access is blocked upstream at the route level (403), not here
- Enterprise complexity routing uses lowercase keyword matching on the user message, routing to `gemini-2.5-pro-preview-05-06` when a complexity keyword is found
- Monthly usage auto-resets by design: a new document `tenants/{id}/aiUsage/YYYY-MM` is created each month via `merge:true` — no cron needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. @google/generative-ai installed but API key config is in a future plan.

## Next Phase Readiness
- `ai.types.ts`, `model-router.ts`, and `usage-tracker.ts` are ready to be consumed by the chat controller (13-02)
- All exports match the interfaces documented in the plan's `artifacts` spec
- TypeScript compiles cleanly — no blockers for 13-02

## Self-Check: PASSED

- FOUND: functions/src/ai/ai.types.ts
- FOUND: functions/src/ai/model-router.ts
- FOUND: functions/src/ai/usage-tracker.ts
- FOUND: .planning/phases/13-lia-backend-core/13-01-SUMMARY.md
- FOUND: commit 06bafd49 (Task 1)
- FOUND: commit 9b9a68c6 (Task 2)
- FOUND: commit 689db335 (Task 3)
- FOUND: commit 31da3df2 (docs/metadata)

---
*Phase: 13-lia-backend-core*
*Completed: 2026-04-13*
