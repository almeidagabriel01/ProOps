/**
 * O que a pessoa escreve, e o que o agente faz com isso.
 *
 * Duas listas, com papéis diferentes.
 *
 * `PEDIDOS` é a leitura: pedidos crus, em minúsculas, do jeito que alguém
 * escreve no WhatsApp, cada um com o que o agente entende dele. Ela responde a
 * dúvida real de quem chega numa página destas, que não é "quais são os
 * recursos" e sim **"será que ele entende do meu jeito?"**. Por isso as frases
 * são propositalmente desleixadas: uma lista de comandos bem formatados
 * provaria o contrário do que se quer provar.
 *
 * Cada frase é quebrada em `partes`, e as partes marcadas com `entidade` são as
 * que a tela destaca e faz voar para a ficha. Um campo da ficha que aponta uma
 * entidade PRECISA achar essa entidade na frase; um campo sem entidade é
 * deduzido (a conta padrão, a data de hoje) e a tela o mostra como tal. O teste
 * `comandos-conteudo.test.ts` cobra as duas coisas, porque a falha aqui é uma
 * ficha com um campo que nunca recebe o seu token, e nada quebra.
 *
 * `OPERACOES` é o oposto: poucas, e escolhidas entre as que a categoria NÃO
 * faz. Cada uma tem uma ferramenta determinística por trás no repositório do
 * aplicativo (`agent/app/tools/finance.py`), e `prova` registra qual, pelo mesmo
 * motivo que em `diferenca.ts`: sem ferramenta, não entra. `cena` escolhe o
 * diagrama que a mesa de operações desenha, e o `Record` de cenas faz uma
 * operação sem diagrama falhar no type check.
 *
 * Os números seguem a história do resto da página: a sobra de R$ 1.284,90 é a
 * da aba Financeiro, e a fatura de R$ 1.590,00 com limite indo de R$ 4.337,00
 * para R$ 5.927,00 é a da cena "Sem sair da conversa".
 */

export type Entidade =
  | "valor"
  | "categoria"
  | "periodo"
  | "conta"
  | "origem"
  | "destino"
  | "repete"
  | "parcelas"
  | "descricao"
  | "meta"
  | "termo"
  | "alvo"
  | "consulta";

/** Como cada entidade é chamada na etiqueta que aparece sobre o token. */
export const ROTULO_DA_ENTIDADE: Record<Entidade, string> = {
  valor: "valor",
  categoria: "categoria",
  periodo: "período",
  conta: "conta",
  origem: "de onde",
  destino: "para onde",
  repete: "repete",
  parcelas: "parcelas",
  descricao: "o quê",
  meta: "meta",
  termo: "termo",
  alvo: "alvo",
  consulta: "consulta",
};

export type Parte = string | { texto: string; entidade: Entidade };

export type Intencao =
  | "Despesa"
  | "Receita"
  | "Lembrete"
  | "Pergunta"
  | "Simulação"
  | "Parcelamento"
  | "Transferência"
  | "Anotação"
  | "Pagamento"
  | "Depósito na meta"
  | "Regra"
  | "Desfazer";

export interface Campo {
  rotulo: string;
  valor: string;
  /** A entidade da frase que vira este valor. Ausente: o campo é deduzido. */
  entidade?: Entidade;
}

export type ValorDaResposta =
  { tipo: "moeda"; numero: number } | { tipo: "texto"; texto: string };

export interface Resposta {
  rotulo: string;
  valor: ValorDaResposta;
  nota: string;
}

export interface Pedido {
  id: string;
  partes: Parte[];
  intencao: Intencao;
  campos: Campo[];
  /** Só para perguntas: o número que volta, no lugar de um lançamento. */
  resposta?: Resposta;
}

/** A frase inteira, como a pessoa a escreveu. */
export function textoDoPedido(pedido: Pedido): string {
  return pedido.partes
    .map((parte) => (typeof parte === "string" ? parte : parte.texto))
    .join("");
}

