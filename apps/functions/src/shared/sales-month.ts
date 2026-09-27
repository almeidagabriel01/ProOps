/**
 * Início e fim do mês no fuso de Brasília, em ISO UTC (é assim que
 * `approvedAt` é gravado). Sem horário de verão desde 2019, então −03:00 fixo.
 *
 * O Dashboard do front (`apps/web/src/lib/sales/sales-month.ts`) repete a
 * conta para somar as vendas do mês; o teste de paridade de lá importa esta.
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
