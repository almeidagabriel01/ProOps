import type { Metadata } from "next";

import { AssinaturaRetratos } from "@/components/institucional/assinaturas-hero";
import { LinhaDoTempo } from "@/components/institucional/linha-do-tempo";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { PessoasFaixa } from "@/components/institucional/pessoas-faixa";
import {
  Realce,
  Secao,
  Sobrancelha,
  TituloSecao,
} from "@/components/institucional/secao";
import { SplitReveal } from "@/components/marketing/_shared/split-reveal";
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
        // Os rostos, antes de qualquer palavra sobre eles. É o assunto desta
        // página, e a faixa de pessoas logo abaixo é que os nomeia.
        assinatura={<AssinaturaRetratos fotos={PESSOAS.map((p) => p.foto)} />}
        dados={[
          { valor: "03", rotulo: "Sócios" },
          { valor: "02", rotulo: "Engenheiros de software" },
          { valor: "Nov 2025", rotulo: "Quando começou" },
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
          <TituloSecao
            sobrancelha="A história"
            titulo={
              <>
                Como a empresa <Realce>chegou aqui</Realce>.
              </>
            }
            descricao="A raiz do site passa por esta linha do tempo. Aqui cada marco vem com o relato inteiro, começando pela reclamação que deu origem a tudo."
            className="mb-16"
          />
          <LinhaDoTempo tom="escuro" marcos={MARCOS} />
        </div>
      </Secao>

      {/*
        O fecho é uma NOTA ASSINADA, e não mais um título com um link embaixo.

        A primeira versão era uma sobrancelha, uma manchete e um "Ler o
        manifesto": tecnicamente uma ponte, e na prática um sumário, porque não
        dizia nada por conta própria. Uma página que acabou de apresentar três
        pessoas e contar a história delas tem uma saída melhor à disposição, que
        é essas pessoas falarem em primeira pessoa e assinarem embaixo.

        O conteúdo dela é a parte que uma empresa nova costuma esconder: são
        duas empresas usando o ERP, e está escrito. Dizer isso antes que alguém
        pergunte é o que dá crédito ao resto da página, e a nota faz a ponte
        para /manifesto por consequência, e não por instrução.
      */}
      <Secao tom="claro" aria-label="Uma nota dos sócios">
        <div className="mx-auto max-w-3xl">
          <Sobrancelha tom="claro" className="mb-10">
            Uma nota
          </Sobrancelha>

          <div className="space-y-7 text-lg leading-relaxed text-black/70 md:text-xl md:leading-relaxed">
            <SplitReveal unit="lines" stagger={0.05}>
              A ProOps começou em novembro de 2025, e hoje são duas empresas
              usando o ERP. Não vamos escrever que somos líderes de coisa
              nenhuma: com esse tempo de estrada, quem escreve isso está pedindo
              para ser conferido.
            </SplitReveal>
            <SplitReveal unit="lines" stagger={0.05}>
              O que a gente tem para oferecer é outra coisa. Um sistema que
              nasceu de um problema real, que foi usado todo dia numa empresa de
              verdade antes de ter preço, e que é mantido pelas mesmas três
              pessoas que atendem quem usa. Enquanto for assim, o que você pedir
              numa reunião não vai passar por camada nenhuma antes de virar
              decisão.
            </SplitReveal>
            <SplitReveal unit="lines" stagger={0.05}>
              O critério que decide o que entra no produto, e o preço de cada uma
              dessas escolhas, está escrito em página própria.
            </SplitReveal>
          </div>

          {/* A assinatura. Os primeiros nomes bastam: a página inteira acabou
              de apresentar os três, e nome completo aqui viraria rodapé de
              contrato. */}
          <p className="mt-12 border-t border-black/15 pt-8 [font-family:var(--font-fraunces)] text-2xl italic text-black md:text-3xl">
            Mauricio, Gabriel e Winicius
          </p>

          <div className="mt-10">
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
        </div>
      </Secao>
    </main>
  );
}