export const PEDIDOS: Pedido[] = [
  {
    id: "mercado",
    partes: [
      "gastei ",
      { texto: "45", entidade: "valor" },
      " no ",
      { texto: "mercado", entidade: "categoria" },
    ],
    intencao: "Despesa",
    campos: [
      { rotulo: "Valor", valor: "R$ 45,00", entidade: "valor" },
      { rotulo: "Categoria", valor: "Alimentação", entidade: "categoria" },
      { rotulo: "Conta", valor: "Cartão da casa" },
      { rotulo: "Quando", valor: "Hoje, 12:31" },
    ],
  },
  {
    id: "aluguel",
    partes: [
      "me lembra de ",
      { texto: "pagar o aluguel", entidade: "descricao" },
      " ",
      { texto: "todo dia 5", entidade: "repete" },
    ],
    intencao: "Lembrete",
    campos: [
      { rotulo: "O quê", valor: "Pagar o aluguel", entidade: "descricao" },
      { rotulo: "Repete", valor: "Todo mês, dia 5", entidade: "repete" },
      { rotulo: "Próximo", valor: "05/10" },
    ],
  },
  {
    id: "sobra",
    partes: ["quanto sobra ", { texto: "esse mês", entidade: "periodo" }, "?"],
    intencao: "Pergunta",
    campos: [
      { rotulo: "Período", valor: "Setembro de 2026", entidade: "periodo" },
    ],
    resposta: {
      rotulo: "Sobra até o fim do mês",
      valor: { tipo: "moeda", numero: 1284.9 },
      nota: "Entrou R$ 6.400,00, saiu R$ 2.095,10 e ainda sai R$ 3.020,00.",
    },
  },
  {
    id: "freela",
    partes: [
      "recebi ",
      { texto: "1.200", entidade: "valor" },
      " de ",
      { texto: "freela", entidade: "categoria" },
    ],
    intencao: "Receita",
    campos: [
      { rotulo: "Valor", valor: "R$ 1.200,00", entidade: "valor" },
      { rotulo: "Categoria", valor: "Trabalho extra", entidade: "categoria" },
      { rotulo: "Conta", valor: "Conta principal" },
      { rotulo: "Quando", valor: "Hoje" },
    ],
  },
  {
    id: "geladeira",
    partes: [
      "parcela ",
      { texto: "a geladeira", entidade: "descricao" },
      " de ",
      { texto: "3.200", entidade: "valor" },
      " em ",
      { texto: "10x", entidade: "parcelas" },
    ],
    intencao: "Parcelamento",
    campos: [
      { rotulo: "O quê", valor: "Geladeira", entidade: "descricao" },
      { rotulo: "Total", valor: "R$ 3.200,00", entidade: "valor" },
      { rotulo: "Parcelas", valor: "10x de R$ 320,00", entidade: "parcelas" },
      { rotulo: "Primeira", valor: "Fatura aberta, fecha 20/09" },
    ],
  },
  {
    id: "comida",
    partes: [
      "quanto gastei com ",
      { texto: "comida", entidade: "categoria" },
      " em ",
      { texto: "agosto", entidade: "periodo" },
      "?",
    ],
    intencao: "Pergunta",
    campos: [
      { rotulo: "Categoria", valor: "Alimentação", entidade: "categoria" },
      { rotulo: "Período", valor: "Agosto de 2026", entidade: "periodo" },
    ],
    resposta: {
      rotulo: "Alimentação em agosto",
      valor: { tipo: "moeda", numero: 1126.4 },
      nota: "Em 23 lançamentos, R$ 94,20 a menos que em julho.",
    },
  },
  {
    id: "transferencia",
    partes: [
      "transfere ",
      { texto: "500", entidade: "valor" },
      " da ",
      { texto: "conta", entidade: "origem" },
      " pro ",
      { texto: "cartão", entidade: "destino" },
    ],
    intencao: "Transferência",
    campos: [
      { rotulo: "Valor", valor: "R$ 500,00", entidade: "valor" },
      { rotulo: "De", valor: "Conta principal", entidade: "origem" },
      { rotulo: "Para", valor: "Cartão da casa", entidade: "destino" },
      { rotulo: "Gasto novo no mês", valor: "Nenhum" },
    ],
  },
  {
    id: "contador",
    partes: [
      "anota: ",
      { texto: "levar as notas fiscais pro contador", entidade: "descricao" },
    ],
    intencao: "Anotação",
    campos: [
      {
        rotulo: "Texto",
        valor: "Levar as notas fiscais pro contador",
        entidade: "descricao",
      },
      { rotulo: "Onde fica", valor: "Anotações" },
    ],
  },
  {
    id: "fatura-paga",
    partes: ["paguei a ", { texto: "fatura do cartão", entidade: "conta" }],
    intencao: "Pagamento",
    campos: [
      {
        rotulo: "Fatura",
        valor: "Cartão da casa, setembro",
        entidade: "conta",
      },
      { rotulo: "Valor", valor: "R$ 1.590,00" },
      { rotulo: "Parcelas baixadas", valor: "6" },
      { rotulo: "Disponível agora", valor: "R$ 5.927,00" },
    ],
  },
  {
    id: "patrimonio",
    partes: [
      "qual é o meu ",
      { texto: "patrimônio", entidade: "consulta" },
      " ",
      { texto: "hoje", entidade: "periodo" },
      "?",
    ],
    intencao: "Pergunta",
    campos: [
      { rotulo: "Consulta", valor: "Patrimônio", entidade: "consulta" },
      { rotulo: "Data", valor: "17/09/2026", entidade: "periodo" },
    ],
    resposta: {
      rotulo: "Patrimônio hoje",
      valor: { tipo: "moeda", numero: 48230 },
      nota: "Contas, investimentos e metas, menos o que já está na fatura.",
    },
  },
  {
    id: "celular",
    partes: [
      "posso comprar ",
      { texto: "um celular", entidade: "descricao" },
      " de ",
      { texto: "3 mil", entidade: "valor" },
      "?",
    ],
    intencao: "Simulação",
    campos: [
      { rotulo: "O quê", valor: "Celular", entidade: "descricao" },
      { rotulo: "Preço", valor: "R$ 3.000,00", entidade: "valor" },
    ],
    resposta: {
      rotulo: "Sobra do mês se comprar à vista",
      valor: { tipo: "moeda", numero: -1715.1 },
      nota: "Sem comprar, sobram R$ 1.284,90. Em 10x, sobram R$ 984,90.",
    },
  },
  {
    id: "viagem",
    partes: [
      "guarda ",
      { texto: "200", entidade: "valor" },
      " na ",
      { texto: "meta da viagem", entidade: "meta" },
    ],
    intencao: "Depósito na meta",
    campos: [
      { rotulo: "Depósito", valor: "R$ 200,00", entidade: "valor" },
      { rotulo: "Meta", valor: "Viagem", entidade: "meta" },
      { rotulo: "Guardado", valor: "R$ 1.700,00 de R$ 4.000,00" },
      { rotulo: "Faltam", valor: "R$ 2.300,00" },
    ],
  },
  {
    id: "ifood",
    partes: [
      "toda vez que eu falar ",
      { texto: "ifood", entidade: "termo" },
      ", joga em ",
      { texto: "alimentação", entidade: "categoria" },
    ],
    intencao: "Regra",
    campos: [
      { rotulo: "Quando aparecer", valor: "ifood", entidade: "termo" },
      { rotulo: "Categoria", valor: "Alimentação", entidade: "categoria" },
      { rotulo: "Vale para", valor: "Os próximos lançamentos" },
    ],
  },
  {
    id: "orcamento",
    partes: [
      "quanto falta pra fechar o ",
      { texto: "orçamento da casa", entidade: "meta" },
      "?",
    ],
    intencao: "Pergunta",
    campos: [
      { rotulo: "Orçamento", valor: "Casa, setembro", entidade: "meta" },
    ],
    resposta: {
      rotulo: "Ainda cabe no orçamento",
      valor: { tipo: "moeda", numero: 680 },
      nota: "De R$ 2.400,00 planejados, R$ 1.720,00 já saíram.",
    },
  },
  {
    id: "desfazer",
    partes: ["desfaz ", { texto: "o último", entidade: "alvo" }],
    intencao: "Desfazer",
    campos: [
      { rotulo: "Alvo", valor: "Último lançamento", entidade: "alvo" },
      { rotulo: "Removido", valor: "Mercado, R$ 45,00" },
      { rotulo: "Sobra do mês", valor: "Volta a R$ 1.329,90" },
    ],
  },
  {
    id: "vencimento",
    partes: ["quando vence a ", { texto: "fatura", entidade: "conta" }, "?"],
    intencao: "Pergunta",
    campos: [{ rotulo: "Cartão", valor: "Cartão da casa", entidade: "conta" }],
    resposta: {
      rotulo: "Vence em",
      valor: { tipo: "texto", texto: "27/09" },
      nota: "Fecha dia 20. Hoje ela está em R$ 1.590,00.",
    },
  },
];

