import type { Metadata } from "next";

import { LinhaDoTempo } from "@/components/institucional/linha-do-tempo";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { PessoasFaixa } from "@/components/institucional/pessoas-faixa";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { canonicalFor } from "@/lib/site/host-seo";

import { MARCOS, PESSOAS } from "@/app/institucional/_content/institucional-copy";

export const metadata: Metadata = {
  title: "Sobre a ProOps",
  description:
    "Quem faz a ProOps: três sócios, dois deles escrevendo o código e atendendo cliente, e como a empresa chegou até aqui.",
  alternates: { canonical: canonicalFor("institucional", "/sobre") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Sobre a ProOps",
    description:
      "Quem faz a ProOps, e como a empresa chegou até aqui.",
    url: canonicalFor("institucional", "/sobre"),
    images: [
      { url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" },
    ],
  },
};

/**
 * Who the company is. Deliberately NOT a second tour of the product.
 *
 * The first version repeated the root experience: the same three principles, the
 * same milestones, the same numbers, one scroll later. Now each subject has one
 * owner. The principles belong to `/manifesto` and this page links there; the
 * numbers stay on the root, where they are one beat of the tour; and the two
 * things this page owns outright are the PEOPLE and the HISTORY, which is what
 * someone who clicked "Sobre" came for.
 *
 * The people come first, before the history, and that order is the argument: a
 * company page is read to find out who is on the other side of the contract, and
 * a timeline of a company whose faces you have not seen is trivia.
 */
export default function SobrePage() {
  return (
    <main>
      <PaginaHero
        sobrancelha="Sobre"
        titulo={
          <>
            <LinhaHero>Três sócios,</LinhaHero>
            <LinhaHero atraso={0.09}>
              <Realce className="font-extrabold">dois</Realce> deles
            </LinhaHero>
            <LinhaHero atraso={0.18}>escrevendo</LinhaHero>
            <LinhaHero atraso={0.27}>o código.</LinhaHero>
          </>
        }
        descricao="Não há camada entre quem atende e quem constrói. O que você conta numa reunião chega, na mesma semana, em quem tem a mão no produto."
        dados={[
          { valor: "03", rotulo: "Sócios" },
          { valor: "02", rotulo: "Engenheiros de software" },
          { valor: "02", rotulo: "Produtos no ar" },
        ]}
      />

      <Secao tom="claro" aria-label="Quem faz a ProOps">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            tom="claro"
            sobrancelha="Quem faz"
            titulo={
              <>
                As três pessoas por trás <Realce>de tudo</Realce>.
              </>
            }
            descricao="Time pequeno de propósito. Um time maior precisaria de um processo entre a conversa e o código, e esse processo é exatamente o que a gente não quer."
            className="mb-14"
          />
          <PessoasFaixa tom="claro" pessoas={PESSOAS} />
        </div>
      </Secao>

      <Secao aria-label="A história da ProOps">
        <div className="mx-auto max-w-6xl">
          <PlaceholderBadge>marcos e datas a definir</PlaceholderBadge>
          <TituloSecao
            sobrancelha="A história"
            titulo={
              <>
                Como a empresa <Realce>chegou aqui</Realce>.
              </>
            }
            descricao="A raiz do site conta esta linha do tempo de passagem. Aqui ela vem com o relato de cada marco."
            className="mb-16"
          />
          <LinhaDoTempo tom="escuro" marcos={MARCOS} />
        </div>
      </Secao>

      {/*
        Ponte para /manifesto em vez de repetir os três princípios aqui, que era
        o que a primeira versão fazia. Eles são o assunto daquela página, e um
        resumo deles nesta só cria uma terceira cópia para manter em dia.
      */}
      <Secao tom="claro" aria-label="Como a ProOps decide">
        <div className="mx-auto max-w-3xl">
          <TituloSecao
            tom="claro"
            sobrancelha="Como decidimos"
            titulo={
              <>
                O que a gente diz <Realce>não</Realce> para.
              </>
            }
            descricao="Três princípios governam o que entra no produto, e cada um deles tem um preço. Os dois estão escritos, em página própria."
            className="mb-10"
          />
          <Magnetic>
            <CurtainLink
              href="/manifesto"
              className="group inline-flex items-center gap-2 border-b border-black/25 pb-1.5 text-base text-black transition-colors hover:border-black"
            >
              Ler o manifesto
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-300 group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </CurtainLink>
          </Magnetic>
        </div>
      </Secao>
    </main>
  );
}
