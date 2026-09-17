"use client";

import React from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { scrollToOffset } from "@/lib/landing/smooth-scroll";

import {
  indiceDaFatia,
  progressoComEntrada,
  progressoDaParada,
} from "./fatias";

/**
 * Uma cena grudada cuja lista avança com a rolagem.
 *
 * O palco é `sticky` dentro de um contêiner alto (`trilho`), e a altura do
 * trilho é o que dá rolagem às fatias. `sticky` e não `pin` pelo mesmo motivo
 * de `aplicativo-conversa.tsx`: a página já tem dois pins, e `sticky` não mede
 * nada. A regra que vem junto: nenhum ancestral do palco pode ter `overflow`.
 *
 * O palco gruda LOGO ABAIXO da barra fixa (`TOPO_DO_PALCO`) e alinha o
 * conteúdo pelo topo. Com o palco da altura da tela inteira e o conteúdo
 * centralizado nele, sobrava um vão de meia tela entre o título da seção e o
 * conteúdo, justamente no primeiro quadro que a pessoa vê.
 *
 * ── Peso ───────────────────────────────────────────────────────────────────
 *
 * O progresso passa por uma mola antes de chegar às cenas. Cru, ele segue a
 * roda do mouse tique a tique, e um giro rápido atravessava três frases antes
 * de a pessoa ler a primeira; com a mola a cena acompanha com atraso curto e
 * assenta, que é a sensação de algo com massa. O índice sai do MESMO valor
 * suavizado, senão a frase trocaria antes de a animação dela terminar.
 *
 * Sob `prefers-reduced-motion` não há trilho nem rolagem dirigida: o índice
 * passa a ser estado comum, trocado por clique, e as cenas ficam no estado
 * final. `animado` diz em qual dos dois modos a cena está.
 */
export function useCenaRolada(total: number) {
  const trilho = React.useRef<HTMLDivElement>(null);
  const { progress: bruto, animated } = useScrollProgress(trilho, {
    start: `top ${TOPO_DO_PALCO}px`,
    end: "bottom bottom",
    fallback: 0,
  });
  const progress = useSpring(bruto, MOLA);
  // A aproximação: do trilho aparecer na tela até o palco grudar. É nela que a
  // primeira fatia se monta (ver `progressoComEntrada`).
  const { progress: entradaBruta } = useScrollProgress(trilho, {
    start: "top 85%",
    end: `top ${TOPO_DO_PALCO}px`,
    fallback: 1,
  });
  const entrada = useSpring(entradaBruta, MOLA);

  const [indiceRolado, setIndiceRolado] = React.useState(0);
  const [indiceEscolhido, setIndiceEscolhido] = React.useState(0);

  // No máximo `total` renders ao longo da cena inteira: o estado só muda
  // quando a fatia muda, e o React descarta o set com o mesmo valor.
  useMotionValueEvent(progress, "change", (v) =>
    setIndiceRolado(indiceDaFatia(v, total)),
  );

  /** Leva a página a um ponto do trilho, dado como progresso 0..1. */
  const rolarPara = React.useCallback(
    (alvo: number, { imediato = false }: { imediato?: boolean } = {}) => {
      const el = trilho.current;
      if (!el) return;
      const inicio =
        el.getBoundingClientRect().top + window.scrollY - TOPO_DO_PALCO;
      const alcance = el.offsetHeight - (window.innerHeight - TOPO_DO_PALCO);
      scrollToOffset(inicio + alvo * alcance, { immediate: imediato });
    },
    [],
  );

  const escolher = React.useCallback(
    (indice: number) => {
      if (!animated) {
        setIndiceEscolhido(indice);
        return;
      }
      rolarPara(progressoDaParada(indice, total));
    },
    [animated, rolarPara, total],
  );

  return {
    trilho,
    progresso: progress,
    entrada,
    animado: animated,
    indice: animated ? indiceRolado : indiceEscolhido,
    escolher,
    rolarPara,
  };
}

/**
 * Onde o palco gruda, em px: a altura da barra fixa mais um respiro. Precisa
 * bater com `top-24` em `CLASSE_DO_PALCO`.
 */
export const TOPO_DO_PALCO = 96;

/** O palco grudado, colado sob a barra e com a altura do que sobra da tela. */
export const CLASSE_DO_PALCO =
  "sticky top-24 h-[calc(100svh-6rem)] content-start";

/**
 * A altura do trilho: a do palco, mais a rolagem de todas as fatias. É o que o
 * ScrollTrigger mede de `top 96px` até `bottom bottom`.
 */
export function alturaDoTrilho(total: number, fatiaSvh: number): string {
  return `calc(100svh - ${TOPO_DO_PALCO}px + ${total * fatiaSvh}svh)`;
}

/**
 * A mola do progresso: firme o bastante para não flutuar depois que a roda
 * para, e lenta o bastante para um giro rápido não atravessar frases inteiras.
 */
const MOLA = { stiffness: 70, damping: 22, mass: 0.9, restDelta: 0.0001 };

/**
 * O progresso da animação de UMA fatia, já sem a pausa de leitura.
 *
 * Fora do modo rolado vale 1 para sempre: é o estado final, que é o que a
 * cena mostra para quem pediu menos movimento.
 */
export function useProgressoDaFatia(
  progresso: MotionValue<number>,
  entrada: MotionValue<number>,
  indice: number,
  total: number,
  animado: boolean,
): MotionValue<number> {
  const completo = useMotionValue(1);
  const daFatia = useTransform(() =>
    progressoComEntrada(progresso.get(), entrada.get(), indice, total),
  );
  return animado ? daFatia : completo;
}
