import { headers } from "next/headers";
import type { MetadataRoute } from "next";

import { sitemapAbsoluto } from "@/lib/site/host-seo";
import { resolveSurface } from "@/lib/site/surfaces";

/**
 * One sitemap per host.
 *
 * `headers()` is what makes this dynamic. Without it Next builds the file once
 * and serves the same bytes on all three domains, which would publish the ERP's
 * URLs on the app's domain and hand Google three copies of one site. Reading a
 * dynamic API here opts the route out of static generation on its own; the
 * explicit `dynamic` below states it rather than leaving it as a side effect
 * someone could remove by "cleaning up" the import.
 *
 * The route is excluded from the proxy matcher (crawlers must reach it), so the
 * host arrives untouched and `noindex` decisions have to be made in
 * `@/lib/site/host-seo`, not inherited from the proxy.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cabecalhos = await headers();
  const surface = resolveSurface(
    cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"),
  );

  return sitemapAbsoluto(surface).map((rota) => ({
    url: rota.url,
    lastModified: new Date(),
    changeFrequency: rota.changeFrequency,
    priority: rota.priority,
  }));
}
