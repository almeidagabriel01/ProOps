import type { Metadata } from "next";

import { BlocosRevelados } from "@/components/institucional/blocos-revelados";
import { LinhaDoTempo } from "@/components/institucional/linha-do-tempo";
import { NumerosScrubados } from "@/components/institucional/numeros-scrubados";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { PessoasFaixa } from "@/components/institucional/pessoas-faixa";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { canonicalFor } from "@/lib/site/host-seo";

import {
  MARCOS,
  NUMEROS,
  PESSOAS,
  PRINCIPIOS,
} from "@/app/institucional/_content/institucional-copy";

export const metadata: Metadata = {
  title: "Sobre a ProOps",
  description:
    "Quem faz a ProOps, por que ela existe e como ela chegou até aqui: a empresa por trás do ERP e do aplicativo.",
  alternates: { canonical: canonicalFor("institucional", "/sobre") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Sobre a ProOps",
    description:
      "Quem faz a ProOps, por que ela existe e como ela chegou até aqui.",
    url: canonicalFor("institucional", "/sobre"),
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" }],
  },
};

export default function SobrePage() {
  return (
    <main>
      <PaginaHero
        sobrancelha="Sobre"
        titulo={
          <>
            <LinhaHero>Uma empresa</LinhaHero>
            <LinhaHero atraso={0.09}>de software</LinhaHero>
            <LinhaHero atraso={0.18}>
              <Realce className="font-extrabold">para quem vende</Realce>
            </LinhaHero>
            <LinhaHero atraso={0.27}>projeto.</LinhaHero>
          </>
        }
        descricao="A ProOps constrói duas coisas, e as duas partem da mesma ideia: dado que já foi digitado uma vez não deveria ser digitado de novo."
      />

      <Secao tom="claro" aria-label="Como a ProOps trabalha">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            tom="claro"
            sobrancelha="Como trabalhamos"
            titulo={
              <>
                Três coisas decidem o que <Realce>entra</Realce> no produto.
              </>
            }
            descricao="Não é uma lista de valores para a parede. É o critério que a gente usa quando duas ideias boas competem pela mesma semana."
            className="mb-14"
          />
          <BlocosRevelados
            tom="claro"
            blocos={PRINCIPIOS.map((p) => ({
              titulo: p.titulo,
              texto: p.texto,
            }))}
          />
        </div>
      </Secao>

      <Secao aria-label="A história da ProOps">
        <div className="mx-auto max-w-6xl">
          <PlaceholderBadge>marcos e datas a definir</PlaceholderBadge>
          <TituloSecao
            sobrancelha="A história"
            titulo={
              <>
                De onde a ProOps <Realce>veio</Realce>.
              </>
            }
            className="mb-16"
          />
          <LinhaDoTempo tom="escuro" marcos={MARCOS} />
        </div>
      </Secao>

      <Secao tom="claro" aria-label="Quem faz a ProOps">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            tom="claro"
            sobrancelha="Quem faz"
            titulo={
              <>
                O produto tem <Realce>gente</Realce> atrás dele.
              </>
            }
            descricao="Time pequeno, e de propósito: quem atende é quem constrói, então o que você conta numa conversa chega em quem escreve o código."
            className="mb-14"
          />
          <PessoasFaixa tom="claro" pessoas={PESSOAS} />
        </div>
      </Secao>

      <Secao aria-label="A ProOps em números">
        <div className="mx-auto max-w-6xl">
          <PlaceholderBadge>números a confirmar</PlaceholderBadge>
          <TituloSecao
            sobrancelha="Em números"
            titulo={
              <>
                O que dá para <Realce>contar</Realce>.
              </>
            }
            className="mb-14"
          />
          <NumerosScrubados numeros={NUMEROS} />
        </div>
      </Secao>
    </main>
  );
}
