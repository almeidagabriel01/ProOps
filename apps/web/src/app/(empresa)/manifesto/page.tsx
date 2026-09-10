import type { Metadata } from "next";

import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { canonicalFor } from "@/lib/site/host-seo";

import { PrincipioCena } from "./_components/principio-cena";

import { PRINCIPIOS } from "@/app/institucional/_content/institucional-copy";

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
      <PaginaHero
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
        descricao="Toda semana duas ideias boas competem pelo mesmo tempo. Estes três princípios são o desempate, e é por isso que eles são três e não doze."
      />

      {PRINCIPIOS.map((principio, index) => (
        <PrincipioCena
          key={principio.titulo}
          principio={principio}
          indice={index}
          total={PRINCIPIOS.length}
        />
      ))}

      <Secao tom="claro" aria-label="A contrapartida">
        <div className="mx-auto max-w-3xl">
          <PlaceholderBadge>revisar com o briefing</PlaceholderBadge>
          <TituloSecao
            tom="claro"
            sobrancelha="A contrapartida"
            titulo={
              <>
                Todo princípio <Realce>custa</Realce> alguma coisa.
              </>
            }
            className="mb-10"
          />
          <div className="space-y-6 text-base leading-relaxed text-black/65 md:text-lg">
            <p>
              Escolher o uso de terça-feira em vez da demonstração significa que
              a ProOps perde alguma venda para um produto mais vistoso na
              primeira reunião.
            </p>
            <p>
              Manter uma base só significa dizer não a integrações que fariam o
              mesmo dado voltar a morar em dois lugares.
            </p>
            <p>
              Gastar tempo no detalhe que ninguém vê significa entregar menos
              coisas por trimestre do que quem não gasta.
            </p>
            <p className="[font-family:var(--font-bricolage)] text-xl font-semibold text-black md:text-2xl">
              A gente aceita os três, e prefere dizer isso aqui do que descobrir
              junto depois.
            </p>
          </div>
        </div>
      </Secao>
    </main>
  );
}
