import type { Metadata } from "next";

import { AssinaturaSelo } from "@/components/institucional/assinaturas-hero";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { SplitReveal } from "@/components/marketing/_shared/split-reveal";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { canonicalFor } from "@/lib/site/host-seo";

import { PrincipioCena } from "./_components/principio-cena";

import { PRINCIPIOS } from "@/app/(empresa)/institucional/_content/institucional-copy";

export const metadata: Metadata = {
  title: "Manifesto da ProOps",
  description:
    "O critério que decide o que entra no produto da ProOps: software que cabe no dia, uma base em vez de seis planilhas, e o detalhe que ninguém vê.",
  alternates: { canonical: canonicalFor("institucional", "/manifesto") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Manifesto da ProOps",
    description: "O critério que decide o que entra no produto da ProOps.",
    url: canonicalFor("institucional", "/manifesto"),
    images: [
      { url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" },
    ],
  },
};

export default function ManifestoPage() {
  return (
    <main>
      {/*
        O único dos quatro heróis centrado, e de propósito: manifesto é
        declaração, não índice, e declaração se lê no meio da página. O selo que
        se desenha atrás do título é a mesma ideia por outro meio.
      */}
      <PaginaHero
        alinhamento="centro"
        assinatura={<AssinaturaSelo />}
        sobrancelha="Manifesto"
        titulo={
          <>
            <LinhaHero>O que</LinhaHero>
            <LinhaHero atraso={0.09}>
              <Realce className="font-extrabold">decide</Realce>
            </LinhaHero>
            <LinhaHero atraso={0.18}>o produto.</LinhaHero>
          </>
        }
        descricao="Não é uma lista de valores para a parede. É o critério que sobra quando duas ideias boas competem pela mesma semana, e o que cada uma delas custa quando ganha."
        dados={[
          { valor: "03", rotulo: "Princípios" },
          { valor: "03", rotulo: "Contrapartidas" },
        ]}
      />

      {PRINCIPIOS.map((principio, index) => (
        <PrincipioCena
          key={principio.titulo}
          principio={principio}
          indice={index}
          total={PRINCIPIOS.length}
        />
      ))}

      {/*
        A contrapartida era três frases no espelho do princípio: gerúndio no
        começo, custo no fim, três vezes seguidas. Lia como exercício de retórica
        e não dizia nada que alguém pudesse conferir antes de assinar.

        Agora é uma lista do que a ProOps NÃO entrega, com o motivo de cada
        ausência. É a mesma honestidade, escrita de um jeito que serve para
        decidir: quem precisa de uma das três sabe, na leitura, que tem que
        procurar em outro lugar.
      */}
      <Secao tom="claro" aria-label="A contrapartida">
        <div className="mx-auto max-w-3xl">
          <TituloSecao
            tom="claro"
            sobrancelha="A contrapartida"
            titulo={
              <>
                Três coisas que a ProOps <Realce>não</Realce> vai te dar.
              </>
            }
            className="mb-12"
          />
          {/*
            Line by line, and not word by word: these are three admissions read
            in sequence, and a per-word reveal on a paragraph turns reading into
            waiting. `SplitReveal` splits on `lines`, which also keeps text
            selection working within a sentence.
          */}
          <ol className="space-y-10">
            {[
              {
                falta: "Uma primeira reunião mais bonita que a do concorrente.",
                porque:
                  "O que a gente abre na tela é o sistema em que você vai trabalhar na terça à tarde, com o seu catálogo e os seus números dentro. Isso perde de um vídeo bem editado, e perde toda vez.",
              },
              {
                falta: "Integração com tudo.",
                porque:
                  "Cada conexão nova é mais um lugar onde o mesmo dado pode divergir. Elas entram uma de cada vez, e só quando dá para dizer sem hesitar quem manda naquele dado.",
              },
              {
                falta: "Novidade toda semana.",
                porque:
                  "O tempo que vai para o fuso horário, para o centavo do arredondamento e para a permissão de quem vê o quê é tempo que não aparece em lista de lançamento nenhuma.",
              },
            ].map((item, indice) => (
              <li key={item.falta} className="flex gap-6 md:gap-8">
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 [font-family:var(--font-geist-mono)] text-[11px] tabular-nums tracking-[0.2em] text-black/30"
                >
                  {String(indice + 1).padStart(2, "0")}
                </span>
                <div>
                  <SplitReveal
                    unit="lines"
                    stagger={0.06}
                    className="[font-family:var(--font-bricolage)] text-xl font-semibold leading-snug tracking-tight text-black md:text-2xl"
                  >
                    {item.falta}
                  </SplitReveal>
                  <SplitReveal
                    unit="lines"
                    stagger={0.06}
                    className="mt-4 text-base leading-relaxed text-black/60 md:text-lg"
                  >
                    {item.porque}
                  </SplitReveal>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-14 border-t border-black/15 pt-10">
            <SplitReveal
              unit="lines"
              stagger={0.06}
              className="[font-family:var(--font-fraunces)] text-2xl italic leading-snug text-black md:text-3xl"
            >
              A gente aceita as três, e prefere dizer isso aqui do que você
              descobrir junto, depois de assinar.
            </SplitReveal>
          </div>
        </div>
      </Secao>
    </main>
  );
}
