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
  // The two host-routed sites. `proops.com.br/` and `app.proops.com.br/` are
  // rewritten onto these paths by the proxy, and both remain directly
  // reachable so they can be reviewed on any host while being built.
  "/institucional",
  "/aplicativo",
  // The company site's own pages, at apex level. They are siblings of the legal
  // pages: `APEX_COMPANY_PATHS` in `@/lib/site/surfaces` keeps the apex serving
  // them after the cutover instead of 301-ing them to the ERP.
  "/sobre",
  "/manifesto",
  "/produtos",
  "/fale-conosco",
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

/**
 * Marketing pages that need NO session context at all.
 *
 * A strict subset of PUBLIC_MARKETING_ROUTES, and the distinction is about what
 * the page DOES, not about who may see it. The ERP landing is public too, but
 * it fetches live prices and swaps its buttons depending on whether the visitor
 * is logged in, so it genuinely needs Auth, Tenant, Permissions and Plan. These
 * do not: the company site has no prices and no login, and the app page has
 * fixed prices with no web checkout.
 *
 * `providers.tsx` gives these a branch with none of those providers, which
 * takes their initialisation straight off the main thread. Measured on a
 * throttled Pixel 5 (4x CPU, slow-3G, median of 3), the difference is written
 * into `lighthouserc.json` next to the budgets it made room for.
 *
 * Before adding a route here, check that nothing it renders calls `useAuth`,
 * `useTenant`, `usePlan` or `usePagePermission`, directly or through a shared
 * component. The failure is a context read returning undefined at runtime, in
 * the browser, which no type checks and no server-side test would catch.
 */
export const SESSIONLESS_MARKETING_ROUTES = [
  "/institucional",
  "/aplicativo",
  "/sobre",
  "/manifesto",
  "/produtos",
  "/fale-conosco",
] as const;

export function isSessionlessMarketingRoute(pathname: string): boolean {
  return matchesExactOrPrefix(pathname, SESSIONLESS_MARKETING_ROUTES);
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
