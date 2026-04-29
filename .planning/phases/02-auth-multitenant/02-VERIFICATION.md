---
phase: 02-auth-multitenant
verified: 2026-04-28T21:00:00Z
status: gaps_found
score: 8/10 must-haves verified by runtime
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "AUTH-06: backend API returns 403 or 404 when alpha token targets a beta-owned proposal (PUT) — tightened assertion confirmed by E2E run"
  gaps_remaining:
    - "AUTH-05: redirect URL query params (redirect, redirect_reason) not present in final login URL at runtime — tests 13 and 14 in route-guards.spec.ts fail"
  regressions: []
human_verification: []
runtime_evidence:
  run_date: 2026-04-28
  runner: playwright
  suite: e2e/auth/
  passed: 16
  failed: 2
  failed_tests:
    - "route-guards.spec.ts:35 — redirect URL includes the original path as 'redirect' query param (received null)"
    - "route-guards.spec.ts:43 — redirect URL includes 'redirect_reason=session_expired' query param (received null)"
---

# Phase 2: Auth & Multi-Tenant E2E Verification Report

**Phase Goal:** E2E tests prove that authentication works end-to-end and that multi-tenant data isolation is enforced — the security foundation for all other test phases.
**Verified:** 2026-04-28T21:00:00Z
**Status:** gaps_found
**Re-verification:** Yes — after AUTH-06 gap closure (plan 02-03)
**Runtime evidence (2026-04-28):** 16 passed / 2 failed — AUTH-06 ✓ confirmed, AUTH-05 redirect query params ✗ not present in final URL

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Test passes: login with valid credentials redirects to an authenticated route | VERIFIED | `auth-flow.spec.ts:19` — `waitForURL(/(dashboard|proposals|transactions|contacts)/)` with 15s timeout; `loginPage.emailInput` asserted not visible |
| 2 | Test passes: login with invalid credentials shows an error message on the login page | VERIFIED | `auth-flow.spec.ts:31` — `loginPage.errorMessage` asserted visible; URL stays on `/login` |
| 3 | Test passes: after login the page can be reloaded and the user remains authenticated | VERIFIED | `auth-flow.spec.ts:47` — `authenticatedPage` fixture, `page.reload()`, URL asserted not `/login` |
| 4 | Test passes: clicking logout redirects to /login and `__session` cookie is cleared | VERIFIED | `auth-flow.spec.ts:58` — `dashboard.logout()` called, URL asserted `/login`, cookie array asserted to not contain `__session` |
| 5 | Test passes: alpha admin token contains tenantId='tenant-alpha', role='admin', masterId='user-admin-alpha' | VERIFIED | `auth-flow.spec.ts:78` — pure Node.js, `getIdTokenClaims` called, all three claims asserted with `toBe` |
| 6 | Test passes: alpha member token contains role='member', masterId='user-admin-alpha' | VERIFIED | `auth-flow.spec.ts:86` — same pattern, asserts `tenantId`, `role='member'`, `masterId='user-admin-alpha'` |
| 7 | Test passes: unauthenticated navigation to /dashboard redirects to /login | VERIFIED | `route-guards.spec.ts:20` — `context.clearCookies()` in beforeEach, navigate, URL asserted `/login` |
| 8 | Test passes: redirect URL preserves the destination path in query params | RUNTIME FAILED | `route-guards.spec.ts:35` and `:43` — both tests reach `/login` but `searchParams.get('redirect')` and `searchParams.get('redirect_reason')` return `null`. Middleware code at lines 118-119 sets the params, but they are absent in the final URL Playwright observes. Root cause: likely a page-level redirect in the login route that discards the query string. |
| 9 | Test passes: alpha's ID token cannot read beta's proposal document from Firestore (403) | VERIFIED | `tenant-isolation.spec.ts:20` — Node.js fetch to Firestore emulator with Bearer token, `response.status` asserted `toBe(403)`; Firestore rules line 220 confirms `belongsToTenant` enforces isolation |
| 10 | Test passes: backend API returns 403 or 404 when alpha token targets a beta-owned proposal (PUT) | VERIFIED | `tenant-isolation.spec.ts:81` — assertion is now `expect([403, 404]).toContain(response.status())`. 502 fallback removed. Comment updated to accurately state Functions emulator is started in global-setup. |

