/**
 * Início e fim do mês no fuso de Brasília, em ISO UTC, a janela de
 * `approvedAt` que conta como venda do mês.
 *
 * Espelho de `apps/functions/src/shared/sales-month.ts`, a janela das Metas:
 * com fronteiras diferentes, uma venda aprovada na virada do mês contaria num
 * mês no Dashboard e no outro na meta. Guard: `__tests__/sold-value-parity.test.ts`.
 */
export function monthWindowUtc(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const next = m === 12 ? { y: year + 1, m: 1 } : { y: year, m: m + 1 };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(m)}-01T03:00:00.000Z`,
    end: `${next.y}-${pad(next.m)}-01T03:00:00.000Z`,
  };
}
