import { z } from "zod";

/**
 * Link público de agendamento (capacidade `bookingLink`, Pro e Enterprise).
 *
 * A empresa define o expediente (dias, horário, antecedência, até quando) e os
 * tipos de visita. O cliente vê só os horários livres desse expediente,
 * descontando a Agenda, e PEDE a visita: ela entra na Agenda como "a confirmar"
 * e a empresa confirma ou recusa. É o desenho do aceite da proposta.
 *
 * Horário é sempre o de Brasília (−03:00 fixo, sem horário de verão desde
 * 2019), guardado como minutos do dia: 540 = 09:00.
 */

export const BOOKING_SETTINGS_COLLECTION = "booking_settings";
export const BOOKING_REQUESTS_COLLECTION = "booking_requests";
export const BOOKING_LOCKS_COLLECTION = "booking_locks";

/** Passo entre os horários oferecidos. */
export const SLOT_STEP_MIN = 30;
const BRAZIL_OFFSET_MIN = 180;
const DAY_MS = 86_400_000;

export interface VisitType {
  id: string;
  label: string;
  durationMin: number;
}

export interface BookingSettings {
  enabled: boolean;
  /** O que vai no link (`/visita/{token}`). Nasce ao ligar pela primeira vez. */
  publicToken: string | null;
  /** Dias da semana abertos: 0 = domingo ... 6 = sábado. */
  days: number[];
  startMin: number;
  endMin: number;
  /** Antecedência mínima: não dá para pedir visita para daqui a 1 hora. */
  leadHours: number;
  /** Até quantos dias à frente o link mostra horários. */
  horizonDays: number;
  visitTypes: VisitType[];
  /** Dono dos eventos criados na Agenda (quem configurou). */
  ownerUserId: string | null;
  updatedAt: string | null;
}

export type BookingRequestStatus = "pending" | "confirmed" | "declined";

/** Os tipos de visita começam pelo nicho, e a empresa edita. */
export function defaultVisitTypes(niche: unknown): VisitType[] {
  return niche === "cortinas"
    ? [{ id: "medicao", label: "Medição", durationMin: 60 }]
    : [{ id: "visita_tecnica", label: "Visita técnica", durationMin: 60 }];
}

export function defaultBookingSettings(niche: unknown): BookingSettings {
  return {
    enabled: false,
    publicToken: null,
    days: [1, 2, 3, 4, 5],
    startMin: 9 * 60,
    endMin: 18 * 60,
    leadHours: 24,
    horizonDays: 21,
    visitTypes: defaultVisitTypes(niche),
    ownerUserId: null,
    updatedAt: null,
  };
}

const minuteOfDay = z.number().int().min(0).max(24 * 60);

export const BookingSettingsInputSchema = z
  .object({
    enabled: z.boolean(),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Escolha pelo menos um dia da semana.")
      .max(7)
      .transform((days) => Array.from(new Set(days)).sort()),
    startMin: minuteOfDay.refine((v) => v % 15 === 0, "Use horários de 15 em 15 minutos."),
    endMin: minuteOfDay.refine((v) => v % 15 === 0, "Use horários de 15 em 15 minutos."),
    leadHours: z.number().int().min(0).max(24 * 14),
    horizonDays: z.number().int().min(1).max(90),
    visitTypes: z
      .array(
        z
          .object({
            id: z.string().trim().max(40).optional(),
            label: z.string().trim().min(2, "Dê um nome ao tipo de visita.").max(60),
            durationMin: z
              .number()
              .int()
              .min(15)
              .max(8 * 60)
              .refine((v) => v % 15 === 0, "Duração de 15 em 15 minutos."),
          })
          .strict(),
      )
      .min(1, "Cadastre pelo menos um tipo de visita.")
      .max(5),
  })
  .strict()
  .refine((v) => v.endMin > v.startMin, {
    message: "O fim do expediente precisa ser depois do início.",
  })
  .refine((v) => v.visitTypes.every((t) => t.durationMin <= v.endMin - v.startMin), {
    message: "Uma visita não cabe no expediente escolhido.",
  });

export const BookingRequestInputSchema = z
  .object({
    visitTypeId: z.string().trim().min(1).max(40),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    startMin: minuteOfDay,
    name: z.string().trim().min(2, "Informe o seu nome.").max(120),
    phone: z.string().trim().min(8, "Informe um telefone para contato.").max(30),
    email: z
      .string()
      .trim()
      .max(160)
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
    address: z.string().trim().max(240).optional(),
    notes: z.string().trim().max(1000).optional(),
    /** Campo escondido: robô preenche, pessoa não. */
    website: z.string().max(200).optional(),
    captchaToken: z.string().max(4000).optional(),
  })
  .strict();

export type BookingRequestInput = z.infer<typeof BookingRequestInputSchema>;

/** Id estável a partir do nome, para o tipo novo que ainda não tem um. */
export function visitTypeId(label: string, taken: Set<string>): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "visita";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  return id;
}

/** "2026-09-26" + 540 (09:00 em Brasília) -> instante UTC em ms. */
export function brazilToUtcMs(date: string, minuteOfDayValue: number): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, minuteOfDayValue + BRAZIL_OFFSET_MIN);
}

/** O dia de Brasília (YYYY-MM-DD) de um instante. */
export function brazilDate(ms: number): string {
  return new Date(ms - BRAZIL_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Dia da semana de um "YYYY-MM-DD" (0 = domingo). */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface BusyInterval {
  startMs: number;
  endMs: number;
}

export interface DaySlots {
  date: string;
  starts: number[];
}

/**
 * Pura: os horários livres de um tipo de visita, do primeiro dia permitido pela
 * antecedência até o fim do horizonte. Um horário é livre quando a visita
 * inteira cabe no expediente e não encosta em nenhum compromisso.
 */
export function computeAvailableSlots(params: {
  settings: Pick<BookingSettings, "days" | "startMin" | "endMin" | "leadHours" | "horizonDays">;
  durationMin: number;
  busy: BusyInterval[];
  nowMs: number;
}): DaySlots[] {
  const { settings, durationMin, busy, nowMs } = params;
  const earliestMs = nowMs + settings.leadHours * 3_600_000;
  const open = new Set(settings.days);
  const today = brazilDate(nowMs);
  const result: DaySlots[] = [];

  for (let offset = 0; offset < settings.horizonDays; offset++) {
    const date = addDaysToDate(today, offset);
    if (!open.has(weekdayOf(date))) continue;
    const starts: number[] = [];
    for (
      let start = settings.startMin;
      start + durationMin <= settings.endMin;
      start += SLOT_STEP_MIN
    ) {
      const startMs = brazilToUtcMs(date, start);
      if (startMs < earliestMs) continue;
      const endMs = startMs + durationMin * 60_000;
      if (busy.some((b) => b.startMs < endMs && b.endMs > startMs)) continue;
      starts.push(start);
    }
    if (starts.length > 0) result.push({ date, starts });
  }
  return result;
}

/** O que o evento da Agenda ocupa, inclusive o dia inteiro. */
export function busyFromCalendarEvent(event: {
  status?: unknown;
  isAllDay?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  startMs?: unknown;
  endMs?: unknown;
}): BusyInterval | null {
  if (event.status === "canceled") return null;
  if (event.isAllDay && typeof event.startDate === "string" && typeof event.endDate === "string") {
    return { startMs: brazilToUtcMs(event.startDate, 0), endMs: brazilToUtcMs(event.endDate, 0) };
  }
  const startMs = Number(event.startMs);
  const endMs = Number(event.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs };
}

/** "09:30" a partir de 570. */
export function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** "26/09" a partir de "2026-09-26". */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}
