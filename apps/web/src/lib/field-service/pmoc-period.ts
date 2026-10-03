/**
 * Os períodos que a tela oferece para o relatório do PMOC. O backend aceita
 * qualquer intervalo de até dois anos; a tela fica nos que se usam de fato.
 */

export type PmocPeriodPreset = "last12" | "last6" | "thisYear" | "lastYear";

export const PMOC_PERIOD_LABELS: Record<PmocPeriodPreset, string> = {
  last12: "Últimos 12 meses",
  last6: "Últimos 6 meses",
  thisYear: "Este ano",
  lastYear: "Ano passado",
};

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonths(day: string, months: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** `today` em "AAAA-MM-DD", no fuso de Brasília. */
export function pmocPeriod(preset: PmocPeriodPreset, today: string): { from: string; to: string } {
  const year = Number(today.slice(0, 4));
  switch (preset) {
    case "last6":
      return { from: shiftDays(shiftMonths(today, -6), 1), to: today };
    case "thisYear":
      return { from: `${year}-01-01`, to: today };
    case "lastYear":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "last12":
    default:
      return { from: shiftDays(today, -364), to: today };
  }
}
