import type { Metadata } from "next";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
} from "@/components/seo/json-ld";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NicheLandingPage } from "@/components/landing/niche/niche-landing-page";
import { canonicalFor } from "@/lib/site/host-seo";

export const metadata: Metadata = {
  title: NICHE_LANDING_CONFIG.cortinas.seo.metadataTitle,
  description: NICHE_LANDING_CONFIG.cortinas.seo.metadataDescription,
  keywords: [
    "ERP persianas",
    "sistema para empresa de toldos",
    "sistema gestão loja cortinas",
    "orçamento de persianas por m²",
    "software proposta decoração",
  ],
  alternates: { canonical: canonicalFor("erp", "/decoracao") },
  openGraph: {
    title: "ERP para Persianas e Toldos | ProOps",
    description:
      "Propostas por ambiente com preço por medida, obra, CRM e financeiro para empresas de persianas, cortinas e toldos.",
    url: canonicalFor("erp", "/decoracao"),
  },
};

export default function DecoracaoPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="cortinas" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: NICHE_LANDING_CONFIG.cortinas.seo.breadcrumb, url: "/decoracao" },
        ]}
      />
      <FAQPageJsonLd items={NICHE_LANDING_CONFIG.cortinas.faq} />
      <NicheLandingPage slug="cortinas" />
    </>
  );
}
