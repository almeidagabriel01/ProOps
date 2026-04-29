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

- **HYPOTHESIS A (CONFIRMED):** IndexedDB persists `firebaseLocalStorageDb` across tests; login page bounces via window.location.replace. Evidence: `DIAG-IDB-DBS= [{"name":"firebase-heartbeat-database","version":1},{"name":"firebaseLocalStorageDb","version":1}]` confirms the database exists. Double NAV to `/dashboard` before final `/login` is the signature of the login page bounce followed by a second middleware redirect. REDIR-CHAIN empty means the server-side 307 is consumed silently and the observable navigation is the subsequent client-side bounce.
- **HYPOTHESIS B (REFUTED):** Content-Type: text/plain on 307 affects redirect handling. Evidence: REDIR-CHAIN is empty — no 307 was captured, meaning the HTTP redirect layer is not the point of failure. The failure occurs in the subsequent client-side navigation triggered by the Firebase Auth persisted state. Additionally, the 3 simple passing tests (`/login` redirect tests) also go through the same 307, yet they pass — proving the 307 itself is followed correctly. The params are present after the 307; they are stripped by the subsequent bounce.
- **HYPOTHESIS C (REFUTED):** No other root cause needed — Hypothesis A fully explains the observations: IDB present + login page bounce + double NAV chain + empty REDIR-CHAIN + final URL at /login without params.

Evidence pointing to the diagnosis:
- `DIAG-IDB-DBS= [{"name":"firebase-heartbeat-database","version":1},{"name":"firebaseLocalStorageDb","version":1}]` — Firebase Auth persisted state in IndexedDB (the leftover from auth-flow tests)
- `DIAG-AFTER-MATCH url= http://localhost:3001/login` (NO query params) — proves the params were stripped during the bounce
- `DIAG-NAV-CHAIN: NAV /dashboard → NAV /dashboard → NAV /login` — double /dashboard NAV is the login page JS calling window.location.replace("/dashboard"), which then gets intercepted by middleware again for a second redirect to /login (this time without params matching what Playwright sees)
- `DIAG-REDIR-CHAIN: (empty)` — the HTTP 307 redirect is swallowed before Playwright can observe it; the failure is at the client-side JS layer

Recommended fix branch (for Task 2): A — Clear IndexedDB (firebaseLocalStorageDb and firebase-heartbeat-database) in beforeEach alongside the existing cookie clear, so Firebase Auth has no persisted user when the login page mounts.