export type CenaId =
  "parcelas" | "simulacao" | "fatura" | "transferencia" | "meta" | "desfazer";

export interface Operacao {
  /** O pedido, como a pessoa escreveria. */
  pedido: string;
  /** O que acontece. Concreto, nunca adjetivo. */
  efeito: string;
  /** O diagrama que a mesa de operações desenha para este pedido. */
  cena: CenaId;
  /** A ferramenta que sustenta isto. Documentação, não conteúdo. */
  prova: string;
}

export const OPERACOES: Operacao[] = [
  {
    pedido: "parcela a geladeira de 3.200 em 10x",
    efeito:
      "Dez lançamentos futuros, no cartão certo, com a primeira parcela caindo na fatura que ainda está aberta.",
    cena: "parcelas",
    prova: "create_installment_purchase",
  },
  {
    pedido: "posso comprar um celular de 3 mil?",
    efeito:
      "Ele simula antes de você comprar: mostra o que sobra no mês se comprar, e o que sobra se não comprar.",
    cena: "simulacao",
    prova: "simulate_purchase",
  },
  {
    pedido: "paguei a fatura do cartão",
    efeito:
      "Baixa a fatura inteira, parcela por parcela, e devolve o limite disponível.",
    cena: "fatura",
    prova: "pay_invoice",
  },
  {
    pedido: "transfere 500 da conta pro cartão",
    efeito:
      "As duas pontas no mesmo lançamento, sem virar uma despesa nova que estraga o mês.",
    cena: "transferencia",
    prova: "create_transfer",
  },
  {
    pedido: "guarda 200 na meta da viagem",
    efeito: "Depósito na meta, com o quanto ainda falta recalculado na hora.",
    cena: "meta",
    prova: "goal_deposit",
  },
  {
    pedido: "desfaz o último",
    efeito:
      "O que foi entendido errado volta atrás pela conversa, sem você abrir o aplicativo.",
    cena: "desfazer",
    prova: "undo_last",
  },
];
