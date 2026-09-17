/** O que toda cena da mesa de operações recebe. */
export interface PropsDaCena {
  /** A seção já chegou perto: pode medir e montar a timeline. */
  armado: boolean;
  /** A seção está na tela: toca. */
  tocando: boolean;
}
