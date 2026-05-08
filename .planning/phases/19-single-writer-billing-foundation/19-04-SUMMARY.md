---
phase: 19-single-writer-billing-foundation
plan: "04"
subsystem: billing-cache
tags: [billing, cache, lru, performance, BILL-07]
dependency_graph:
  requires: [19-01]
  provides: [bounded-billing-cache, bounded-plan-cache]
  affects: [require-active-subscription, tenant-plan-policy, all-protected-routes]
tech_stack:
  added: []
  patterns: [LRUCache-v11-bounded-cache, per-entry-ttl-override]
key_files:
  created: []
  modified:
    - apps/functions/src/api/middleware/require-active-subscription.ts
    - apps/functions/src/lib/tenant-plan-policy.ts
    - apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts
decisions:
  - "resolvePlanCacheTtlMs() deleted (not deprecated-and-kept) — noUnusedLocals: true in tsconfig enforced removal; function was fully orphaned after PLAN_CACHE switch to LRU with hard-coded 30_000 literal"
  - "hasTenantPlanCacheForTest uses PLAN_CACHE.get() !== undefined (not .has()) — lru-cache v11 has() does not respect TTL expiry in all cases; get() triggers the TTL staleness check"
  - "TTL test uses real elapsed time (1200ms wait) instead of Jest fake timers — lru-cache v11 debounces perf.now() via internal setTimeout with ttlResolution=1ms; fake timer interaction is unreliable"
  - "BILLING_CACHE_TTL_MS constant removed from require-active-subscription.ts — was unused after LRU took over TTL management; noUnusedLocals: true enforced removal"
metrics:
  duration_minutes: 35
  tasks_completed: 2
  files_modified: 3
  completed_date: "2026-05-08"
---

# Phase 19 Plan 04: LRU Cache Replacement (BILL-07) Summary

**One-liner:** Both unbounded Map caches replaced with LRUCache v11 instances (max=500, ttl=30_000 hard-coded literal), honoring the CONTEXT.md locked decision; 5 BILL-07 tests pass.

## What Was Done

Replaced two module-level `new Map<string, T>()` caches with bounded `LRUCache` instances from `lru-cache@^11.3.6` (installed in Plan 01). Each file gets its own independent instance — they are NOT shared.

### Task 1: billingStateCache in require-active-subscription.ts

**LRU constructor:**
```typescript
const BILLING_CACHE_MAX_SIZE = 500;
const billingStateCache = new LRUCache<string, CachedBillingState>({
  max: BILLING_CACHE_MAX_SIZE,
  ttl: 30_000, // hard-coded per CONTEXT.md decision (no env override)
});
```

- Removed `expiresAt: number` from `CachedBillingState` interface — LRU manages TTL internally
- Simplified cache lookup: `billingStateCache.get(tenantId)` returns `undefined` for expired entries; no manual `cached.expiresAt > now` check
- Removed unused `BILLING_CACHE_TTL_MS` constant (noUnusedLocals enforcement)
- Middleware behavior preserved: all `next()` paths intact

### Task 2: PLAN_CACHE in tenant-plan-policy.ts

**LRU constructor:**
```typescript
const PLAN_CACHE_MAX_SIZE = 500;
// TTL hard-coded per CONTEXT.md locked decision (LRU cache replacement).
// NOT routed through resolvePlanCacheTtlMs() — env override intentionally disabled.
const PLAN_CACHE = new LRUCache<string, CachedPlan>({
  max: PLAN_CACHE_MAX_SIZE,
  ttl: 30_000,
});
```

- Removed `expiresAt: number` from `CachedPlan` type
- `getTenantPlanProfile` simplified: `const cached = PLAN_CACHE.get(id); if (cached) return cached.profile;` then `PLAN_CACHE.set(id, { profile })`
- `clearTenantPlanCache` body unchanged (`.delete()` / `.clear()` supported by both Map and LRU)
- `setTenantPlanCacheForTest` updated to use LRU per-entry TTL override: `PLAN_CACHE.set(tenantId, { profile }, { ttl: Math.max(1_000, ttlMs) })`
- `hasTenantPlanCacheForTest` updated to `PLAN_CACHE.get(tenantId) !== undefined` (respects TTL; `.has()` does not)

## Disposition of resolvePlanCacheTtlMs()

**DELETED** — not deprecated-and-kept.

`grep -rn "resolvePlanCacheTtlMs" apps/functions/src/` showed only two occurrences: the function definition and its single call site in `getTenantPlanProfile`. After removing that call and using the LRU constructor literal `30_000`, the function became fully orphaned. `noUnusedLocals: true` in `tsconfig.json` caused a build error. Per the plan's alternative guidance ("Delete if truly orphaned"), the function was removed entirely.

