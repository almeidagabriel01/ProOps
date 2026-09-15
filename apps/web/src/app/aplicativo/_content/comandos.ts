/**
 * O que a pessoa escreve, e o que o agente faz com isso.
 *
 * Duas listas, com papéis diferentes.
 *
 * `FRASES` é a parede: pedidos crus, em minúsculas, do jeito que alguém escreve
 * no WhatsApp. Ela responde a dúvida real de quem chega numa página destas, que
 * não é "quais são os recursos" e sim **"será que ele entende do meu jeito?"**.
 * Por isso elas são propositalmente desleixadas: uma lista de comandos bem
 * formatados provaria o contrário do que se quer provar.
 *
 * `OPERACOES` é o oposto: poucas, e escolhidas entre as que a categoria NÃO
 * faz. Cada uma tem uma ferramenta determinística por trás no repositório do
 * aplicativo (`agent/app/tools/finance.py`), e `prova` registra qual, pelo mesmo
 * motivo que em `diferenca.ts`: sem ferramenta, não entra.
 */

export const FRASES: string[] = [
  "gastei 45 no mercado",
  "me lembra de pagar o aluguel todo dia 5",
  "quanto sobra esse mês?",
  "recebi 1.200 de freela",
  "parcela a geladeira em 10x",
  "quanto gastei com comida em agosto?",
  "transfere 500 da conta pro cartão",
  "anota: levar as notas fiscais pro contador",
  "paguei a fatura do cartão",
  "qual é o meu patrimônio hoje?",
  "posso comprar um celular de 3 mil?",
  "guarda 200 na meta da viagem",
  "toda vez que eu falar ifood, joga em alimentação",
  "quanto falta pra fechar o orçamento da casa?",
  "desfaz o último",
  "quando vence a fatura?",
];

export interface Operacao {
  /** O pedido, como a pessoa escreveria. */
  pedido: string;
  /** O que acontece. Concreto, nunca adjetivo. */
  efeito: string;
  /** A ferramenta que sustenta isto. Documentação, não conteúdo. */
  prova: string;
}

export const OPERACOES: Operacao[] = [
  {
    pedido: "parcela a geladeira em 10x",
    efeito:
      "Dez lançamentos futuros, no cartão certo, com a primeira caindo na fatura que ainda está aberta.",
    prova: "create_installment_purchase",
  },
  {
    pedido: "posso comprar um celular de 3 mil?",
    efeito:
      "Ele simula antes de você fazer: responde o que sobra no mês se comprar, e o que sobra se não comprar.",
    prova: "simulate_purchase",
  },
  {
    pedido: "paguei a fatura do cartão",
    efeito:
      "Baixa a fatura inteira, parcela por parcela, e devolve o limite disponível.",
    prova: "pay_invoice",
  },
  {
    pedido: "transfere 500 da conta pro cartão",
    efeito:
      "As duas pontas no mesmo lançamento, sem virar uma despesa nova que estraga o mês.",
    prova: "create_transfer",
  },
  {
    pedido: "guarda 200 na meta da viagem",
    efeito: "Depósito na meta, com o quanto ainda falta recalculado na hora.",
    prova: "goal_deposit",
  },
  {
    pedido: "desfaz o último",
    efeito:
      "O que foi entendido errado volta atrás pela conversa, sem você abrir o aplicativo.",
    prova: "undo_last",
  },
];
