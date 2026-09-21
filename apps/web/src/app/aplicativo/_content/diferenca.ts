/**
 * A comparação, em pares.
 *
 * Genérica de propósito: a coluna da esquerda é "os apps de anotação por
 * WhatsApp" como categoria, e nenhum concorrente é nomeado. Uma tabela com nome
 * e sobrenome vira material comparativo sobre empresas identificáveis, precisa
 * ser reconferida toda vez que qualquer uma delas lança alguma coisa, e envelhece
 * sozinha na primeira semana em que não for.
 *
 * `provas` NÃO vai para a tela. É a ferramenta do agente que sustenta cada
 * afirmação, no registro do repositório do aplicativo (`agent/app/tools/`), e
 * existe para que a regra de acrescentar linha aqui seja verificável em vez de
 * ser questão de entusiasmo: **se não há ferramenta, não há linha.**
 */
export interface ParDeDiferenca {
  /** O que a categoria faz. */
  eles: string;
  /** O que a ProOps Pessoal faz. */
  nos: string;
  /** As ferramentas que provam a coluna da direita. Documentação, não conteúdo. */
  provas: string[];
}

export const PARES: ParDeDiferenca[] = [
  {
    eles: "Anota o gasto que você mandou.",
    nos: "Anota, corrige, apaga e desfaz o último, pela mesma conversa.",
    provas: ["update_transaction", "delete_transaction", "undo_last"],
  },
  {
    eles: "Responde quanto você já gastou.",
    nos: "Transfere entre contas, parcela a compra, paga a fatura e simula o gasto antes de você fazer.",
    provas: [
      "create_transfer",
      "create_installment_purchase",
      "pay_invoice",
      "simulate_purchase",
    ],
  },
  {
    eles: "Vive só no WhatsApp.",
    nos: "Tem um aplicativo inteiro, com o mesmo agente morando dentro dele.",
    provas: [],
  },
  {
    eles: "Devolve uma lista de gastos.",
    nos: "Cartões, faturas, orçamentos, metas, patrimônio e a projeção até o fim do mês.",
    provas: [
      "query_budgets",
      "query_goals",
      "query_invoice",
      "query_net_worth",
      "query_forecast",
    ],
  },
];

export const COLUNAS = {
  eles: "Os apps de WhatsApp",
  nos: "A ProOps Pessoal",
} as const;
