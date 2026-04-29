import type { Metadata } from "next";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/json-ld";
import { NicheLandingPage } from "@/components/landing/niche/niche-landing-page";

export const metadata: Metadata = {
  title: "ERP para Automação Residencial — propostas, projetos e gestão",
  description:
    "ProOps é o sistema ERP especializado para empresas de automação residencial. Gerencie propostas comerciais com PDF profissional, CRM, financeiro, agenda e WhatsApp em uma plataforma integrada.",
  keywords: [
    "ERP automação residencial",
    "sistema gestão automação residencial",
    "software proposta automação residencial",
    "CRM integradores",
    "ERP integradores AV",
    "gestão projetos automação",
    "proposta comercial automação residencial",
  ],
  alternates: { canonical: "/automacao-residencial" },
  openGraph: {
    title: "ERP para Automação Residencial — ProOps",
    description:
      "Sistema completo para integradores: propostas em PDF, CRM, financeiro, agenda e WhatsApp integrados.",
    url: "/automacao-residencial",
  },
};

export default function AutomacaoResidencialPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="automacao_residencial" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: "Automação Residencial", url: "/automacao-residencial" },
        ]}
      />
      <NicheLandingPage slug="automacao_residencial" />
    </>
  );
}
