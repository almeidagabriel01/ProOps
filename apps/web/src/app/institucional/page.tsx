import type { Metadata } from "next";

import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";

import { InstitucionalCta } from "./_components/institucional-cta";
import { InstitucionalFooter } from "./_components/institucional-footer";
import { InstitucionalHistoria } from "./_components/institucional-historia";
import { InstitucionalHero } from "./_components/institucional-hero";
import { InstitucionalManifesto } from "./_components/institucional-manifesto";
import { InstitucionalNavbar } from "./_components/institucional-navbar";
import { InstitucionalProdutos } from "./_components/institucional-produtos";

/**
 * The ProOps company page.
 *
 * Served at `https://proops.com.br/` through a host rewrite in the proxy, so
 * the canonical is the apex root and NOT this file's path. See
 * @/lib/site/surfaces for the host policy.
 */
export const metadata: Metadata = {
  // `absolute` escapes the root layout template (`%s | ProOps`), which would
  // otherwise render this page as "ProOps | ProOps".
  title: { absolute: "ProOps: software de gestão para quem vende projeto" },
  description:
    "A ProOps constrói software de gestão para quem vende projeto: um ERP para a operação da empresa e um aplicativo para a vida financeira de cada pessoa.",
  alternates: { canonical: "https://proops.com.br/" },
  openGraph: {
    title: "ProOps",
    description:
      "Software de gestão para quem vende projeto: um ERP para a empresa e um aplicativo para a pessoa.",
    url: "https://proops.com.br/",
  },
};

export default function InstitucionalPage() {
  return (
    <>
      <SmoothScroll />
      <InstitucionalNavbar />
      <InstitucionalHero />
      <InstitucionalProdutos />
      <InstitucionalManifesto />
      <InstitucionalHistoria />
      <InstitucionalCta />
      <InstitucionalFooter />
    </>
  );
}
