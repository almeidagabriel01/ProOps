import {
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/seo/json-ld";
import { NicheLandingPage } from "@/components/landing/niche/niche-landing-page";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NICHE_REGISTRY } from "@/lib/niches/registry";
import type { TenantNiche } from "@/types";

/**
 * A landing de um nicho com o dado estruturado dela. A página de cada nicho
 * (`app/<caminho>/page.tsx`) só renderiza isto.
 */
export function NicheLandingRoute({ niche }: { niche: TenantNiche }) {
  const config = NICHE_LANDING_CONFIG[niche];
  return (
    <>
      <SoftwareApplicationJsonLd niche={niche} />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: config.seo.breadcrumb, url: NICHE_REGISTRY[niche].landingPath },
        ]}
      />
      <FAQPageJsonLd items={config.faq} />
      <NicheLandingPage slug={niche} />
    </>
  );
}
