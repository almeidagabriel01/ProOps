"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { scrollToOffset } from "@/lib/landing/smooth-scroll";

import { normalizarBusca } from "./normalizar-busca";

interface FiltroDeRecursosProps {
  categorias: readonly { id: string; titulo: string; total: number }[];
  planos: readonly { tier: string; nome: string }[];
}

const TODOS = "todos";

/**
 * A barra que filtra a lista de recursos por texto e por plano, e o índice dos
 * capítulos com o capítulo em leitura marcado.
 *
 * É IRMÃ da lista, não mãe: a lista inteira é HTML de servidor, e envolvê-la
 * num componente de cliente faria o React hidratar cada uma das dezenas de
 * linhas. Aqui o filtro só lê os `data-*` que `LinhaDeRecurso` escreveu e
 * alterna `hidden`, sem renderizar linha nenhuma.
 *
 * O filtro por plano mostra o que o plano JÁ traz e o que ele compra como
 * add-on; a linha que só entra por add-on ganha `data-por-addon`, e o CSS
 * destaca o selo de add-on nela.
 */
export function FiltroDeRecursos({ categorias, planos }: FiltroDeRecursosProps) {
  const [busca, setBusca] = useState("");
  const [plano, setPlano] = useState(TODOS);
  const [visiveis, setVisiveis] = useState<Record<string, number>>(() =>
    Object.fromEntries(categorias.map((c) => [c.id, c.total])),
  );
  const [ativo, setAtivo] = useState(categorias[0]?.id);
  const buscaId = useId();
  const trilhoRef = useRef<HTMLDivElement>(null);

  const total = Object.values(visiveis).reduce((a, b) => a + b, 0);
  const totalGeral = categorias.reduce((a, c) => a + c.total, 0);

  // O filtro em si: alterna `hidden` nas linhas e nos capítulos.
  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>("[data-capitulos]");
    if (!raiz) return;
    const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
    const contagem: Record<string, number> = {};

    raiz.querySelectorAll<HTMLElement>("[data-capitulo]").forEach((capitulo) => {
      let n = 0;
      capitulo.querySelectorAll<HTMLElement>("[data-recurso]").forEach((linha) => {
        const texto = linha.dataset.texto ?? "";
        const inclui = (linha.dataset.inclui ?? "").split(" ");
        const addon = (linha.dataset.addon ?? "").split(" ");
        const casaTexto = termos.every((t) => texto.includes(t));
        const porPlano = plano === TODOS || inclui.includes(plano);
        const porAddon = plano !== TODOS && !porPlano && addon.includes(plano);
        const mostra = casaTexto && (porPlano || porAddon);
        linha.hidden = !mostra;
        linha.toggleAttribute("data-por-addon", porAddon);
        if (mostra) n++;
      });
      capitulo.hidden = n === 0;
      contagem[capitulo.id] = n;
    });

    raiz.querySelector<HTMLElement>("[data-vazio]")?.toggleAttribute(
      "hidden",
      Object.values(contagem).some((n) => n > 0),
    );
    setVisiveis(contagem);
  }, [busca, plano]);

  // O capítulo em leitura, para o índice.
  useEffect(() => {
    const capitulos = document.querySelectorAll<HTMLElement>("[data-capitulos] [data-capitulo]");
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel) setAtivo(visivel.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    capitulos.forEach((c) => observador.observe(c));
    return () => observador.disconnect();
  }, []);

  // Com o índice em faixa horizontal (celular), o chip ativo precisa ficar à vista.
  useEffect(() => {
    const chip = trilhoRef.current?.querySelector<HTMLElement>(`[data-chip="${ativo}"]`);
    const trilho = trilhoRef.current;
    if (!chip || !trilho || trilho.scrollWidth <= trilho.clientWidth) return;
    trilho.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" });
  }, [ativo]);

  // Quem chega por `#id-do-recurso` (o mapa do topo, um link de fora) encontra
  // a linha já aberta.
  useEffect(() => {
    const abrir = () => {
      const alvo = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      const detalhes = alvo?.matches("[data-recurso]") ? alvo.querySelector("details") : null;
      if (detalhes) detalhes.open = true;
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);

  const irPara = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    event.preventDefault();
    scrollToOffset(alvo.getBoundingClientRect().top + window.scrollY - 110);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-7">
      <div className="flex flex-col gap-3">
        <label htmlFor={buscaId} className="sr-only">
          Buscar recurso
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" aria-hidden />
          <input
            id={buscaId}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar: Pix, comissão, DRE..."
            className="h-11 w-full rounded-full border border-black/12 bg-white pl-10 pr-10 text-base text-black outline-none transition-colors placeholder:text-black/40 focus:border-black/40 dark:border-white/15 dark:bg-neutral-950 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/45 md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar a busca"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div role="radiogroup" aria-label="Filtrar por plano" className="grid grid-cols-4 rounded-full border border-black/12 p-1 dark:border-white/15">
          {[{ tier: TODOS, nome: "Todos" }, ...planos].map((p) => {
            const selecionado = plano === p.tier;
            return (
              <button
                key={p.tier}
                type="button"
                role="radio"
                aria-checked={selecionado}
                onClick={() => setPlano(p.tier)}
                className={cn(
                  "min-w-0 truncate rounded-full px-1.5 py-1.5 text-[12px] font-semibold transition-colors duration-200",
                  selecionado
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white",
                )}
              >
                {p.nome}
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="text-xs tabular-nums text-black/50 dark:text-white/50">
          {total === totalGeral ? `${totalGeral} recursos` : `${total} de ${totalGeral} recursos`}
        </p>
      </div>

      <nav aria-label="Capítulos">
        <div
          ref={trilhoRef}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {categorias.map((c) => {
            const corrente = ativo === c.id;
            const vazio = (visiveis[c.id] ?? 0) === 0;
            return (
              <a
                key={c.id}
                href={`#${c.id}`}
                data-chip={c.id}
                onClick={(e) => irPara(e, c.id)}
                aria-current={corrente ? "true" : undefined}
                className={cn(
                  "trilho-item group/trilho relative flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-200 lg:rounded-none lg:border-0 lg:py-2 lg:pl-5 lg:pr-0",
                  corrente
                    ? "border-black bg-black font-semibold text-white dark:border-white dark:bg-white dark:text-black lg:bg-transparent lg:text-black dark:lg:bg-transparent dark:lg:text-white"
                    : "border-black/12 text-black/60 hover:text-black dark:border-white/15 dark:text-white/60 dark:hover:text-white",
                  vazio && "opacity-35",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1/2 hidden h-full w-px -translate-y-1/2 origin-center bg-black transition-transform duration-300 dark:bg-white lg:block",
                    corrente ? "scale-y-100" : "scale-y-0",
                  )}
                />
                {c.titulo}
                <span className="hidden text-xs tabular-nums text-black/40 dark:text-white/40 lg:inline">
                  {visiveis[c.id] ?? 0}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
