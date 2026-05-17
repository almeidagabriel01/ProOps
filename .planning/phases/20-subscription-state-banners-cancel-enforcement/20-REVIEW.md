---
phase: 20-subscription-state-banners-cancel-enforcement
reviewed: 2026-05-08T00:00:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - firebase/firestore.rules
  - apps/functions/src/lib/billing-claims.ts
  - apps/functions/src/lib/billing-cache-invalidation.ts
  - apps/web/src/app/api/auth/billing-status/route.ts
  - apps/web/src/app/api/auth/billing-status/invalidate/route.ts
  - apps/web/src/lib/billing-cache.ts
  - apps/web/middleware.ts
  - apps/web/src/components/shared/subscription-guard.tsx
  - apps/functions/src/api/middleware/require-active-subscription.ts
  - apps/functions/src/api/controllers/stripe.controller.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase adds a 5-layer defense for billing enforcement: Stripe controller (immediate cancel for `past_due`), billing claims propagation, edge middleware billing gate, backend Express middleware gate, and Firestore rules. The implementation is mostly sound — the layered architecture, LRU cache with 5s TTL, token revocation on terminal statuses, and `checkRevoked: true` on session cookie verification are all correct and well-reasoned.

Two critical findings require attention before production deployment:

1. The `/v1/aux/` whitelist in `require-active-subscription.ts` bypasses the backend billing gate for all auxiliary tenant data mutations (custom fields, proposal templates, sistemas, ambientes, options). Blocked tenants can continue writing to their tenant data via these routes.
2. The bfcache pageshow handler in `subscription-guard.tsx` reads a stale React closure value of `isBlocked` — if the subscription became blocked while the page sat in bfcache, the redirect never fires.

Six warnings cover fail-open paths, claim status asymmetry, Firestore rule gaps for the grace period, the edge middleware's silent pass-through on non-2xx responses from the billing-status route, and the active-claim fast-path in Firestore rules that trusts stale JWT claims unconditionally for direct client SDK reads.

---

## Critical Issues

### CR-01: `/v1/aux/` Whitelist Bypasses Backend Billing Gate for Tenant Data Writes

**File:** `apps/functions/src/api/middleware/require-active-subscription.ts:30`

**Issue:** `"/v1/aux/"` is included in `WHITELISTED_PREFIXES`. The `auxiliary.routes.ts` file mounts all auxiliary tenant data mutations under `/v1/aux/`: `POST/PUT/DELETE /ambientes`, `POST/PUT/DELETE /sistemas`, `POST/PUT/DELETE /custom-fields`, `POST/PUT/DELETE /options`, `POST/PUT/DELETE /proposal-templates`. A tenant with `canceled` or `past_due` (grace expired) subscription can call all of these endpoints without hitting the billing gate. The original reason for whitelisting `/v1/aux/` was likely the `GET /v1/aux/proxy-image` public endpoint (registered before auth middleware at line 367 of `index.ts`), but the write routes under the same prefix are authenticated and tenant-scoped and should not be exempt from subscription enforcement.

**Fix:** Remove `/v1/aux/` from the general whitelist and instead list only the specific public path that requires exemption:

```typescript
const WHITELISTED_PREFIXES = [
  "/v1/stripe/",
  "/v1/admin/",
  "/v1/users/me",
  "/v1/auth/",
  "/v1/billing/",
  "/v1/validation/",
  "/v1/aux/proxy-image",   // ← specific path only; proxy-image is public, aux writes are not
  "/health",
  "/internal/",
  "/authenticated",
];
```

---

### CR-02: bfcache `pageshow` Handler Reads Stale React Closure for `isBlocked`

**File:** `apps/web/src/components/shared/subscription-guard.tsx:121-129`

**Issue:** When the browser restores a page from the back-forward cache (`event.persisted === true`), the entire React tree — including the `isBlocked` memo — is restored from the snapshot at the time the page was cached. If the user's subscription became blocked between page cache and restoration (e.g., they canceled on another tab, navigated away, then hit Back), `isBlocked` is `false` (from the stale snapshot) and the redirect in the `pageshow` handler never fires. The comment at line 117 documents the intent correctly but the implementation is wrong: checking `isBlocked` inside the handler reads the closure value, not a fresh evaluation.

**Fix:** On bfcache restoration, trigger an unconditional navigation to force a fresh middleware round-trip rather than relying on the stale React state:

