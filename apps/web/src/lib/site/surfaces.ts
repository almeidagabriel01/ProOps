/**
 * Host → surface policy: which of the three ProOps sites a request belongs to.
 *
 * ProOps serves three products from ONE Next project, split by hostname:
 *
 *   proops.com.br      → the company page          (surface "institucional")
 *   erp.proops.com.br  → the ERP: landing + app    (surface "erp")
 *   app.proops.com.br  → the mobile app landing    (surface "app")
 *
 * Pure string logic with NO Next.js / React imports, for the same reason
 * `@/lib/auth/route-access` is: the proxy, the tests and any server component
 * share ONE source of truth and can't drift.
 */

export type Surface = "institucional" | "erp" | "app";

/** Internal route subtree that backs each non-ERP surface. */
export const INSTITUCIONAL_ROOT = "/institucional";
export const APP_ROOT = "/aplicativo";

/**
 * What the apex domain (proops.com.br, and every preview/localhost host) serves.
 *
 * Deliberately still "erp": the subdomains go live first and additively, so
 * nothing changes for anyone already using proops.com.br while the two new
 * pages are being built. The cutover flips this ONE constant to
 * "institucional" and adds the 301s — see the plan, phase 9.
 */
export const APEX_SURFACE: Surface = "erp";

/**
 * True while the apex still serves the ERP, i.e. `erp.proops.com.br` is a
 * duplicate of `proops.com.br`. Non-apex hosts must be `noindex` until the
 * cutover, otherwise Google indexes the same ERP twice and picks a winner
 * for us.
 */
export const APEX_STILL_SERVES_ERP = APEX_SURFACE === "erp";

/**
 * Resolves the surface from a `Host` header.
 *
 * Matches on the leftmost label so it works for production
 * (`erp.proops.com.br`), for local development (`erp.localhost:3000` — Chrome
 * resolves any `*.localhost` to 127.0.0.1 with no hosts-file edit) and for
 * Playwright. Anything else, including Vercel preview URLs, falls back to the
 * apex surface.
 */
export function resolveSurface(host: string | null | undefined): Surface {
  if (!host) return APEX_SURFACE;

  // `x-forwarded-host` can arrive as a comma-separated chain; the first entry
  // is the client-facing host. Then strip IPv6 brackets and the port before
  // looking at labels.
  const hostname = host
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split(":")[0];
  const label = hostname.split(".")[0];

  if (label === "app") return "app";
  if (label === "erp") return "erp";
  return APEX_SURFACE;
}

/**
 * The internal path that should render for `pathname` on `surface`, or `null`
 * when the request must be served as-is.
 *
 * ONLY the root is ever rewritten, and that is deliberate. `providers.tsx`
 * classifies the page with `usePathname()`, which under a rewrite reports the
 * BROWSER path, not the rewrite target. Rewriting a whole subtree
 * (`app.proops.com.br/x` → `/aplicativo/x`) would leave the client seeing `/x`,
 * which is not in PUBLIC_MARKETING_ROUTES, so the proxy would let the page
 * through while the client wrapped it in <ProtectedRoute> and bounced it to
 * login. Rewriting only `/` keeps both sides looking at a path that is on the
 * list: `/` for a rewritten root, and the real path for anything else.
 *
 * The ERP surface always returns `null`: `erp.proops.com.br` serves the route
 * tree exactly as it exists today, which is what keeps the existing landing,
 * login and authenticated app untouched by this change.
 */
export function resolveRewritePath(
  surface: Surface,
  pathname: string,
): string | null {
  if (pathname !== "/") return null;
  if (surface === "app") return APP_ROOT;
  if (surface === "institucional") return INSTITUCIONAL_ROOT;
  return null;
}
