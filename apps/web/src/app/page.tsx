import type { Metadata } from "next";
import {
  OrganizationJsonLd,
  WebSiteJsonLd,
  SoftwareApplicationJsonLd,
  FAQPageJsonLd,
} from "@/components/seo/json-ld";
import { FAQS } from "@/components/landing/_shared/faq-data";
import { LandingPageClient } from "./_components/landing-page-client";

export const metadata: Metadata = {
  title: "ProOps - ERP para gestão de serviços",
  description:
    "ProOps é o ERP completo para empresas de serviço: propostas, CRM, financeiro, agenda e WhatsApp integrados em uma plataforma online com editor de PDF profissional.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ProOps - ERP para gestão de serviços",
    description:
      "CRM, propostas, financeiro e agenda integrados numa plataforma feita para empresas de serviço que querem crescer sem perder o controle.",
    url: "/",
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
