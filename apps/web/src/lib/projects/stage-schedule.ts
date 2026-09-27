import type { StageScheduleInput } from "@/types/project";

/** O mínimo para mostrar a data: serve à obra, à página da entrega e ao portal. */
export interface ScheduleLike {
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate?: string | null;
}

/** Durações oferecidas ao marcar uma visita, em minutos. */
export const VISIT_DURATIONS = [60, 120, 180, 240, 360, 480] as const;
export const DEFAULT_VISIT_DURATION = 120;

export interface ScheduleFormValues {
  /** "AAAA-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  durationMin: number;
  isAllDay: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

function dayMonth(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

function hourMinute(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * "qua, 20/10, 08:00 às 11:00" ou "qua, 20/10, dia inteiro". Hora local de
 * quem olha, que é a da empresa e a do cliente dela.
 */
export function formatStageSchedule(schedule: ScheduleLike): string {
  if (schedule.isAllDay && schedule.startDate) {
    const [y, m, d] = schedule.startDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return `${WEEKDAYS[date.getDay()]}, ${dayMonth(date)}, dia inteiro`;
  }
  if (!schedule.startsAt) return "";
  const start = new Date(schedule.startsAt);
  const end = schedule.endsAt ? new Date(schedule.endsAt) : null;
  const sameDay = end && end.toDateString() === start.toDateString();
  const endText = !end ? "" : sameDay ? ` às ${hourMinute(end)}` : ` até ${dayMonth(end)} ${hourMinute(end)}`;
  return `${WEEKDAYS[start.getDay()]}, ${dayMonth(start)}, ${hourMinute(start)}${endText}`;
}

/** Valores do formulário: os da visita já marcada, ou amanhã às 08:00. */
export function scheduleFormFrom(schedule: ScheduleLike | null | undefined, now: Date = new Date()): ScheduleFormValues {
  if (schedule?.isAllDay && schedule.startDate) {
    return { date: schedule.startDate, time: "08:00", durationMin: DEFAULT_VISIT_DURATION, isAllDay: true };
  }
  if (schedule?.startsAt) {
    const start = new Date(schedule.startsAt);
    const minutes = schedule.endsAt
      ? Math.max(15, Math.round((Date.parse(schedule.endsAt) - start.getTime()) / 60000))
      : DEFAULT_VISIT_DURATION;
    return {
      date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      time: hourMinute(start),
      durationMin: minutes,
      isAllDay: false,
    };
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    date: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`,
    time: "08:00",
    durationMin: DEFAULT_VISIT_DURATION,
    isAllDay: false,
  };
}

/** O que vai para a API; null quando falta data ou hora. */
export function toScheduleInput(values: ScheduleFormValues): StageScheduleInput | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) return null;
  if (values.isAllDay) {
    const [y, m, d] = values.date.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    return {
      isAllDay: true,
      startDate: values.date,
      endDate: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    };
  }
  if (!/^\d{2}:\d{2}$/.test(values.time)) return null;
  const start = new Date(`${values.date}T${values.time}:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + values.durationMin * 60000);
  return { isAllDay: false, startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/** "2 horas", "1 hora", "1h30". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return h === 0 ? `${m} min` : `${h}h${pad(m)}`;
}
