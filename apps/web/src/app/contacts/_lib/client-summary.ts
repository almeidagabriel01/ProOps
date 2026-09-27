import type { Proposal } from "@/types/proposal";
import type { Transaction } from "@/services/transaction-service";

export interface ClientProposalSummary {
  total: number;
  approved: number;
  approvedValue: number;
  open: number;
}

export interface ClientFinanceSummary {
  received: number;
  toReceive: number;
  overdue: number;
}

function proposalValue(p: Proposal): number {
  const closed = (p as { closedValue?: number | null }).closedValue;
  if (typeof closed === "number") return closed;
  return Number((p as { totalValue?: number }).totalValue ?? 0);
}

/**
 * Resumo das propostas do contato. `isApproved` vem de fora porque depende das
 * colunas do CRM da empresa (a mesma regra da lista de propostas).
 */
export function summarizeProposals(
  proposals: Proposal[],
  isApproved: (p: Proposal) => boolean,
): ClientProposalSummary {
  let approved = 0;
  let approvedValue = 0;
  let open = 0;
  for (const p of proposals) {
    if (p.status === "draft") continue;
    if (isApproved(p)) {
      approved++;
      approvedValue += proposalValue(p);
    } else if (p.status !== "rejected") {
      open++;
    }
  }
  return {
    total: proposals.filter((p) => p.status !== "draft").length,
    approved,
    approvedValue,
    open,
  };
}

/** O que o contato já pagou, o que falta e o que está vencido (só receitas). */
export function summarizeFinance(transactions: Transaction[]): ClientFinanceSummary {
  const summary: ClientFinanceSummary = { received: 0, toReceive: 0, overdue: 0 };
  for (const t of transactions) {
    if (t.type !== "income") continue;
    if (t.status === "paid") summary.received += t.amount;
    else {
      summary.toReceive += t.amount;
      if (t.status === "overdue") summary.overdue += t.amount;
    }
  }
  return summary;
}
