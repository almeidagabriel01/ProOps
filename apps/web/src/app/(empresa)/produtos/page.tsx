import type { Metadata } from "next";
import Image from "next/image";

import { AssinaturaAparelhos } from "@/components/institucional/assinaturas-hero";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { MolduraNavegador } from "@/components/marketing/_shared/moldura-navegador";
import { canonicalFor } from "@/lib/site/host-seo";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS, hostnameDe } from "@/lib/site/surfaces";

import { LedgerRecursos } from "./_components/ledger-recursos";
import { TelasDoAplicativo } from "./_components/telas-do-aplicativo";
import { TelasDoErp } from "./_components/telas-do-erp";

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
 *
 * What it does NOT skimp on is showing them. The first version was two columns
 * of prose claiming a system exists; the captures are the same argument made by
 * showing, and they cost no new asset because both landings already ship them.
 */
export default function ProdutosPage() {
  return (
    <main>
      <PaginaHero
        assinatura={<AssinaturaAparelhos />}
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
        descricao="Um roda na tela do escritório e o outro no bolso. Esta página mostra as duas por dentro, com captura do que está no ar hoje."
        dados={[
          { valor: "02", rotulo: "Produtos" },
          { valor: "07", rotulo: "Telas nesta página" },
          { valor: "0", rotulo: "Protótipos: tudo aqui está no ar" },
        ]}
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

          <div className="grid gap-px bg-black/10 lg:grid-cols-2">
            <article className="flex flex-col justify-between gap-10 overflow-hidden bg-white p-8 md:p-12">
              <div>
                <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-black/40">
                  Para a empresa
                </p>
                <h3 className="mt-5 [font-family:var(--font-bricolage)] text-3xl font-semibold tracking-tight text-black md:text-4xl">
                  ProOps ERP
                </h3>
                <p className="mt-5 max-w-md text-base leading-relaxed text-black/60">
                  Monta a proposta, acompanha o cliente pelo funil e fecha o mês
                  sem trocar de ferramenta. É o sistema de quem vende projeto e
                  precisa que o orçamento, o contrato e o recebimento contem a
                  mesma história.
                </p>
                <div className="mt-8">
                  <Magnetic>
                    <LandingButton
                      href={SITE_URLS.erp}
                      external
                      variant="onLight"
                    >
                      Conhecer o ERP
                    </LandingButton>
                  </Magnetic>
                </div>
              </div>

              {/*
                Bleeding off the bottom edge on purpose: the card is a window
                onto the product, and a screenshot floating with margin all round
                reads as an illustration of it instead.
              */}
              <div className="-mb-12 -mr-8 md:-mb-16 md:-mr-12">
                <MolduraNavegador
                  tom="claro"
                  endereco={hostnameDe("erp")}
                  className="rounded-br-none"
                >
                  {/*
                    A proporção é a do ARQUIVO (1920x944), não um 16/10 redondo:
                    com uma caixa mais estreita o `object-cover` corta as bordas,
                    e o que sai primeiro é justamente a coluna da esquerda, onde
                    ficam a saudação e o menu. Capturar a tela toda e depois
                    cortá-la na moldura é desperdiçar a captura.
                  */}
                  <div className="relative aspect-[1920/944]">
                    <Image
                      src="/hero/Dashboard.png"
                      alt="Dashboard do ERP da ProOps"
                      fill
                      sizes="(min-width: 1024px) 34rem, 88vw"
                      className="object-cover"
                    />
                  </div>
                </MolduraNavegador>
              </div>
            </article>

            <article className="flex flex-col justify-between gap-10 overflow-hidden bg-neutral-950 p-8 text-white md:p-12">
              <div>
                <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-white/45">
                  Para a pessoa
                </p>
                <h3 className="mt-5 [font-family:var(--font-bricolage)] text-3xl font-semibold tracking-tight md:text-4xl">
                  {APP_NAME}
                </h3>
                <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
                  Você manda uma mensagem e a IA organiza. Nota, lembrete e
                  controle financeiro pessoal em linguagem natural, no WhatsApp
                  ou dentro do aplicativo, sem planilha e sem categoria para
                  preencher.
                </p>
                <div className="mt-8">
                  <Magnetic>
                    <LandingButton
                      href={SITE_URLS.app}
                      external
                      variant="inverted"
                    >
                      Conhecer o aplicativo
                    </LandingButton>
                  </Magnetic>
                </div>
              </div>

              <div className="-mb-12 flex justify-center md:-mb-16">
                <div className="w-[13rem] md:w-[15rem]">
                  <DeviceFrame platform="ios">
                    <Image
                      src="/mockup-ios/hoje.jpg"
                      alt={`Tela inicial da ${APP_NAME}`}
                      fill
                      sizes="(min-width: 768px) 15rem, 13rem"
                      className="object-cover"
                    />
                  </DeviceFrame>
                </div>
              </div>
            </article>
          </div>
        </div>
      </Secao>

      {/*
        NÃO usa `Secao` aqui, e isso não é inconsistência.
        `Secao` traz `overflow-hidden`, e overflow em qualquer ancestral desliga
        `position: sticky` nos descendentes: o palco desgruda e a cena vira uma
        pilha de conteúdo passando reto, sem erro nenhum. O contrato está escrito
        no próprio `Secao`: cena pinada monta a própria seção.
      */}
      <section
        aria-label="O ERP por dentro"
        className="relative border-t border-white/10 bg-neutral-950 text-white"
      >
        <div className="mx-auto max-w-[88rem] px-6 pt-24 md:px-10 md:pt-32">
          <TituloSecao
            sobrancelha="O ERP por dentro"
            titulo={
              <>
                Quatro telas, e o <Realce>mês inteiro</Realce> passa por elas.
              </>
            }
            descricao="Capturas do sistema como ele é hoje, não protótipo."
            className="mb-16"
          />
        </div>
        <div className="mx-auto max-w-[88rem] px-6 pb-24 md:px-10 md:pb-32">
          <TelasDoErp />
        </div>
      </section>

      <Secao tom="claro" aria-label="O aplicativo por dentro">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            tom="claro"
            sobrancelha="O aplicativo por dentro"
            titulo={
              <>
                O mesmo dado, no <Realce>bolso</Realce>.
              </>
            }
            descricao="Três telas do aplicativo. As outras estão na landing dele, que é quem vende esse produto."
            className="mb-20"
          />
          <div className="rounded-3xl bg-neutral-950 px-6 pb-6 pt-16 md:px-12 md:pb-12 md:pt-20">
            <TelasDoAplicativo />
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
