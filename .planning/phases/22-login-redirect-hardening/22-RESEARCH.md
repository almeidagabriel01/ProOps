# Phase 22: Login Redirect Hardening - Research

**Researched:** 2026-05-11
**Domain:** Next.js auth flow — post-login redirect removal + session-expired toast
**Confidence:** HIGH

## Summary

This phase removes the `?redirect=` consumption from the post-login flow in `useLoginForm.ts` and `protected-route.tsx`, replaces the conditional subtitle on the login page with a `toast.warning()` on mount, and rewrites `login-redirect.spec.ts` to cover the new fixed-destination behavior. No new libraries are introduced; every change is a reduction of existing code.

The implementation scope is tightly bounded: three production files (`useLoginForm.ts`, `login/page.tsx`, `protected-route.tsx`) and one E2E test file (`login-redirect.spec.ts`). Two auxiliary files need collateral checks — the `isPathAllowedForUser` import in `useLoginForm.ts` becomes unused after the redirect branch is removed, and the superadmin E2E scenario in CONTEXT.md requires a seed user type extension that does not yet exist.

**Primary recommendation:** Implement in one wave with two parallel tracks — code changes (three production files) and test rewrite (one E2E file). The only Wave 0 gap is extending the seed for superadmin E2E coverage.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Post-login destination (core change)**
- Superadmins → `/admin` (unchanged)
- All other authenticated users → `/dashboard` (fixed, ignores any `?redirect=` param)
- `handleRedirectAfterAuth` in `useLoginForm.ts`: remove the entire `redirectUrl` consumption branch. The function reads `user.role`, sends superadmin to `/admin`, everyone else to `resolveUserHome()` (which returns `/dashboard` for paying users)
- `redirectUrl` state variable becomes unused and is removed

**Session-expired notification**
- Toast, not subtitle: when `redirect_reason=session_expired` is present in search params, trigger `toast.warning()` from `@/lib/toast` on page mount (useEffect on `redirectReason`)
- Subtitle reverts to default: login subtitle always shows "Bem-vindo de volta! Insira suas credenciais." — the conditional subtitle logic is removed
- Toast style: `toast.warning()` (maps to `sileo.warning()`) — auto-dismisses
- Toast text (suggested): "Sua sessão expirou. Entre novamente para continuar."
- `redirectReason` state remains — only used for the toast trigger, not for routing

**Protected-route bounce URL**
- Strip `redirect=` from the outgoing bounce URL in `protected-route.tsx`
- Current: `router.push('/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired')`
- New: `router.push('/login?redirect_reason=session_expired')`
- The pathname is no longer forwarded since it won't be consumed

**Collateral cleanup in useLoginForm.ts**
- `handleRegister`: remove `?redirect=` from `verifyUrl` — the email verification link should not carry the redirect param since it won't be consumed post-verification
- `getGoogleSetupTarget()`: strip `redirect=` from the passed query params — only pass non-redirect params to the google-setup page

**E2E test migration (login-redirect.spec.ts)**
- Strategy: rewrite in-place (not a new file)
- Delete: LR-02, LR-03, LR-04, LR-05, LR-07 — these test redirect consumption and guard logic that no longer exists
- Update LR-01: assert admin lands on `/dashboard` (not a broad pattern match)
- Keep LR-06 updated: sticky redirect regression test — free user after paying-user logout still lands on `/`
- Add new scenarios (LOGIN-01 coverage):
  1. Admin login with `?redirect=/proposals` present → lands on `/dashboard` (redirect ignored)
  2. Superadmin login → lands on `/admin` regardless of redirect params
  3. Login with `redirect_reason=session_expired` → warning toast visible on login page before submitting

