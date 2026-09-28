import React from "react";

import { capitulos, seloDoPlano } from "@/lib/landing/funcionalidades";

/**
 * O mapa de linhas do topo da página: cada área do ERP é uma linha, cada
 * recurso uma estação, e a linha do alto liga as áreas na ordem em que uma
 * venda passa por elas. A gramática é a do diagrama de linha de metrô (traço
 * grosso, estação vazada, rótulo ao lado), em tinta só, como o resto da página.
 *
 * Componente de servidor e sem JavaScript: o desenho de entrada é keyframe CSS
 * (`.mapa-*` em `app/vitrine.css`), porque este bloco está acima da dobra e o
 * contrato de LCP da casa é o texto pintar sem esperar hidratação. O realce de
 * linha no hover é `:has()`, também sem script.
 *
 * Toda estação é um link para o recurso na lista abaixo. No celular as
 * estações somem e cada linha vira um atalho para o capítulo dela: nove colunas
 * de estações não cabem em 360px, e uma versão espremida seria ilegível.
 */
export function MapaDaOperacao() {
  const linhas = capitulos();
  return (
    <nav aria-label="Mapa das áreas do ERP" className="mapa relative">
      {/* A linha do alto: liga as áreas, da primeira à última. */}
      <span aria-hidden="true" className="mapa-tronco absolute left-0 right-0 top-[13px] hidden h-[3px] lg:block" />
      <ol className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-3 md:gap-y-10 lg:grid-cols-9 lg:gap-x-3">
        {linhas.map(({ categoria, recursos }, coluna) => {
          const Icone = categoria.icone;
          return (
            <li
              key={categoria.id}
              className="mapa-linha group/linha relative md:self-start"
              style={{ "--coluna": coluna } as React.CSSProperties}
            >
              <a
                href={`#${categoria.id}`}
                className="relative flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/50 md:items-start lg:gap-2"
              >
                <span className="mapa-terminal relative z-10 grid h-[29px] w-[29px] shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
                  <Icone className="h-[15px] w-[15px]" aria-hidden />
                </span>
                <span className="min-w-0 md:pt-[5px] lg:pt-[24px]">
                  <span className="block [font-family:var(--font-pdf-montserrat)] text-[15px] font-bold leading-tight text-black dark:text-white lg:text-[13px]">
                    {categoria.titulo}
                  </span>
                  <span className="block text-xs tabular-nums text-black/50 dark:text-white/50">
                    {recursos.length} recursos
                  </span>
                </span>
              </a>

              <ul className="mapa-estacoes relative mt-4 hidden md:block">
                {recursos.map((recurso, linha) => (
                  <li
                    key={recurso.id}
                    className="mapa-estacao relative"
                    style={{ "--linha": linha } as React.CSSProperties}
                  >
                    <a
                      href={`#${recurso.id}`}
                      className="group/estacao flex items-start gap-2.5 rounded-md py-[5px] pr-1 outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/50"
                    >
                      <span
                        aria-hidden="true"
                        className="mapa-ponto relative z-10 ml-[9px] mt-[3px] h-[11px] w-[11px] shrink-0 rounded-full border-[2.5px] border-black bg-white transition-colors duration-200 group-hover/estacao:bg-black dark:border-white dark:bg-neutral-950 dark:group-hover/estacao:bg-white"
                      />
                      <span className="min-w-0 text-[12.5px] leading-[1.3] text-black/70 transition-colors duration-200 group-hover/estacao:text-black dark:text-white/70 dark:group-hover/estacao:text-white">
                        {recurso.titulo}
                        <span className="sr-only">, {seloDoPlano(recurso.requisito).rotulo}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
