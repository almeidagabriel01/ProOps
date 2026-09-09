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

/**
 * Absolute origin of each surface, in one place.
 *
 * Cross-surface links have to be absolute: a relative `/erp` would stay on
 * whatever host is being served. Keeping them here means the cutover (phase 9)
 * has one file to touch instead of every call site.
 */
export const SITE_URLS: Record<Surface, string> = {
  institucional: "https://proops.com.br",
  erp: "https://erp.proops.com.br",
  app: "https://app.proops.com.br",
};

/**
 * The apex domain itself, as a domain and not as a surface.
 *
 * Same string as `SITE_URLS.institucional` today, and deliberately a separate
 * name: which SURFACE the apex serves flips at the cutover, but the apex is the
 * apex before and after. Anything that must stay put across the flip (the
 * canonical of the legal pages, chiefly) anchors here, so it does not silently
 * move hosts when `APEX_SURFACE` changes.
 */
export const APEX_URL = "https://proops.com.br";

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

  const label = normalizeHost(host).split(".")[0];

  if (label === "app") return "app";
  if (label === "erp") return "erp";
  return APEX_SURFACE;
}

/**
 * A `Host` header reduced to a bare hostname.
 *
 * `x-forwarded-host` can arrive as a comma-separated chain, and the first entry
 * is the client-facing host. Then IPv6 brackets and the port come off.
 */
export function normalizeHost(host: string): string {
  return host
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split(":")[0];
}

/**
 * True for a request arriving on one of the NEW subdomains, as opposed to the
 * apex, a preview URL or localhost.
 *
 * Separate from `resolveSurface` on purpose, and the distinction is not
 * cosmetic. While the apex still serves the ERP, `resolveSurface` maps BOTH
 * `proops.com.br` and `erp.proops.com.br` to the surface "erp" — correctly, as
 * they render the same thing. But that makes surface useless for deciding
 * indexability, which is exactly the question "are these two the same page at
 * two addresses?". Asking it of the surface answered "no" for
 * `erp.proops.com.br` and left the duplicate crawlable.
 */
export function isNewSubdomainHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const label = normalizeHost(host).split(".")[0];
  return label === "app" || label === "erp";
}

/**
 * Whether a host must be kept out of the search index.
 *
 * Until the cutover the two subdomains duplicate content that already lives on
 * the apex, so they answer `noindex` and their `robots.txt` disallows
 * everything. After the flip each host has content of its own and all three are
 * indexable.
 */
export function shouldNoIndexHost(host: string | null | undefined): boolean {
  return APEX_STILL_SERVES_ERP && isNewSubdomainHost(host);
}

/**
 * Paths the APEX keeps serving after the cutover, besides its own root.
 *
 * The legal pages belong to the company, not to a product, so they stay on
 * proops.com.br and their canonical already anchors there (see `./host-seo`).
 * Everything else on the apex is ERP and moves.
 *
 * They live here, and not in `host-seo`, only to keep the import graph
 * one-directional: `host-seo` imports this module, so the reverse would be a
 * cycle.
 */
export const APEX_OWNED_PATHS = [
  "/privacy",
  "/terms",
  "/cookies",
  "/data-deletion",
] as const;

/**
 * Where the ERP landing lives, as something you can redirect to.
 *
 * `/` while the apex still serves the ERP, and the absolute subdomain after the
 * cutover. It exists because of one line in the proxy: a free-tier account that
 * touches an ERP route is bounced to the public landing, and that bounce was
 * written as `new URL("/", request.url)`. After the flip that lands the user on
 * the company page, which is not a landing for the product they were trying to
 * use, with no error and nothing to click. `new URL()` accepts an absolute URL
 * as the first argument and ignores the base, so the call site does not change
 * shape.
 */
export function erpHomeUrl(): string {
  return erpHomeUrlPara(APEX_STILL_SERVES_ERP);
}

/** @internal A mesma decisão, com o estado da virada explícito, para o teste. */
export function erpHomeUrlPara(apexServeErp: boolean): string {
  return apexServeErp ? "/" : `${SITE_URLS.erp}/`;
}

/**
 * The 301 target for an ERP path still being requested on the apex, or `null`
 * when the apex should serve it.
 *
 * Inert until the cutover: while `APEX_SURFACE` is "erp" this always returns
 * `null`, so the rule ships, is tested, and does nothing.
 *
 * After the flip the apex serves exactly two things: the company page at `/`
 * and the legal pages. Every other path is ERP that changed address, and gets a
 * permanent redirect — which is the ONLY migration signal Google will get for
 * those URLs. `/` itself is deliberately absent: it keeps answering 200 with
 * different content, and no redirect can express that. That asymmetry is the
 * documented SEO risk of this whole plan.
 */
export function resolveApexRedirect(
  surface: Surface,
  pathname: string,
): string | null {
  return apexRedirectPara(pathname, {
    apexServeErp: APEX_STILL_SERVES_ERP,
    superficieDoApex: APEX_SURFACE,
    superficie: surface,
  });
}

/**
 * @internal A mesma decisão, com o estado da virada explícito.
 *
 * Existe para o teste conseguir exercitar o lado de LÁ da virada. Sem isto, a
 * regra de 301 só poderia ser testada no estado em que ela não faz nada, e a
 * primeira execução dela seria em produção, no dia mais arriscado do plano.
 * Mockar o módulo não resolveria: as constantes são lidas por closure, então o
 * mock não alcançaria a função.
 */
export function apexRedirectPara(
  pathname: string,
  opts: {
    apexServeErp: boolean;
    superficieDoApex: Surface;
    superficie: Surface;
  },
): string | null {
  if (opts.apexServeErp) return null;
  if (opts.superficie !== opts.superficieDoApex) return null;
  if (pathname === "/") return null;
  if ((APEX_OWNED_PATHS as readonly string[]).includes(pathname)) return null;
  return `${SITE_URLS.erp}${pathname}`;
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
