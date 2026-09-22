import type { Ato } from "./roteiro";

/**
 * O texto da cena, num lugar só.
 *
 * Uma legenda por ato, e só uma aparece de cada vez. Elas falam de "ambiente" e
 * de "item", e não de cortina nem de luminária: a cena mostra um exemplo de um
 * nicho, mas o que ela afirma vale para qualquer empresa que venda projeto, que
 * é justamente o que a página precisa dizer.
 */
export const LEGENDAS: Record<Exclude<Ato, "repouso">, string> = {
  projeto: "Cada ambiente que a sua equipe especifica vira um item, com preço.",
  proposta: "Os itens montam a proposta sozinhos, com o código e o total certos.",
  aprovada: "O cliente assina, e a proposta aprovada fecha o orçamento.",
  financeiro: "A entrada e as parcelas já nascem lançadas no financeiro.",
};

/** A palavra curta do mesmo ato, no trilho. */
export const TRILHO: Record<Exclude<Ato, "repouso">, string> = {
  projeto: "Projeto",
  proposta: "Proposta",
  aprovada: "Aprovada",
  financeiro: "Financeiro",
};
