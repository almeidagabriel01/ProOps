import { headers } from "next/headers";
import type { MetadataRoute } from "next";

import { robotsPara } from "@/lib/site/host-seo";
import { resolveSurface } from "@/lib/site/surfaces";

/**
 * One robots.txt per host. See `./sitemap.ts` for why this must be dynamic.
 *
 * A host that still duplicates the apex answers `Disallow: /`. That decision
 * cannot come from the proxy: `robots.txt` is excluded from its matcher, by
 * design, so the `X-Robots-Tag` it sets never reaches this file.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const politica = robotsPara(resolveSurface(host), host);

  return {
    rules: [
      {
        userAgent: "*",
        ...(politica.allow ? { allow: politica.allow } : {}),
        disallow: politica.disallow,
      },
    ],
    sitemap: politica.sitemap,
    host: politica.host,
  };
}
