import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

import { FechoCta } from "@/components/landing/_shared/fecho-cta";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Accent } from "@/components/landing/_shared/section-heading";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbarComSessao } from "@/components/landing/landing-navbar-com-sessao";
import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import {
  FUNCIONALIDADE_SLUGS,
  caminhoDaFuncionalidade,
  escadaDoLimite,
  funcionalidade,
  nichosDoRecurso,
  recurso,
  seloDoPlano,
  type FuncionalidadeSlug,
  type Recurso,
} from "@/lib/landing/funcionalidades";
import { canonicalFor } from "@/lib/site/host-seo";

import { LinhaDeFuncionalidade } from "../_components/linha-de-funcionalidade";
import { TelaDaFuncionalidade } from "../_components/tela-da-funcionalidade";

interface PaginaProps {
  params: Promise<{ slug: string }>;
}

/** Só existem as páginas da lista: um slug fora dela é 404, e não uma página vazia. */
export const dynamicParams = false;

export function generateStaticParams() {
  return FUNCIONALIDADE_SLUGS.map((slug) => ({ slug }));
}

function slugConhecido(slug: string): slug is FuncionalidadeSlug {
  return (FUNCIONALIDADE_SLUGS as readonly string[]).includes(slug);
}

export async function generateMetadata({ params }: PaginaProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slugConhecido(slug)) return {};
  const f = funcionalidade(slug);
  const url = canonicalFor("erp", caminhoDaFuncionalidade(slug));
  return {
    title: `${f.titulo} | Funcionalidades`,
    description: f.resumo,
    alternates: { canonical: url },
    openGraph: { title: `${f.titulo} | ProOps`, description: f.resumo, url },
  };
}

