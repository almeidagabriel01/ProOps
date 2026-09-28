const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "09:30" a partir de 570 minutos. */
export function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** 570 a partir de "09:30". */
export function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes <= 24 * 60 ? minutes : null;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "sexta-feira, 26/09 às 09:30" */
export function describeBookingWhen(date: string, startMin: number): string {
  const [, m, d] = date.split("-");
  return `${WEEKDAYS[weekdayOf(date)]}, ${d}/${m} às ${formatMinutes(startMin)}`;
}

/** "sex 26/09" para o seletor de dia. */
export function shortDayLabel(date: string): { weekday: string; day: string } {
  const [, m, d] = date.split("-");
  return { weekday: WEEKDAYS_SHORT[weekdayOf(date)], day: `${d}/${m}` };
}

/** Hoje em Brasília ("YYYY-MM-DD"), o dia que vale para o link. */
export function todayInBrazil(nowMs: number = Date.now()): string {
  return new Date(nowMs - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "sex, 02/10, dia inteiro" ou "sex, 02/10, das 10:00 às 11:00". */
export function describeException(exception: {
  date: string;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
}): string {
  const { weekday, day } = shortDayLabel(exception.date);
  if (exception.allDay || exception.startMin === null || exception.endMin === null) {
    return `${weekday}, ${day}, dia inteiro`;
  }
  return `${weekday}, ${day}, das ${formatMinutes(exception.startMin)} às ${formatMinutes(exception.endMin)}`;
}

/** "30 min", "1h", "1h30". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${rest}` : `${hours}h`;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "quarta-feira, 30 de setembro" */
export function longDayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(date)]}, ${d} de ${MONTHS[m - 1]}`;
}

/** "setembro de 2026" a partir de "2026-09". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/** "2026-10" a partir de "2026-09" e +1. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * As casas do mês numa grade de domingo a sábado: `null` antes do dia 1, para
 * o dia 1 cair na coluna do dia da semana dele.
 */
export function monthGrid(month: string): Array<string | null> {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: weekdayOf(first) }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  return cells;
}

export type DayPeriod = "manha" | "tarde" | "noite";

const PERIOD_LABELS: Record<DayPeriod, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

/** Os horários do dia em Manhã (antes das 12h), Tarde e Noite (18h em diante), sem grupo vazio. */
export function groupStartsByPeriod(starts: number[]): Array<{ id: DayPeriod; label: string; starts: number[] }> {
  const periodOf = (start: number): DayPeriod => (start < 12 * 60 ? "manha" : start < 18 * 60 ? "tarde" : "noite");
  return (["manha", "tarde", "noite"] as const)
    .map((id) => ({ id, label: PERIOD_LABELS[id], starts: starts.filter((s) => periodOf(s) === id) }))
    .filter((group) => group.starts.length > 0);
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

/**
 * Expediente padrão para a conta de demonstração, que não chama a API. Os
 * números espelham `defaultBookingSettings` do backend (booking-model.ts).
 */
export function demoBookingSettings(visitType: { id: string; label: string; durationMin: number }) {
  return {
    enabled: false,
    publicToken: null,
    days: [1, 2, 3, 4, 5],
    startMin: 9 * 60,
    endMin: 18 * 60,
    leadHours: 24,
    horizonDays: 21,
    visitTypes: [visitType],
    exceptions: [],
  };
}
