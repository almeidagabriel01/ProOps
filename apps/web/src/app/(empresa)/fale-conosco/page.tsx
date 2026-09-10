import type { Metadata } from "next";

import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { canonicalFor } from "@/lib/site/host-seo";

import { SeletorDeCanal } from "./_components/seletor-de-canal";

import { CANAIS } from "@/app/institucional/_content/institucional-copy";

export const metadata: Metadata = {
  title: "Falar com a ProOps",
  description:
    "Comercial, suporte, imprensa e parcerias: o canal certo para cada assunto, com quem responde de verdade.",
  alternates: { canonical: canonicalFor("institucional", "/fale-conosco") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Falar com a ProOps",
    description: "O canal certo para cada assunto.",
    url: canonicalFor("institucional", "/fale-conosco"),
    images: [
      { url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" },
    ],
  },
};

/**
 * Contact, as a router rather than as a form.
 *
 * There is no text field on this page on purpose. The commercial form already
 * exists on the ERP's `/contato` and is wired to the pipeline that answers it;
 * a second form here would either duplicate that plumbing or drop messages into
 * an inbox nobody watches, which is worse than no form.
 *
 * What the company site can do better is routing: four reasons someone writes
 * in, and the right destination for each, chosen by the reader in one click.
 */
export default function FaleConoscoPage() {
  return (
    <main>
      <PaginaHero
        sobrancelha="Contato"
        titulo={
          <>
            <LinhaHero>Falar com</LinhaHero>
            <LinhaHero atraso={0.09}>
              a <Realce className="font-extrabold">ProOps</Realce>.
            </LinhaHero>
          </>
        }
        descricao="Diga o que você precisa e a página mostra por onde. São quatro caminhos, e todos terminam em uma pessoa."
      />

      <Secao aria-label="Escolha o assunto">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            sobrancelha="Por onde"
            titulo={
              <>
                O que traz você <Realce>aqui</Realce>?
              </>
            }
            className="mb-14"
          />
          <SeletorDeCanal canais={CANAIS} />
        </div>
      </Secao>

      <Secao tom="claro" aria-label="Onde a ProOps fica">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <TituloSecao
            tom="claro"
            sobrancelha="A empresa"
            titulo={
              <>
                Dados da <Realce>ProOps</Realce>.
              </>
            }
          />
          <dl className="space-y-8 self-center">
            <div>
              <dt className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-black/40">
                E-mail
              </dt>
              <dd className="mt-2">
                <a
                  href="mailto:gestao@proops.com.br"
                  className="text-lg text-black transition-opacity hover:opacity-70"
                >
                  gestao@proops.com.br
                </a>
              </dd>
            </div>
            <div>
              <dt className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-black/40">
                Tempo de resposta
              </dt>
              <dd className="mt-2 text-lg text-black">
                Até dois dias úteis, em qualquer canal.
              </dd>
            </div>
            <div>
              <dt className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-black/40">
                Privacidade
              </dt>
              <dd className="mt-2 max-w-md text-base leading-relaxed text-black/60">
                O que você escrever é tratado conforme a{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-4 transition-opacity hover:opacity-70"
                >
                  Política de Privacidade
                </a>
                , e você pode pedir a exclusão a qualquer momento.
              </dd>
            </div>
          </dl>
        </div>
      </Secao>
    </main>
  );
}
