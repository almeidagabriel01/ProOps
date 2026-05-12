---
phase: 22-login-redirect-hardening
verified: 2026-05-11T16:30:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run Playwright E2E suite against Firebase Emulators + Next.js dev server"
    expected: "All 5 tests in tests/e2e/auth/login-redirect.spec.ts pass (LR-01 × 2, LR-06 × 1, LOGIN-01-A × 2, LOGIN-01-B × 1)"
    why_human: "The 22-02-SUMMARY explicitly states infrastructure was not started during plan execution. Runtime correctness of redirect navigation and toast rendering requires a live environment."
  - test: "Navigate to /login?redirect=/proposals while logged out; log in as admin"
    expected: "URL settles on /dashboard — the ?redirect= param is silently ignored"
    why_human: "Validates handleRedirectAfterAuth behaviour at runtime; cannot be confirmed by static analysis alone"
  - test: "Navigate to /login?redirect_reason=session_expired while logged out; observe login page before submitting"
    expected: "Warning toast appears within 5 seconds of page mount; subtitle reads 'Bem-vindo de volta! Insira suas credenciais.' (not the old session-expired copy)"
    why_human: "Toast visibility and DOM selector ([data-sonner-toast] vs [role=status]) require a running browser; Open Question #3 in RESEARCH.md is unresolved"
  - test: "Log in as superadmin (superadmin@proops.test) with or without ?redirect= params"
    expected: "URL settles on /admin regardless of URL params"
    why_human: "Requires USER_SUPERADMIN seeded in Firebase Emulator and running Next.js dev server; window.location.replace('/admin') code path not exercised by static checks"
  - test: "Navigate to a protected route while logged out (e.g. /dashboard)"
    expected: "Redirected to /login?redirect_reason=session_expired with no redirect= segment in the URL"
    why_human: "Validates protected-route.tsx bounce URL at runtime; Next.js middleware + auth state required"
---

# Phase 22: Login Redirect Hardening — Verification Report

**Phase Goal:** Harden the login redirect flow — eliminate the open-redirect attack surface from `?redirect=` consumption, replace the session-expired subtitle with a warning toast, and deliver an E2E test suite that validates the new behavior against the LOGIN-01 acceptance criteria.
**Verified:** 2026-05-11T16:30:00Z
**Status:** HUMAN NEEDED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `handleRedirectAfterAuth` never reads or consumes the `?redirect=` URL parameter | VERIFIED | `grep -c "redirectUrl" useLoginForm.ts` = 0; `handleRedirectAfterAuth` body confirmed at lines 307-327 reads only `user.role` and calls `resolveUserHome(user ?? null)` |
| 2 | Protected-route bounce URL contains only `redirect_reason`, never `redirect=` | VERIFIED | `protected-route.tsx` line 120: `router.push("/login?redirect_reason=session_expired");` — no `encodeURIComponent` or `redirect=` anywhere in file |
| 3 | Login page subtitle is always the default welcome copy; `redirect_reason=session_expired` triggers a warning toast on mount | VERIFIED (code level) | `login/page.tsx` line 604: unconditional `Bem-vindo de volta! Insira suas credenciais.`; `useLoginForm.ts` lines 395-399: `useEffect([redirectReason])` fires `toast.warning(...)` on `"session_expired"`; `Toaster` mounted at app root in `toast-provider.tsx` |
| 4 | Superadmin and free-user redirect paths still resolve correctly through `resolveUserHome()` (LR-06 regression preserved) | VERIFIED | `useLoginForm.ts` line 227: `const home = resolveUserHome(user ?? null); router.replace(home.path);`; E2E spec LR-06 block present and substantive |
| 5 | `USER_SUPERADMIN` is seeded in the emulator and cleaned up by `clearAll()` | VERIFIED | `users.ts` lines 61-68: constant exported with uid `user-superadmin`, role `"superadmin"`, tenantId `"tenant-superadmin"`; `seed-factory.ts` line 94: `"user-superadmin"` in clearAll UID array; tenant-doc branch extended for `user.role === "superadmin"` |
| 6 | Lint passes (no unused `redirectUrl`, no unused `isPathAllowedForUser`, no exhaustive-deps warnings on redirect useEffect) | VERIFIED | `grep "redirectUrl" useLoginForm.ts` = 0; `grep "isPathAllowedForUser" useLoginForm.ts` = 0; outer redirect useEffect dep array confirmed excludes `redirectReason`; pre-existing lint failures are in unrelated files (price-change-banner.tsx, subscription-guard.tsx, usePriceChange.ts, MySubscriptionTab.tsx) documented in deferred-items.md — none introduced by Phase 22 |
| 7 | E2E spec has exactly 4 describe blocks: LR-01, LR-06, LOGIN-01-A, LOGIN-01-B | VERIFIED | File confirmed: 4 describe blocks present with correct IDs; LR-02/03/04/05/07 count = 0 |
| 8 | LR-02/03/04/05/07 (redirect= consumption scenarios) are absent from spec | VERIFIED | `grep "AUTH-LR-02\|AUTH-LR-03\|AUTH-LR-04\|AUTH-LR-05\|AUTH-LR-07" login-redirect.spec.ts` = 0 |
| 9 | E2E spec compiles without TypeScript errors | VERIFIED | 22-02-SUMMARY confirms `npx tsc --noEmit -p tests/e2e/tsconfig.json` exits 0 with no output; `USER_SUPERADMIN` import from `../seed/data/users` type-checked successfully |

