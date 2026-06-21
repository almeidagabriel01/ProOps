# Client Error Attribution — Design

**Date:** 2026-06-21
**Status:** Approved approach (ID token, verify-server-side); pending spec review
**Scope:** Error observability — attribute client-captured errors to the authenticated user

## Problem

Client-captured errors (window.onerror, unhandledrejection, console.error of Errors, api-client
failures) reach `/admin/observability` as **anonymous** with `affectedUsers: 0` even when a user
is signed in. Root cause: the reporter sends via `navigator.sendBeacon` (and a `fetch` fallback)
which carries **no Firebase auth token** — sendBeacon cannot set an `Authorization` header, and
the api-client's Bearer token is never attached by the reporter. The proxy only forwards an
`authorization` header when present (`route.ts:61`), so nothing reaches the backend. The backend
controller (`observability.controller.ts:43-44`) derives `uid`/`tenantId` from `req.user`
(populated by optional-auth only when a token is present) → null → anonymous.

Backend-captured errors (thrown routes, finish-middleware) are correctly attributed because those
requests carry the Bearer token via the api-client.

## Goal

Attribute client-side error reports to the signed-in user **securely** — identity verified
server-side, never trusted from the client — while keeping reporting best-effort (never blocks,
never throws, degrades to anonymous).

## Decisions (senior security)

1. **Verify, never trust.** The client attaches its Firebase **ID token**; the backend verifies it
   with the Admin SDK (`auth.verifyIdToken` → signature, `aud`=project, `iss`, `exp`). `uid` and
   `tenantId` are derived **only** from the verified claims. No client-asserted identity field is
   ever trusted.
2. **Token in body, attached at send time, single path.** sendBeacon cannot set headers but can
   send a body; `fetch` can too. So the token rides in the JSON body field `idToken`. One code
   path covers beacon and fetch.
3. **Freshest-token cache.** A module singleton subscribes to `onIdTokenChanged` (fires on login,
   Firebase's ~hourly auto-refresh, and logout) and holds the latest token. The reporter reads it
   **synchronously at send time** — keeping the sync/fire-and-forget flush (incl. `pagehide`)
   intact. The token is never stored in the dedupe buffer.
4. **Fail-open.** Absent/expired/malformed/invalid token → anonymous. Never 401, never blocks, the
   error is always captured.
5. **Token is a secret in transit only.** Never logged, never persisted. Only derived
   `uid`/`tenantId` are stored (uid is already hashed in the `_agg` sets).
6. **`checkRevoked: false`.** Telemetry endpoint; a revoked-but-unexpired token attributing an
   error for ≤1h is negligible and not worth the per-call network latency of revocation checks.

## Architecture

### A. Client — token cache (new, single responsibility)

`apps/web/src/lib/observability/identity-token-cache.ts`
- `installIdentityTokenCache(): () => void` — `onIdTokenChanged(auth, user => { if (user)
  user.getIdToken().then(t => set cache).catch(noop); else clear cache })`. Returns an unsubscribe
  that also clears the cache. SSR-guarded (`typeof window`).
- `getCachedIdToken(): string | null`.
- The cache holds only the token string. No persistence beyond Firebase's own.

### B. Client — reporter attaches token at send

`apps/web/src/lib/observability/client-error-reporter.ts`
- In `send(payload)`, build the request body as `{ ...payload, idToken: getCachedIdToken() ??
  undefined }`. `idToken` is added **only** to the outgoing body — never to the buffered `payload`
  (so it never enters the dedupe key and never lingers).
- `installClientErrorReporter()` also calls `installIdentityTokenCache()` and composes its
  teardown into the returned uninstall. (The installer component already mounts app-wide.)

### C. Backend — identity verifier (new, single responsibility)

`apps/functions/src/lib/observability/verify-report-identity.ts`
- `verifyReportIdentity(idToken: unknown): Promise<{ uid: string; tenantId: string | null } | null>`
  - If `idToken` is not a non-empty string → return `null`.
  - `const decoded = await auth.verifyIdToken(idToken)` (from `../../init`).
  - Return `{ uid: decoded.uid, tenantId: (decoded as { tenantId?: string }).tenantId ?? null }`.
  - Any thrown error → return `null`. Never throws. Never logs the token (or any token fragment).

### D. Backend — controller wiring

`apps/functions/src/api/controllers/observability.controller.ts`
- Compute identity: if `req.user?.uid` exists, use `req.user` (already middleware-verified).
  Otherwise `const identity = await verifyReportIdentity((req.body)?.idToken)`.
  Else `{ uid: null, tenantId: null }`.
- Pass the resolved `uid`/`tenantId` into the existing `captureError(...)` call. `idToken` is read
  for verification only and is **never** forwarded to `captureError`, logged, or stored.
- Body shape unchanged otherwise (`errorType`, `message`, `stack`, `route`, `status` still
  sanitized + length-capped). `idToken` is the only new accepted field.

## Data flow

```
signed-in user → error → reporter.send({...payload, idToken: cachedToken})
  → sendBeacon/fetch (no header) → Next proxy forwards body verbatim
  → backend optional-auth (no Bearer → req.user undefined)
  → ingestClientError → verifyReportIdentity(idToken) → {uid, tenantId}
  → captureError(..., uid, tenantId) → error_issues attributed
```

## Error handling

- `verifyReportIdentity` swallows all verification errors → `null` → anonymous capture.
- Reporter `send` already try/caught; reading the cache is a sync field access that cannot throw.
- Token cache `getIdToken().catch(noop)` — a refresh failure leaves the prior token (or null),
  never throws.

## Security review

| Concern | Mitigation |
|---|---|
| Spoofed identity | `verifyIdToken` cryptographically verifies; uid/tenant only from decoded claims. |
| Token leakage | Never logged, never stored; only in transit (HTTPS, same-origin) — same as the existing Bearer path. |
| DoS via verify | Existing `observabilityIngestLimiter`; verify only on token presence; malformed tokens fail locally (no network). |
| Revoked token | `checkRevoked:false` → ≤1h attribution window; negligible for telemetry; documented. |
| CSRF | Endpoint only writes a content-fingerprinted error doc; attribution requires a real unforgeable token; without one → anonymous. No meaningful CSRF value. |
| PII | uid/tenantId are not PII per project convention; uid hashed in `_agg`. No emails/phones added. |

## Testing

- **Web (Vitest):**
  - `identity-token-cache`: caches token on `onIdTokenChanged(user)`, clears on null, unsubscribe
    clears (mock `firebase/auth` `onIdTokenChanged` and a fake user `getIdToken`).
  - `client-error-reporter`: `send` includes `idToken` from the cache in the POSTed body; the
    buffered/dedupe payload does NOT include `idToken` (mock `sendBeacon`/`fetch`, assert body).
- **Functions (Jest):**
  - `verify-report-identity`: valid token → `{uid, tenantId}`; non-string/empty → null; verify
    throws → null; never throws; tenantId null when claim absent (mock `auth.verifyIdToken`).
  - `observability.controller`: with `req.user` set → uses it (no verify call); without `req.user`
    but valid `body.idToken` → uses verified identity; invalid token → anonymous; `idToken` never
    passed to `captureError` (mock `verifyReportIdentity` + `captureError`).

## Deploy notes

- Low/medium risk: read-only attribution; no billing, no schema/index change. Existing rate limiter
  and ingest path unchanged. Deploy to dev, verify a signed-in console-thrown error now shows the
  user, then prod.

## Out of scope (YAGNI)

- Revocation checking (`checkRevoked:true`), session-cookie forwarding through the proxy, batching
  multiple buffered errors into one request, attributing pre-login boot errors.
