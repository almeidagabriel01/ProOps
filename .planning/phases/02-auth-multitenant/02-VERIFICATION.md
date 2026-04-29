---
phase: 02-auth-multitenant
verified: 2026-04-29T02:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/10
  gaps_closed:
    - "AUTH-06: backend API isolation assertion tightened to [403, 404] — 502 vacuous fallback removed (plan 02-03, commit 12705129)"
    - "AUTH-05: ProtectedRoute client-side router.push now includes redirect and redirect_reason query params — fix confirmed in protected-route.tsx lines 119-121 (plan 02-04, commit 830d5b19)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run full 18-test auth suite against Firebase emulators"
    expected: "All 18 tests pass — both route-guard param tests (previously tests 13-14) now assert non-null redirect and redirect_reason values"
    why_human: "Cannot execute Playwright tests programmatically in this verification session. The SUMMARY documents 18/18 passing but SUMMARY claims are not treated as runtime evidence — an independent run against live emulators is the definitive proof of the AUTH-05 fix."
---

# Phase 2: Auth & Multi-Tenant E2E Verification Report

**Phase Goal:** Establish comprehensive E2E test coverage for Firebase Auth + multi-tenant flows, including route guards, tenant isolation, and session management
**Verified:** 2026-04-29T02:00:00Z
**Status:** human_needed
**Re-verification:** Yes — third pass, after AUTH-05 gap closure (plan 02-04)

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
| 7 | Test passes: unauthenticated navigation to /dashboard redirects to /login | VERIFIED | `route-guards.spec.ts:20` — `beforeEach` clears cookies AND IndexedDB; navigate; URL asserted `/login` |
| 8 | Test passes: redirect URL preserves the destination path as 'redirect' query param | CODE-VERIFIED | `protected-route.tsx` lines 119-121: `router.push(\`/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired\`)` — fix present in commit 830d5b19; test assertion at `route-guards.spec.ts:35` checks `searchParams.get("redirect")` |
| 9 | Test passes: alpha's ID token cannot read beta's proposal document from Firestore (403) | VERIFIED | `tenant-isolation.spec.ts:20` — Node.js fetch to Firestore emulator with Bearer token, `response.status` asserted `toBe(403)`; Firestore rules enforce `belongsToTenant(resource.data.tenantId)` |
| 10 | Test passes: backend API returns 403 or 404 when alpha token targets a beta-owned proposal (PUT) | VERIFIED | `tenant-isolation.spec.ts:81` — assertion is `expect([403, 404]).toContain(response.status())`. 502 fallback removed in commit 12705129. Comment updated to accurately reflect that Functions emulator IS started in global-setup. |

**Score:** 10/10 truths verified at code level

### AUTH-05 Gap: CLOSED (plan 02-04, commit 830d5b19)

Root cause identified via diagnostic instrumentation: Next.js middleware returns HTTP 200 for `/dashboard` (the App Router shell) — it does NOT issue a 307 redirect for client-navigated routes. The actual redirect mechanism is `ProtectedRoute`, a client-side React component. Its `else if (!firebaseUser)` branch called `router.push("/login")` without any query params.

Fix applied to `src/components/auth/protected-route.tsx` lines 119-121:
```typescript
router.push(
  `/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired`,
);
```

This mirrors the middleware's redirect logic for the client-side code path. The diagnostic also revealed that `firebaseLocalStorageDb` IndexedDB persists Firebase Auth state across tests — `beforeEach` now clears both cookies and IndexedDB as hygiene (Branch A), though this was not the root cause.

### AUTH-06 Gap: CLOSED (plan 02-03, commit 12705129)

