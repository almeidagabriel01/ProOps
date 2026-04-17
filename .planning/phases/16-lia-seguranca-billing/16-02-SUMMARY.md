---
phase: 16-lia-seguranca-billing
plan: 02
subsystem: backend/ai
tags: [security, billing, ai, subscription]
requirements: [AIBI-02]

dependency_graph:
  requires: [16-01]
  provides: [inactive-subscription-gate-at-ai-chat]
  affects: [functions/src/ai/chat.route.ts]

tech_stack:
  added: []
  patterns: [evaluateSubscriptionStatusAccess pure function for grace-period logic]

key_files:
  modified:
    - functions/src/ai/chat.route.ts

decisions:
  - "evaluateSubscriptionStatusAccess is a pure function — no telemetry or logger calls added inside the check block (consistent with the function's design)"
  - "pastDueSince always passed from planProfile to avoid false-blocking all past_due tenants within grace period"
  - "Subscription check placed between free-tier guard (line 51) and planTier assignment (line 59) ensuring 403 fires before any SSE stream starts"

metrics:
  duration_minutes: 5
  completed_date: "2026-04-14"
  tasks_completed: 1
  files_modified: 1
---

# Phase 16 Plan 02: Inactive Subscription Gate for AI Chat — Summary

**One-liner:** Adds `evaluateSubscriptionStatusAccess` guard to `chat.route.ts` blocking canceled and past_due-beyond-grace tenants with 403 `AI_SUBSCRIPTION_INACTIVE` before any SSE stream starts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add inactive subscription check to chat.route.ts | 27e57d3f | functions/src/ai/chat.route.ts |

## What Was Built

Modified `functions/src/ai/chat.route.ts` to add a subscription status guard between the existing free-tier check (step 3) and the `planTier` assignment (step 3b). The guard calls `evaluateSubscriptionStatusAccess` from `tenant-plan-policy.ts`, which handles grace-period logic internally:

- `active` / `trialing` → `allowWrite: true` → request proceeds normally
- `past_due` within grace period → `allowWrite: true` → request proceeds normally
- `past_due` beyond grace period → `allowWrite: false` → 403 `AI_SUBSCRIPTION_INACTIVE`
- `canceled` or any other blocked status → `allowWrite: false` → 403 `AI_SUBSCRIPTION_INACTIVE`

The check fires **before** `res.flushHeaders()` at line 150, satisfying AIBI-02's requirement that the 403 arrives before streaming begins.

## Guard Order in chat.route.ts

```
POST /v1/ai/chat
  ├── 1. Auth check (401)
  ├── 2. Input validation (400)
  ├── 3. Resolve planProfile
  ├── 3a. Free-tier block → 403 AI_FREE_TIER_BLOCKED
  ├── 3b. Inactive subscription block → 403 AI_SUBSCRIPTION_INACTIVE  ← NEW
  ├── 4. Monthly limit check → 429 AI_LIMIT_EXCEEDED
  └── 5. SSE stream starts (res.flushHeaders)
```

## Decisions Made

- **No telemetry/logger in the check block:** `evaluateSubscriptionStatusAccess` is a pure function by design; adding a `logger.warn` here would be inconsistent with the plan's explicit instruction and the function's contract.
- **`pastDueSince` always passed:** Omitting it would cause `PAST_DUE_MISSING_TIMESTAMP` → `allowWrite: false` for all `past_due` tenants even within grace (Pitfall 2 from research).
- **No custom grace period override:** Using the function's default (`TENANT_PLAN_PAST_DUE_GRACE_DAYS` env var, defaulting to 7 days) keeps the behavior consistent with `enforceTenantPlanLimit`.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Coverage

| Threat ID | Status |
|-----------|--------|
| T-16-01 (Elevation of Privilege) | Mitigated — `evaluateSubscriptionStatusAccess` runs server-side on every request |
| T-16-02 (Spoofing subscription status) | Mitigated — `planProfile` resolved from Firestore via `req.user.tenantId` from validated Firebase token |
| T-16-03 (Cache staleness DoS) | Accepted — 30s plan cache TTL is an acceptable trade-off per design |

## Self-Check: PASSED

- [x] `functions/src/ai/chat.route.ts` exists and contains all required strings
- [x] Commit `27e57d3f` exists
- [x] `cd functions && npx tsc --noEmit` exits 0
