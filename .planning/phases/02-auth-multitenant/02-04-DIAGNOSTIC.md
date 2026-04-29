# AUTH-05 Diagnostic Output

Date: 2026-04-29
Run: npx playwright test e2e/auth/route-guards.spec.ts

## Test 13: redirect param

### URLs at each phase
DIAG-AFTER-GOTO url= http://localhost:3001/dashboard
DIAG-AFTER-MATCH url= http://localhost:3001/login
DIAG-AFTER-WAIT url= http://localhost:3001/login

### IndexedDB
DIAG-IDB-DBS= [{"name":"firebase-heartbeat-database","version":1},{"name":"firebaseLocalStorageDb","version":1}]

### Navigation chain
DIAG-NAV-CHAIN:
NAV http://localhost:3001/dashboard
NAV http://localhost:3001/dashboard
NAV http://localhost:3001/login

### Redirect chain
DIAG-REDIR-CHAIN:
(empty — no 3xx HTTP responses captured by Playwright response listener)

## Test 14: redirect_reason param

### URLs at each phase
DIAG-AFTER-GOTO url= http://localhost:3001/proposals
DIAG-AFTER-MATCH url= http://localhost:3001/login
DIAG-AFTER-WAIT url= http://localhost:3001/login

### IndexedDB
DIAG-IDB-DBS= [{"name":"firebase-heartbeat-database","version":1},{"name":"firebaseLocalStorageDb","version":1}]

### Navigation chain
DIAG-NAV-CHAIN:
NAV http://localhost:3001/proposals
NAV http://localhost:3001/proposals
NAV http://localhost:3001/login

### Redirect chain
DIAG-REDIR-CHAIN:
(empty — no 3xx HTTP responses captured by Playwright response listener)

## Diagnosis

**Strip point:** The query params (`redirect` and `redirect_reason`) ARE set by the middleware in the 307 Location header, but they are stripped before Playwright reads `page.url()` after `toHaveURL(/\/login/)` matches.

**Evidence analysis:**

- DIAG-AFTER-GOTO shows the URL is still at the protected route (`/dashboard` / `/proposals`) — the `page.goto()` call returned before the server 307 redirect was followed by the browser, confirming Next.js middleware fires asynchronously relative to Playwright's goto.
- DIAG-AFTER-MATCH shows the URL settled at `/login` WITHOUT query params — meaning the redirect params were present in an intermediate URL but stripped before Playwright's assertion.
- DIAG-REDIR-CHAIN is EMPTY — Playwright's `page.on("response")` listener captured zero 3xx responses. This indicates the redirect chain was either handled before listener registration or was a client-side JS navigation (not HTTP redirect).
- DIAG-NAV-CHAIN shows a double navigation: `NAV /dashboard` → `NAV /dashboard` → `NAV /login`. The double `/dashboard` navigation indicates a client-side JS bounce from the login page back to `/dashboard` (handleRedirectAfterAuth called window.location.replace("/dashboard")), which triggered the middleware AGAIN for a second unauthenticated redirect to `/login?...`. The final URL settles at `/login` WITHOUT params because Playwright's `toHaveURL(/\/login/)` matched during the bouncing.
- DIAG-IDB-DBS confirms `firebaseLocalStorageDb` EXISTS in IndexedDB — Firebase Auth persisted user state from a prior test (auth-flow.spec.ts which runs first alphabetically). The `beforeEach` clears cookies but NOT IndexedDB, leaving the Firebase Auth token intact.

**Root cause:** Firebase Auth's `onAuthStateChanged` fires on the login page because `firebaseLocalStorageDb` persists the authenticated user from the prior auth-flow test. The `useLoginForm` useEffect (lines 363-403 in useLoginForm.ts) sees `user != null` and `redirectReason === "session_expired"` and waits for `isSessionSynced`. Meanwhile, or once synced, it calls `handleRedirectAfterAuth` which executes `window.location.replace(target)` (line 299). This causes the browser to navigate away from `/login?redirect=/dashboard&...` to `/dashboard`. The middleware fires again with no session cookie, redirecting to `/login` again. The final URL at the time Playwright's `toHaveURL` assertion resolves is `/login` (no query params) because the URL is in a transient state between bounces.

- **HYPOTHESIS A (INITIALLY CONFIRMED, THEN REFUTED BY EMPIRICAL TESTING):** IndexedDB persists `firebaseLocalStorageDb` across tests; login page bounces via window.location.replace. The IDB presence was confirmed, but applying Branch A (clearing IDB in beforeEach) DID NOT fix the tests. Failure time went from 2.6s to 761ms (faster, meaning LESS bouncing — not the primary mechanism). Branch A empirically refuted as the sole root cause. IDB clearing was retained as test hygiene but is not the fix.
- **HYPOTHESIS B (REFUTED):** Content-Type: text/plain on 307 affects redirect handling. Evidence: middleware does NOT redirect `/dashboard` at all — it returns HTTP 200 OK. There is no 307 to have a bad Content-Type on. Refuted definitively.
- **HYPOTHESIS C (CONFIRMED — ACTUAL ROOT CAUSE):** The `ProtectedRoute` client-side component (`src/components/auth/protected-route.tsx` line 119) calls `router.push("/login")` WITHOUT any query params when `auth.currentUser` is null. This is the actual redirect mechanism observed by Playwright. The middleware is bypassed for the initial `/dashboard` page load (returns 200 OK for the HTML shell) because Next.js App Router delivers the shell client-side. The client React tree then mounts, `ProtectedRoute` detects no Firebase user, and calls `router.push("/login")` — stripping the redirect and redirect_reason params that middleware would have set.

Evidence pointing to the confirmed root cause (Branch C):
- HTTP-level check of `/dashboard` with no cookies returned **200 OK** (no Location header) — middleware does NOT redirect the route
- Adding `console.log("[MIDDLEWARE-ENTRY]")` at the first line of `middleware()` — it never printed for `/dashboard` requests — middleware not called for client-navigated routes
- Security headers (X-Frame-Options, CSP) on 200 responses come from `next.config.ts` `headers()` config, NOT middleware — this was the misleading signal
- `router.push("/login")` at `protected-route.tsx:119` has no query params — confirmed in source code inspection
- Branch A applied → tests still failed (761ms failure vs 2.6s — faster means less bouncing, confirming the mechanism changed but not the root cause)

**Applied fix (Branch C — Task 2):** Changed `protected-route.tsx` line ~119 from:
```ts
router.push("/login");
```
to:
```ts
router.push(`/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired`);
```

Recommended fix branch (for Task 2): C — Fix ProtectedRoute to pass redirect params when performing client-side login redirect.
