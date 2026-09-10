/**
 * What each host tells a crawler: sitemap entries, canonical URLs and robots.
 *
 * With three domains served by ONE Next project, the file-convention
 * `app/sitemap.ts` and `app/robots.ts` stop working: they are built once, from
 * `NEXT_PUBLIC_SITE_URL`, and have no way to know which host asked. Left alone
 * they would publish the same sitemap on all three domains, which is the
 * textbook way to hand Google three copies of one site.
 *
 * Pure, like `./surfaces`: no Next imports, so the route handlers, the tests
 * and anything server-side share one source of truth.
 */

import {
  APEX_LEGAL_PATHS,
  APEX_OWNED_PATHS,
  APEX_SURFACE,
  APEX_URL,
  APP_ROOT,
  INSTITUCIONAL_ROOT,
  SITE_URLS,
  shouldNoIndexHost,
  type Surface,
} from "./surfaces";

type ChangeFrequency =
  "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SitemapRoute {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** Indexable content of each surface, and nothing else. */
const ROTAS: Record<Surface, SitemapRoute[]> = {
  institucional: [
    { path: "/", changeFrequency: "monthly", priority: 1 },
    { path: "/sobre", changeFrequency: "monthly", priority: 0.8 },
    { path: "/manifesto", changeFrequency: "monthly", priority: 0.8 },
    { path: "/produtos", changeFrequency: "monthly", priority: 0.8 },
    { path: "/carreiras", changeFrequency: "weekly", priority: 0.7 },
    { path: "/fale-conosco", changeFrequency: "yearly", priority: 0.5 },
  ],
  erp: [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    {
      path: "/automacao-residencial",
      changeFrequency: "monthly",
      priority: 0.9,
    },
    { path: "/decoracao", changeFrequency: "monthly", priority: 0.9 },
    { path: "/contato", changeFrequency: "yearly", priority: 0.5 },
    { path: "/agendar", changeFrequency: "yearly", priority: 0.5 },
  ],
  app: [{ path: "/", changeFrequency: "monthly", priority: 1 }],
};

/**
 * The legal pages, which belong to the COMPANY rather than to a product.
 *
 * They are the one piece of content every host serves: the proxy rewrites only
 * `/`, so `/privacy` answers 200 on all three domains. Left without a canonical
 * that is triplicated content, so they anchor to the apex and stay there
 * through the cutover — see `canonicalFor`.
 */
export const ROTAS_LEGAIS: SitemapRoute[] = APEX_LEGAL_PATHS.map((path) => ({
  path,
  changeFrequency: "yearly" as const,
  priority: 0.3,
}));

/**
 * Every path whose canonical is the apex, whatever host served it.
 *
 * Wider than the legal pages: the company site's own pages are at apex level
 * too, so `erp.proops.com.br/sobre` also answers 200 (only `/` is rewritten).
 * Without this they would be the most literal duplicate the project has.
 */
const CAMINHOS_ANCORADOS_NO_APEX = new Set<string>(APEX_OWNED_PATHS);

/**
 * Sitemap entries for a surface.
 *
 * The legal pages ride with whichever surface is currently serving the apex,
 * which is what keeps the apex sitemap complete on both sides of the cutover:
 * today they ship with the ERP, afterwards with the company page, and at no
 * point do two hosts list them.
 */
export function rotasDoSitemap(surface: Surface): SitemapRoute[] {
  const proprias = ROTAS[surface];
  return surface === APEX_SURFACE
    ? [...proprias, ...ROTAS_LEGAIS]
    : [...proprias];
}

/** Absolute sitemap URLs for a surface, ready for `MetadataRoute.Sitemap`. */
export function sitemapAbsoluto(
  surface: Surface,
): Array<SitemapRoute & { url: string }> {
  const origem = origemDe(surface);
  return rotasDoSitemap(surface).map((rota) => ({
    ...rota,
    url: rota.path === "/" ? `${origem}/` : `${origem}${rota.path}`,
  }));
}

/**
 * Where a path declares itself canonical.
 *
 * The pages the company owns, legal documents and company site alike, always
 * point at the apex regardless of the host that served them. Everything else is
 * canonical on the surface that owns it.
 */
export function canonicalFor(surface: Surface, pathname: string): string {
  const path = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  if (CAMINHOS_ANCORADOS_NO_APEX.has(path)) return `${APEX_URL}${path}`;
  const origem = origemDe(surface);
  return path === "/" ? `${origem}/` : `${origem}${path}`;
}

/**
 * The origin a surface publishes under.
 *
 * While the apex still serves the ERP, the ERP's canonical is the APEX, not
 * `erp.proops.com.br`: that subdomain is a duplicate today, and pointing the
 * canonical at it would ask Google to move the ranking to a host that is about
 * to change meaning. The cutover flips `APEX_SURFACE` and this resolves to the
 * subdomain on its own.
 */
export function origemDe(surface: Surface): string {
  return surface === APEX_SURFACE ? APEX_URL : SITE_URLS[surface];
}

/**
 * Canonical of a legal page: the apex, always.
 *
 * A thin name over `canonicalFor` because the call site should not have to pass
 * a surface it does not have and that would not change the answer. These four
 * pages had NO canonical of their own, so they inherited the root layout's
 * `alternates: { canonical: "/" }` and each declared itself a copy of the home
 * page — verified rendered, not inferred. That is wrong on one host already,
 * and on three it also triplicates them.
 */
export function canonicalLegal(path: string): string {
  return canonicalFor(APEX_SURFACE, path);
}

/**
 * Paths no crawler should follow, on any host.
 *
 * The first two are the internal subtrees behind the host rewrite, and they
 * belong here permanently, not just until the cutover. `app.proops.com.br/` and
 * `/aplicativo` render the same page, so leaving the path crawlable publishes
 * every new page at two addresses at once. The public address of these two
 * surfaces is a HOST; the path is plumbing, and it stays reachable only so the
 * pages can be reviewed from any host while being built.
 */
const NUNCA_INDEXAR = [
  INSTITUCIONAL_ROOT,
  APP_ROOT,
  "/api/",
  "/share/",
  "/admin/",
  "/dashboard/",
  "/proposals/",
  "/transactions/",
  "/settings/",
  "/profile/",
  "/products/",
  "/contacts/",
  "/crm/",
  "/team/",
  "/wallets/",
  "/spreadsheets/",
  "/services/",
  "/automation/",
  "/calendar/",
  "/invoices/",
  "/notifications/",
  "/login",
  "/register",
  "/forgot-password",
  "/subscribe",
  "/checkout",
  "/checkout-success",
  "/addon-success",
  "/auth/",
  "/403",
  "/subscription-blocked",
];

export interface RobotsPolicy {
  allow: string;
  disallow: string[];
  sitemap: string;
  host: string;
}

/**
 * `robots.txt` for a host.
 *
 * A host that is still a duplicate disallows everything. That has to be stated
 * here and not only in the proxy: `robots.txt` is excluded from the proxy
 * matcher (a crawler must reach it), so the `X-Robots-Tag` the proxy sets never
 * touches this file.
 */
export function robotsPara(
  surface: Surface,
  host: string | null,
): RobotsPolicy {
  const origem = origemDe(surface);
  const base: RobotsPolicy = {
    allow: "/",
    disallow: [...NUNCA_INDEXAR],
    sitemap: `${origem}/sitemap.xml`,
    host: origem,
  };

  if (!shouldNoIndexHost(host)) return base;

  return { ...base, allow: "", disallow: ["/"] };
}
