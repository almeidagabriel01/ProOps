import { headers } from "next/headers";
import type { MetadataRoute } from "next";

import { buildWebManifest } from "@/lib/pwa/manifest";
import { resolveSurface } from "@/lib/site/surfaces";

/**
 * Um manifest por host, pelo mesmo motivo do `sitemap.ts`: sem ler o host, o
 * Next gera o arquivo uma vez e serve os mesmos bytes nos três domínios. A
 * regra de cada superfície está em `buildWebManifest`.
 */
export const dynamic = "force-dynamic";

const DESCRIPTION =
  "ERP completo que adapta-se ao seu nicho: automação residencial; persianas e toldos; segurança eletrônica; vidraçaria e esquadrias; marcenaria e móveis planejados; climatização e ar-condicionado; e mais.";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cabecalhos = await headers();
  const surface = resolveSurface(
    cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"),
  );
  return buildWebManifest(surface, DESCRIPTION);
}
