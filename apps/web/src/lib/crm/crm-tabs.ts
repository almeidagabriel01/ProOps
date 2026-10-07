export type CrmTab = "proposals" | "transactions" | "leads";

/**
 * A aba Lançamentos do CRM mostra lançamentos de verdade (valor, categoria,
 * carteira): exige "Ver" em Lançamentos e o financeiro no plano. Até 2026-10
 * ela aparecia para todo membro com acesso ao CRM, inclusive a vendedora que
 * o dono queria só nos leads e nas propostas.
 */
export function canShowCrmTransactionsTab(input: {
  canViewTransactions: boolean;
  hasFinancial: boolean;
}): boolean {
  return input.canViewTransactions && input.hasFinancial;
}

/** A aba pedida (pela URL ou pelo clique), ou Propostas se ela não abre. */
export function resolveCrmTab(requested: CrmTab, transactionsAllowed: boolean): CrmTab {
  if (requested === "transactions" && !transactionsAllowed) return "proposals";
  return requested;
}
