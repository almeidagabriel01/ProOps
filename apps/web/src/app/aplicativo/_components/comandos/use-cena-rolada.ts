"use client";

import React from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { scrollToOffset } from "@/lib/landing/smooth-scroll";

import { indiceDaFatia, progressoDaParada, progressoNaFatia } from "./fatias";

/**
 * Uma cena grudada cuja lista avança com a rolagem.
 *
 * O palco é `sticky` dentro de um contêiner alto (`trilho`), e a altura do
 * trilho é o que dá rolagem às fatias. `sticky` e não `pin` pelo mesmo motivo
 * de `aplicativo-conversa.tsx`: a página já tem dois pins, e `sticky` não mede
 * nada. A regra que vem junto: nenhum ancestral do palco pode ter `overflow`.
 *
 * Sob `prefers-reduced-motion` não há trilho nem rolagem dirigida: o índice
 * passa a ser estado comum, trocado por clique, e as cenas ficam no estado
 * final. `animado` diz em qual dos dois modos a cena está.
 */
export function useCenaRolada(total: number) {
  const trilho = React.useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilho, {
    start: "top top",
    end: "bottom bottom",
    fallback: 0,
  });

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
      const topo = el.getBoundingClientRect().top + window.scrollY;
      const alcance = el.offsetHeight - window.innerHeight;
      scrollToOffset(topo + alvo * alcance, { immediate: imediato });
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
    animado: animated,
    indice: animated ? indiceRolado : indiceEscolhido,
    escolher,
    rolarPara,
  };
}

/**
 * O progresso da animação de UMA fatia, já sem a pausa de leitura.
 *
 * Fora do modo rolado vale 1 para sempre: é o estado final, que é o que a
 * cena mostra para quem pediu menos movimento.
 */
export function useProgressoDaFatia(
  progresso: MotionValue<number>,
  indice: number,
  total: number,
  animado: boolean,
): MotionValue<number> {
  const completo = useMotionValue(1);
  const daFatia = useTransform(progresso, (v) =>
    progressoNaFatia(v, indice, total),
  );
  return animado ? daFatia : completo;
}
