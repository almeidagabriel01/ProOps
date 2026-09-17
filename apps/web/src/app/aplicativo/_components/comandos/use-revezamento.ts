"use client";

import { useCallback, useReducer } from "react";

/**
 * O revezamento automático de uma lista, com a pessoa podendo assumir.
 *
 * O relógio NÃO mora aqui. Quem avança é a `BarraDeTempo`, quando a animação
 * CSS dela termina (`animationend`). Uma fonte só de tempo é o que mantém a
 * barra e a troca em sincronia: com um `setTimeout` ao lado de uma animação
 * CSS, pausar e retomar recomeçava o timer do zero enquanto a barra continuava
 * do meio, e a troca chegava com a barra pela metade.
 *
 * Isso também resolve de graça dois casos: fora de vista a barra é pausada, e
 * sob `prefers-reduced-motion` a animação não roda, então nada avança sozinho.
 */

export interface EstadoDoRevezamento {
  indice: number;
  /** Desligado na escolha da pessoa; só o botão o devolve. */
  automatico: boolean;
  /** Pausa pedida pelo botão. */
  pausado: boolean;
  /** Muda a cada troca, para a barra de tempo recomeçar do zero. */
  volta: number;
}

export type AcaoDoRevezamento =
  | { tipo: "avancar"; total: number }
  | { tipo: "escolher"; indice: number }
  | { tipo: "alternar" };

export function revezamento(
  estado: EstadoDoRevezamento,
  acao: AcaoDoRevezamento,
): EstadoDoRevezamento {
  switch (acao.tipo) {
    case "avancar":
      if (!estado.automatico || estado.pausado || acao.total < 1) return estado;
      return {
        ...estado,
        indice: (estado.indice + 1) % acao.total,
        volta: estado.volta + 1,
      };
    case "escolher":
      // Escolher a frase que já está no centro também conta como assumir: a
      // pessoa tocou na roda, e o automático não deve tirar a frase dela.
      return {
        ...estado,
        indice: acao.indice,
        automatico: false,
        volta: estado.volta + 1,
      };
    case "alternar":
      // Um botão só: com o relógio andando ele pausa; parado por qualquer
      // motivo (pausa ou a pessoa ter assumido), ele devolve o automático.
      if (estado.automatico && !estado.pausado) {
        return { ...estado, pausado: true };
      }
      return { ...estado, automatico: true, pausado: false };
  }
}

export function estadoInicial(indice = 0): EstadoDoRevezamento {
  return { indice, automatico: true, pausado: false, volta: 0 };
}

export function useRevezamento(total: number) {
  const [estado, despachar] = useReducer(revezamento, 0, estadoInicial);

  const avancar = useCallback(
    () => despachar({ tipo: "avancar", total }),
    [total],
  );
  const escolher = useCallback(
    (indice: number) => despachar({ tipo: "escolher", indice }),
    [],
  );
  const alternar = useCallback(() => despachar({ tipo: "alternar" }), []);

  return {
    ...estado,
    /** O relógio anda: automático ligado e sem pausa pedida. */
    rodando: estado.automatico && !estado.pausado,
    avancar,
    escolher,
    alternar,
  };
}
