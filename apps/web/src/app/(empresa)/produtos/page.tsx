import type { Metadata } from "next";

import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { canonicalFor } from "@/lib/site/host-seo";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

import { LedgerRecursos } from "./_components/ledger-recursos";

export const metadata: Metadata = {
  title: "Produtos da ProOps",
  description:
    "A ProOps constrói dois produtos: um ERP que leva a proposta até o pós-venda, e um aplicativo que organiza o dinheiro do dia a dia por mensagem.",
  alternates: { canonical: canonicalFor("institucional", "/produtos") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Produtos da ProOps",
    description:
      "Um ERP para a operação da empresa, um aplicativo para a vida financeira de cada pessoa.",
    url: canonicalFor("institucional", "/produtos"),
    images: [
      { url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" },
    ],
  },
};

/**
 * Deliberately NOT a feature list.
 *
 * The ERP landing and the app landing already sell each product in detail, and
 * duplicating them here would create two pages competing for the same search and
 * two copies of the same copy to keep in sync. This page answers the question
 * only the company site gets asked: there are two products, which one is for me,
 * and why does one company make both.
 */
export default function ProdutosPage() {
  return (
    <main>
      <PaginaHero
        sobrancelha="Produtos"
        titulo={
          <>
            <LinhaHero>Dois produtos,</LinhaHero>
            <LinhaHero atraso={0.09}>
              uma <Realce className="font-extrabold">ideia</Realce>
            </LinhaHero>
            <LinhaHero atraso={0.18}>só.</LinhaHero>
          </>
        }
        descricao="Dado que já foi digitado uma vez não deveria ser digitado de novo. Vale para a empresa, e vale para a pessoa que sai dela às sete da noite."
      />

      <Secao tom="claro" aria-label="Qual dos dois é para você">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            tom="claro"
            sobrancelha="Qual é o seu"
            titulo={
              <>
                Um é da <Realce>empresa</Realce>. O outro é seu.
              </>
            }
            descricao="Eles não são versões um do outro, e não se substituem: resolvem contas diferentes, para pessoas que muitas vezes são a mesma."
            className="mb-16"
          />

          <div className="grid gap-px bg-black/10 md:grid-cols-2">
            <article className="bg-white p-8 md:p-12">
              <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-black/40">
                Para a empresa
              </p>
              <h3 className="mt-5 [font-family:var(--font-bricolage)] text-3xl font-semibold tracking-tight text-black md:text-4xl">
                ProOps ERP
              </h3>
              <p className="mt-5 text-base leading-relaxed text-black/60">
                Monta a proposta, acompanha o cliente pelo funil e fecha o mês
                sem trocar de ferramenta. É o sistema de quem vende projeto e
                precisa que o orçamento, o contrato e o recebimento contem a
                mesma história.
              </p>
              <div className="mt-8">
                <LandingButton href={SITE_URLS.erp} external variant="onLight">
                  Conhecer o ERP
                </LandingButton>
              </div>
            </article>

            <article className="bg-neutral-950 p-8 text-white md:p-12">
              <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-white/45">
                Para a pessoa
              </p>
              <h3 className="mt-5 [font-family:var(--font-bricolage)] text-3xl font-semibold tracking-tight md:text-4xl">
                {APP_NAME}
              </h3>
              <p className="mt-5 text-base leading-relaxed text-white/60">
                Você manda uma mensagem e a IA organiza. Nota, lembrete e
                controle financeiro pessoal em linguagem natural, no WhatsApp ou
                dentro do aplicativo, sem planilha e sem categoria para
                preencher.
              </p>
              <div className="mt-8">
                <LandingButton href={SITE_URLS.app} external variant="inverted">
                  Conhecer o aplicativo
                </LandingButton>
              </div>
            </article>
          </div>
        </div>
      </Secao>

      <Secao aria-label="O que cada um resolve">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            sobrancelha="Lado a lado"
            titulo={
              <>
                O que cada um <Realce>resolve</Realce>.
              </>
            }
            descricao="A mesma pergunta, feita nas duas escalas."
            className="mb-16"
          />
          <LedgerRecursos />
        </div>
      </Secao>

      <Secao tom="claro" aria-label="Por que a mesma empresa faz os dois">
        <div className="mx-auto max-w-3xl">
          <TituloSecao
            tom="claro"
            sobrancelha="Por que os dois"
            titulo={
              <>
                Porque o problema é o <Realce>mesmo</Realce>, em duas escalas.
              </>
            }
            className="mb-10"
          />
          <div className="space-y-6 text-base leading-relaxed text-black/65 md:text-lg">
            <p>
              Uma empresa perde dinheiro quando a proposta, o contrato e o
              recebimento moram em lugares diferentes. Uma pessoa perde o
              controle quando o gasto, a fatura e a meta moram em lugares
              diferentes.
            </p>
            <p>
              É a mesma falha, e a resposta que a ProOps dá é a mesma: uma base
              só, alimentada no momento em que a coisa acontece, em vez de
              reconstruída no fim do mês.
            </p>
          </div>
        </div>
      </Secao>
    </main>
  );
}
