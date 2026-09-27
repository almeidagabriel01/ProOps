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
  };
}
