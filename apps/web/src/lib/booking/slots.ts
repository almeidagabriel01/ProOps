export const WORK_START_MIN = 9 * 60; // 540
export const WORK_END_MIN = 17 * 60; // 1020
export const SAO_PAULO_TZ = "America/Sao_Paulo";

export type DurationMinutes = 15 | 30 | 60;

export interface BookedInterval {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateSlotStarts(duration: DurationMinutes): number[] {
  const starts: number[] = [];
  for (let t = WORK_START_MIN; t + duration <= WORK_END_MIN; t += duration) {
    starts.push(t);
  }
  return starts;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isSlotAvailable(
  startMinutes: number,
  duration: DurationMinutes,
  dayBookings: BookedInterval[],
): boolean {
  const end = startMinutes + duration;
  return !dayBookings.some((b) =>
    intervalsOverlap(startMinutes, end, b.startMinutes, b.endMinutes),
  );
}

export function formatDateStr(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

export function nowSaoPaulo(): { dateStr: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  // Intl pode devolver "24" para meia-noite em hour12:false — normaliza p/ 0.
  const hour = Number(get("hour")) % 24;
  const minutes = hour * 60 + Number(get("minute"));
  return { dateStr, minutes };
}

export function isPastDate(dateStr: string, todayStr: string): boolean {
  return dateStr < todayStr;
}

export function isSlotInPast(
  dateStr: string,
  startMinutes: number,
  now: { dateStr: string; minutes: number },
): boolean {
  if (dateStr !== now.dateStr) return false;
  return startMinutes <= now.minutes;
}
