---
phase: 22-login-redirect-hardening
plan: 01
subsystem: auth
tags: [react, next.js, firebase, toast, e2e-seed]

# Dependency graph
requires: []
provides:
  - "handleRedirectAfterAuth routes via resolveUserHome only — no redirect= URL param consumption"
  - "protected-route bounce URL stripped to /login?redirect_reason=session_expired only"
  - "session_expired toast via toast.warning() in useLoginForm"
  - "USER_SUPERADMIN seed constant with tenant doc and clearAll cleanup"
affects: [22-02-login-redirect-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-expired notification as transient toast (useEffect on redirectReason) rather than subtitle swap"
    - "SeedUserFreeRole / SeedUserSuperadminRole via Omit<SeedUser, 'role'> for non-union role seeding"

key-files:
  created: []
  modified:
    - apps/web/src/app/login/_hooks/useLoginForm.ts
    - apps/web/src/app/login/page.tsx
    - apps/web/src/components/auth/protected-route.tsx
    - tests/e2e/seed/data/users.ts
    - tests/e2e/seed/seed-factory.ts

key-decisions:
  - "redirectReason kept in UseLoginFormReturn interface and hook return — consumed by toast effect and session-recovery effect; removal deferred to future cleanup"
  - "SeedUserFreeRole added to users.ts alongside SeedUserSuperadminRole — pre-existing type error exposed by TypeScript check (USER_FREE was typed as SeedUser with role: 'free' — mismatch)"

patterns-established:
  - "Seed role extension pattern: Omit<SeedUser, 'role'> + specific role literal — used for free and superadmin variants"

requirements-completed: [LOGIN-01]

# Metrics
duration: 15min
completed: 2026-05-11
---

# Phase 22 Plan 01: Login Redirect Hardening — Core Changes Summary

**Open-redirect attack surface closed: handleRedirectAfterAuth routes only via resolveUserHome or superadmin short-circuit; session-expired notification moved from subtitle swap to toast.warning()**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-11T15:25:00Z
- **Completed:** 2026-05-11T15:40:25Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `handleRedirectAfterAuth` no longer reads or follows the `?redirect=` URL param — every non-superadmin user lands on `resolveUserHome().path`, every superadmin lands on `/admin`
- `protected-route.tsx` bounce URL stripped from `/login?redirect=...&redirect_reason=session_expired` to `/login?redirect_reason=session_expired`
- Session-expired notification moved from conditional subtitle copy to `toast.warning()` firing once on mount via `useEffect([redirectReason])`
- `USER_SUPERADMIN` seeded with dedicated `tenant-superadmin` tenant doc; `user-superadmin` UID added to `clearAll()` cleanup list

## Task Commits

Each task was committed atomically:

1. **Task 1: Simplify useLoginForm.ts** - `e04a5d45` (feat)
2. **Task 2: Strip redirect= from protected-route bounce + remove conditional subtitle** - `a3553bda` (feat)
3. **Task 3: Add USER_SUPERADMIN seed + clearAll cleanup** - `42b8ae4f` (feat)

## Files Created/Modified
- `apps/web/src/app/login/_hooks/useLoginForm.ts` — redirectUrl const removed, isPathAllowedForUser import dropped, handleRedirectAfterAuth simplified, toast.warning useEffect added, redirectReason removed from outer useEffect deps, verifyUrl and getGoogleSetupTarget cleaned up
- `apps/web/src/app/login/page.tsx` — conditional subtitle removed, redirectReason destructure removed (no longer consumed at page level)
- `apps/web/src/components/auth/protected-route.tsx` — bounce URL simplified to /login?redirect_reason=session_expired
- `tests/e2e/seed/data/users.ts` — SeedUserFreeRole + SeedUserSuperadminRole interfaces added, USER_FREE re-typed, USER_SUPERADMIN constant added, ALL_USERS widened, tenant-doc branch extended
- `tests/e2e/seed/seed-factory.ts` — user-superadmin UID added to clearAll() cleanup array

## Decisions Made
- `redirectReason` remains in `UseLoginFormReturn` interface and hook return object. It is still consumed by the session-recovery useEffect (lines ~402–422) and the new toast useEffect. The plan notes this as a future cleanup question — whether to tighten the return type in a follow-up plan after the session-recovery flow is re-evaluated.
- `SeedUserFreeRole` added to `users.ts` (not just `ai.ts`) — this was required to fix a pre-existing TypeScript error where `USER_FREE` was typed as `SeedUser` with `role: "free"`, which doesn't satisfy `SeedUser`'s `"admin" | "member"` union constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript type error for USER_FREE constant**
- **Found during:** Task 3 (TypeScript check after seed file edits)
- **Issue:** `USER_FREE` was typed as `SeedUser` (role: `"admin" | "member"`) but had `role: "free"`. This was a latent type error that became visible when running `npx tsc --noEmit` on the test tsconfig. The widening of `ALL_USERS` to `(SeedUser | SeedUserSuperadminRole)[]` made the union incompatible with `"free"`.
- **Fix:** Added `SeedUserFreeRole extends Omit<SeedUser, "role"> { role: "free" }` interface; re-typed `USER_FREE` as `SeedUserFreeRole`; widened `ALL_USERS` to `(SeedUser | SeedUserFreeRole | SeedUserSuperadminRole)[]`
- **Files modified:** `tests/e2e/seed/data/users.ts`
- **Verification:** `npx tsc --noEmit -p tests/e2e/tsconfig.json` exits 0 with no output
- **Committed in:** `42b8ae4f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — pre-existing type bug)
**Impact on plan:** Fix necessary for TypeScript correctness and exposed a real mismatch in seed data types. No scope creep — `SeedUserFreeRole` is the established Phase 17 pattern documented in the plan interfaces section.

## Issues Encountered
- Pre-existing lint errors in `price-change-banner.tsx`, `subscription-guard.tsx`, `usePriceChange.ts`, `MySubscriptionTab.tsx` cause `npm run lint` to fail regardless of this plan's changes. These are out-of-scope per deviation rules scope boundary. Logged to deferred items.

## Known Stubs
None — all changes are behavior-removing simplifications with no placeholder data paths.

## Threat Flags
None — the changes remove an attack surface (open redirect via `?redirect=` param) rather than introduce new surface.

## Next Phase Readiness
- Plan 22-01 complete: post-login redirect hardened, bounce URL clean, toast notification wired
- Plan 22-02 (E2E tests for login-redirect) can now proceed — `USER_SUPERADMIN` seed is available for the superadmin redirect scenario

---
*Phase: 22-login-redirect-hardening*
*Completed: 2026-05-11*