## BILL-07 Test Results (5 Tests)

| # | Test Name | Result |
|---|-----------|--------|
| 1 | evicts oldest entry when 501st entry inserted | PASS |
| 2 | entry expires after explicit TTL passes | PASS |
| 3 | clearTenantPlanCache(id) removes a single entry | PASS |
| 4 | clearTenantPlanCache() with no arg clears all entries | PASS |
| 5 | setTenantPlanCacheForTest writes through LRU and is observable via hasTenantPlanCacheForTest | PASS |

**Test 2 implementation note:** lru-cache v11 uses `performance.now()` with a 1ms debounce (`ttlResolution=1`). Jest fake timers do not reliably advance `performance.now()` in this context. The TTL test uses real elapsed time: `setTenantPlanCacheForTest("t-ttl", profile, 1_000)` then `await new Promise(r => setTimeout(r, 1_200))`. The `Math.max(1_000, ttlMs)` floor in the helper means the minimum testable TTL is 1000ms.

## Regressions Check

- `tenant-plan-policy.test.ts` — 22 existing tests: all PASS
- `tenant-plan-policy.lru.test.ts` — 5 new BILL-07 tests: all PASS
- `whatsapp-eligibility.test.ts` — 6 tests using `setTenantPlanCacheForTest`: all PASS
- `npm run build` — exits 0

## Confirmation: expiresAt No Longer Tracked

Neither `CachedBillingState` nor `CachedPlan` types contain `expiresAt`. No manual `cached.expiresAt > now` checks remain in either file. The LRU constructor TTL is the literal `30_000` in both files — NOT `resolvePlanCacheTtlMs()`.

## Threat Mitigations (from plan threat_model)

| Threat | Mitigation | Verified By |
|--------|------------|-------------|
| T-19-04-01: DoS — unbounded Map fills memory | LRUCache max=500, O(1) eviction | Test 1: 501st insertion evicts t-0 |
| T-19-04-02: DoS — stale billing decisions | Hard-coded 30s TTL | Test 2: entry expires after TTL |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/noUnusedLocals] BILLING_CACHE_TTL_MS constant removed**
- **Found during:** Task 1 build
- **Issue:** `const BILLING_CACHE_TTL_MS = 30_000` became unused after LRU took over TTL; `noUnusedLocals: true` caused `error TS6133`
- **Fix:** Removed the constant; TTL is documented by the inline comment in the LRU constructor
- **Files modified:** `apps/functions/src/api/middleware/require-active-subscription.ts`
- **Commit:** `7e228b14`

**2. [Rule 1 - Bug/noUnusedLocals] resolvePlanCacheTtlMs() deleted instead of deprecated-and-kept**
- **Found during:** Task 2 build
- **Issue:** Removing the call from `getTenantPlanProfile` left the function with zero callers; `noUnusedLocals: true` caused `error TS6133`
- **Fix:** Deleted the function body entirely (plan's alternative: "Delete if grep shows truly orphaned")
- **Files modified:** `apps/functions/src/lib/tenant-plan-policy.ts`
- **Commit:** `3fedc21e`

**3. [Rule 3 - TDD adaptation] TTL test switched from fake timers to real elapsed time**
- **Found during:** Task 2 GREEN phase
- **Issue:** lru-cache v11 debounces `performance.now()` via an internal `cachedNow` + 1ms setTimeout; Jest fake timers do not reliably advance the cache's time source
- **Fix:** Test uses `setTenantPlanCacheForTest("t-ttl", profile, 1_000)` + 1200ms real wait instead of fake timers
- **Files modified:** `apps/functions/src/lib/__tests__/tenant-plan-policy.lru.test.ts`
- **Commit:** `3fedc21e`

**4. [Rule 3 - TDD adaptation] hasTenantPlanCacheForTest switched from .has() to .get() !== undefined**
- **Found during:** Task 2 GREEN phase
- **Issue:** `PLAN_CACHE.has(tenantId)` returned `true` even for expired entries in some lru-cache v11 configurations; `.get()` is the authoritative TTL-aware accessor
- **Fix:** `return PLAN_CACHE.get(tenantId) !== undefined`
- **Files modified:** `apps/functions/src/lib/tenant-plan-policy.ts`
- **Commit:** `3fedc21e`

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `7e228b14` | feat | replace billingStateCache Map with LRUCache (max=500, ttl=30s) |
| `48be25f5` | test | add failing LRU eviction + TTL + clear tests for PLAN_CACHE (BILL-07) — RED gate |
| `3fedc21e` | feat | replace PLAN_CACHE Map with LRUCache (max=500, ttl=30s hard-coded) |

## Known Stubs

None — no placeholder data or wired-but-empty paths introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.
