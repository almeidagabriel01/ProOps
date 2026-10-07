/**
 * O que o painel mostra do financeiro (saldo, alertas de vencimento, fluxo de
 * caixa, balanço futuro, gastos do mês, lançamentos recentes) exige "Ver" em
 * Lançamentos ou em Carteiras, que é o que as rules exigem para ler os
 * documentos. Até 2026-10 todo membro com o Dashboard via o saldo da empresa.
 */
export function canSeeDashboardFinance(input: {
  canViewTransactions: boolean;
  canViewWallet: boolean;
}): boolean {
  return input.canViewTransactions || input.canViewWallet;
}