**Score:** 9/10 truths verified (8 code-verified + 1 runtime-confirmed AUTH-06; truth #8 fails at runtime)

### AUTH-06 Gap: CLOSED

**Gap closed by plan 02-03.** The `e2e/auth/tenant-isolation.spec.ts` backend API test now asserts only `[403, 404]`. Specifically:

- **Line 81:** `expect([403, 404]).toContain(response.status())` — 502 removed.
- **Lines 79-80:** Stale 5-line comment claiming "global-setup only starts auth,firestore,storage" replaced with a 2-line accurate comment: "Functions emulator is started in global-setup (--only auth,firestore,storage,functions). 403 = tenantId mismatch caught by Express middleware; 404 = document not found after tenant filter."

The assertion is no longer vacuous. If the Functions emulator fails to start, global-setup throws and the test run aborts — the tightened assertion acts as a secondary guard.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/helpers/firebase-auth-api.ts` | Node.js helper that calls Auth emulator REST API to get and decode ID token claims | VERIFIED | Exports `signInWithEmailPassword`, `decodeJwtPayload`, `getIdTokenClaims`; used in 22 other test files across the project |
| `e2e/auth/auth-flow.spec.ts` | E2E test suite covering AUTH-01, AUTH-02, AUTH-03, AUTH-04 | VERIFIED | 6 tests across 4 describe blocks; substantive assertions (URL patterns, cookie inspection, JWT claim values) |
| `e2e/pages/dashboard.page.ts` | DashboardPage with `logout()` method | VERIFIED | `logout()` method targets `[aria-label="Sair"]`, waits for `/login` URL; used in `auth-flow.spec.ts:60` |
| `e2e/auth/route-guards.spec.ts` | E2E tests for AUTH-05: protected route redirection | VERIFIED | 5 tests; uses `base.fixture` (no auth); `beforeEach` clears cookies; asserts redirect and redirect_reason params |
| `e2e/auth/tenant-isolation.spec.ts` | E2E tests for AUTH-06: multi-tenant data isolation | VERIFIED | 4 tests; all 4 make hard assertions — 3 assert 403, 1 asserts [403, 404] (strict, no 502 fallback) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/auth/auth-flow.spec.ts` | `e2e/fixtures/auth.fixture.ts` | imports `authenticatedPage` fixture | WIRED | Line 10: `import { test, expect } from "../fixtures/auth.fixture"` |
| `e2e/auth/auth-flow.spec.ts` | `e2e/helpers/firebase-auth-api.ts` | imports `getIdTokenClaims` | WIRED | Line 14: `import { getIdTokenClaims } from "../helpers/firebase-auth-api"` |
| `e2e/auth/auth-flow.spec.ts` | `e2e/pages/dashboard.page.ts` | uses `logout()` method | WIRED | Line 59-60: `const dashboard = new DashboardPage(page); await dashboard.logout()` |
| `e2e/auth/route-guards.spec.ts` | `middleware.ts` | tests redirect behavior set at lines 118-119 | WIRED | Middleware sets `redirect` and `redirect_reason=session_expired`; tests assert `searchParams.get('redirect')` and `searchParams.get('redirect_reason')` |
| `e2e/auth/tenant-isolation.spec.ts` | `e2e/helpers/firebase-auth-api.ts` | imports `signInWithEmailPassword` | WIRED | Line 12: `import { signInWithEmailPassword } from "../helpers/firebase-auth-api"` |
| `e2e/auth/tenant-isolation.spec.ts` | `e2e/seed/data/proposals.ts` | references `PROPOSAL_BETA_DRAFT` | WIRED | Line 13: `import { PROPOSAL_BETA_DRAFT } from "../seed/data/proposals"` |
| `firestore.rules` | `firebase.json` | emulator loads rules | WIRED | `firebase.json` line 17: `"rules": "firestore.rules"`; proposals collection enforces `belongsToTenant(resource.data.tenantId)` |

### Data-Flow Trace (Level 4)

Not applicable — all artifacts are E2E test specifications and helpers, not data-rendering components. Tests call real emulators and assert real HTTP responses.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Auth test files are discovered by Playwright | `playwright.config.ts` `testMatch: "**/*.spec.ts"` covers `e2e/auth/*.spec.ts` | All three auth spec files match the glob | PASS |
| CI blocks on E2E failure | `push-checks.yml` `push-gate` job requires `e2e-push=success`; `test-suite.yml` `all-checks-passed` job requires `e2e=success` | Both gate jobs are configured and both require E2E success | PASS |
| Firestore rules load in emulator | `firebase.json` references `firestore.rules`; rules define `belongsToTenant` on proposals | Confirmed present | PASS |
| No 502 in tenant-isolation.spec.ts | `grep "502" e2e/auth/tenant-isolation.spec.ts` | Zero matches — 502 removed | PASS |
| Strict [403, 404] assertion present | `grep "expect(\[403, 404\])" e2e/auth/tenant-isolation.spec.ts` | Matches once at line 81 | PASS |
| Stale comment removed | `grep "global-setup only starts auth,firestore,storage" e2e/auth/tenant-isolation.spec.ts` | Zero matches | PASS |
| Run full auth suite green | Cannot execute without running emulators | — | SKIP (see Human Verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01-PLAN.md | E2E valida login com email e senha via Firebase Auth | SATISFIED | `auth-flow.spec.ts` "logs in with valid credentials" test |
| AUTH-02 | 02-01-PLAN.md | E2E valida que sessão persiste após refresh (cookie `__session`) | SATISFIED | `auth-flow.spec.ts` "session persists after page reload" test |
| AUTH-03 | 02-01-PLAN.md | E2E valida que usuário consegue fazer logout limpando sessão | SATISFIED | `auth-flow.spec.ts` logout test with explicit cookie assertion |
| AUTH-04 | 02-01-PLAN.md | E2E valida que custom claims Firebase são corretos após login | SATISFIED | `auth-flow.spec.ts` two Node.js-only claim assertion tests |
| AUTH-05 | 02-02-PLAN.md | E2E valida que rotas protegidas redirecionam usuário não autenticado | PARTIAL | `route-guards.spec.ts` — 3/5 tests pass (redirect to /login confirmed). Tests 13-14 fail at runtime: redirect query params (`redirect`, `redirect_reason`) are absent in the final URL. Requires gap-closure plan. |
| AUTH-06 | 02-02-PLAN.md, 02-03-PLAN.md | E2E valida que Tenant A não consegue ler, criar nem modificar dados do Tenant B | SATISFIED | `tenant-isolation.spec.ts` — all 4 tests make hard assertions; backend API test now asserts [403, 404] only (gap closed by plan 02-03) |

**Note on REQUIREMENTS.md traceability table:** AUTH-01 through AUTH-06 are still listed as "Pending" in `.planning/REQUIREMENTS.md` even though ROADMAP.md marks Phase 2 as `[x]` complete. This is a documentation inconsistency — the requirements table was not updated when the phase was marked complete. No impact on verification outcome.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/pages/dashboard.page.ts` | 35 | `return null` | Info | Not a stub — this is the catch fallback in `getWelcomeText()` when a heading is not visible within 5s. The method is a helper utility, not used by any auth test. No impact on test outcomes. |

No blockers remain. The `[403, 404, 502]` pattern previously flagged as a blocker has been removed.

### Human Verification Required

#### 1. Full Auth Suite Green Against Emulators

**Test:** Run `npx playwright test e2e/auth/` with Firebase emulators started (`firebase emulators:start --only auth,firestore,storage,functions --project demo-proops-test`) and seed data seeded.

**Expected:** All 15 tests pass — 6 in `auth-flow.spec.ts`, 5 in `route-guards.spec.ts`, 4 in `tenant-isolation.spec.ts`. The backend API test (test 3 in tenant-isolation.spec.ts) must pass with a strict 403 or 404 response — no 502 is accepted.

**Why human:** Cannot execute Playwright tests programmatically in this verification session. The tightened assertion is code-verified but a passing run against live emulators is the definitive proof that the Functions emulator returns 403 or 404 (not a network error) when a cross-tenant PUT is attempted.

---

### Gaps Summary

**AUTH-06 CLOSED** — backend API isolation assertion tightened to `[403, 404]`, confirmed passing at runtime (tests 15-18 all pass).

**AUTH-05 GAP (new)** — redirect URL query params not present at runtime:
- `route-guards.spec.ts:35` — `searchParams.get("redirect")` returns `null` (expected `"/dashboard"`)
- `route-guards.spec.ts:43` — `searchParams.get("redirect_reason")` returns `null` (expected `"session_expired"`)

Middleware code at lines 118-119 is correct. The 3 basic redirect tests (navigate to protected route → end up at `/login`) pass, confirming the middleware redirect fires. The params are being stripped — most likely by the login page rendering or a secondary redirect. Needs investigation and fix.

---

_Verified: 2026-04-28T21:00:00Z_
_Updated: 2026-04-28 (runtime evidence from user E2E run)_
_Verifier: Claude (gsd-verifier)_
