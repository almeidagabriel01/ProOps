---
status: testing
phase: 02-auth-multitenant
source: [02-01-PLAN.md, 02-02-PLAN.md]
started: 2026-04-07T02:48:33Z
updated: 2026-04-07T02:48:33Z
---

## Current Test

number: 8
name: Tenant isolation — Firestore blocks cross-tenant reads
expected: Cross-tenant reads are blocked by Firestore security rules.
awaiting: complete

## Tests

### 1. E2E test suite passes — all 17 tests green
expected: Running `npx playwright test` completes with 17 passed, 0 failed. Output shows AUTH-01 through AUTH-06 all green.
result: pass

### 2. Login with valid credentials
expected: On the /login page, entering admin@alpha.test credentials and submitting redirects to an authenticated route (/dashboard or /proposals). The login form disappears and the app is fully loaded.
result: pass

### 3. Login with invalid credentials shows error
expected: On the /login page, entering wrong credentials (e.g. wrong@test.com / wrongpassword) and submitting keeps the user on /login and shows a visible error message (not just a console log — something on the page).
result: pass

### 4. Session persists after page reload
expected: After logging in, pressing F5 / reloading the page keeps the user on the authenticated route. They are NOT redirected back to /login.
result: pass

### 5. Logout clears session and redirects to /login
expected: After logging in, clicking "Sair" (the logout button in the sidebar) redirects the user to /login. The login form is visible again. The __session cookie is absent from the browser.
result: pass

### 6. Custom claims in Firebase ID token
expected: The Firebase ID token for admin@alpha.test contains: tenantId = "tenant-alpha", role = "admin", masterId = "user-admin-alpha". For member@alpha.test: tenantId = "tenant-alpha", role = "member", masterId = "user-admin-alpha". (Verified by AUTH-04 tests via JWT decode.)
result: pass

### 7. Protected routes redirect unauthenticated users
expected: Visiting /dashboard, /proposals, or /transactions WITHOUT being logged in (no cookies) immediately redirects to /login. The protected page content is never shown.
result: pass

### 8. Tenant isolation — Firestore blocks cross-tenant reads
expected: An authenticated request with Tenant Alpha's ID token trying to read Tenant Beta's proposal document from Firestore gets a 403 PERMISSION_DENIED response. The same applies to write attempts.
result: pass (covered by E2E suite AUTH-05)

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