**Score:** 9/9 truths verified at static/code level

**ROADMAP Success Criteria mapping (Phase 22 has 3 SCs):**
- SC-1 ("user visits `/login?redirect=/proposals`, completes login, taken to `/dashboard`") — maps to truth #1 (code level) + human verification item #2 (runtime)
- SC-2 ("session-expired bounce → warning toast; `redirect_reason` still consumed for toast only") — maps to truth #3 (code level) + human verification item #3 (runtime)
- SC-3 ("superadmin logs in → taken to `/admin` regardless of URL params") — maps to truths #1 and #4 (code level) + human verification item #4 (runtime)

All three SCs are fully addressed in code. Runtime confirmation is blocked on human verification items #2-4 (covered by the Playwright suite in item #1).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/login/_hooks/useLoginForm.ts` | `handleRedirectAfterAuth` simplified; `redirectUrl` removed; `toast.warning` on `session_expired` via `useEffect` | VERIFIED | `toast.warning` present line 397; `redirectUrl` count = 0; `isPathAllowedForUser` count = 0; `resolveUserHome(user ?? null)` present |
| `apps/web/src/app/login/page.tsx` | Default-only subtitle; no `session_expired` conditional | VERIFIED | Line 604: unconditional subtitle confirmed; `redirectReason` removed from destructure |
| `apps/web/src/components/auth/protected-route.tsx` | Bounce URL constructed without `redirect=` param | VERIFIED | Line 120: `/login?redirect_reason=session_expired` — no `redirect=` |
| `tests/e2e/seed/data/users.ts` | `SeedUserSuperadminRole` + `USER_SUPERADMIN` + superadmin tenant doc seeded | VERIFIED | Interface line 18, constant lines 61-68, tenant-doc branch lines 129-131 |
| `tests/e2e/seed/seed-factory.ts` | `user-superadmin` UID in `clearAll()` cleanup array | VERIFIED | Line 94: `"user-superadmin"` present in UID array |
| `tests/e2e/auth/login-redirect.spec.ts` | 4 describe blocks, `USER_SUPERADMIN` import, tightened LR-01 assertion, Sonner toast selector | VERIFIED | Full rewrite confirmed: 71 insertions / 94 deletions; all describe blocks present; `USER_SUPERADMIN` imported |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `protected-route.tsx` | `/login` | `router.push` bounce URL | WIRED | Line 120: `router.push("/login?redirect_reason=session_expired")` — pattern matches |
| `useLoginForm.ts` | `@/lib/toast` | `useEffect` on `redirectReason` | WIRED | Line 24: `import { toast } from "@/lib/toast"`; lines 395-399: `useEffect` on `[redirectReason]` calls `toast.warning(...)` |
| `useLoginForm.ts` | `@/lib/auth/resolve-user-home` | `import { resolveUserHome }` | WIRED | Line 7: `import { resolveUserHome } from "@/lib/auth/resolve-user-home"` — `isPathAllowedForUser` removed; `resolveUserHome(user ?? null)` called in `handleRedirectAfterAuth` |
| `toast-provider.tsx` | Sileo `<Toaster>` | App root mount | WIRED | Line 3: `import { Toaster } from "sileo"`; line 23: `<Toaster ... />` — prerequisite for toast.warning() rendering |
| `login-redirect.spec.ts` | `seed/data/users` | `USER_SUPERADMIN` import | WIRED | Line 22: `import { USER_ADMIN_ALPHA, USER_FREE, USER_SUPERADMIN } from "../seed/data/users"` |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 22 modifies auth redirect logic and a test spec. No new data-rendering artifacts were introduced. Existing artifacts do not render dynamic data from a database query.

---

### Behavioral Spot-Checks