```typescript
React.useEffect(() => {
  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      // React state is frozen in bfcache — always force a middleware round-trip.
      // The middleware will redirect to /subscription-blocked if access is revoked.
      router.replace(window.location.pathname);
    }
  };
  window.addEventListener("pageshow", handlePageShow);
  return () => window.removeEventListener("pageshow", handlePageShow);
}, [router]);
```

Alternatively, use `window.location.reload()` if preserving the scroll position matters less than simplicity. The key invariant is: do not read `isBlocked` inside this handler.

---

## Warnings

### WR-01: Edge Middleware Silently Passes Through on Non-2xx Billing Status Response

**File:** `apps/web/middleware.ts:152-178`

**Issue:** The billing gate in middleware only redirects to `/subscription-blocked` when `billingRes.ok` is `true` AND `billing.allowed` is `false`. If `billingRes.ok` is `false` (the billing-status route returns a 4xx or 5xx), the outer `if (billingRes.ok)` block is not entered and `NextResponse.next()` is returned at line 196 — a silent fail-open. The `catch` block at lines 180-186 correctly fails closed for network-level errors (connection refused, DNS failure), but an HTTP error response from the billing-status route itself takes the silent path.

**Fix:** Treat non-ok HTTP responses from the billing-status route as fail-closed:

```typescript
if (billingRes.ok) {
  const billing = (await billingRes.json()) as BillingStatusResponse;
  if (!billing.allowed) {
    // ... existing redirect logic
  }
} else {
  // billing-status returned an error HTTP status — fail closed
  const blockedUrl = new URL("/subscription-blocked", request.url);
  const resp = NextResponse.redirect(blockedUrl);
  resp.headers.set("Cache-Control", "no-store");
  return resp;
}
```

---

### WR-02: `past_due` with Grace Period Not Enforced in Firestore Rules

**File:** `firebase/firestore.rules:188-202`

**Issue:** `tenantSubscriptionAllowsRead()` treats `past_due` as an ambiguous state and falls through to the Firestore read check, but the Firestore check only blocks on explicitly terminal statuses (`canceled`, `cancelled`, `unpaid`, `inactive`, `payment_failed`). A tenant whose `subscriptionStatus` is `past_due` in Firestore — and whose JWT claim is also `past_due` — will pass this function regardless of whether the 7-day grace period has expired, because `past_due` is not in the blocked list. This means Firestore rules do not enforce the grace period; the backend middleware (`require-active-subscription.ts`) is the sole enforcer for this.

This may be intentional (the comment at line 179 says "no Firestore read needed" for trusted claims), but it creates a defense-in-depth gap: if the backend middleware is bypassed or fails open (see WR-03), `past_due` tenants with expired grace periods can still read tenant data directly via the Firebase SDK.

**Fix (if grace-period enforcement in rules is desired):** The rules language cannot compute date arithmetic, so the practical fix is to ensure the Stripe webhook and `checkManualSubscriptions` cron transition `past_due` to `canceled` after the grace period — making the terminal-status block in rules do the enforcement indirectly. Verify that `checkManualSubscriptions.ts` (7-day transition) covers this path and that no `past_due` tenant can remain in that state indefinitely.

---

### WR-03: Backend Middleware Fails Open on Firestore Read Error

**File:** `apps/functions/src/api/middleware/require-active-subscription.ts:109-117`

**Issue:** If the Firestore read for the tenant document fails (network partition, Firestore quota exceeded, cold start timeout), the middleware calls `next()` and allows the request through. Combined with the billing-status route also failing open on Firestore errors (see WR-04), a Firestore degradation event would allow blocked tenants through at two independent layers simultaneously.

The behavior is documented in the CLAUDE.md context as acceptable ("TTL is already short"), but the current comment says "fail open on infra errors — other layers catch this." For `canceled` or `unpaid` tenants this is only partially true: Firestore rules will catch direct SDK reads, but Express API calls are not covered by Firestore rules.

**Fix:** Consider failing closed with a 503 instead of allowing through, at minimum for the `past_due`/`canceled` states already known from the LRU cache:

```typescript
} catch (err) {
  logger.warn("require_active_subscription: firestore_read_error", { tenantId, uid: user.uid });
  // If we have a recently cached (but now expired) state for this tenant,
  // use it as a conservative fallback rather than failing fully open.
  const staleCached = billingStateCache.get(tenantId); // may be undefined if evicted
  if (!staleCached) {
    // No cached state — uncertain. Log and allow through (existing behavior).
    next();
    return;
  }
  // Use stale state as conservative fallback.
  // Falls through to the status evaluation below.
  billingState = staleCached;
}
```

