import type { CSSProperties } from "react";
import type { Metadata } from "next";

import { CommandFaq } from "@/components/landing/_shared/command-faq";
import { FechoCta } from "@/components/landing/_shared/fecho-cta";
import { Accent } from "@/components/landing/_shared/section-heading";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbarComSessao } from "@/components/landing/landing-navbar-com-sessao";
import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { BreadcrumbJsonLd, FAQPageJsonLd, SoftwareApplicationJsonLd } from "@/components/seo/json-ld";
import { FUNCIONALIDADES, GRUPOS_DE_FUNCIONALIDADES } from "@/lib/landing/funcionalidades";
import { canonicalFor } from "@/lib/site/host-seo";

import { LinhaDeFuncionalidade } from "./_components/linha-de-funcionalidade";
import { FAQ_FUNCIONALIDADES } from "./_content/faq";

const DESCRICAO =
  "Tudo o que a ProOps faz: CRM, propostas com aceite online, obras, pós-venda por link, financeiro, notas fiscais e a Lia. Cada funcionalidade com a sua página e o plano que a libera.";

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
 * A lista do que o ERP faz: uma linha por funcionalidade, com a explicação
 * curta e o plano, agrupadas na ordem de uma venda. Cada linha abre a página
 * da funcionalidade (`[slug]/page.tsx`), onde mora o detalhe. Montada no
 * servidor: a única ilha é a navbar.
 */
export default function FuncionalidadesPage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <SoftwareApplicationJsonLd featureList={FUNCIONALIDADES.map((f) => f.titulo)} />
      <BreadcrumbJsonLd
        items={[
          { name: "ProOps", url: canonicalFor("erp", "/") },
          { name: "Funcionalidades", url: canonicalFor("erp", "/funcionalidades") },
        ]}
      />
      <FAQPageJsonLd items={[...FAQ_FUNCIONALIDADES]} />
      <SmoothScroll />
      <LandingNavbarComSessao />

      <main>
        <section className="relative bg-white pb-16 pt-32 dark:bg-neutral-950 md:pb-20 md:pt-40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1
              className="hero-enter max-w-4xl [font-family:var(--font-pdf-montserrat)] text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] text-black dark:text-white sm:text-6xl lg:text-[4.6rem]"
              style={{ "--hero-y": "22px" } as CSSProperties}
            >
              Tudo o que a ProOps faz, do primeiro contato ao <Accent>recibo</Accent>.
            </h1>
            <div
              className="hero-enter mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
              style={{ "--hero-delay": "0.12s" } as CSSProperties}
            >
              <p className="max-w-2xl text-lg leading-relaxed text-black/60 dark:text-white/60">
                {FUNCIONALIDADES.length} funcionalidades, cada uma com uma explicação curta e o plano que a libera.
                Clique numa delas para ver como funciona, a tela do ERP e o que vem incluído.
              </p>
              <nav aria-label="Grupos de funcionalidades" className="flex flex-wrap gap-2">
                {GRUPOS_DE_FUNCIONALIDADES.map((g) => (
                  <a
                    key={g.id}
                    href={`#${g.id}`}
                    className="rounded-full border border-black/12 px-4 py-2 text-sm font-medium text-black/70 transition-colors duration-200 hover:border-black hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:border-white dark:hover:text-white"
                  >
                    {g.titulo}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 md:pb-32">
          {GRUPOS_DE_FUNCIONALIDADES.map((grupo) => (
            <section
              key={grupo.id}
              id={grupo.id}
              aria-labelledby={`${grupo.id}-titulo`}
              className="scroll-mt-28 pt-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:pt-16"
            >
              <div className="lg:sticky lg:top-28 lg:self-start">
                <h2
                  id={`${grupo.id}-titulo`}
                  className="[font-family:var(--font-pdf-montserrat)] text-2xl font-bold tracking-[-0.02em] text-black dark:text-white md:text-3xl"
                >
                  {grupo.titulo}
                </h2>
                <p className="mt-2 text-[15px] leading-relaxed text-black/55 dark:text-white/55">{grupo.resumo}</p>
              </div>
              <ol className="mt-6 border-b border-black/10 dark:border-white/10 lg:mt-0">
                {FUNCIONALIDADES.filter((f) => f.grupo === grupo.id).map((f) => (
                  <LinhaDeFuncionalidade key={f.slug} funcionalidade={f} />
                ))}
              </ol>
            </section>
          ))}
        </div>

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
              A próxima venda já pode passar por <Accent>todas</Accent> elas.
            </>
          }
          frase="Crie a conta, escolha o seu segmento e comece pela proposta. O resto já está montado."
          primario={{ rotulo: "Começar agora", href: "/register" }}
          secundario={{ rotulo: "Falar com a gente", href: "/contato" }}
          estacoes={FUNCIONALIDADES.map((f) => f.titulo)}
        />
      </main>

      <LandingFooter />
    </div>
  );
}
