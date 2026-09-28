import { z } from "zod";
import { mapNiches, nicheEntry, type TenantNicheId, type VisitType } from "../../../shared/niches";

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

const BRAZIL_OFFSET_MIN = 180;
const DAY_MS = 86_400_000;

export type { VisitType };

export interface BookingSettings {
  enabled: boolean;
  /** O que vai no link (`/share/visita/{token}`). Nasce ao ligar pela primeira vez. */
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
  /**
   * Dias ou faixas em que a empresa não atende (feriado, férias, um compromisso
   * fora da Agenda). O link não oferece horário que encoste neles.
   */
  exceptions: BookingException[];
  /** Dono dos eventos criados na Agenda (quem configurou). */
  ownerUserId: string | null;
  updatedAt: string | null;
}

/** Um dia (ou uma faixa de um dia) sem atendimento, em horário de Brasília. */
export interface BookingException {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  allDay: boolean;
  /** Minutos do dia; null quando é o dia inteiro. */
  startMin: number | null;
  endMin: number | null;
  /** Só para a empresa (feriado, férias...). O cliente nunca vê. */
  note: string | null;
}

export const MAX_BOOKING_EXCEPTIONS = 100;

export type BookingRequestStatus = "pending" | "confirmed" | "declined";

/** Tipo de visita com que o link nasce, por nicho. A empresa edita depois. */
export const DEFAULT_VISIT_TYPE_BY_NICHE: Record<TenantNicheId, VisitType> = mapNiches(
  (entry) => entry.defaultVisitType,
);

/** Os tipos de visita começam pelo nicho, e a empresa edita. */
export function defaultVisitTypes(niche: unknown): VisitType[] {
  return [{ ...nicheEntry(niche).defaultVisitType }];
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
    exceptions: [],
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
    // Opcional: a tela publicada antes das exceções não manda o campo.
    exceptions: z
      .array(
        z
          .object({
            id: z.string().trim().max(40).optional(),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data da exceção inválida."),
            allDay: z.boolean(),
            startMin: minuteOfDay.nullable().optional(),
            endMin: minuteOfDay.nullable().optional(),
            note: z.string().trim().max(80).nullable().optional(),
          })
          .strict()
          .refine(
            (e) =>
              e.allDay ||
              (typeof e.startMin === "number" &&
                typeof e.endMin === "number" &&
                e.endMin > e.startMin &&
                e.startMin % 15 === 0 &&
                e.endMin % 15 === 0),
            { message: "Na exceção por horário, o fim precisa ser depois do início." },
          ),
      )
      .max(MAX_BOOKING_EXCEPTIONS, "São no máximo 100 exceções.")
      .optional(),
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

/** O que cada exceção ocupa: o dia inteiro ou a faixa, em Brasília. */
export function busyFromExceptions(exceptions: BookingException[] | undefined): BusyInterval[] {
  return (exceptions ?? []).map((e) =>
    e.allDay || e.startMin === null || e.endMin === null
      ? { startMs: brazilToUtcMs(e.date, 0), endMs: brazilToUtcMs(e.date, 24 * 60) }
      : { startMs: brazilToUtcMs(e.date, e.startMin), endMs: brazilToUtcMs(e.date, e.endMin) },
  );
}

/**
 * As exceções a guardar: sem as que já passaram, em ordem de data e hora, com
 * id estável. Faixa de "dia inteiro" perde os horários.
 */
export function normalizeExceptions(
  input: Array<{ id?: string; date: string; allDay: boolean; startMin?: number | null; endMin?: number | null; note?: string | null }>,
  nowMs: number,
): BookingException[] {
  const today = brazilDate(nowMs);
  const taken = new Set<string>();
  return input
    .filter((e) => e.date >= today)
    .map((e) => ({
      id: e.id?.trim() || "",
      date: e.date,
      allDay: e.allDay,
      startMin: e.allDay ? null : (e.startMin ?? null),
      endMin: e.allDay ? null : (e.endMin ?? null),
      note: e.note?.trim() || null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startMin ?? -1) - (b.startMin ?? -1))
    .map((e) => {
      let id = e.id && !taken.has(e.id) ? e.id : `exc_${e.date.replace(/-/g, "")}_${e.startMin ?? "dia"}`;
      for (let n = 2; taken.has(id); n++) id = `exc_${e.date.replace(/-/g, "")}_${e.startMin ?? "dia"}_${n}`;
      taken.add(id);
      return { ...e, id };
    });
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
  settings: Pick<BookingSettings, "days" | "startMin" | "endMin" | "leadHours" | "horizonDays"> & {
    exceptions?: BookingException[];
  };
  durationMin: number;
  busy: BusyInterval[];
  nowMs: number;
}): DaySlots[] {
  const { settings, durationMin, nowMs } = params;
  // As exceções da empresa ocupam como um compromisso da Agenda.
  const busy = [...params.busy, ...busyFromExceptions(settings.exceptions)];
  const earliestMs = nowMs + settings.leadHours * 3_600_000;
  const open = new Set(settings.days);
  const today = brazilDate(nowMs);
  const result: DaySlots[] = [];

  for (let offset = 0; offset < settings.horizonDays; offset++) {
    const date = addDaysToDate(today, offset);
    if (!open.has(weekdayOf(date))) continue;
    const starts: number[] = [];
    // O passo é a própria duração: visita de 1h é oferecida de hora em hora a
    // partir do início do expediente (08:00, 09:00, ...). Com passo fixo de
    // 30 min a visita de 1h aparecia também às 08:30, 09:30, e a agenda da
    // equipe virava uma colcha de meias horas. O horário ocupado sai da grade,
    // sem deslocar os outros.
    for (
      let start = settings.startMin;
      start + durationMin <= settings.endMin;
      start += durationMin
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