---

### WR-04: `billing-status` Route Fails Open on All Firestore and Auth-Infra Errors

**File:** `apps/web/src/app/api/auth/billing-status/route.ts:154-157`

**Issue:** The catch block at the end of `GET` returns `{ allowed: true, status: "unknown" }` for any unexpected error, including Firestore unavailability. The comment says "other layers catch this" — which is true for Firestore rules on direct SDK reads, but the edge middleware treats this as allowed (see WR-01 for the related non-ok issue). The combination means a Firestore outage could simultaneously fail open at the edge middleware layer and the billing-status route, with only the backend middleware as a working gate.

**Fix:** Distinguish between `auth/session-cookie-revoked` (definitively blocked) and infrastructure errors. Infrastructure errors are acceptable to fail open at this layer, but the error should at minimum be distinguishable so the middleware can treat it more conservatively:

```typescript
// Fail-open is intentional for infra errors — other layers (backend middleware, Firestore rules) catch this.
// Return a distinct status so callers can decide their own failure policy.
console.error("[billing-status] unexpected error", error);
return NextResponse.json({ allowed: true, status: "error" }, { status: 200 });
```

Then in middleware, treat `status: "error"` as a signal to fail closed or log an alert.

---

### WR-05: `REVOKE_TOKEN_STATUSES` Asymmetry — `payment_failed` and `cancelled` Not Included

**File:** `apps/functions/src/lib/billing-claims.ts:12`

**Issue:** `REVOKE_TOKEN_STATUSES` contains `["canceled", "unpaid", "inactive"]`. The `BLOCKED_STATUSES` sets in `subscription-guard.tsx` (line 20-26) and `billing-status/route.ts` (line 13-19) both include `"cancelled"` (British spelling) and `"payment_failed"`. If either of those status strings is ever written as the canonical `subscriptionStatus` (e.g., by a Stripe webhook or a future billing integration), users in that state will not have their refresh tokens revoked, and their existing JWTs remain valid for up to 1 hour.

**Fix:** Add both variants and `payment_failed` to be consistent with BLOCKED_STATUSES:

```typescript
const REVOKE_TOKEN_STATUSES = new Set([
  "canceled",
  "cancelled",   // British spelling — matches BLOCKED_STATUSES in other files
  "unpaid",
  "inactive",
  "payment_failed",
]);
```

Verify whether `payment_failed` is ever written as the canonical status by searching Stripe webhook handlers and `checkManualSubscriptions.ts`.

---

### WR-06: Active-Claim Fast-Path in Firestore Rules Unconditionally Trusts Stale JWT for Direct SDK Reads

**File:** `firebase/firestore.rules:195`

**Issue:** `tenantSubscriptionAllowsRead()` short-circuits and `return isAllowedClaim` (i.e., `return true`) when the JWT claim status is `active`, `trialing`, or `free` — with zero Firestore fallback. Firebase ID tokens are valid for ~1 hour after issuance. After a billing status change (e.g., `active → canceled`), in-flight tokens still carry `claimStatus == 'active'` and will pass this fast-path for the remaining token lifetime.

The backend Express middleware (`require-active-subscription.ts`) reads Firestore directly and is not affected by this. The edge middleware (`middleware.ts`) calls `/api/auth/billing-status` which also reads Firestore directly and is not affected. However, any browser-side code that uses the Firebase client SDK directly — Firestore listeners (`onSnapshot`), direct `getDoc`/`getDocs` calls — bypasses both middleware layers and is subject only to Firestore rules. During the ~1h window between a billing status change and token expiry, such direct SDK reads will pass the rules check and return data that should be blocked.

**Fix:** There is no way to eliminate the JWT validity window entirely. The practical mitigations are:

1. **Ensure `applyBillingClaimsToTenantUsers` writes the updated claim** — which it does. When the claim is updated, the next token refresh will carry the new status, ending the window early for any active sessions that refresh.
2. **Call `revokeRefreshTokens`** — which the billing-claims code does for terminal statuses. Revocation takes effect within ~1 hour but forces new token issuance on the next SDK call. This already narrows the window.
3. **Document this as an accepted risk** — the window is bounded by `min(token_ttl, claim_update_propagation)`. If the current architecture is intended to tolerate this (backend and edge gates cover API/page-load surfaces; only direct SDK reads have the window), add an explicit comment in the rules:

