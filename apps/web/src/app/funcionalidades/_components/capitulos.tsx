import React from "react";
import Link from "next/link";

import { Accent } from "@/components/landing/_shared/section-heading";
import { capitulos, type CategoriaId } from "@/lib/landing/funcionalidades";
import { DEFAULT_PLANS } from "@/lib/plans/default-plans";

import { FiltroDeRecursos } from "./filtro-de-recursos";
import { LinhaDeRecurso } from "./linha-de-recurso";

interface CapitulosProps {
  /** Uma cena que fecha o capítulo, onde ver o recurso funcionando vale mais que a lista. */
  vitrines?: Partial<Record<CategoriaId, React.ReactNode>>;
}

/**
 * Tudo o que o ERP faz, área por área, com o plano de cada recurso.
 *
 * Cada capítulo continua a linha do mapa do topo: o terminal com o ícone da
 * área e a linha vertical passando pelas estações, agora com texto inteiro.
 * O filtro à esquerda é a única ilha de cliente da seção.
 */
export function Capitulos({ vitrines = {} }: CapitulosProps) {
  const lista = capitulos();
  const planos = [...DEFAULT_PLANS]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ tier: p.tier, nome: p.name }));

  return (
    <section
      aria-labelledby="recursos-titulo"
      className="relative border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2
          id="recursos-titulo"
          className="max-w-3xl [font-family:var(--font-pdf-montserrat)] text-[2.1rem] font-bold leading-[1.06] tracking-[-0.025em] text-black dark:text-white md:text-5xl"
        >
          Recurso por recurso, com o plano que <Accent>libera</Accent> cada um.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/60 dark:text-white/60 md:text-lg">
          Abra uma linha para ver como funciona e onde fica no ERP. Filtre pelo seu plano para ver o que já vem nele
          e o que entra como add-on.
        </p>

        <div className="mt-14 lg:grid lg:grid-cols-[296px_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <FiltroDeRecursos
              categorias={lista.map(({ categoria, recursos }) => ({
                id: categoria.id,
                titulo: categoria.titulo,
                total: recursos.length,
              }))}
              planos={planos}
            />
          </div>

          <div data-capitulos="" className="mt-12 lg:mt-0">
            {lista.map(({ categoria, recursos }) => {
              const Icone = categoria.icone;
              return (
                <section
                  key={categoria.id}
                  id={categoria.id}
                  data-capitulo=""
                  aria-labelledby={`${categoria.id}-titulo`}
                  className="capitulo adiado scroll-mt-28 pb-16 last:pb-0"
                >
                  <header className="relative flex items-start gap-4">
                    <span className="relative z-10 grid h-[29px] w-[29px] shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
                      <Icone className="h-[15px] w-[15px]" aria-hidden />
                    </span>
                    <div className="min-w-0 pb-2">
                      <h2
                        id={`${categoria.id}-titulo`}
                        className="[font-family:var(--font-pdf-montserrat)] text-2xl font-bold leading-tight tracking-[-0.02em] text-black dark:text-white md:text-[1.85rem]"
                      >
                        {categoria.titulo}
                      </h2>
                      <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-black/55 dark:text-white/55">
                        {categoria.resumo}
                      </p>
                    </div>
                  </header>
                  <ul className="capitulo-linha relative mt-2">
                    {recursos.map((recurso) => (
                      <LinhaDeRecurso key={recurso.id} recurso={recurso} />
                    ))}
                  </ul>
                  {vitrines[categoria.id] ? <div className="mt-10">{vitrines[categoria.id]}</div> : null}
                </section>
              );
            })}

            <p
              data-vazio=""
              hidden
              className="rounded-2xl border border-dashed border-black/15 px-6 py-12 text-center text-[15px] text-black/60 dark:border-white/15 dark:text-white/60"
            >
              Nenhum recurso com esse filtro.{" "}
              <Link href="/contato" className="font-semibold text-black underline underline-offset-4 dark:text-white">
                Pergunte para a gente
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
