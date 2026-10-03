"use client";

import * as React from "react";

/** Atributo que marca, dentro do contêiner, a opção que tem de ficar à vista. */
export const SCROLL_ACTIVE_ATTR = "data-scroll-active";

interface CenterMeasure {
  /** Largura visível do contêiner (`clientWidth`). */
  containerWidth: number;
  /** Largura total do conteúdo (`scrollWidth`). */
  scrollWidth: number;
  /** Início da opção, medido a partir do início do conteúdo rolável. */
  itemLeft: number;
  itemWidth: number;
}

/**
 * `scrollLeft` que põe a opção no centro do contêiner, sem passar das pontas:
 * a primeira opção fica encostada no início e a última no fim.
 */
export function centeredScrollLeft({
  containerWidth,
  scrollWidth,
  itemLeft,
  itemWidth,
}: CenterMeasure): number {
  const max = Math.max(0, scrollWidth - containerWidth);
  const target = itemLeft + itemWidth / 2 - containerWidth / 2;
  return Math.min(max, Math.max(0, Math.round(target)));
}

interface EdgeMeasure {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/** Folga para o arredondamento de subpixel não acender um esmaecido à toa. */
const EDGE_TOLERANCE_PX = 2;

/** Qual lado ainda tem conteúdo escondido. */
export function scrollEdges({
  scrollLeft,
  scrollWidth,
  clientWidth,
}: EdgeMeasure): { fadeStart: boolean; fadeEnd: boolean } {
  if (scrollWidth - clientWidth <= EDGE_TOLERANCE_PX) {
    return { fadeStart: false, fadeEnd: false };
  }
  return {
    fadeStart: scrollLeft > EDGE_TOLERANCE_PX,
    fadeEnd: scrollLeft + clientWidth < scrollWidth - EDGE_TOLERANCE_PX,
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Uma fileira de abas que rola na horizontal (no celular, quase todas) perde
 * duas informações: QUAL aba está ativa, quando ela cai fora da tela, e SE há
 * mais abas para o lado. Este hook devolve as duas.
 *
 * - Põe no centro a opção marcada com `data-scroll-active`, sem animação na
 *   montagem (uma página que abre não deve deslizar) e com animação na troca.
 *   Usa `scrollTo` no próprio contêiner, e não `scrollIntoView`, que rolaria
 *   também os ancestrais, inclusive o `<main>`.
 * - Diz de que lado sobra conteúdo, para o esmaecido (`.scroll-fade-x`).
 *
 * Sem isso, o seletor de visões de um grupo (sete telas no Financeiro) abria
 * cada tela com a rolagem no início e a visão escolhida escondida à direita:
 * parecia que a aba tinha voltado para a primeira.
 */
export function useHorizontalScrollAffordance<T extends HTMLElement>(
  activeKey: string | undefined,
) {
  const ref = React.useRef<T>(null);
  const hasPositionedRef = React.useRef(false);
  const [edges, setEdges] = React.useState({
    fadeStart: false,
    fadeEnd: false,
  });

  const measureEdges = React.useCallback(() => {
    const container = ref.current;
    if (!container) return;
    const next = scrollEdges(container);
    setEdges((prev) =>
      prev.fadeStart === next.fadeStart && prev.fadeEnd === next.fadeEnd
        ? prev
        : next,
    );
  }, []);

  React.useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const item = container.querySelector<HTMLElement>(
      `[${SCROLL_ACTIVE_ATTR}="true"]`,
    );
    if (item && container.scrollWidth > container.clientWidth) {
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const left = centeredScrollLeft({
        containerWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        itemLeft: itemRect.left - containerRect.left + container.scrollLeft,
        itemWidth: itemRect.width,
      });
      const animate = hasPositionedRef.current && !prefersReducedMotion();
      if (typeof container.scrollTo === "function") {
        container.scrollTo({ left, behavior: animate ? "smooth" : "auto" });
      } else {
        container.scrollLeft = left;
      }
    }
    hasPositionedRef.current = true;
    measureEdges();
  }, [activeKey, measureEdges]);

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.addEventListener("scroll", measureEdges, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      // O contêiner e as opções: um contador que chega depois alarga a fileira
      // sem mudar a largura do contêiner.
      observer = new ResizeObserver(measureEdges);
      observer.observe(container);
      for (const child of Array.from(container.children)) {
        observer.observe(child);
      }
    }
    return () => {
      container.removeEventListener("scroll", measureEdges);
      observer?.disconnect();
    };
  }, [measureEdges]);

  return {
    ref,
    fadeProps: {
      "data-fade-start": edges.fadeStart ? "true" : undefined,
      "data-fade-end": edges.fadeEnd ? "true" : undefined,
    },
    ...edges,
  };
}