/** Um recurso incluído: o que faz, onde fica no ERP e o plano que o libera. */
function RecursoIncluido({ item }: { item: Recurso }) {
  const Icone = item.icone;
  const selo = seloDoPlano(item.requisito);
  const nichos = nichosDoRecurso(item.nichos);
  return (
    <li
      id={item.id}
      className="vt-revela scroll-mt-28 border-t border-black/10 py-8 dark:border-white/10 md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)_14rem] md:gap-10"
    >
      <div>
        <h3 className="flex items-start gap-3 [font-family:var(--font-pdf-montserrat)] text-lg font-bold leading-snug text-black dark:text-white">
          <Icone className="mt-[3px] h-5 w-5 shrink-0 text-black/45 dark:text-white/45" aria-hidden />
          <span className="min-w-0">{item.titulo}</span>
        </h3>
        {item.ondeFica ? (
          <p className="mt-2 pl-8 text-[13px] text-black/50 dark:text-white/50">No ERP: {item.ondeFica}</p>
        ) : null}
      </div>
      <div className="mt-4 md:mt-0">
        <p className="text-[15px] leading-relaxed text-black/75 dark:text-white/75">{item.resumo}</p>
        <ul className="mt-3 space-y-1.5">
          {item.detalhes.map((d) => (
            <li key={d} className="flex gap-2.5 text-[14px] leading-relaxed text-black/60 dark:text-white/60">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-black/40 dark:bg-white/40" />
              {d}
            </li>
          ))}
        </ul>
        {nichos.length > 0 ? (
          <p className="mt-3 text-[13px] text-black/50 dark:text-white/50">Nos segmentos: {nichos.join(", ")}.</p>
        ) : null}
      </div>
      <div className="mt-4 space-y-1.5 text-[13px] md:mt-0">
        <p className="font-semibold text-black dark:text-white">{selo.rotulo}</p>
        {selo.rotuloAddon ? <p className="text-black/55 dark:text-white/55">{selo.rotuloAddon}</p> : null}
        {item.limite ? (
          <p className="text-black/55 dark:text-white/55">{escadaDoLimite(item.limite.chave, item.limite.unidade)}</p>
        ) : null}
        {item.exemplo ? (
          <Link
            href={item.exemplo.href}
            className="inline-flex items-center gap-1 pt-1 font-semibold text-black underline decoration-black/25 underline-offset-4 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
          >
            {item.exemplo.rotulo}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A página de uma funcionalidade: o que ela resolve, a tela, como funciona em
 * três passos e os recursos que ela reúne, cada um com o plano que o libera.
 * Tudo sai de `lib/landing/funcionalidades`; esta página só organiza.
 */
export default async function FuncionalidadePage({ params }: PaginaProps) {
  const { slug } = await params;
  if (!slugConhecido(slug)) notFound();
  const f = funcionalidade(slug);
  const selo = seloDoPlano(recurso(f.principal).requisito);
  const itens = f.recursos.map(recurso);

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <BreadcrumbJsonLd
        items={[
          { name: "ProOps", url: canonicalFor("erp", "/") },
          { name: "Funcionalidades", url: canonicalFor("erp", "/funcionalidades") },
          { name: f.titulo, url: canonicalFor("erp", caminhoDaFuncionalidade(slug)) },
        ]}
      />
      <SmoothScroll />
      <LandingNavbarComSessao />

      <main>
        <section className="relative bg-white pb-20 pt-28 dark:bg-neutral-950 md:pb-28 md:pt-36">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <Link
                href="/funcionalidades"
                className="hero-enter inline-flex items-center gap-1.5 text-sm font-medium text-black/55 transition-colors hover:text-black dark:text-white/55 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Todas as funcionalidades
              </Link>
              <h1
                className="hero-enter mt-6 [font-family:var(--font-pdf-montserrat)] text-[2.4rem] font-bold leading-[1.03] tracking-[-0.035em] text-black dark:text-white sm:text-5xl lg:text-[3.6rem]"
                style={{ "--hero-delay": "0.05s", "--hero-y": "22px" } as CSSProperties}
              >
                {f.pagina.titulo} <Accent>{f.pagina.destaque}</Accent>
              </h1>
              <p
                className="hero-enter mt-6 max-w-xl text-lg leading-relaxed text-black/60 dark:text-white/60"
                style={{ "--hero-delay": "0.12s" } as CSSProperties}
              >
                {f.pagina.intro}
              </p>
              <div className="hero-enter mt-8" style={{ "--hero-delay": "0.2s", "--hero-y": "12px" } as CSSProperties}>
                <p className="text-sm text-black/60 dark:text-white/60">
                  <span className="font-semibold text-black dark:text-white">{selo.rotulo}</span>
                  {selo.rotuloAddon ? <span> · {selo.rotuloAddon}</span> : null}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <LandingButton
                    href="/register"
                    variant="solid"
                    size="md"
                    trailingIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Começar agora
                  </LandingButton>
                  <LandingButton href="/#pricing" variant="link">
                    Ver os planos
                  </LandingButton>
                </div>
              </div>
            </div>
            <div className="hero-enter" style={{ "--hero-delay": "0.25s", "--hero-y": "30px" } as CSSProperties}>
              <TelaDaFuncionalidade slug={slug} />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="como-funciona"
          className="border-t border-black/10 bg-white py-20 dark:border-white/10 dark:bg-neutral-950 md:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2
              id="como-funciona"
              className="[font-family:var(--font-pdf-montserrat)] text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-black dark:text-white md:text-5xl"
            >
              Como <Accent>funciona</Accent>
            </h2>
            <ol className="mt-12 border-b border-black/10 dark:border-white/10">
              {f.pagina.passos.map((passo, i) => (
                <li
                  key={passo.titulo}
                  className="vt-revela grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-t border-black/10 py-7 dark:border-white/10 md:grid-cols-[5rem_minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-baseline md:gap-x-8"
                >
                  <span className="[font-family:var(--font-pdf-montserrat)] text-2xl font-bold tabular-nums text-black/25 dark:text-white/25 md:text-4xl">
                    {i + 1}
                  </span>
                  <h3 className="[font-family:var(--font-pdf-montserrat)] text-xl font-bold text-black dark:text-white md:text-2xl">
                    {passo.titulo}
                  </h3>
                  <p className="col-start-2 mt-2 text-[15px] leading-relaxed text-black/60 dark:text-white/60 md:col-start-auto md:mt-0 md:text-base">
                    {passo.texto}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="incluido"
          className="border-t border-black/10 bg-white py-20 dark:border-white/10 dark:bg-neutral-950 md:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2
              id="incluido"
              className="[font-family:var(--font-pdf-montserrat)] text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-black dark:text-white md:text-5xl"
            >
              O que vem <Accent>incluído</Accent>
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60">
              Cada parte com o plano que a libera. Onde há add-on, ele aparece ao lado.
            </p>
            <ul className="mt-12 border-b border-black/10 dark:border-white/10">
              {itens.map((item) => (
                <RecursoIncluido key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="continue"
          className="border-t border-black/10 bg-white py-20 dark:border-white/10 dark:bg-neutral-950 md:py-28"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <h2
                id="continue"
                className="[font-family:var(--font-pdf-montserrat)] text-[2rem] font-bold leading-[1.08] tracking-[-0.025em] text-black dark:text-white md:text-5xl"
              >
                Continue <Accent>por aqui</Accent>
              </h2>
              <Link
                href="/funcionalidades"
                className="inline-flex items-center gap-1 text-sm font-semibold text-black underline decoration-black/25 underline-offset-4 hover:decoration-black dark:text-white dark:decoration-white/30 dark:hover:decoration-white"
              >
                Ver todas as funcionalidades
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="mt-10 border-b border-black/10 dark:border-white/10">
              {f.relacionadas.map((outra) => (
                <LinhaDeFuncionalidade key={outra} funcionalidade={funcionalidade(outra)} />
              ))}
            </ul>
          </div>
        </section>

        <FechoCta
          titulo={
            <>
              {f.titulo} já na <Accent>próxima venda</Accent>.
            </>
          }
          frase="Crie a conta, escolha o seu segmento e comece pela proposta. O resto já está montado."
          primario={{ rotulo: "Começar agora", href: "/register" }}
          secundario={{ rotulo: "Falar com a gente", href: "/contato" }}
        />
      </main>

      <LandingFooter />
    </div>
  );
}
