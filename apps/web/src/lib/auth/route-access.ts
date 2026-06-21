/**
 * Route-access policy — the SINGLE source of truth for how the app classifies a
 * pathname (public vs. protected, billing-exempt, skippable).
 *
 * Pure string logic with NO Next.js / React imports, so it is safe to import
 * from the edge `proxy` AND from client components, and is fully unit-testable
 * in CI without a running server.
 *
 * Why this module exists: route classification used to be duplicated — the proxy
 * had its own `PUBLIC_ROUTES` list while `app/providers.tsx` had a separate
 * inline `isPublicMarketingPage`. The two drifted (a public page added to one
 * list but not the other), which dropped a genuinely public page into the
 * server-side auth-recovery interstitial (`/auth/refresh`). One list consumed
 * everywhere makes that class of drift impossible by construction; the invariant
 * is additionally enforced by `__tests__/route-access.test.ts`.
 */

/**
 * Public MARKETING pages: reachable with NO auth AND rendered without the ERP
 * shell / `<ProtectedRoute>`. This is the subset shared with `providers.tsx`.
 * Every entry here MUST also be a public route (enforced below + in tests).
 */
export const PUBLIC_MARKETING_ROUTES = [
  "/",
  "/automacao-residencial",
  "/decoracao",
  "/contato",
  "/agendar",
] as const;

/**
 * All routes the server proxy lets through WITHOUT a `__session` cookie. The
 * marketing routes are spread in first so a public page can never be public on
 * the client (no `<ProtectedRoute>`) yet protected at the proxy.
 */
export const PUBLIC_ROUTES = [
  ...PUBLIC_MARKETING_ROUTES,
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/data-deletion",
  "/cookies",
  "/subscribe",
  "/checkout-success",
  "/pricing",
  "/auth/refresh", // Silent session re-mint interstitial — must run without a cookie
  "/api/webhooks", // Webhooks need to be public
  "/share", // Public shared proposal pages
  "/auth/action", // Legacy Firebase Auth action handler (kept for in-flight emails)
  "/reset", // Custom password reset flow (oobCode via clean URL)
  "/verify", // Custom email verification flow (oobCode via clean URL)
] as const;

/** Routes that bypass the billing gate (accessible even when blocked). */
export const BILLING_ALLOWED_ROUTES = ["/subscription-blocked"] as const;

/** Static assets and API routes the proxy skips entirely. */
export const SKIP_PATTERNS = [
  "/_next",
  "/favicon.ico",
  "/public",
  "/hero",
  "/logo",
  "/api/", // Let API routes handle their own auth
] as const;

/**
 * Matches `pathname` against a route list using exact match OR a `route + "/"`
 * prefix. The trailing slash prevents word-boundary collisions (e.g. `/contato`
 * must not match `/contatos`).
 */
function matchesExactOrPrefix(
  pathname: string,
  routes: readonly string[],
): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

export function isPublicMarketingRoute(pathname: string): boolean {
  return matchesExactOrPrefix(pathname, PUBLIC_MARKETING_ROUTES);
}

export function isPublicRoute(pathname: string): boolean {
  return matchesExactOrPrefix(pathname, PUBLIC_ROUTES);
}

export function isBillingAllowedRoute(pathname: string): boolean {
  return matchesExactOrPrefix(pathname, BILLING_ALLOWED_ROUTES);
}

export function shouldSkipRoute(pathname: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}
