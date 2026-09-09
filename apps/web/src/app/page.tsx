import type { Metadata } from "next";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
  SoftwareApplicationJsonLd,
  FAQPageJsonLd,
} from "@/components/seo/json-ld";
import { FAQS } from "@/components/landing/_shared/faq-data";
import { canonicalFor } from "@/lib/site/host-seo";
import { LandingPageClient } from "./_components/landing-page-client";

export const metadata: Metadata = {
  title: "ProOps - ERP para gestão de serviços",
  description:
    "ProOps é o ERP completo para empresas de serviço: propostas, CRM, financeiro, agenda e WhatsApp integrados em uma plataforma online com editor de PDF profissional.",
  // Não é `"/"`. Relativo, o canonical resolve contra o `metadataBase`, que é o
  // apex: depois da virada a landing do ERP declararia ser uma cópia da página
  // institucional, que é o pior sinal possível justamente na semana em que o
  // Google está reavaliando os dois endereços. `canonicalFor` devolve o apex
  // hoje (onde o ERP de fato mora) e o subdomínio depois do flip, sozinho.
  alternates: { canonical: canonicalFor("erp", "/") },
  openGraph: {
    title: "ProOps - ERP para gestão de serviços",
    description:
      "CRM, propostas, financeiro e agenda integrados numa plataforma feita para empresas de serviço que querem crescer sem perder o controle.",
    url: canonicalFor("erp", "/"),
  },
};

export default function Page() {
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <SoftwareApplicationJsonLd />
      <FAQPageJsonLd items={FAQS} />
      <LandingPageClient />
    </>
  );
}