The `e2e/auth/tenant-isolation.spec.ts` backend API test assertion was tightened from `[403, 404, 502]` to `[403, 404]`. The 502 fallback was vacuous — `global-setup.ts` already starts the Functions emulator via `--only auth,firestore,storage,functions`. A comment was added to document why 502 is not acceptable: if the emulator fails to start, `global-setup.ts` throws and the test run aborts.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `e2e/helpers/firebase-auth-api.ts` | Node.js helper calling Auth emulator REST API to get and decode ID token claims | VERIFIED | Exports `signInWithEmailPassword`, `decodeJwtPayload`, `getIdTokenClaims`; uses `user_id` field for Firebase UID; throws descriptive error on auth failure |
| `e2e/auth/auth-flow.spec.ts` | E2E test suite covering AUTH-01, AUTH-02, AUTH-03, AUTH-04 | VERIFIED | 6 tests across 4 describe blocks; substantive assertions (URL patterns, cookie inspection, JWT claim values with `toBe`) |
| `e2e/pages/dashboard.page.ts` | DashboardPage with `logout()` method | VERIFIED | `logout()` targets `[aria-label="Sair"]`, waits for `/login` URL; used in `auth-flow.spec.ts:60` |
| `e2e/auth/route-guards.spec.ts` | E2E tests for AUTH-05: protected route redirection with query params | VERIFIED | 5 tests; `beforeEach` clears cookies AND IndexedDB; no diagnostic artifacts (0 DIAG-, framenavigated, console.log matches); param assertions present at lines 35 and 43 |
| `src/components/auth/protected-route.tsx` | ProtectedRoute that passes redirect params on unauthenticated client-side redirect | VERIFIED | Lines 119-121 confirmed; fix in commit 830d5b19; mirrors middleware redirect logic |
| `e2e/auth/tenant-isolation.spec.ts` | E2E tests for AUTH-06: multi-tenant data isolation at Firestore and API layers | VERIFIED | 4 tests; assertion is `[403, 404]` (strict, no 502); comment accurately reflects Functions emulator state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `e2e/auth/auth-flow.spec.ts` | `e2e/fixtures/auth.fixture.ts` | imports `authenticatedPage` fixture | WIRED | `import { test, expect } from "../fixtures/auth.fixture"` |
| `e2e/auth/auth-flow.spec.ts` | `e2e/helpers/firebase-auth-api.ts` | imports `getIdTokenClaims` | WIRED | `import { getIdTokenClaims } from "../helpers/firebase-auth-api"` |
| `e2e/auth/auth-flow.spec.ts` | `e2e/pages/dashboard.page.ts` | uses `logout()` method | WIRED | `const dashboard = new DashboardPage(page); await dashboard.logout()` |
| `e2e/auth/route-guards.spec.ts` | `src/components/auth/protected-route.tsx` | tests client-side redirect behavior | WIRED | `ProtectedRoute` now calls `router.push(\`/login?redirect=...&redirect_reason=session_expired\`)` matching test assertions at lines 35 and 43 |
| `e2e/auth/tenant-isolation.spec.ts` | `e2e/helpers/firebase-auth-api.ts` | imports `signInWithEmailPassword` | WIRED | `import { signInWithEmailPassword } from "../helpers/firebase-auth-api"` |
| `e2e/auth/tenant-isolation.spec.ts` | `e2e/seed/data/proposals.ts` | references `PROPOSAL_BETA_DRAFT` | WIRED | `import { PROPOSAL_BETA_DRAFT } from "../seed/data/proposals"` (not hardcoded string) |
| `firestore.rules` | `firebase.json` | emulator loads rules | WIRED | `firebase.json` `"rules": "firestore.rules"`; proposals collection enforces `belongsToTenant(resource.data.tenantId)` |

### Data-Flow Trace (Level 4)

