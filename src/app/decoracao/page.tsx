import type { Metadata } from "next";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/json-ld";
import { NicheLandingPage } from "@/components/landing/niche/niche-landing-page";

export const metadata: Metadata = {
  title: "ERP para Decoração — cortinas, persianas e papéis de parede",
  description:
    "ProOps é o ERP para lojas de decoração. Propostas com cálculo automático de metros, CRM, financeiro e WhatsApp integrados.",
  keywords: [
    "ERP decoração",
    "sistema gestão loja cortinas",
    "ERP persianas",
    "software proposta decoração",
    "sistema decoração interiores",
  ],
  alternates: { canonical: "/decoracao" },
  openGraph: {
    title: "ERP para Decoração — ProOps",
    description:
      "Sistema completo para lojas de decoração: propostas com medidas, CRM, financeiro e WhatsApp.",
    url: "/decoracao",
  },
};

export default function DecoracaoPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="cortinas" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: "Decoração", url: "/decoracao" },
        ]}
      />
      <NicheLandingPage slug="cortinas" />
    </>
  );
}
