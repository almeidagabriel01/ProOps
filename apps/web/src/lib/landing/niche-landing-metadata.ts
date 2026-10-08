import type { Metadata } from "next";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NICHE_REGISTRY } from "@/lib/niches/registry";
import { canonicalFor } from "@/lib/site/host-seo";
import { OG_IMAGES_PADRAO } from "@/lib/site/og-image";
import type { TenantNiche } from "@/types";

/**
 * Metadados da landing de um nicho: título, descrição, palavras-chave, Open
 * Graph e canonical ABSOLUTO no host do ERP (`canonicalFor`), tudo da pasta do
 * nicho. A página de cada nicho só chama isto.
 */
export function buildNicheLandingMetadata(niche: TenantNiche): Metadata {
  const { seo } = NICHE_LANDING_CONFIG[niche];
  const url = canonicalFor("erp", NICHE_REGISTRY[niche].landingPath);
  return {
    title: seo.metadataTitle,
    description: seo.metadataDescription,
    keywords: seo.keywords,
    alternates: { canonical: url },
    openGraph: { title: seo.ogTitle, description: seo.ogDescription, url, images: OG_IMAGES_PADRAO },
  };
}
