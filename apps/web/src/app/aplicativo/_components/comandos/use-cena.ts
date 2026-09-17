"use client";

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
  progresso: MotionValue<number>;
  /** Troca de conteúdo que exige uma timeline nova. */
  chave?: string | number;
}

/**
 * Uma timeline GSAP por cena, com a posição dada pela rolagem.
 *
 * A timeline nunca toca sozinha: ela nasce pausada e cada mudança de
 * `progresso` a leva para aquele ponto (`tl.progress`). Descer a página avança a
 * cena; subir, volta. Por isso tudo aqui é construído com `fromTo` e `set`, que
 * o GSAP sabe desfazer quando a agulha anda para trás.
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
  { armado, progresso, chave }: OpcoesDaCena,
) {
  const reduzido = useReducedMotion();
  const ligado = armado && !reduzido;

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

      const limpar = construir(tl, {
        marco: (tempo, aoCruzar) => marcos.push({ tempo, aoCruzar }),
        acompanhar: (aoAtualizar) => acompanhantes.push(aoAtualizar),
      });

      const aplicar = (valor: number) => {
        tl.progress(Math.min(Math.max(valor, 0), 1));
        const tempo = tl.time();
        for (const m of marcos) {
          const depois = tempo >= m.tempo;
          if (m.lado === depois) continue;
          m.lado = depois;
          m.aoCruzar(depois);
        }
        for (const a of acompanhantes) a(tempo);
      };

      aplicar(progresso.get());
      const desligar = progresso.on("change", aplicar);

      return () => {
        desligar();
        tl.kill();
        limpar?.();
      };
    },
    { scope: escopo, dependencies: [ligado, chave], revertOnUpdate: true },
  );

  return { reduzido, ligado };
}
