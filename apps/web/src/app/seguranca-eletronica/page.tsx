import type { Metadata } from "next";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
  FAQPageJsonLd,
} from "@/components/seo/json-ld";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NicheLandingPage } from "@/components/landing/niche/niche-landing-page";
import { canonicalFor } from "@/lib/site/host-seo";

const seo = NICHE_LANDING_CONFIG.seguranca_eletronica.seo;

export const metadata: Metadata = {
  title: seo.metadataTitle,
  description: seo.metadataDescription,
  keywords: [
    "ERP segurança eletrônica",
    "sistema para empresa de CFTV",
    "software proposta CFTV",
    "sistema gestão instalador de alarme",
    "ERP controle de acesso",
  ],
  alternates: { canonical: canonicalFor("erp", "/seguranca-eletronica") },
  openGraph: {
    title: "ERP para Segurança Eletrônica | ProOps",
    description:
      "Proposta por sistema e área, obra por etapas, CRM, financeiro e mensalidades para instaladores de segurança eletrônica.",
    url: canonicalFor("erp", "/seguranca-eletronica"),
  },
};

export default function SegurancaEletronicaPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="seguranca_eletronica" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: seo.breadcrumb, url: "/seguranca-eletronica" },
        ]}
      />
      <FAQPageJsonLd items={NICHE_LANDING_CONFIG.seguranca_eletronica.faq} />
      <NicheLandingPage slug="seguranca_eletronica" />
    </>
  );
}
