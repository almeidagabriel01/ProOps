import { buildProposalCodePreview } from "@/lib/proposal-numbering";
import type { StageTemplate } from "@/lib/niches/registry";

import { parcelar } from "./geometria";

/**
 * A história de demonstração das telas codadas: uma cliente, uma proposta, as
 * parcelas dela. Uma só, usada em toda réplica, para o visitante reconhecer a
 * mesma venda passando de tela em tela (é o argumento da página: uma base só).
 *
 * Tudo aqui é FICTÍCIO e está nas telas como exemplo, igual ao portal de
 * exemplo do produto (`/share/portal/exemplo`, que também fala com "Sua
 * empresa"). Nenhum número daqui é dado de cliente, uso ou resultado.
 *
 * Os valores derivados (parcelas, código, totais) são calculados, não
 * digitados: a soma das parcelas bate com o total ao centavo porque sai de
 * `parcelar`, e o código segue o formato real da numeração de propostas.
 */
export const EMPRESA_DEMO = "Sua empresa";
export const CLIENTE_DEMO = "Ana Moreira";
export const TITULO_DEMO = "Projeto do apartamento 1204";

export const CODIGO_DEMO = buildProposalCodePreview({ number: 189, year: 2026, praca: "SP" });

/** Grupos da proposta com o subtotal de cada um. */
export const GRUPOS_DEMO = [
  { nome: "Sala de estar", itens: 6, subtotal: 7200 },
  { nome: "Suíte master", itens: 5, subtotal: 6400 },
  { nome: "Área gourmet", itens: 4, subtotal: 4800 },
] as const;

export const TOTAL_DEMO = GRUPOS_DEMO.reduce((soma, g) => soma + g.subtotal, 0);

const [ENTRADA, PARCELA_2, PARCELA_3] = parcelar(TOTAL_DEMO, 3);

export const PARCELAS_DEMO = [
  { rotulo: "Entrada", valor: ENTRADA, vencimento: "15/08", estado: "pago" },
  { rotulo: "Parcela 2 de 3", valor: PARCELA_2, vencimento: "10/10", estado: "aberto" },
  { rotulo: "Parcela 3 de 3", valor: PARCELA_3, vencimento: "10/11", estado: "aberto" },
] as const;

/**
 * Projeção de saldo em 12 meses nos três cenários do fluxo de caixa. Curvas de
 * exemplo, em milhares: a realista entre as outras duas, sempre.
 */
export const CENARIOS_DEMO = {
  pessimista: [42, 44, 41, 45, 47, 46, 49, 50, 48, 52, 53, 55],
  realista: [42, 46, 45, 50, 54, 55, 59, 62, 61, 66, 69, 72],
  otimista: [42, 48, 49, 56, 61, 64, 70, 75, 76, 83, 88, 93],
} as const;

export type EstadoDaEtapaDemo = "feita" | "atual" | "proxima";

export interface EtapaDemo {
  nome: string;
  estado: EstadoDaEtapaDemo;
  checklist: readonly string[];
}

/**
 * As etapas de uma obra de exemplo a partir do modelo REAL do nicho
 * (`NICHE_REGISTRY[n].stageTemplate`, espelho do backend): as anteriores a
 * `atual` feitas, a `atual` em andamento, o resto por vir.
 */
export function etapasDaObra(modelo: readonly StageTemplate[], atual = 1): EtapaDemo[] {
  const indice = Math.min(Math.max(atual, 0), modelo.length - 1);
  return modelo.map((etapa, i) => ({
    nome: etapa.name,
    checklist: etapa.checklist,
    estado: i < indice ? "feita" : i === indice ? "atual" : "proxima",
  }));
}
