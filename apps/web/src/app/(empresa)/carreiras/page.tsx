import type { Metadata } from "next";

import { BlocosRevelados } from "@/components/institucional/blocos-revelados";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { canonicalFor } from "@/lib/site/host-seo";

import { Vagas } from "./_components/vagas";

import {
  PROCESSO,
  VAGAS,
} from "@/app/institucional/_content/institucional-copy";

export const metadata: Metadata = {
  title: "Carreiras na ProOps",
  description:
    "Como a ProOps trabalha, como é o processo seletivo e quais vagas estão abertas.",
  alternates: { canonical: canonicalFor("institucional", "/carreiras") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Carreiras na ProOps",
    description: "Como a ProOps trabalha, e as vagas abertas.",
    url: canonicalFor("institucional", "/carreiras"),
    images: [
      { url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" },
    ],
  },
};

/**
 * How the company works, then the openings.
 *
 * In that order deliberately: a careers page that opens with a job list is a job
 * board, and the person worth hiring is deciding whether they want to work HERE
 * before they decide which seat. The list comes after, and it handles being
 * empty as a real state rather than as an omission.
 */
const COMO_TRABALHAMOS = [
  {
    titulo: "Time pequeno, escopo grande",
    texto:
      "Ninguém aqui cuida de um pedaço de tela. Você acompanha um problema do primeiro relato do cliente até ele estar em produção.",
  },
  {
    titulo: "Quem constrói, atende",
    texto:
      "A conversa com quem usa não passa por três camadas até chegar em quem escreve o código. Isso muda o que a gente decide construir.",
  },
  {
    titulo: "Escrito, não combinado",
    texto:
      "Decisão que só existe na memória de duas pessoas vira retrabalho em três meses. O porquê fica registrado ao lado do código.",
  },
  {
    titulo: "Ritmo de maratona",
    texto:
      "Software de gestão é feito para durar anos. A gente prefere entregar menos por trimestre e não ter que reescrever no seguinte.",
  },
];

export default function CarreirasPage() {
  return (
    <main>
      <PaginaHero
        sobrancelha="Carreiras"
        titulo={
          <>
            <LinhaHero>Trabalhar</LinhaHero>
            <LinhaHero atraso={0.09}>
              na <Realce className="font-extrabold">ProOps</Realce>.
            </LinhaHero>
          </>
        }
        descricao="Um time pequeno construindo software que empresas usam para fechar o mês. O que a gente procura, como a gente trabalha e o que está aberto agora."
      />

      <Secao tom="claro" aria-label="Como a gente trabalha">
        <div className="mx-auto max-w-6xl">
          <PlaceholderBadge>revisar com o time</PlaceholderBadge>
          <TituloSecao
            tom="claro"
            sobrancelha="Como a gente trabalha"
            titulo={
              <>
                Antes da vaga, o <Realce>lugar</Realce>.
              </>
            }
            descricao="Se nada aqui parecer com o que você procura, a vaga certa provavelmente não é esta. É melhor descobrir agora."
            className="mb-14"
          />
          <BlocosRevelados
            tom="claro"
            colunas={2}
            blocos={COMO_TRABALHAMOS}
          />
        </div>
      </Secao>

      <Secao aria-label="Vagas abertas">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            sobrancelha="Vagas abertas"
            titulo={
              <>
                O que está <Realce>aberto</Realce> agora.
              </>
            }
            className="mb-14"
          />
          <Vagas vagas={VAGAS} />
        </div>
      </Secao>

      <Secao tom="claro" aria-label="O processo seletivo">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            tom="claro"
            sobrancelha="O processo"
            titulo={
              <>
                Quatro passos, sem <Realce>surpresa</Realce>.
              </>
            }
            descricao="Você sabe desde o começo quantas conversas são, o que cada uma cobra e em quanto tempo a gente responde."
            className="mb-14"
          />
          <BlocosRevelados tom="claro" colunas={4} blocos={PROCESSO} />
        </div>
      </Secao>
    </main>
  );
}
