/**
 * Lucro da proposta, a mesma conta nas três telas do formulário (cabeçalho
 * dos sistemas, passo de pagamento e resumo final).
 *
 * Só produto tem custo (`unitPrice` × `quantity`, que já é a quantidade
 * cobrável nos produtos vendidos por medida). Serviço é mão de obra: entra
 * inteiro no lucro. Até 2026-10 o lucro era só o markup dos produtos, o que
 * deixava a instalação de fora e ignorava o desconto.
 *
 * A mensalidade fica fora, como do total (`countsInProposalTotal`).
 */

import { countsInProposalTotal } from "./monthly-lines";

interface ProfitLine {
  itemType?: "product" | "service";
  quantity?: number;
  unitPrice?: number;
  total?: number;
  isMonthly?: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Custo dos produtos vendidos. Serviço não tem custo. */
export function proposalProductsCost(lines: readonly ProfitLine[]): number {
  const cost = lines.filter(countsInProposalTotal).reduce((sum, line) => {
    if ((line.itemType || "product") === "service") return sum;
    return sum + Number(line.unitPrice || 0) * Number(line.quantity || 0);
  }, 0);
  return round2(cost);
}

/** Valor de venda das linhas, antes de desconto e custos extras. */
export function proposalSaleValue(lines: readonly ProfitLine[]): number {
  const value = lines
    .filter(countsInProposalTotal)
    .reduce((sum, line) => sum + Number(line.total || 0), 0);
  return round2(value);
}

/** Lucro das linhas, antes de desconto: venda menos o custo dos produtos. */
export function proposalLinesProfit(lines: readonly ProfitLine[]): number {
  return round2(proposalSaleValue(lines) - proposalProductsCost(lines));
}

interface ProposalProfitInput {
  lines: readonly ProfitLine[];
  /** O que o cliente paga: já com desconto, custos extras e valor combinado. */
  finalTotal: number;
  /** Frete, deslocamento: cobrado do cliente, mas é custo repassado, não lucro. */
  extraExpense?: number;
}

/** Lucro do fechamento: o desconto e o valor combinado reduzem o lucro. */
export function proposalProfit({
  lines,
  finalTotal,
  extraExpense = 0,
}: ProposalProfitInput): number {
  return round2(
    Number(finalTotal || 0) -
      Number(extraExpense || 0) -
      proposalProductsCost(lines),
  );
}
