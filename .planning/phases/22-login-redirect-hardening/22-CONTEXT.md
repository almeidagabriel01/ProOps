# Phase 22: Login Redirect Hardening - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove `?redirect=` consumption from the post-login flow. After a successful login, users always land on `/dashboard` (or `/admin` for superadmins) regardless of URL parameters. The `?redirect_reason=session_expired` parameter is preserved — it triggers a warning toast notification on the login page, but does NOT alter the post-login destination.

Out of scope: changes to the registration flow beyond collateral `redirect=` cleanup, anything that adds new redirect capabilities.

</domain>

<decisions>
## Implementation Decisions

### Post-login destination (core change)
- Superadmins → `/admin` (unchanged)
- All other authenticated users → `/dashboard` (fixed, ignores any `?redirect=` param)
- `handleRedirectAfterAuth` in `useLoginForm.ts`: remove the entire `redirectUrl` consumption branch. The function reads `user.role`, sends superadmin to `/admin`, everyone else to `resolveUserHome()` (which returns `/dashboard` for paying users)
- `redirectUrl` state variable becomes unused and is removed

### Session-expired notification
- **Toast, not subtitle**: when `redirect_reason=session_expired` is present in search params, trigger `toast.warning()` from `@/lib/toast` on page mount (useEffect on `redirectReason`)
- **Subtitle reverts to default**: login subtitle always shows "Bem-vindo de volta! Insira suas credenciais." — the conditional subtitle logic is removed
- Toast style: `toast.warning()` (maps to `sileo.warning()`) — auto-dismisses
- Toast text (suggested): "Sua sessão expirou. Entre novamente para continuar."
- `redirectReason` state remains — only used for the toast trigger, not for routing

### Protected-route bounce URL
- Strip `redirect=` from the outgoing bounce URL in `protected-route.tsx`
- Current: `router.push('/login?redirect=${encodeURIComponent(pathname)}&redirect_reason=session_expired')`
- New: `router.push('/login?redirect_reason=session_expired')`
- The pathname is no longer forwarded since it won't be consumed

### Collateral cleanup in useLoginForm.ts
- `handleRegister`: remove `?redirect=` from `verifyUrl` — the email verification link should not carry the redirect param since it won't be consumed post-verification
- `getGoogleSetupTarget()`: strip `redirect=` from the passed query params — only pass non-redirect params to the google-setup page

### E2E test migration (login-redirect.spec.ts)
- **Strategy**: rewrite in-place (not a new file)
- **Delete**: LR-02, LR-03, LR-04, LR-05, LR-07 — these test redirect consumption and guard logic that no longer exists
- **Update LR-01**: assert admin lands on `/dashboard` (not a broad pattern match)
- **Keep LR-06 updated**: sticky redirect regression test — free user after paying-user logout still lands on `/`
- **Add new scenarios** (LOGIN-01 coverage):
  1. Admin login with `?redirect=/proposals` present → lands on `/dashboard` (redirect ignored)
  2. Superadmin login → lands on `/admin` regardless of redirect params
  3. Login with `redirect_reason=session_expired` → warning toast visible on login page before submitting

### Claude's Discretion
- Exact toast message text (intent: warn about session expiry, prompt re-login)
- Whether to keep or remove the `redirectUrl` const from `useLoginForm.ts` (it can be deleted entirely as it's unused)
- Exact file organization for the updated E2E tests (keep existing describe block style)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` — Phase 22 goal and success criteria (including AUTH-05 moved to Out of Scope note)
- `.planning/REQUIREMENTS.md` — LOGIN-01 requirement definition

### Core files to change
- `apps/web/src/app/login/_hooks/useLoginForm.ts` — `handleRedirectAfterAuth` (remove redirectUrl branch), `redirectUrl` const (remove), `redirectReason` (keep for toast), `handleRegister` (clean verifyUrl), `getGoogleSetupTarget` (strip redirect= from params)
- `apps/web/src/app/login/page.tsx` — Remove conditional subtitle for `redirect_reason=session_expired`; add toast trigger via `useEffect` on `redirectReason`
- `apps/web/src/components/auth/protected-route.tsx` — Strip `redirect=` from bounce URL (line ~121)

### Toast system
- `apps/web/src/lib/toast.ts` — Project toast wrapper (use `toast.warning()` for session-expired notification)
- `apps/web/src/components/shared/toast-provider.tsx` — `sileo` Toaster already mounted in app shell; no changes needed

### E2E tests
- `tests/e2e/auth/login-redirect.spec.ts` — Full rewrite in-place per decisions above

### Related auth files (read-only reference, no changes expected)
- `apps/web/src/lib/auth/resolve-user-home.ts` — `resolveUserHome()` — returns `/dashboard` for paying users (verify this is still correct after change)
- `apps/web/src/lib/auth/is-path-allowed-for-user.ts` — `isPathAllowedForUser()` — used in redirect guard being removed; check if still needed elsewhere

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `toast.warning()` from `@/lib/toast`: already used across the codebase for warnings; wraps `sileo.warning()`; auto-dismisses. Import and call inside a `useEffect` on `redirectReason` in `useLoginForm.ts`
- `resolveUserHome(user)` from `@/lib/auth/resolve-user-home`: already used at the end of `handleRedirectAfterAuth` as the fallback — after the change, it becomes the primary (and only) path for non-superadmins

### Established Patterns
- `searchParams.get('redirect_reason')` already read in `useLoginForm.ts` as `redirectReason` — the variable stays, only its usage changes (toast trigger instead of subtitle conditional)
- `useEffect` on `redirectReason` is the right pattern for the toast trigger — fires once on mount when param is present

### Integration Points
- `login/page.tsx` imports `redirectReason` from `useLoginForm()` hook — the subtitle conditional on `redirectReason === 'session_expired'` is removed; a `useEffect` is added (or moved inside the hook) for the toast
- The `sileo` Toaster (`toast-provider.tsx`) is already mounted at the app root — no provider changes needed
- `protected-route.tsx` line ~121: the `router.push` call is the only place that generates the session-expired bounce URL

</code_context>

<specifics>
## Specific Ideas

- The session-expired toast fires on mount (via `useEffect` with `[redirectReason]` dependency) — not on form submission
- `redirectUrl` const in `useLoginForm.ts` (currently `searchParams.get('redirect')`) becomes completely unused — delete it entirely to avoid lint errors
- The `proops_just_logged_out` sessionStorage cleanup effect in `useLoginForm.ts` currently deletes `redirect` AND `redirect_reason` from the URL on explicit logout — after LOGIN-01, `redirect=` won't be in the URL anymore (since protected-route strips it), so this cleanup is harmless but may simplify to only clearing `redirect_reason`

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-login-redirect-hardening*
*Context gathered: 2026-05-11*
