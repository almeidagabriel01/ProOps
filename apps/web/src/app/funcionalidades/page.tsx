import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { CommandFaq } from "@/components/landing/_shared/command-faq";
import { FechoCta } from "@/components/landing/_shared/fecho-cta";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Accent } from "@/components/landing/_shared/section-heading";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbarComSessao } from "@/components/landing/landing-navbar-com-sessao";
import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { etapasDaObra } from "@/components/marketing/mocks/dados";
import { BreadcrumbJsonLd, FAQPageJsonLd, SoftwareApplicationJsonLd } from "@/components/seo/json-ld";
import { CATALOGO, CATEGORIAS } from "@/lib/landing/funcionalidades";
import { DEFAULT_NICHE, NICHE_REGISTRY } from "@/lib/niches/registry";
import { canonicalFor } from "@/lib/site/host-seo";

import { Capitulos } from "./_components/capitulos";
import { JornadaDaVenda } from "./_components/jornada-da-venda";
import { LinksDoCliente } from "./_components/links-do-cliente";
import { VitrineLia } from "./_components/vitrine-lia";
import { VitrineFluxo } from "./_components/vitrines";
import { MapaDaOperacao } from "./_components/mapa-da-operacao";
import { FAQ_FUNCIONALIDADES } from "./_content/faq";

const DESCRICAO =
  "Tudo o que a ProOps faz, área por área: CRM, propostas com aceite online, obra, pós-venda por link, financeiro, notas fiscais e a Lia. Com o plano que libera cada recurso.";

export const metadata: Metadata = {
  title: "Funcionalidades do ERP",
  description: DESCRICAO,
  alternates: { canonical: canonicalFor("erp", "/funcionalidades") },
  openGraph: {
    title: "Funcionalidades do ERP | ProOps",
    description: DESCRICAO,
    url: canonicalFor("erp", "/funcionalidades"),
  },
};

/**
 * A página de tudo o que o ERP faz. Montada no servidor: as ilhas de cliente
 * são a navbar (sessão), a jornada animada, o filtro da lista e as cenas que
 * fecham alguns capítulos. O mapa do topo e a lista inteira chegam prontos no
 * HTML, sem esperar JavaScript.
 */
export default function FuncionalidadesPage() {
  const etapas = etapasDaObra(NICHE_REGISTRY[DEFAULT_NICHE].stageTemplate, 1);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <SoftwareApplicationJsonLd featureList={CATALOGO.map((r) => r.titulo)} />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: "Funcionalidades", url: "/funcionalidades" },
        ]}
      />
      <FAQPageJsonLd items={[...FAQ_FUNCIONALIDADES]} />
      <SmoothScroll />
      <LandingNavbarComSessao />

      <main>
        <section className="relative bg-white pb-20 pt-32 dark:bg-neutral-950 md:pb-28 md:pt-40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end lg:gap-16">
              <h1
                className="hero-enter [font-family:var(--font-pdf-montserrat)] text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] text-black dark:text-white sm:text-6xl lg:text-[4.6rem]"
                style={{ "--hero-y": "22px" } as CSSProperties}
              >
                Tudo o que a ProOps faz, do primeiro contato ao <Accent>recibo</Accent>.
              </h1>
              <div
                className="hero-enter lg:pb-3"
                style={{ "--hero-delay": "0.12s" } as CSSProperties}
              >
                <p className="text-lg leading-relaxed text-black/60 dark:text-white/60">
                  {CATALOGO.length} recursos em {CATEGORIAS.length} áreas, cada um com o plano que o libera. Siga a
                  linha da sua área, ou veja uma venda inteira passar por elas logo abaixo.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <LandingButton
                    href="/register"
                    variant="solid"
                    size="md"
                    trailingIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Começar agora
                  </LandingButton>
                  <LandingButton href="/agendar" variant="link">
                    Marcar uma demonstração
                  </LandingButton>
                </div>
              </div>
            </div>

            <div className="mt-16 md:mt-24">
              <MapaDaOperacao />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="jornada-titulo"
          className="relative border-t border-black/10 bg-white pt-24 dark:border-white/10 dark:bg-neutral-950 md:pt-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2
              id="jornada-titulo"
              className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl"
            >
              Uma venda só, do lead ao <Accent>contador</Accent>.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60 md:text-lg">
              Acompanhe a mesma proposta passar por sete telas. O código e o valor não mudam de sistema no caminho,
              porque o sistema é um só.
            </p>
          </div>
          <div className="mt-16 pb-24 md:mt-8 md:pb-0">
            <JornadaDaVenda etapas={etapas} />
          </div>
        </section>

        <Capitulos
          vitrines={{
            links: (
              <LinksDoCliente
                etapas={etapas}
                tipoDeVisita={NICHE_REGISTRY[DEFAULT_NICHE].defaultVisitType.label}
              />
            ),
            financeiro: <VitrineFluxo />,
            lia: <VitrineLia />,
          }}
        />

        <CommandFaq
          items={FAQ_FUNCIONALIDADES}
          eyebrow={null}
          title={
            <>
              O que costumam <Accent>perguntar</Accent>
            </>
          }
          description="Sobre planos, links do cliente e exemplos."
        />

        <FechoCta
          titulo={
            <>
              A próxima venda já pode passar por <Accent>todas</Accent> essas estações.
            </>
          }
          frase="Crie a conta, escolha o seu segmento e comece pela proposta. O resto da linha já está montado."
          primario={{ rotulo: "Começar agora", href: "/register" }}
          secundario={{ rotulo: "Falar com a gente", href: "/contato" }}
          estacoes={CATALOGO.map((r) => r.titulo)}
        />
      </main>

      <LandingFooter />
    </div>
  );
}