```javascript
// Fast-path: trust claim for active/trialing/free. Stale claims can persist
// up to ~1h after a billing status change (JWT TTL). This is accepted: backend
// middleware and edge middleware both read Firestore directly and are not affected.
// Direct client SDK reads are subject to this window. Token revocation on
// terminal statuses (via revokeRefreshTokens) narrows the window.
let isAllowedClaim = claimStatus == 'active' || claimStatus == 'trialing' || claimStatus == 'free';
return isAllowedClaim;
```

If the window is unacceptable, the alternative is to remove the fast-path and always fall through to the Firestore check (higher read cost).

---

## Info

### IN-01: `past_due` Intentionally Excluded from Token Revocation — Needs Comment Update

**File:** `apps/functions/src/lib/billing-claims.ts:10-12`

**Issue:** The comment explains `past_due` is excluded "so the user still needs a valid session to fix payment." This is correct and intentional per the phase context. However, after the `past_due → immediate cancel` path added in this phase, a `past_due` user who cancels will have their status set to `canceled` and `applyBillingClaimsToTenantUsers` will be called with `"canceled"` — which is in `REVOKE_TOKEN_STATUSES`. The comment is still accurate, but a follow-up note about the cancel path would help future maintainers understand the full lifecycle.

**Fix:** Extend the comment to mention the cancel path:

```typescript
// past_due intentionally excluded: user still needs a valid session to fix payment
// via the Stripe billing portal. On cancellation from past_due state, the controller
// calls applyBillingClaimsToTenantUsers with "canceled", which IS in this set —
// so tokens are revoked at that point. See stripe.controller.ts cancelSubscription.
const REVOKE_TOKEN_STATUSES = new Set(["canceled", "unpaid", "inactive"]);
```

---

### IN-02: Module-Level Cache in `billing-cache.ts` Not Shared Across Vercel Instances

**File:** `apps/web/src/lib/billing-cache.ts:10`

**Issue:** The module-level `Map` is the correct mechanism for in-process caching within a single Vercel serverless instance, but on Vercel each instance is isolated. The `invalidate/route.ts` endpoint deletes from this map, but the delete only takes effect in the instance that receives the invalidation request. Other warm instances will retain the cached state until the 5s TTL expires. This is documented implicitly by the TTL design but worth making explicit.

**Fix:** Add a comment to the export:

```typescript
// Module-level singleton: same Map instance reused across requests in the same
// warm Node.js process. NOTE: Vercel runs multiple isolated instances — cache
// invalidation via /api/auth/billing-status/invalidate only clears the instance
// that receives the request. Other instances evict on 5s TTL. This is acceptable:
// the 5s window is the designed maximum staleness tolerance.
export const billingCache = new Map<string, CachedBillingState>();
```

---

### IN-03: Timing Side-Channel in Invalidation Secret Comparison

**File:** `apps/web/src/app/api/auth/billing-status/invalidate/route.ts:11`

**Issue:** `provided !== secret` is a standard string comparison, not a constant-time comparison. This creates a theoretical timing side-channel. In practice, this endpoint is server-to-server (Cloud Functions → Vercel) with a long random secret, making a timing attack impractical. However, for a security-critical endpoint, constant-time comparison is the correct primitive.

**Fix (optional, low urgency):**

```typescript
import { timingSafeEqual } from "crypto";

function timingSafeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Replace:
if (!secret || !provided || provided !== secret) {
// With:
if (!secret || !provided || !timingSafeCompare(provided, secret)) {
```

---

### IN-04: CONTEXT.md Spec Inverts Field Names for `cancelSubscription` Status Read

**File:** `apps/functions/src/api/controllers/stripe.controller.ts:497-502`

**Issue:** The `20-CONTEXT.md` spec states: "Controller reads `subscription.status` only (no fallback to top-level `subscriptionStatus`) — Phase 19 canonical fields are trusted." This sentence has the field names backwards. Phase 19 established `subscriptionStatus` (top-level) as the canonical field, deprecating the nested `subscription.status`. The actual implementation correctly reads `tenantData?.subscriptionStatus` (top-level canonical) first, then falls back to `tenantData?.subscription?.status` (legacy nested) for backward compatibility. The code is correct; the spec sentence is inverted.

**Fix:** No code change needed. Update `20-CONTEXT.md` to accurately describe the read order:

```
Controller reads top-level `subscriptionStatus` first (Phase 19 canonical field),
with a fallback to nested `subscription.status` for legacy compatibility.
```

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