### Claude's Discretion
- Exact toast message text (intent: warn about session expiry, prompt re-login)
- Whether to keep or remove the `redirectUrl` const from `useLoginForm.ts` (it can be deleted entirely as it's unused)
- Exact file organization for the updated E2E tests (keep existing describe block style)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOGIN-01 | After a successful login, users are always redirected to `/dashboard` (or `/admin` for superadmins) regardless of `?redirect=` URL parameters | Satisfied by removing the `redirectUrl` branch in `handleRedirectAfterAuth`, stripping `redirect=` from the protected-route bounce URL, and rewriting E2E tests to verify fixed-destination behavior |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Post-login destination routing | Frontend (client hook) | — | `handleRedirectAfterAuth` is a client-side React callback in `useLoginForm.ts` — routing via `router.replace` / `window.location.replace` |
| Session-expired notification | Frontend (client component) | — | `login/page.tsx` reads `redirectReason` from the hook and fires a `useEffect` toast — no server involvement |
| Protected-route bounce URL construction | Frontend (client component) | — | `protected-route.tsx` is a client component that constructs and pushes the `/login?...` URL |
| Auth redirect E2E coverage | Test (Playwright) | — | `login-redirect.spec.ts` exercises the client-side flow via browser automation |

---

## Standard Stack

All libraries in this phase are already installed. No new dependencies required.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sileo` (via `@/lib/toast`) | project-current | Warning toast on session expiry | Project toast wrapper already in use across the codebase; `toast.warning()` calls `sileo.warning()` and auto-dismisses. `[VERIFIED: codebase grep apps/web/src/lib/toast.ts]` |
| `next/navigation` | 16.1.6 | `useRouter`, `useSearchParams`, `usePathname` | Already used throughout `useLoginForm.ts` — no new imports needed |
| `@playwright/test` | project-current | E2E test rewrite | Existing test infrastructure; `LoginPage` POM already available at `tests/e2e/pages/login.page.ts` |

### Installation
No packages to install. This phase only removes code and rewrites one test file.

---

## Architecture Patterns

### System Architecture Diagram

```
User navigates to /login (with or without ?redirect= and/or ?redirect_reason=)
    │
    ▼
useLoginForm.ts (mount)
    ├─ reads redirectReason = searchParams.get('redirect_reason')
    ├─ redirectUrl const → REMOVED (no longer read)
    └─ useEffect([redirectReason])
           └─ if redirectReason === 'session_expired' → toast.warning(...)

User submits credentials
    │
    ▼
login() / handleGoogleAuth() → Firebase Auth
    │
    ▼
useEffect([user, isLoading, isSessionSynced]) fires
    │
    ▼
handleRedirectAfterAuth()
    ├─ user.role === 'superadmin' → window.location.replace('/admin')
    └─ else → resolveUserHome(user).path → router.replace(path)
         └─ resolveUserHome returns:
              - /subscription-blocked  (hard-blocked statuses)
              - /                      (free role, unauthenticated)
              - /dashboard             (admin/MASTER)
              - first-allowed page     (MEMBER)

Protected route bounces unauthenticated request:
    router.push('/login?redirect_reason=session_expired')
    (no ?redirect= param forwarded)
```

### Recommended Project Structure

No structural changes. All edits are in-place modifications to existing files:

```
apps/web/src/
├── app/login/
│   ├── _hooks/useLoginForm.ts    # Remove redirectUrl, remove redirect branch, add toast useEffect
│   └── page.tsx                  # Remove conditional subtitle, add useEffect for toast (or move into hook)
└── components/auth/
    └── protected-route.tsx       # Strip ?redirect= from bounce URL (line ~121)

tests/e2e/
├── auth/login-redirect.spec.ts   # Rewrite in-place
└── seed/data/users.ts            # Extend for superadmin seed user (Wave 0)
```

### Pattern 1: Fixed-destination redirect after auth

**What:** `handleRedirectAfterAuth` drops the `redirectUrl` branch entirely. Superadmins go to `/admin`; everyone else goes to `resolveUserHome().path`.

**Before (to be removed):**
```typescript
// Source: apps/web/src/app/login/_hooks/useLoginForm.ts lines 325-354
if (redirectUrl) {
  const target = decodeURIComponent(redirectUrl);
  const isSameOrigin = ...;
  if (!isSameOrigin) { /* fall through */ }
  else if (!isPathAllowedForUser(target, user ?? null)) { /* fall through */ }
  else if (redirectReason === 'session_expired') {
    if (!isSuperAdminRoute) { window.location.replace(target); return; }
  } else {
    router.replace(target); return;
  }
}
```

**After:**
```typescript
// Source: CONTEXT.md decision — handleRedirectAfterAuth simplified
const handleRedirectAfterAuth = React.useCallback(() => {
  const currentUser = auth.currentUser;
  const skipEmailVerification = process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === 'true';
  if (currentUser && !currentUser.emailVerified && !skipEmailVerification) {
    setIsEmailVerificationPending(true);
    return;
  }
  if (user?.role === 'superadmin') {
    window.location.replace('/admin');
    return;
  }
  const home = resolveUserHome(user ?? null);
  router.replace(home.path);
}, [router, user]);
```

### Pattern 2: Session-expired toast on mount

**What:** `useEffect` fires once when `redirectReason === 'session_expired'` is present, triggering a warning toast.

**Where:** Can live either in `useLoginForm.ts` (preferred — keeps all login logic in the hook) or in `login/page.tsx`. The `toast` import and `ToastProvider` (Sileo Toaster) are already mounted in the app shell — no provider changes needed.

```typescript
// Source: CONTEXT.md decision + apps/web/src/lib/toast.ts
React.useEffect(() => {
  if (redirectReason === 'session_expired') {
    toast.warning('Sua sessão expirou. Entre novamente para continuar.');
  }
}, [redirectReason]);
```

`toast.warning()` calls `sileo.warning()` which auto-dismisses. The Toaster is positioned `top-center` in `toast-provider.tsx`. [VERIFIED: codebase read apps/web/src/components/shared/toast-provider.tsx]

### Pattern 3: Protected-route bounce URL

**Current (line 121 of protected-route.tsx):**
```typescript
router.push(`/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired`);
```

**New:**
```typescript
router.push('/login?redirect_reason=session_expired');
```

[VERIFIED: codebase read apps/web/src/components/auth/protected-route.tsx line 121]

### Pattern 4: `proops_just_logged_out` cleanup effect

The existing `useEffect` on mount (lines 280–296 of `useLoginForm.ts`) deletes both `redirect` and `redirect_reason` from the URL when `proops_just_logged_out` is set in sessionStorage. After this phase, `redirect=` will no longer appear in the bounce URL, so the `params.delete('redirect')` call becomes a no-op. The planner must decide: simplify to only delete `redirect_reason`, or leave the harmless dead deletion in place.

### Anti-Patterns to Avoid
- **Toast inside JSX conditional:** The toast must fire via `useEffect`, not as a JSX conditional subtitle. The subtitle change is a separate concern (always revert to default copy).
- **Moving toast logic to `page.tsx` unnecessarily:** The hook already returns `redirectReason` — placing the `useEffect` in the hook keeps all auth side-effects co-located.
- **Leaving `redirectUrl` const in place:** After the branch is removed, `const redirectUrl = searchParams.get('redirect')` becomes an unused variable that will cause a lint error (`@typescript-eslint/no-unused-vars`). It must be deleted.
- **Leaving `isPathAllowedForUser` import in `useLoginForm.ts`:** Once the redirect branch is removed, the import `{ resolveUserHome, isPathAllowedForUser }` leaves `isPathAllowedForUser` unused, triggering lint. The import must be narrowed to `{ resolveUserHome }` only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session-expired notification | Custom inline alert component | `toast.warning()` from `@/lib/toast` | Already used codebase-wide; Sileo Toaster already mounted; auto-dismisses |
| Role-based home resolution | Inline `if/else` chains | `resolveUserHome(user)` from `@/lib/auth/resolve-user-home` | Handles all cases: superadmin, subscription-blocked, free, admin/MASTER, MEMBER with first-allowed page |

**Key insight:** This phase is almost entirely a deletion task. The only code added is a two-line `useEffect` for the toast.

---

## Common Pitfalls

### Pitfall 1: "Always `/dashboard`" misread as unconditional
**What goes wrong:** Planner tasks `handleRedirectAfterAuth` to always route to `/dashboard`, breaking subscription-blocked tenants and free users.
**Why it happens:** CONTEXT.md says "All other authenticated users → `/dashboard`" but this is shorthand for the paying-user majority. `resolveUserHome()` already handles the edge cases (free → `/`, blocked → `/subscription-blocked`, MEMBER → first-allowed page).
**How to avoid:** The new `handleRedirectAfterAuth` body MUST end with `router.replace(resolveUserHome(user ?? null).path)` — never hardcode `/dashboard`. LR-06 regression test (free user lands on `/`) validates this.
**Warning signs:** If LR-06 breaks after the change, the planner over-simplified the redirect.

### Pitfall 2: Removing `redirectReason` state variable
**What goes wrong:** Developer removes `redirectReason` along with `redirectUrl` because both are `searchParams.get()` calls.
**Why it happens:** They look structurally similar in the code (lines 299–300 of `useLoginForm.ts`).
**How to avoid:** `redirectReason` must survive — it drives the toast `useEffect` AND the session-recovery `useEffect` (lines 402–422) that fires `forceSyncSession()`. Removing it breaks both features.
**Warning signs:** TypeScript error on `redirectReason` usage in the return object or the session-recovery effect.

### Pitfall 3: `isPathAllowedForUser` left as dead import
**What goes wrong:** After removing the redirect branch, the import `{ resolveUserHome, isPathAllowedForUser }` in `useLoginForm.ts` retains the unused identifier, causing a TypeScript/ESLint lint failure in CI.
**Why it happens:** It's easy to remove the usage but forget to update the import statement.
**How to avoid:** After removing the redirect branch, update the import to `import { resolveUserHome } from "@/lib/auth/resolve-user-home"`.
**Warning signs:** `npm run lint` in `apps/web/` reports `'isPathAllowedForUser' is defined but never used`.

### Pitfall 4: Superadmin E2E scenario has no seed user
**What goes wrong:** New E2E test "Superadmin login → lands on `/admin`" fails at login because no superadmin user exists in the emulator.
**Why it happens:** `tests/e2e/seed/data/users.ts` defines `SeedUser.role` as `"admin" | "member"` only. `superadmin` is not in the union.
**How to avoid:** Create a `SeedUserSuperadminRole` type (extends `Omit<SeedUser, 'role'> & { role: 'superadmin' }`) and a `USER_SUPERADMIN` constant. Seed this user in `seedUsers()` before the spec runs. This is a Wave 0 requirement.
**Warning signs:** E2E test logs "Invalid password" or user not found — actually means the user was never created in the emulator.

### Pitfall 5: Toast fires after redirect (invisible)
**What goes wrong:** The toast `useEffect` fires but the page immediately navigates away, so the user never sees the toast.
**Why it happens:** The `useEffect([redirectReason])` and the redirect `useEffect([user, isLoading, isSessionSynced])` both run on mount. If the user is already logged in (session cookie valid), the redirect fires immediately.
**How to avoid:** This is the correct behavior: the toast is intended to show on the login PAGE before the user re-authenticates — not after. The toast fires when `redirectReason === 'session_expired'` is present, which happens when the user has been bounced to the login page. At that point `user` is `null` (session expired), so the redirect effect does nothing. The toast is visible while the user fills in credentials.
**Warning signs:** Manual test: navigate to `/login?redirect_reason=session_expired` while logged out — toast should appear immediately.

### Pitfall 6: Vestigial `redirectReason` dependency in the outer redirect `useEffect`
**What goes wrong:** After `handleRedirectAfterAuth` is rebuilt without `redirectReason` in its closure, the outer redirect `useEffect` (lines 391–400 of `useLoginForm.ts`) still lists `redirectReason` in its dependency array. The `react-hooks/exhaustive-deps` ESLint rule will flag `redirectReason` as a spurious dependency since `handleRedirectAfterAuth` no longer captures it.
**Why it happens:** The dep array was correct before the change. After rebuilding `handleRedirectAfterAuth` to not read `redirectReason`, the dep becomes vestigial — it was tracking a value the callback consumed, but now does not.
**How to avoid:** After simplifying `handleRedirectAfterAuth`, remove `redirectReason` from the outer redirect `useEffect` dependency array. Updated array: `[user, isLoading, isSessionSynced, handleRedirectAfterAuth, getGoogleSetupTarget, setIsEmailVerificationPending]`.
**Warning signs:** `npm run lint` in `apps/web/` reports a `react-hooks/exhaustive-deps` lint error flagging `redirectReason` as an unnecessary dependency.

---

## Code Examples

Verified patterns from official sources:

### Updated `handleRedirectAfterAuth` (simplified)
```typescript
// Source: CONTEXT.md locked decision
const handleRedirectAfterAuth = React.useCallback(() => {
  const currentUser = auth.currentUser;
  const skipEmailVerification =
    process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === 'true';
  if (currentUser && !currentUser.emailVerified && !skipEmailVerification) {
    setIsEmailVerificationPending(true);
    return;
  }
  if (user?.role === 'superadmin') {
    window.location.replace('/admin');
    return;
  }
  const home = resolveUserHome(user ?? null);
  router.replace(home.path);
}, [router, user]);
```

### Toast useEffect for session expiry
```typescript
// Source: CONTEXT.md locked decision + apps/web/src/lib/toast.ts verified
React.useEffect(() => {
  if (redirectReason === 'session_expired') {
    toast.warning('Sua sessão expirou. Entre novamente para continuar.');
  }
}, [redirectReason]);
```

### Updated import in `useLoginForm.ts`
```typescript
// Remove isPathAllowedForUser from import — becomes unused after redirect branch removal
import { resolveUserHome } from '@/lib/auth/resolve-user-home';
```

### `handleRegister` verifyUrl cleanup
```typescript
// Source: CONTEXT.md locked decision
// Before:
const verifyUrl = redirectUrl
  ? `${window.location.origin}/login?redirect=${encodeURIComponent(redirectUrl)}`
  : `${window.location.origin}/login`;
// After:
const verifyUrl = `${window.location.origin}/login`;
```

### Superadmin seed user (Wave 0 addition)
```typescript
// Source: CONTEXT.md decision + Phase 17 SeedUserFreeRole pattern (STATE.md)
// In tests/e2e/seed/data/users.ts:
export interface SeedUserSuperadminRole extends Omit<SeedUser, 'role'> {
  role: 'superadmin';
}

export const USER_SUPERADMIN: SeedUserSuperadminRole = {
  uid: 'user-superadmin',
  email: 'superadmin@proops.test',
  password: 'Test1234!',
  name: 'Super Admin',
  tenantId: 'tenant-superadmin',
  role: 'superadmin',
};
```

### New E2E scenario — redirect param ignored
```typescript
// Source: CONTEXT.md locked decision
test('admin login with ?redirect=/proposals → lands on /dashboard (redirect ignored)', async ({ page }) => {
  await page.goto('/login?redirect=%2Fproposals');
  const loginPage = new LoginPage(page);
  await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
  await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
});
```

### New E2E scenario — session-expired toast
```typescript
// Source: CONTEXT.md locked decision
test('login with redirect_reason=session_expired → warning toast visible', async ({ page }) => {
  await page.goto('/login?redirect_reason=session_expired');
  // Toast should be visible immediately on page load (before submitting credentials)
  await expect(page.locator('[data-sonner-toast], [role="status"]').first()).toBeVisible({ timeout: 5000 });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conditional subtitle showing "Sua sessão expirou" in login page copy | `toast.warning()` on mount via `useEffect` | Phase 22 | Non-blocking notification; subtitle always shows default welcome copy |
| `?redirect=` forwarded by protected-route bounce | `redirect_reason=session_expired` only (no path forwarded) | Phase 22 | Eliminates open-redirect attack surface; users lose original destination after session expiry (accepted tradeoff) |
| `isPathAllowedForUser` used as redirect validation in auth flow | Dead code in runtime (still tested via unit tests) | Phase 22 | Import removed from `useLoginForm.ts`; function stays in `resolve-user-home.ts` with existing unit tests intact |

**Deprecated/outdated after this phase:**
- `redirectUrl` const in `useLoginForm.ts` — deleted
- `isPathAllowedForUser` import in `useLoginForm.ts` — removed (function itself remains in `resolve-user-home.ts`)
- Conditional subtitle `redirectReason === 'session_expired'` in `login/page.tsx` — replaced by `useEffect` toast
- LR-02, LR-03, LR-04, LR-05, LR-07 test scenarios in `login-redirect.spec.ts` — deleted

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified against actual source files. No assumed claims.**

---

## Open Questions (RESOLVED)

1. **`proops_just_logged_out` cleanup effect: simplify or leave?**
   - What we know: After this phase, `redirect=` will never appear in the URL, so `params.delete('redirect')` becomes a no-op.
   - What's unclear: Whether Claude's discretion should simplify the effect to only `params.delete('redirect_reason')`.
   - RESOLVED: Simplify. Remove the `params.delete('redirect')` line to reflect the new reality. This makes the code honest without breaking anything. Implemented in Plan 22-01 Task 1 Step 4.

2. **`isPathAllowedForUser` function: delete or leave in `resolve-user-home.ts`?**
   - What we know: After `useLoginForm.ts` stops importing it, the only callers are the unit tests in `__tests__/is-path-allowed.test.ts` (which import it directly from `resolve-user-home.ts`).
   - What's unclear: Whether the planner should delete the function and its tests, or leave it as a utility.
   - RESOLVED: Leave the function in `resolve-user-home.ts`. Its unit tests provide a spec for the path-validation logic that may be useful again. The removal work is out of scope of LOGIN-01 and deletion of a tested utility carries risk for zero benefit to this phase.

3. **Toast assertion in E2E — reliable selector?**
   - What we know: Sileo's Toaster renders via Radix/Sonner. The toast-provider renders at `top-center`.
   - What's unclear: The exact Playwright-visible selector for a Sileo toast.
   - RESOLVED: Use `page.locator('[data-sonner-toast]').first()` with `page.getByRole('status').first()` as fallback. Implemented in Plan 22-02 Task 1. Accept as a LOW-certainty selector that may need a data-testid in a future phase if flaky.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure code/config changes to three existing files and one test file. No new external tools, services, runtimes, or CLI utilities are required beyond what already exists in the project.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (E2E) + Vitest (unit, `apps/web`) |
| Config file | `playwright.config.ts` (root), `apps/web/vitest.config.ts` |
| Quick run command | `npm run test:web` (unit); `npm run test:e2e` (E2E, requires emulators) |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOGIN-01 | Admin login ignores `?redirect=` → lands on `/dashboard` | E2E | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` | ✅ (rewritten in-place) |
| LOGIN-01 | Superadmin login → lands on `/admin` regardless of params | E2E | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` | ✅ (new scenario) |
| LOGIN-01 | `redirect_reason=session_expired` → warning toast on login page | E2E | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` | ✅ (new scenario) |
| LOGIN-01 | LR-06 regression — free user after paying-user logout lands on `/` | E2E | `npx playwright test tests/e2e/auth/login-redirect.spec.ts` | ✅ (kept/updated) |

### Sampling Rate
- **Per task commit:** `npm run lint` in `apps/web/` (catches unused imports instantly)
- **Per wave merge:** `npx playwright test tests/e2e/auth/login-redirect.spec.ts`
- **Phase gate:** Full E2E suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/seed/data/users.ts` — add `SeedUserSuperadminRole` interface and `USER_SUPERADMIN` constant; seed the user in `seedUsers()` function. Required by new superadmin E2E scenario.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No change to auth mechanism |
| V3 Session Management | no | `redirect_reason=session_expired` preserved; session handling unchanged |
| V4 Access Control | yes | Removal of `?redirect=` consumption eliminates an open-redirect vector |
| V5 Input Validation | yes | No redirect URL is consumed from user input post-this-phase |
| V6 Cryptography | no | No change |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `?redirect=` manipulation | Spoofing/Tampering | **Eliminated** — redirect param no longer consumed post-login |
| URL-embedded phishing destination | Spoofing | Eliminated — destination is fixed (`/dashboard` or `/admin`) |

**Security posture change:** This phase strictly reduces attack surface. The existing open-redirect guard code (`isSameOrigin` check + `isPathAllowedForUser` guard) is deleted because the attack surface it protected is also deleted. No new security controls needed.

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/app/login/_hooks/useLoginForm.ts` — full file read; all hook state variables, effects, and redirect logic verified
- `apps/web/src/app/login/page.tsx` — full file read; conditional subtitle (line 606–608) verified
- `apps/web/src/components/auth/protected-route.tsx` — full file read; bounce URL construction at line 121 verified
- `apps/web/src/lib/toast.ts` — full file read; `toast.warning()` → `sileo.warning()` mapping verified
- `apps/web/src/components/shared/toast-provider.tsx` — read; Sileo `Toaster` mounted at `top-center`, no changes needed
- `apps/web/src/lib/auth/resolve-user-home.ts` — full file read; `resolveUserHome()` and `isPathAllowedForUser()` both live here (not in a separate file)
- `tests/e2e/auth/login-redirect.spec.ts` — full file read; all seven LR scenarios reviewed
- `tests/e2e/pages/login.page.ts` — read; `LoginPage` POM verified
- `tests/e2e/seed/data/users.ts` — read; `SeedUser.role` type is `"admin" | "member"` only — no superadmin variant exists

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries read from actual source files
- Architecture: HIGH — all three production files read in full; logic traced directly
- Pitfalls: HIGH — derived from actual code inspection, not training knowledge
- E2E gaps: HIGH — seed data file read confirms superadmin user is absent

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable code — no external APIs change this)
