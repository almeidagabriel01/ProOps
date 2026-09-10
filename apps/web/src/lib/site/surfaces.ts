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
 * The host label of each subdomain surface, DERIVED from `SITE_URLS`.
 *
 * This is what makes renaming a subdomain a one-line change. The surface name
 * ("app") identifies the PRODUCT inside the codebase; the label identifies the
 * HOST out on the internet, and the two only look alike by coincidence today.
 * Reading the label off the URL keeps them from being welded together: pointing
 * the app landing at `personal.proops.com.br` becomes an edit to `SITE_URLS`
 * and nothing else, with no `label === "app"` left behind in a matcher to go
 * stale silently.
 *
 * The apex is deliberately absent: it is whatever is NOT one of these.
 */
const ROTULOS_DE_SUBDOMINIO: ReadonlyArray<readonly [string, Surface]> = (
  ["erp", "app"] as const
).map((surface) => [
  new URL(SITE_URLS[surface]).hostname.split(".")[0],
  surface,
]);

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

/**
 * Hostnames of the subdomain surfaces, for anything that needs the bare host.
 *
 * `next.config.ts` uses it for `allowedDevOrigins`, and the ERP landing shows
 * one of them as text inside a browser chrome mock.
 */
export function hostnameDe(surface: Surface): string {
  return new URL(SITE_URLS[surface]).hostname;
}

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
  const casado = ROTULOS_DE_SUBDOMINIO.find(([rotulo]) => rotulo === label);

  return casado ? casado[1] : APEX_SURFACE;
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
  return ROTULOS_DE_SUBDOMINIO.some(([rotulo]) => rotulo === label);
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
 * True for the internal subtrees that back the host-routed surfaces.
 *
 * `app.proops.com.br/` and `/aplicativo` render the same page. Both stay
 * reachable on purpose, so the pages can be reviewed from any host, but only
 * the HOST is a public address: indexing the path too would publish every new
 * page at two URLs from the first day.
 */
export function isInternalSurfacePath(pathname: string): boolean {
  return (
    pathname === INSTITUCIONAL_ROOT ||
    pathname === APP_ROOT ||
    pathname.startsWith(`${INSTITUCIONAL_ROOT}/`) ||
    pathname.startsWith(`${APP_ROOT}/`)
  );
}

/**
 * The legal pages: company documents, not product pages.
 *
 * They stay on proops.com.br through the cutover and their canonical already
 * anchors there (see `./host-seo`). Named separately from the company site's
 * own pages because the two have different sitemap weights: a privacy policy is
 * `yearly`/0.3 boilerplate, an "about" page is real content.
 */
export const APEX_LEGAL_PATHS = [
  "/privacy",
  "/terms",
  "/cookies",
  "/data-deletion",
] as const;

/**
 * The company site's pages, at apex level.
 *
 * `proops.com.br/sobre` and not `proops.com.br/institucional/sobre`: the
 * rewrite only ever touches `/`, so a subtree under INSTITUCIONAL_ROOT would
 * carry an internal name in a public URL, and that subtree is permanently
 * `noindex` (it is the rewrite target, hence a duplicate of the root).
 *
 * These are siblings of the legal pages: the company owns them, so after the
 * cutover the apex keeps serving them instead of 301-ing them to the ERP.
 */
export const APEX_COMPANY_PATHS = [
  "/sobre",
  "/manifesto",
  "/produtos",
  "/carreiras",
  "/fale-conosco",
] as const;

/**
 * Paths the APEX keeps serving after the cutover, besides its own root.
 *
 * Everything else on the apex is ERP and moves. This is the list
 * `apexRedirectPara` consults, and the list `host-seo` anchors canonicals with.
 *
 * They live here, and not in `host-seo`, only to keep the import graph
 * one-directional: `host-seo` imports this module, so the reverse would be a
 * cycle.
 */
export const APEX_OWNED_PATHS = [
  ...APEX_LEGAL_PATHS,
  ...APEX_COMPANY_PATHS,
] as const;

/**
 * True while a company-site page must stay out of the index.
 *
 * The company pages answer 200 on the apex from the day they ship, so they can
 * be reviewed and shared internally, but until `APEX_SURFACE` flips the apex is
 * still the ERP and an indexed `/sobre` would be a page Google found before the
 * site it belongs to exists. Symmetric to `shouldNoIndexHost`, which does the
 * same for the subdomains while they are duplicates.
 *
 * The internal surface subtrees are `noindex` FOREVER, not transitionally: the
 * public address of those surfaces is a host, so indexing the path too would
 * publish every page at two URLs.
 */
export function shouldNoIndexPath(pathname: string): boolean {
  if (isInternalSurfacePath(pathname)) return true;
  return (
    APEX_STILL_SERVES_ERP &&
    (APEX_COMPANY_PATHS as readonly string[]).includes(pathname)
  );
}

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
  // `/institucional` is the rewrite TARGET of the apex root. Redirecting it to
  // the ERP subdomain would move the company page to the one host that does not
  // serve it, and the apex root would rewrite onto a 301. Inert today only
  // because `apexServeErp` returns above.
  if (isInternalSurfacePath(pathname)) return null;
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
