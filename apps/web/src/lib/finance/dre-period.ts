/** Períodos prontos da tela do DRE, em meses `YYYY-MM` no fuso de Brasília. */
export type DrePeriodPreset = "this_month" | "last_month" | "last_3" | "last_6" | "this_year" | "last_12";

export const DRE_PERIOD_OPTIONS: Array<{ value: DrePeriodPreset; label: string }> = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_3", label: "Últimos 3 meses" },
  { value: "last_6", label: "Últimos 6 meses" },
  { value: "this_year", label: "Este ano" },
  { value: "last_12", label: "Últimos 12 meses" },
];

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthKey(year: number, month: number): string {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** O mês de hoje em Brasília (UTC-3). */
export function currentBrazilMonth(nowMs = Date.now()): { year: number; month: number } {
  const d = new Date(nowMs - 3 * 3_600_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Os meses que cada período pronto cobre, sempre terminando no mês atual (ou no passado). */
export function presetRange(preset: DrePeriodPreset, nowMs = Date.now()): { from: string; to: string } {
  const { year, month } = currentBrazilMonth(nowMs);
  const now = monthKey(year, month);
  switch (preset) {
    case "this_month":
      return { from: now, to: now };
    case "last_month": {
      const last = monthKey(year, month - 1);
      return { from: last, to: last };
    }
    case "last_3":
      return { from: monthKey(year, month - 2), to: now };
    case "last_6":
      return { from: monthKey(year, month - 5), to: now };
    case "this_year":
      return { from: `${year}-01`, to: now };
    case "last_12":
      return { from: monthKey(year, month - 11), to: now };
  }
}

/** "set/26" */
export function formatMonthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

/** Margem sobre a receita líquida, arredondada; sem receita, nulo. */
export function marginOf(value: number, revenue: number): number | null {
  if (!revenue) return null;
  return Math.round((value / revenue) * 1000) / 10;
}

export interface PeriodChoice {
  value: string;
  label: string;
  range: { from: string; to: string };
}

/**
 * O que o contador escolhe: os períodos prontos e cada um dos últimos 12
 * meses, porque o trabalho dele é fechar um mês específico.
 */
export function periodChoices(nowMs = Date.now()): PeriodChoice[] {
  const presets = DRE_PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label, range: presetRange(o.value, nowMs) }));
  const { year, month } = currentBrazilMonth(nowMs);
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = monthKey(year, month - i);
    return { value: `month:${key}`, label: `Mês: ${formatMonthShort(key)}`, range: { from: key, to: key } };
  });
  return [...presets, ...months];
}

/** Os meses de `from` a `to`, inclusive. */
export function monthsInRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const count = Math.min(Math.max((ty - fy) * 12 + (tm - fm) + 1, 0), 24);
  return Array.from({ length: count }, (_, i) => monthKey(fy, fm + i));
}
