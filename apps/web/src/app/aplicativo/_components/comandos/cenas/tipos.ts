import type { MotionValue } from "motion/react";

/** O que toda cena da mesa de operações recebe. */
export interface PropsDaCena {
  /** A seção já chegou perto: pode medir e montar a timeline. */
  armado: boolean;
  /** 0..1 da animação desta cena, vindo da rolagem. */
  progresso: MotionValue<number>;
}
