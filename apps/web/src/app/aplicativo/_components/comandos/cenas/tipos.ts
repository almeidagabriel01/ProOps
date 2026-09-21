import type { MotionValue } from "motion/react";

/**
 * O que toda cena da mesa de operações recebe.
 *
 * Dois modos, e a cena não precisa saber em qual está: ela repassa os dois
 * para `useCena`. Com `progresso`, a rolagem posiciona a animação; com
 * `tocar`, ela toca inteira quando alguém escolhe a operação.
 */
export interface PropsDaCena {
  /** A seção já chegou perto: pode medir e montar a timeline. */
  armado: boolean;
  /** 0..1 da animação, vindo da rolagem. */
  progresso?: MotionValue<number>;
  /** Toca do começo ao fim quando vira `true`. */
  tocar?: boolean;
}