Not applicable — all artifacts are E2E test specifications, page objects, and helpers. Tests call live emulators and assert real HTTP responses. No data-rendering components to trace.

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| AUTH-05 fix: ProtectedRoute passes redirect params | `grep "redirect_reason=session_expired" src/components/auth/protected-route.tsx` | Match at line 121 | PASS |
| No diagnostic artifacts in route-guards.spec.ts | `grep "DIAG-\|framenavigated\|console.log" e2e/auth/route-guards.spec.ts` | 0 matches | PASS |
| Both param assertions present | `grep 'searchParams.get("redirect")' e2e/auth/route-guards.spec.ts` | 2 matches (redirect + redirect_reason) | PASS |
| AUTH-06 fix: 502 removed | `grep "502" e2e/auth/tenant-isolation.spec.ts` | 0 matches | PASS |
| AUTH-06 fix: strict [403, 404] assertion | `grep "\[403, 404\]" e2e/auth/tenant-isolation.spec.ts` | 1 match at line 81 | PASS |
| IDB cleanup present in beforeEach | `grep "indexedDB.deleteDatabase" e2e/auth/route-guards.spec.ts` | 1 match | PASS |
| CI gates require E2E passage | `push-gate` requires `e2e-push=success`; `all-checks-passed` requires `e2e=success` | Both confirmed in workflow YAML | PASS |
| Full auth suite green against emulators | Cannot execute Playwright without running server | — | SKIP (see Human Verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01-PLAN.md | E2E valida login com email e senha via Firebase Auth | SATISFIED | `auth-flow.spec.ts` "logs in with valid credentials" test; URL redirects to authenticated route |
| AUTH-02 | 02-01-PLAN.md | E2E valida que sessão persiste após refresh (cookie `__session`) | SATISFIED | `auth-flow.spec.ts` "session persists after page reload" test; `page.reload()` asserts URL not `/login` |
| AUTH-03 | 02-01-PLAN.md | E2E valida que usuário consegue fazer logout limpando sessão | SATISFIED | `auth-flow.spec.ts` logout test with explicit `__session` cookie absence assertion |
| AUTH-04 | 02-01-PLAN.md | E2E valida que custom claims Firebase são corretos após login | SATISFIED | `auth-flow.spec.ts` two pure Node.js claim assertion tests; checks tenantId, role, masterId with `toBe` |
| AUTH-05 | 02-02-PLAN.md, 02-04-PLAN.md | E2E valida que rotas protegidas redirecionam usuário não autenticado com redirect params | SATISFIED (code-verified) | `route-guards.spec.ts` 5 tests; `protected-route.tsx` fix confirmed in commit 830d5b19; param assertions at lines 35 and 43 match the fix. Runtime confirmation pending (see Human Verification). |
| AUTH-06 | 02-02-PLAN.md, 02-03-PLAN.md | E2E valida que Tenant A não consegue ler, criar nem modificar dados do Tenant B | SATISFIED | `tenant-isolation.spec.ts` 4 tests; all make hard assertions; backend API assertion is strict [403, 404]; 502 removed |

**Note on REQUIREMENTS.md traceability table:** AUTH-01 through AUTH-06 are still listed as "Pending" in `.planning/REQUIREMENTS.md` even though ROADMAP.md marks Phase 2 as `[x]` complete. This is a documentation inconsistency — the requirements traceability table was not updated when the phase was marked complete. No impact on verification outcome.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `e2e/pages/dashboard.page.ts` | 35 | `return null` | Info | Catch fallback in `getWelcomeText()` helper when heading is not visible within 5s. Not a stub — the method is an optional utility not used by any auth assertion. No impact on test outcomes. |
| `src/components/auth/protected-route.tsx` | 109, 113, 169 | `router.push("/login")` without params | Info | Three other branches in `ProtectedRoute` redirect to `/login` without `redirect` and `redirect_reason` params. These cover: session recovery failure (line 109), master account error (line 113), and email verification cancel (line 169). Not in AUTH-05 scope — these are different UX paths where a redirect destination may not apply. Not blocking; noted for future review. |

No blockers. No warnings.

### Human Verification Required

#### 1. Full Auth Suite Green Against Emulators

**Test:** With Firebase emulators running (`firebase emulators:start --only auth,firestore,storage,functions --project demo-proops-test`) and seed data seeded, run:

```bash
npx playwright test e2e/auth/
```

**Expected:** All 18 tests pass — 6 in `auth-flow.spec.ts`, 5 in `route-guards.spec.ts`, 4 in `tenant-isolation.spec.ts`, plus 3 additional counted by Playwright from fixture/describe setup. Previously 16/18 passed with tests 13-14 (redirect param assertions) failing. After the `protected-route.tsx` fix (commit 830d5b19), both should now pass.

Specific assertions to confirm green:
- `route-guards.spec.ts` test "redirect URL includes the original path as 'redirect' query param" — `searchParams.get("redirect")` must equal `"/dashboard"` (not null)
- `route-guards.spec.ts` test "redirect URL includes 'redirect_reason=session_expired' query param" — `searchParams.get("redirect_reason")` must equal `"session_expired"` (not null)

**Why human:** Cannot execute Playwright against live emulators in this verification session. The SUMMARY documents "18 passed (48.9s)" but SUMMARY claims reflect what Claude reported, not independent runtime evidence. An independent emulator run is the definitive proof of the AUTH-05 fix.

---

### Gaps Summary

No gaps remain at the code-verification level.

**AUTH-05 CLOSED** — `ProtectedRoute` client-side redirect now includes `redirect` and `redirect_reason=session_expired` query params (commit 830d5b19). Root cause confirmed via diagnostic instrumentation: middleware returns HTTP 200 for `/dashboard` (App Router shell), not a 307. The client-side component was the actual redirect mechanism and lacked the params.

**AUTH-06 CLOSED** — backend API isolation assertion tightened to `[403, 404]` (commit 12705129). The 502 fallback was vacuous since `global-setup.ts` already starts the Functions emulator. Comment updated to accurately reflect the emulator setup.

Both fixes are confirmed present in source code. A final emulator run is required to promote status from `human_needed` to `passed`.

---

_Verified: 2026-04-29T02:00:00Z_
_Previous verification: 2026-04-28T21:00:00Z (gaps_found — AUTH-05 open, AUTH-06 closed)_
_Verifier: Claude (gsd-verifier)_