**SKIPPED** — requires Firebase Emulators + Next.js dev server to be running. The 22-02-SUMMARY explicitly documented that infrastructure was not started. All runtime checks are surfaced in the Human Verification section.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LOGIN-01 | 22-01-PLAN, 22-02-PLAN | After successful login, user always redirected to `/dashboard` (or `/admin` for superadmins); `?redirect=` param ignored; `redirect_reason=session_expired` triggers warning toast, not subtitle change | SATISFIED (code level) | `handleRedirectAfterAuth` reads only `user.role`; `resolveUserHome()` drives all non-superadmin paths; protected-route bounce URL strips `redirect=`; toast `useEffect` fires on `session_expired`; E2E spec validates all four scenarios — runtime execution pending human verification |

---

### Anti-Patterns Found

None in Phase 22 files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No stubs, no TODOs, no placeholder returns found in Phase 22 modified files | — | — |

**Note on pre-existing lint failures:** `npm run lint` exits non-zero due to 6 pre-existing problems in `price-change-banner.tsx`, `subscription-guard.tsx`, `usePriceChange.ts`, and `MySubscriptionTab.tsx`. These files were not touched by Phase 22 and are documented in `.planning/phases/22-login-redirect-hardening/deferred-items.md`. The Phase 22 lint must-have (Plan 22-01, truth #6) specifically targets absence of `redirectUrl`, `isPathAllowedForUser`, and exhaustive-deps warnings on the redirect useEffect — all confirmed absent.

---

### Human Verification Required

#### 1. Playwright E2E Suite

**Test:** Start Firebase Emulators (`firebase emulators:start`) and Next.js dev server (`npm run dev`), then run:
```
npx playwright test tests/e2e/auth/login-redirect.spec.ts
```
**Expected:** All 5 tests pass — AUTH-LR-01 (2 tests), AUTH-LR-06 (1 test), AUTH-LOGIN-01-A (2 tests), AUTH-LOGIN-01-B (1 test)
**Why human:** Infrastructure was explicitly not started during Plan 22-02 execution. Runtime correctness of redirect navigation, cookie clearing, and toast rendering cannot be verified by static analysis.

#### 2. Admin Login Ignores ?redirect= Param (ROADMAP SC-1)

**Test:** Navigate to `/login?redirect=/proposals` while logged out. Log in as an admin user.
**Expected:** URL settles on `/dashboard` — the `?redirect=` param is silently ignored.
**Why human:** Validates the `handleRedirectAfterAuth` code path at runtime including `router.replace()` navigation.

#### 3. Session-Expired Toast and Subtitle (ROADMAP SC-2)

**Test:** Navigate to `/login?redirect_reason=session_expired` while logged out. Observe the page before submitting credentials.
**Expected:** Warning toast appears within 5 seconds of page mount; subtitle reads "Bem-vindo de volta! Insira suas credenciais." (not the old expired-session copy).
**Why human:** Toast DOM rendering depends on Sonner version and whether `[data-sonner-toast]` or `[role="status"]` is the correct selector — Open Question #3 in RESEARCH.md is unresolved until runtime is observed.

#### 4. Superadmin Home Resolution (ROADMAP SC-3)

**Test:** Log in as `superadmin@proops.test` (with or without `?redirect=` params in URL).
**Expected:** URL settles on `/admin` regardless of URL params.
**Why human:** Requires USER_SUPERADMIN seeded in Firebase Emulator with `role: "superadmin"` custom claims. The `window.location.replace('/admin')` code path requires a running browser session.

#### 5. Protected-Route Bounce URL

**Test:** Navigate to a protected route (e.g., `/dashboard`) while logged out.
**Expected:** Redirected to `/login?redirect_reason=session_expired` with no `redirect=` segment in the URL.
**Why human:** Requires Next.js middleware and auth state to be active; `protected-route.tsx` executes only in a running Next.js app.

---

### Gaps Summary

No structural or code-level gaps found. All 9 observable truths are verified at the static analysis level — the implementation correctly removes `?redirect=` consumption, strips the bounce URL to `redirect_reason` only, adds the session-expired toast, preserves the `resolveUserHome()` regression, seeds USER_SUPERADMIN, and rewrites the E2E spec with the correct 4 describe blocks.

The phase is blocked on **human_needed** because all three ROADMAP Success Criteria require runtime behavioral evidence (redirect navigation, toast visibility) that cannot be confirmed without executing the Playwright suite against live infrastructure. This is a known gap documented in 22-02-SUMMARY.md and is not a code defect — it is an infrastructure execution gap.

Once the Playwright suite passes (Human Verification item #1), ROADMAP SCs 1-3 will be covered by tests AUTH-LOGIN-01-A, AUTH-LOGIN-01-B, and the superadmin test in AUTH-LOGIN-01-A respectively. The toast selector (item #3) is the only check that may surface a follow-up if neither `[data-sonner-toast]` nor `[role="status"]` matches the actual Sonner DOM output.

---

_Verified: 2026-05-11T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
