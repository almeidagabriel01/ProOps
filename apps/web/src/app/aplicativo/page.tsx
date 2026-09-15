import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { PointerFieldProvider } from "@/components/marketing/_shared/pointer-field-provider";
import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { APP_NAME } from "@/lib/site/app-brand";
import { canonicalFor } from "@/lib/site/host-seo";

import { AplicativoDiferenca } from "./_components/aplicativo-diferenca";
import { AplicativoHero } from "./_components/aplicativo-hero";
import { AplicativoJsonLd } from "./_components/aplicativo-json-ld";
import { AplicativoNavbar } from "./_components/aplicativo-navbar";

/**
 * Tudo a partir da quarta cena é code-split, importado POR CAMINHO DIRETO e
 * nunca por um barrel. A regra está registrada em `institucional/page.tsx` e o
 * motivo é que um import de barrel puxa o grafo inteiro do módulo para o
 * primeiro chunk: o split não falha, ele simplesmente não acontece, e nada
 * avisa.
 *
 * `ssr` fica no padrão (`true`), então toda cena é renderizada no servidor e
 * está no HTML. O split é sobre QUANDO o JavaScript chega, não sobre quando o
 * conteúdo chega: as cenas são escritas no estado final, então o markup está
 * completo e legível antes de qualquer uma hidratar.
 *
 * Isso é orçamento, não higiene. Esta página mede 308ms de TBT e está no teto
 * GENÉRICO do `lighthouserc.json` (800ms como `error`), sem exceção própria, de
 * propósito.
 */
const AplicativoComandos = dynamic(() =>
  import("./_components/aplicativo-comandos").then((m) => m.AplicativoComandos),
);
const AplicativoDiaADia = dynamic(() =>
  import("./_components/aplicativo-dia-a-dia").then((m) => m.AplicativoDiaADia),
);
const AplicativoConversa = dynamic(() =>
  import("./_components/aplicativo-conversa").then((m) => m.AplicativoConversa),
);
const AplicativoGaleria = dynamic(() =>
  import("./_components/aplicativo-galeria").then((m) => m.AplicativoGaleria),
);
const AplicativoPrivacidade = dynamic(() =>
  import("./_components/aplicativo-privacidade").then(
    (m) => m.AplicativoPrivacidade,
  ),
);
const AplicativoCasa = dynamic(() =>
  import("./_components/aplicativo-casa").then((m) => m.AplicativoCasa),
);
const AplicativoPlanos = dynamic(() =>
  import("./_components/aplicativo-planos").then((m) => m.AplicativoPlanos),
);
const AplicativoFaq = dynamic(() =>
  import("./_components/aplicativo-faq").then((m) => m.AplicativoFaq),
);
const AplicativoFecho = dynamic(() =>
  import("./_components/aplicativo-fecho").then((m) => m.AplicativoFecho),
);
const AplicativoFooter = dynamic(() =>
  import("./_components/aplicativo-footer").then((m) => m.AplicativoFooter),
);

/**
 * The mobile app landing page.
 *
 * Served at `https://app.proops.com.br/` through a host rewrite in the proxy,
 * so the canonical is that host's root and NOT this file's path. See
 * @/lib/site/surfaces for the host policy.
 */
const DESCRICAO =
  "Lançamento, transferência, parcela, fatura e a projeção do mês por mensagem. No WhatsApp ou dentro do aplicativo, com um financeiro completo por trás.";

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
    // para gestão de serviços", errado para esta página. Trocar quando houver
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
      {/* Um campo de ponteiro para a superfície inteira: `--px` e `--py` são
          escritos UMA vez por quadro aqui e herdados por toda a página, então
          qualquer cena reage lendo duas variáveis em CSS. Um hook por seção
          seria um listener e uma escrita por seção, todos calculando os mesmos
          dois números.

          Ele não pode ganhar `transform`: um ancestral transformado vira bloco
          de contenção para `position: fixed`, e a navbar desta página é fixa. */}
      <PointerFieldProvider>
        <AplicativoNavbar />
        <AplicativoHero />
        <AplicativoDiferenca />
        <AplicativoComandos />
        <AplicativoDiaADia />
        <AplicativoConversa />
        <AplicativoGaleria />
        <AplicativoPrivacidade />
        <AplicativoCasa />
        <AplicativoPlanos />
        <AplicativoFaq />
        <AplicativoFecho />
        <AplicativoFooter />
      </PointerFieldProvider>
    </>
  );
}
