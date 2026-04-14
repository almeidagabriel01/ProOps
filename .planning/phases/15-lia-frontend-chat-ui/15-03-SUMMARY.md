---
phase: 15-lia-frontend-chat-ui
plan: "03"
subsystem: frontend-hooks
tags: [lia, hooks, session, usage, firestore, real-time]
dependency_graph:
  requires: ["15-01"]
  provides: ["useLiaSession", "useLiaUsage"]
  affects: ["15-04", "15-05"]
tech_stack:
  added: []
  patterns: [onSnapshot-subscriptionKey-loading, localStorage-session-persistence, 4h-idle-expiry]
key_files:
  created:
    - src/hooks/useLiaSession.ts
    - src/hooks/useLiaUsage.ts
  modified: []
decisions:
  - "user.id used instead of user.uid — project User type uses id field (not uid)"
  - "isLoading derived from subscriptionKey comparison instead of synchronous setState in effect — required by react-hooks/set-state-in-effect lint rule"
  - "useLiaSession uses tenant?.id from useTenant() since TenantContextType exposes tenant not tenantId directly"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-14T13:51:17Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 15 Plan 03: Session and Usage Hooks Summary

**One-liner:** Session ID persistence with 4h Firestore history expiry and real-time monthly AI usage tracking via subscriptionKey-based loading state.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useLiaSession hook | 82944910 | src/hooks/useLiaSession.ts |
| 2 | Create useLiaUsage hook | 82944910 | src/hooks/useLiaUsage.ts |

## What Was Built

### useLiaSession (`src/hooks/useLiaSession.ts`)
- Session ID persisted in `localStorage` under key `lia_session_id_{tenantId}` for Pro/Enterprise plans
- Ephemeral (in-memory only) session ID for Starter plan
- On mount: loads `aiConversations/{sessionId}` from Firestore for Pro/Enterprise
- 4-hour idle check on `updatedAt` — starts fresh session if expired
- `startNewSession()` generates new UUID, clears localStorage, resets history
- Graceful degradation on Firestore errors (empty history, no crash)
- Exports: `useLiaSession`, `UseLiaSessionReturn`

### useLiaUsage (`src/hooks/useLiaUsage.ts`)
- Real-time `onSnapshot` listener on `tenants/{tenantId}/aiUsage/{YYYY-MM}`
- `messagesLimit` derived from `AI_TIER_LIMITS[planTier]`
- `isNearLimit`: `messagesUsed >= floor(messagesLimit * 0.8)`
- `isAtLimit`: `messagesUsed >= messagesLimit`
- `resetDate`: human-readable Portuguese date of next month's 1st (e.g. "01 de maio")
- Graceful degradation on Firestore error (shows 0 usage, no crash)
- Exports: `useLiaUsage`, `UseLiaUsageReturn`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed user.uid → user.id**
- **Found during:** Task 1 TypeScript check
- **Issue:** Plan's code used `user?.uid` but project `User` type has `id` field (not `uid`)
- **Fix:** Changed both occurrences to `user?.id`
- **Files modified:** src/hooks/useLiaSession.ts
- **Commit:** 82944910

**2. [Rule 1 - Bug] Fixed useTenant() destructuring**
- **Found during:** Task 1 context review
- **Issue:** Plan's code destructured `{ tenantId }` from `useTenant()` but `TenantContextType` exposes `tenant: Tenant | null` — no `tenantId` property
- **Fix:** Destructured `{ tenant }` and used `tenant?.id ?? null` as `tenantId`
- **Files modified:** src/hooks/useLiaSession.ts, src/hooks/useLiaUsage.ts
- **Commit:** 82944910

**3. [Rule 1 - Bug] Fixed synchronous setState in effect body**
- **Found during:** Task 2 lint check
- **Issue:** ESLint rule `react-hooks/set-state-in-effect` disallows any synchronous `setState()` calls at the top of `useEffect` bodies. Plan's `setIsLoading(false)` early-return pattern triggered this.
- **Fix:** Replaced `isLoading` state with `subscriptionKey`-based derivation — `isLoading = !!tenantId && usage.subscriptionKey !== subscriptionKey`. State is only updated inside `onSnapshot` callbacks (not synchronously in effect body).
- **Files modified:** src/hooks/useLiaUsage.ts
- **Commit:** 82944910

## Known Stubs

None — both hooks are fully functional with real Firestore paths.

## Threat Flags

No new network endpoints or auth paths introduced. Both hooks use Firebase client SDK with existing auth tokens; Firestore rules from Phase 13 enforce tenant isolation and uid-scoped conversation reads.

## Self-Check: PASSED

- [x] `src/hooks/useLiaSession.ts` exists
- [x] `src/hooks/useLiaUsage.ts` exists
- [x] Commit 82944910 exists
- [x] `npx tsc --noEmit` passes (0 errors)
- [x] `npm run lint` passes (0 errors, 0 warnings)
- [x] `aiConversations` path present in useLiaSession
- [x] `aiUsage` path present in useLiaUsage
- [x] `SESSION_IDLE_MS` (4h) present in useLiaSession
- [x] `isNearLimit` and `isAtLimit` present in useLiaUsage
