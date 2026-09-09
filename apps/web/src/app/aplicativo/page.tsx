import type { Metadata } from "next";

import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { APP_NAME } from "@/lib/site/app-brand";

import { AplicativoAgente } from "./_components/aplicativo-agente";
import { AplicativoDiaADia } from "./_components/aplicativo-dia-a-dia";
import { AplicativoFooter } from "./_components/aplicativo-footer";
import { AplicativoGaleria } from "./_components/aplicativo-galeria";
import { AplicativoHero } from "./_components/aplicativo-hero";
import { AplicativoPlanos } from "./_components/aplicativo-planos";
import { AplicativoNavbar } from "./_components/aplicativo-navbar";

/**
 * The mobile app landing page.
 *
 * Served at `https://app.proops.com.br/` through a host rewrite in the proxy,
 * so the canonical is that host's root and NOT this file's path. See
 * @/lib/site/surfaces for the host policy.
 */
export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Notas, lembretes e controle financeiro pessoal por mensagem. Você escreve ou fala, a IA organiza.",
  alternates: { canonical: "https://app.proops.com.br/" },
  openGraph: {
    title: APP_NAME,
    description:
      "Notas, lembretes e controle financeiro pessoal por mensagem. Você escreve ou fala, a IA organiza.",
    url: "https://app.proops.com.br/",
  },
};

export default function AplicativoPage() {
  return (
    <>
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
