"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";

interface OpcoesDaCena {
  /** Montar a timeline. Normalmente o `armado` de `useVisibilidade`. */
  armado: boolean;
  /** Tocar. Normalmente o `emVista`. Sair de vista pausa, não volta. */
  tocando: boolean;
  /** Troca de conteúdo que exige uma timeline nova. */
  chave?: string | number;
}

/**
 * Uma timeline GSAP por cena, criada só quando serve para alguma coisa.
 *
 * As cenas são escritas no ESTADO FINAL, que é o que o servidor manda e o que
 * fica para quem pediu menos movimento. A timeline é construída com `fromTo` e
 * nasce pausada: o render imediato do `fromTo` já escreve o estado inicial,
 * então quando a pessoa chega a cena está pronta para tocar e nunca pisca do
 * final para o começo diante dela.
 *
 * `useGSAP` roda em layout effect e reverte tudo o que a timeline escreveu
 * quando a chave muda ou o componente sai. Isso importa porque a mesma árvore
 * serve várias frases: sem o revert, estilos inline de uma ficariam presos nos
 * elementos da próxima.
 *
 * `construir` pode devolver uma limpeza, para o que a timeline não registra
 * sozinha (elementos criados à mão, estado do React alterado por `tl.call`).
 *
 * Sem ScrollTrigger de propósito: a página está no limite de TBT, e o custo
 * medido ali era justamente trigger criado na hidratação.
 */
export function useCena(
  escopo: React.RefObject<HTMLElement | null>,
  construir: (tl: gsap.core.Timeline) => void | (() => void),
  { armado, tocando, chave }: OpcoesDaCena,
) {
  const reduzido = useReducedMotion();
  const ligado = armado && !reduzido;
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (!ligado) return;
      const tl = gsap.timeline({ paused: true });
      const limpar = construir(tl);
      timeline.current = tl;
      return () => {
        timeline.current = null;
        tl.kill();
        limpar?.();
      };
    },
    { scope: escopo, dependencies: [ligado, chave], revertOnUpdate: true },
  );

  // Depende também de `ligado` e `chave`: a timeline nova nasce pausada no
  // layout effect acima, e é este efeito, que roda logo depois no mesmo commit,
  // que a põe para tocar se a região já estiver na tela.
  useEffect(() => {
    const tl = timeline.current;
    if (!tl) return;
    if (tocando) tl.play();
    else tl.pause();
  }, [tocando, ligado, chave]);

  return { reduzido, ligado };
}
