/**
 * Valor vendido de uma proposta: o valor fechado, quando houver, senão o total.
 *
 * Espelho de `apps/functions/src/shared/sold-value.ts`, que as Metas usam no
 * backend. As duas contas têm que bater, senão "Vendido" no Dashboard e o
 * progresso da meta mostram números diferentes para o mesmo mês. Guard:
 * `__tests__/sold-value-parity.test.ts`.
 */
export function soldValue(proposal: { closedValue?: unknown; totalValue?: unknown }): number {
  const closed = Number(proposal.closedValue);
  if (Number.isFinite(closed) && closed > 0) return closed;
  const total = Number(proposal.totalValue);
  return Number.isFinite(total) && total > 0 ? total : 0;
}
