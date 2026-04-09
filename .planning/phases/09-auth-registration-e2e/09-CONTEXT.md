# Phase 9 Context: Auth Registration E2E

**Phase:** 9 — Auth Registration E2E
**Requirements:** REG-01, REG-02, REG-03
**Created:** 2026-04-09

---

## Decisions

### Registration flow reality (critical)
- Self-signup (`handleRegister` in `src/app/login/_hooks/useLoginForm.ts`) does NOT call `setCustomUserClaims`
- It creates: Firebase Auth user + `tenants/{tenantId}` doc + `users/{uid}` doc with `role: "free"`, `tenantId: "tenant_{uid}"`, no `masterId`
- After submit, the app shows `EmailVerificationPending` screen
- With `NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION=true` (set in playwright.config.ts webServer env): `verifyIfConfirmed()` auto-proceeds → calls `forceSyncSession()` → `onVerified()` → `window.location.reload()`
- On reload: auth provider reads Firestore user doc → `role: "free"` → `useLoginForm` redirects to `'/'` (not `/dashboard`)

### REG-01: Form navigation
- Navigate to `/register` directly — URL auto-sets `mode = "register"` in `useLoginForm` (`pathname === "/register"` check at line ~240)
- **Step 1** (Account): `id="reg-name"` (name), `id="email"` (email), `id="password"` (password)
  - Phone (`id="reg-phone"`) is optional — skip it to avoid Brazil phone format validation
  - Click StepNavigation "Continuar" to advance
- **Step 2** (Company): `id="companyName"` (company name), `id="niche"` (select — leave at default value)
  - Click StepNavigation "Continuar" to advance
- **Step 3** (Brand): branding is optional — don't fill color or logo, just click StepNavigation `submitLabel="Finalizar"`
- Before Firebase user creation, the app calls `POST /api/backend/v1/validation/contact` with email — this hits the Functions emulator and will pass as long as the email is unique and properly formatted

### REG-02: Claims verification — via Firestore Admin SDK
- After form submit, sign in via `signInWithEmailPassword()` helper (from `e2e/helpers/firebase-auth-api.ts`) to get the UID
- Use `getTestDb()` helper (from `e2e/helpers/admin-firestore.ts`) to read Firestore documents
- Verify `users/{uid}` doc exists with: `tenantId: "tenant_{uid}"`, `role: "free"`, `email: <testEmail>`
- Verify `tenants/tenant_{uid}` doc exists with: `name: <companyName>` field set
- `masterId` is NOT verified — it is not set during self-signup and is not part of the self-registration contract

### REG-03: Dashboard access verification
- "Accessing the dashboard" for a free-plan user means the app correctly completed the auth flow
- Free users are redirected to `'/'` by `handleRedirectAfterAuth` (role check at line ~305 in `useLoginForm`)
- Test verifies the user lands on `'/'` URL — this proves: registration succeeded, auth state was established, session was synced, redirect happened

### Test isolation
- Unique timestamp email per run: `reg-test-${Date.now()}@test.com` (or similar pattern)
- No `afterEach` cleanup — emulator is reset by `globalSetup` per suite run, so users don't accumulate across CI runs
- Phone number: leave blank (optional) to avoid Brazilian mobile phone format validation
- Niche: leave at default (first option — `automacao_residencial`)

### POM structure
- New file: `e2e/pages/register.page.ts` — `RegisterPage` class
- Methods to expose: `goto()`, `fillStep1(name, email, password)`, `fillStep2(companyName)`, `submitStep3()`, `waitForVerificationScreen()`, `waitForHomeRedirect()`
- `isLoaded()` checks URL is `/register` and reg-name input is visible
- Follows the class-based locator-as-properties pattern of existing POMs

### Test file location
- `e2e/auth/auth-registration.spec.ts` — alongside `auth-flow.spec.ts`, `route-guards.spec.ts`, `tenant-isolation.spec.ts`

### Key infrastructure reuse
- `signInWithEmailPassword()` from `e2e/helpers/firebase-auth-api.ts` — to retrieve UID post-registration for Firestore verification
- `getTestDb()` from `e2e/helpers/admin-firestore.ts` — to read Firestore emulator docs for REG-02 assertions
- No `authenticatedPage` fixture needed — registration uses an unauthenticated browser page (fresh page)

---

## Out of Scope for Phase 9
- Google OAuth registration flow — deferred
- Phone SMS verification flow — deferred (phone field left blank in tests)
- Testing role promotion from "free" to "ADMIN" after Stripe payment — deferred to billing tests
- Verifying onboarding flow after registration — deferred
- Error states (duplicate email, weak password) — deferred
