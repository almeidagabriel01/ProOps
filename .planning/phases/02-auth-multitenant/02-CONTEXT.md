# Phase 2: Auth & Multi-Tenant E2E - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests prove that authentication works end-to-end and that multi-tenant data isolation is enforced — the security foundation for all other test phases. Covers login flow, session persistence, logout, custom claims verification, protected route guards, and Firestore/backend tenant isolation. Writing tests for proposals, financial flows, or any feature-specific behavior is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Foundation Available from Phase 1
- **D-01:** `auth.fixture.ts` already provides `authenticatedPage` (alpha admin) and `authenticatedAsBeta` (beta admin) fixtures that perform real Firebase login against emulators — Phase 2 tests extend these directly.
- **D-02:** `base.fixture.ts` already intercepts Firebase SDK requests (identitytoolkit, securetoken, Firestore REST) and routes them to local emulators — no additional interception needed for new tests.
- **D-03:** Seed data provides 4 deterministic users (2 tenants × 2 roles) and known document IDs (e.g., `proposal-beta-draft` for tenant-beta) that isolation tests can reference without querying.

### Custom Claims Verification (AUTH-04)
- **D-04:** Custom claims cannot be read from the browser-side Firebase SDK without exposing internal state. Instead, a helper `e2e/helpers/firebase-auth-api.ts` calls the Auth emulator REST API (`POST /identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`) to get the raw ID token, then base64url-decodes the JWT payload to extract custom claims (`tenantId`, `role`, `masterId`). This is a pure Node.js test-side operation with no browser involvement.

### Tenant Isolation Strategy (AUTH-06)
- **D-05:** Isolation is tested at two layers:
  1. **Backend API layer**: Playwright `request` fixture calls the Next.js proxy (`/api/backend/proposals/:id`) with alpha's ID token targeting a beta-owned document. The backend enforces `req.user.tenantId` in all queries, so the response must be 403 or 404.
  2. **Firestore rules layer**: Direct Firestore emulator REST call with alpha's ID token targeting `proposals/proposal-beta-draft`. Firestore security rules must return 403.
- **D-06:** Firestore emulator is started with the project's `firestore.rules` (via `firebase.json`). The demo project prefix (`demo-proops-test`) triggers emulator mode but does NOT skip security rules — rules are always enforced in emulators.

### Route Guard Tests (AUTH-05)
- **D-07:** Route guard tests use fresh browser contexts with NO cookies set (no auth fixture). Navigation to protected routes (`/dashboard`, `/proposals`, `/transactions`) must redirect to `/login` with `redirect` and `redirect_reason=session_expired` query params, as implemented in `middleware.ts`.

### Logout (AUTH-03)
- **D-08:** The logout trigger is expected to be in the app's navigation/sidebar. The implementer reads the layout components to find it (likely button with text "Sair"). A `logout()` helper is added to `DashboardPage` POM. After logout, the `__session` cookie must be absent from `page.context().cookies()`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Phase 1 infrastructure (already built — extend, don't rewrite)
- `e2e/fixtures/auth.fixture.ts` — `authenticatedPage`, `authenticatedAsBeta` fixtures, `interceptFirebaseRequests()`
- `e2e/fixtures/base.fixture.ts` — `setupEmulatorRoutes()`, base fixture with POM instances
- `e2e/seed/data/users.ts` — `USER_ADMIN_ALPHA`, `USER_MEMBER_ALPHA`, `USER_ADMIN_BETA`, `USER_MEMBER_BETA` with real credentials
- `e2e/seed/data/proposals.ts` — `PROPOSAL_BETA_DRAFT` with `id: 'proposal-beta-draft'`, `tenantId: 'tenant-beta'`
- `e2e/pages/login.page.ts` — `LoginPage` with `login()`, `getErrorMessage()`, `isLoginFormVisible()`
- `e2e/pages/dashboard.page.ts` — `DashboardPage` (to extend with `logout()`)

### App auth mechanism
- `middleware.ts` (root) — checks `__session` cookie, redirects unauthenticated requests with `?redirect=<path>&redirect_reason=session_expired`

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-06 define exact acceptance criteria

### Emulator topology
- Auth emulator: `http://127.0.0.1:9099`
- Firestore emulator: `http://127.0.0.1:8080`
- Project ID: `demo-proops-test`
- Auth emulator sign-in endpoint: `POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`

</canonical_refs>

<code_context>
## Existing Code Insights

### Auth fixture already handles emulator routing
`auth.fixture.ts` uses `interceptFirebaseRequests()` via `page.addInitScript()` to rewrite Firebase SDK URLs to emulator addresses. This works for browser-side auth flows. For server-side/Node.js token inspection, the helper must call the Auth emulator REST API directly (no browser involved).

### Session cookie mechanism
The app sets `__session` cookie client-side after login (Firebase Auth convention for Next.js). `middleware.ts` reads this cookie for route protection. Tests verify it's present after login and absent after logout.

### Backend isolation guarantee
All backend controllers use `req.user.tenantId` (never request body) for Firestore filtering. Attempting to access a document with a mismatched tenantId yields 403 or 404. The specific behavior (403 vs 404) depends on whether the controller checks tenantId on the document or just filters queries — tests should accept either.

### Firestore security rules
`firestore.rules` at project root is loaded by the emulator. Rules are DENY-by-default. Any cross-tenant document access with a client SDK token must fail with HTTP 403 (PERMISSION_DENIED from Firestore).

</code_context>

<deferred>
## Deferred Ideas

- Testing with member role specifically (AUTH-04 tests both admin and member claims, but functional role-based access tests deferred to Phase 3+)
- Testing `AUTH_ACCEPT_LEGACY_COOKIE_HINT` behavior (legacy cookie fallback in middleware) — not core to the phase goal

</deferred>

---

*Phase: 02-auth-multitenant*
*Context gathered: 2026-04-06*
