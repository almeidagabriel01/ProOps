/**
 * Valor vendido de uma proposta: o valor fechado, quando houver, senão o total.
 *
 * O Dashboard do front (`apps/web/src/lib/sales/sold-value.ts`) repete a mesma
 * conta para a faixa "Vendas do mês"; o teste de paridade de lá importa esta.
 */
export function soldValue(proposal: { closedValue?: unknown; totalValue?: unknown }): number {
  const closed = Number(proposal.closedValue);
  if (Number.isFinite(closed) && closed > 0) return closed;
  const total = Number(proposal.totalValue);
  return Number.isFinite(total) && total > 0 ? total : 0;
}
