import type { Metadata } from "next";

import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { APP_NAME } from "@/lib/site/app-brand";
import { canonicalFor } from "@/lib/site/host-seo";

import { AplicativoAgente } from "./_components/aplicativo-agente";
import { AplicativoDiaADia } from "./_components/aplicativo-dia-a-dia";
import { AplicativoFooter } from "./_components/aplicativo-footer";
import { AplicativoGaleria } from "./_components/aplicativo-galeria";
import { AplicativoHero } from "./_components/aplicativo-hero";
import { AplicativoPlanos } from "./_components/aplicativo-planos";
import { AplicativoNavbar } from "./_components/aplicativo-navbar";
import { AplicativoJsonLd } from "./_components/aplicativo-json-ld";

/**
 * The mobile app landing page.
 *
 * Served at `https://app.proops.com.br/` through a host rewrite in the proxy,
 * so the canonical is that host's root and NOT this file's path. See
 * @/lib/site/surfaces for the host policy.
 */
const DESCRICAO =
  "Notas, lembretes e controle financeiro pessoal por mensagem. Você escreve ou fala, a IA organiza.";

export const metadata: Metadata = {
  // `absolute` escapes the root layout template (`%s | ProOps`): the app is
  // already called ProOps Pessoal, so the template would render it twice.
  title: { absolute: APP_NAME },
  description: DESCRICAO,
  alternates: { canonical: canonicalFor("app", "/") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: APP_NAME,
    title: APP_NAME,
    description: DESCRICAO,
    url: canonicalFor("app", "/"),
    // PENDÊNCIA: imagem própria. Herda a do layout raiz, que diz "ProOps, ERP
    // para gestão de serviços" — errado para esta página. Trocar quando houver
    // arte; até lá o alt não mente sobre o que a imagem mostra.
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "ProOps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: DESCRICAO,
  },
};

export default function AplicativoPage() {
  return (
    <>
      <AplicativoJsonLd />
      <SmoothScroll />
      <AplicativoNavbar />
      <AplicativoHero />
      <AplicativoAgente />
      <AplicativoDiaADia />
      <AplicativoGaleria />
      <AplicativoPlanos />
      <AplicativoFooter />
    </>
  );
}
