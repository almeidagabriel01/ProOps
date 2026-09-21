"use client";

import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { MotionValue } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";

/**
 * Um ponto da timeline em que algo que o GSAP não anima muda de estado: um
 * número do NumberFlow, a classe do cursor, o texto do token em voo.
 *
 * `aoCruzar(depois)` recebe `true` quando o tempo está no marco ou além dele, e
 * `false` antes. É chamado só quando esse lado muda, nos DOIS sentidos.
 */
export type Marco = (
  tempo: number,
  aoCruzar: (depois: boolean) => void,
) => void;

/** Chamado a cada atualização com o tempo atual da timeline, em segundos. */
export type Acompanhar = (aoAtualizar: (tempo: number) => void) => void;

export interface FerramentasDaCena {
  marco: Marco;
  acompanhar: Acompanhar;
}

interface OpcoesDaCena {
  /** Montar a timeline. Normalmente o `armado` de `useVisibilidade`. */
  armado: boolean;
  /** 0..1, de onde a timeline lê a posição. Normalmente o scroll. */
  progresso?: MotionValue<number>;
  /**
   * Sem `progresso`: a cena toca sozinha, do começo ao fim, quando isto vira
   * `true`. É o modo das cenas que respondem a um clique em vez de prender a
   * rolagem.
   */
  tocar?: boolean;
  /** Troca de conteúdo que exige uma timeline nova. */
  chave?: string | number;
}

/**
 * Uma timeline GSAP por cena, em dois modos.
 *
 * **Com `progresso`**, a posição é a rolagem: a timeline nasce pausada e cada
 * mudança do valor a leva para aquele ponto (`tl.progress`). Descer a página
 * avança a cena; subir, volta.
 *
 * **Com `tocar`**, ela toca do começo ao fim quando o sinal vira `true`, e
 * recomeça a cada montagem. É o modo de uma cena que responde ao clique de
 * quem lê: a página rola normalmente, e o movimento acontece quando a pessoa
 * pede. Duas seções seguidas prendendo a rolagem é uma a mais.
 *
 * Nos dois, tudo é construído com `fromTo` e `set`, que o GSAP sabe desfazer
 * quando a agulha anda para trás.
 *
 * ── Por que não `tl.call` ──────────────────────────────────────────────────
 *
 * `progress(valor)` suprime callbacks por padrão, e mesmo sem suprimir um
 * `call` não tem como saber em que sentido foi cruzado: o número que devia
 * voltar a zero ao subir ficaria no valor final. Os `marcos` resolvem isso
 * comparando o tempo atual com o do marco a cada atualização, e a primeira
 * avaliação (em tempo 0) já escreve o estado inicial de cada um.
 *
 * ── Custo ──────────────────────────────────────────────────────────────────
 *
 * Sem ScrollTrigger aqui: quem produz o progresso é `useScrollProgress`, que
 * cria o seu por IntersectionObserver, fora da hidratação. A timeline também só
 * é montada quando a região chega perto (`armado`), porque ela mede layout.
 *
 * As cenas são escritas no ESTADO FINAL, que é o que o servidor manda e o que
 * fica para quem pediu menos movimento: nesse caso nada é montado.
 */
export function useCena(
  escopo: React.RefObject<HTMLElement | null>,
  construir: (
    tl: gsap.core.Timeline,
    ferramentas: FerramentasDaCena,
  ) => void | (() => void),
  { armado, progresso, tocar = false, chave }: OpcoesDaCena,
) {
  const reduzido = useReducedMotion();
  const ligado = armado && !reduzido;
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (!ligado) return;
      const tl = gsap.timeline({ paused: true });
      const marcos: {
        tempo: number;
        aoCruzar: (depois: boolean) => void;
        lado?: boolean;
      }[] = [];
      const acompanhantes: ((tempo: number) => void)[] = [];

      timeline.current = tl;
      const limpar = construir(tl, {
        marco: (tempo, aoCruzar) => marcos.push({ tempo, aoCruzar }),
        acompanhar: (aoAtualizar) => acompanhantes.push(aoAtualizar),
      });

      const avaliar = (tempo: number) => {
        for (const m of marcos) {
          const depois = tempo >= m.tempo;
          if (m.lado === depois) continue;
          m.lado = depois;
          m.aoCruzar(depois);
        }
        for (const a of acompanhantes) a(tempo);
      };

      const aplicar = (valor: number) => {
        tl.progress(Math.min(Math.max(valor, 0), 1));
        avaliar(tl.time());
      };

      aplicar(0);

      // Na rolagem, a posição vem de fora. Tocando, o `onUpdate` da própria
      // timeline é que avisa os marcos a cada quadro: o `progress()` do outro
      // modo suprime callbacks, então os dois caminhos não se misturam.
      let desligar = () => {};
      if (progresso) {
        aplicar(progresso.get());
        desligar = progresso.on("change", aplicar);
      } else {
        tl.eventCallback("onUpdate", () => avaliar(tl.time()));
      }

      return () => {
        timeline.current = null;
        desligar();
        tl.kill();
        limpar?.();
      };
    },
    { scope: escopo, dependencies: [ligado, chave], revertOnUpdate: true },
  );

  // Modo tocado: recomeça do zero a cada vez que o sinal liga. Uma cena que
  // toca pela metade, porque a anterior parou no meio, não demonstra nada.
  useEffect(() => {
    const tl = timeline.current;
    if (!tl || progresso) return;
    if (tocar) tl.restart();
    else tl.pause(0);
  }, [tocar, progresso, ligado, chave]);

  return { reduzido, ligado };
}
