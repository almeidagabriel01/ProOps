import { randomBytes } from "node:crypto";
import { db } from "../../../init";
import { logger } from "../../../lib/logger";
import { resolveFrontendAppOrigin } from "../../../lib/frontend-app-url";
import { tenantHasCapability } from "../../../lib/tenant-capabilities";
import { sendEmail } from "../../../services/email/send-email";
import { renderBookingClientEmail } from "../../../services/email/templates/booking-client";
import {
  buildCalendarEventDocument,
  syncEventToGoogle,
  syncGoogleEventsToLocalCalendar,
  type CalendarEventDocument,
} from "../../controllers/calendar.controller";
import { NotificationService } from "../notification.service";
import {
  BOOKING_LOCKS_COLLECTION,
  BOOKING_REQUESTS_COLLECTION,
  BOOKING_SETTINGS_COLLECTION,
  brazilToUtcMs,
  busyFromCalendarEvent,
  computeAvailableSlots,
  defaultBookingSettings,
  formatMinutes,
  formatShortDate,
  visitTypeId,
  weekdayOf,
  type BookingRequestInput,
  type BookingSettings,
  type BusyInterval,
  type DaySlots,
  type VisitType,
} from "./booking-model";

const CALENDAR_EVENTS = "calendar_events";
const PENDING_COLOR = "#f59e0b";
const CONFIRMED_COLOR = "#0ea5e9";
const DAY_MS = 86_400_000;
const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export class BookingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function tenantNiche(tenantId: string): Promise<unknown> {
  const snap = await db.collection("tenants").doc(tenantId).get();
  return snap.data()?.niche ?? snap.data()?.tenantNiche;
}

export async function loadBookingSettings(tenantId: string): Promise<BookingSettings> {
  const [snap, niche] = await Promise.all([
    db.collection(BOOKING_SETTINGS_COLLECTION).doc(tenantId).get(),
    tenantNiche(tenantId),
  ]);
  const defaults = defaultBookingSettings(niche);
  const data = snap.data();
  if (!data) return defaults;
  return { ...defaults, ...data } as BookingSettings;
}

/** Grava o expediente. O token do link nasce na primeira vez que é ligado e não muda. */
export async function saveBookingSettings(
  tenantId: string,
  input: {
    enabled: boolean;
    days: number[];
    startMin: number;
    endMin: number;
    leadHours: number;
    horizonDays: number;
    visitTypes: Array<{ id?: string; label: string; durationMin: number }>;
  },
  uid: string,
): Promise<BookingSettings> {
  const current = await loadBookingSettings(tenantId);
  const taken = new Set<string>();
  const visitTypes: VisitType[] = input.visitTypes.map((t) => {
    const id = t.id && !taken.has(t.id) ? t.id : visitTypeId(t.label, taken);
    taken.add(id);
    return { id, label: t.label, durationMin: t.durationMin };
  });
  const next: BookingSettings = {
    ...current,
    ...input,
    visitTypes,
    publicToken:
      current.publicToken ?? (input.enabled ? randomBytes(12).toString("base64url") : null),
    ownerUserId: uid,
    updatedAt: new Date().toISOString(),
  };
  await db
    .collection(BOOKING_SETTINGS_COLLECTION)
    .doc(tenantId)
    .set({ ...next, tenantId });
  return next;
}

/**
 * Empresa por trás de um link público. Link desligado, empresa sem o plano ou
 * token inexistente dão o mesmo 404: quem tem o link não precisa saber qual.
 */
export async function resolveBookingToken(
  token: string,
): Promise<{ tenantId: string; settings: BookingSettings }> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) throw new BookingError(404, "Link de agendamento indisponível.");
  const snap = await db
    .collection(BOOKING_SETTINGS_COLLECTION)
    .where("publicToken", "==", token)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  const data = doc?.data();
  if (!doc || !data?.enabled) throw new BookingError(404, "Link de agendamento indisponível.");
  const tenantId = String(data.tenantId ?? doc.id);
  if (!(await tenantHasCapability(tenantId, "bookingLink"))) {
    throw new BookingError(404, "Link de agendamento indisponível.");
  }
  return { tenantId, settings: await loadBookingSettings(tenantId) };
}

/**
 * Compromissos da Agenda entre dois instantes. Olha um dia antes do início
 * porque a consulta é por `startMs`: um evento que começou antes e ainda está
 * acontecendo também ocupa o horário.
 */
async function loadBusy(tenantId: string, fromMs: number, toMs: number): Promise<BusyInterval[]> {
  const snap = await db
    .collection(CALENDAR_EVENTS)
    .where("tenantId", "==", tenantId)
    .where("startMs", ">=", fromMs - DAY_MS)
    .where("startMs", "<", toMs)
    .orderBy("startMs", "asc")
    .limit(2000)
    .get();
  return snap.docs
    .map((doc) => busyFromCalendarEvent(doc.data()))
    .filter((b): b is BusyInterval => b !== null);
}

export async function publicBookingView(token: string): Promise<{
  company: { name: string; logoUrl: string | null; primaryColor: string | null };
  visitTypes: VisitType[];
  slots: Record<string, DaySlots[]>;
}> {
  const { tenantId, settings } = await resolveBookingToken(token);
  const nowMs = Date.now();
  const toMs = nowMs + (settings.horizonDays + 1) * DAY_MS;

  // Traz para a Agenda o que mudou no Google Agenda (com o próprio limite de
  // frequência), para o link não oferecer um horário ocupado lá.
  try {
    await syncGoogleEventsToLocalCalendar({ tenantId, startMs: nowMs, endMs: toMs });
  } catch (error) {
    logger.warn("booking_google_inbound_failed", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const [busy, tenantSnap] = await Promise.all([
    loadBusy(tenantId, nowMs, toMs),
    db.collection("tenants").doc(tenantId).get(),
  ]);
  const tenant = tenantSnap.data() ?? {};
  const slots: Record<string, DaySlots[]> = {};
  for (const type of settings.visitTypes) {
    slots[type.id] = computeAvailableSlots({
      settings,
      durationMin: type.durationMin,
      busy,
      nowMs,
    });
  }
  return {
    company: {
      name: String(tenant.name || "Empresa"),
      logoUrl: (tenant.logoUrl as string | undefined) ?? null,
      primaryColor: (tenant.primaryColor as string | undefined) ?? null,
    },
    visitTypes: settings.visitTypes,
    slots,
  };
}

function describeWhen(date: string, startMin: number): string {
  return `${WEEKDAYS[weekdayOf(date)]}, ${formatShortDate(date)} às ${formatMinutes(startMin)}`;
}

/**
 * O pedido do cliente. Numa transação travada pelo dia: dois clientes pedindo
 * o mesmo horário ao mesmo tempo não viram duas visitas.
 */
export async function createBookingRequest(
  token: string,
  input: BookingRequestInput,
): Promise<{ id: string }> {
  const { tenantId, settings } = await resolveBookingToken(token);
  const visitType = settings.visitTypes.find((t) => t.id === input.visitTypeId);
  if (!visitType) throw new BookingError(400, "Tipo de visita inválido.");

  const startMs = brazilToUtcMs(input.date, input.startMin);
  const endMs = startMs + visitType.durationMin * 60_000;
  const nowMs = Date.now();

  // O horário tem que estar entre os oferecidos (expediente, antecedência,
  // horizonte); os compromissos são conferidos de novo dentro da transação.
  const offered = computeAvailableSlots({ settings, durationMin: visitType.durationMin, busy: [], nowMs })
    .find((d) => d.date === input.date)
    ?.starts.includes(input.startMin);
  if (!offered) throw new BookingError(409, "Esse horário não está mais disponível. Escolha outro.");

  const lockRef = db.collection(BOOKING_LOCKS_COLLECTION).doc(`${tenantId}_${input.date}`);
  const requestRef = db.collection(BOOKING_REQUESTS_COLLECTION).doc();
  const eventRef = db.collection(CALENDAR_EVENTS).doc();
  const label = visitType.label;

  await db.runTransaction(async (t) => {
    await t.get(lockRef);
    const events = await t.get(
      db
        .collection(CALENDAR_EVENTS)
        .where("tenantId", "==", tenantId)
        .where("startMs", ">=", startMs - DAY_MS)
        .where("startMs", "<", endMs)
        .orderBy("startMs", "asc")
        .limit(500),
    );
    const conflict = events.docs
      .map((doc) => busyFromCalendarEvent(doc.data()))
      .some((b) => b !== null && b.startMs < endMs && b.endMs > startMs);
    if (conflict) throw new BookingError(409, "Esse horário acabou de ser ocupado. Escolha outro.");

    const details = [
      `Telefone: ${input.phone}`,
      input.email ? `E-mail: ${input.email}` : null,
      input.address ? `Endereço: ${input.address}` : null,
      input.notes ? `Observações: ${input.notes}` : null,
      "Pedido pelo link de agendamento.",
    ]
      .filter(Boolean)
      .join("\n");

    const event: CalendarEventDocument = buildCalendarEventDocument({
      input: {
        title: `A confirmar: ${label}: ${input.name}`.slice(0, 140),
        description: details,
        location: input.address || null,
        status: "pending",
        color: PENDING_COLOR,
        isAllDay: false,
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
      },
      tenantId,
      ownerUserId: settings.ownerUserId || "booking",
      actingUserId: settings.ownerUserId || "booking",
    });

    t.set(eventRef, { ...event, bookingRequestId: requestRef.id });
    t.set(requestRef, {
      tenantId,
      eventId: eventRef.id,
      visitTypeId: visitType.id,
      visitTypeLabel: label,
      date: input.date,
      startMin: input.startMin,
      durationMin: visitType.durationMin,
      startsAt: new Date(startMs).toISOString(),
      endsAt: new Date(endMs).toISOString(),
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      address: input.address || null,
      notes: input.notes || null,
      status: "pending",
      createdAt: new Date(nowMs).toISOString(),
      decidedAt: null,
      decidedBy: null,
      declineMessage: null,
    });
    t.set(lockRef, { tenantId, date: input.date, updatedAt: new Date(nowMs).toISOString() });
  });

  try {
    await NotificationService.createNotification({
      tenantId,
      type: "booking_requested",
      title: "Pedido de visita",
      message: `${input.name} pediu ${label.toLocaleLowerCase("pt-BR")} para ${describeWhen(input.date, input.startMin)}. Confirme na Agenda.`,
      bookingRequestId: requestRef.id,
    });
  } catch (error) {
    logger.warn("booking_notification_failed", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { id: requestRef.id };
}

export interface PublicBookingRequest {
  id: string;
  eventId: string;
  visitTypeLabel: string;
  date: string;
  startMin: number;
  durationMin: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

export async function listPendingRequests(tenantId: string): Promise<PublicBookingRequest[]> {
  const snap = await db
    .collection(BOOKING_REQUESTS_COLLECTION)
    .where("tenantId", "==", tenantId)
    .where("status", "==", "pending")
    .limit(100)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<PublicBookingRequest, "id">) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}

async function notifyClient(
  tenantId: string,
  request: FirebaseFirestore.DocumentData,
  outcome: "confirmed" | "declined",
  message: string | null,
  rebookToken: string | null,
): Promise<void> {
  if (!request.email) return;
  try {
    const tenant = (await db.collection("tenants").doc(tenantId).get()).data() ?? {};
    const email = renderBookingClientEmail({
      companyName: String(tenant.name || "Empresa"),
      clientName: String(request.name || ""),
      visitLabel: String(request.visitTypeLabel || "Visita"),
      when: describeWhen(String(request.date), Number(request.startMin)),
      outcome,
      message,
      rebookUrl: rebookToken ? `${resolveFrontendAppOrigin()}/visita/${rebookToken}` : null,
    });
    await sendEmail({
      to: String(request.email),
      subject: email.subject,
      html: email.html,
      text: email.text,
      tenantId,
      type: `booking_${outcome}`,
    });
  } catch (error) {
    logger.warn("booking_client_email_failed", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * A empresa confirma: o evento vira compromisso de verdade (e vai para o
 * Google Agenda, se estiver ligado) e o cliente recebe a confirmação.
 */
export async function confirmBookingRequest(tenantId: string, requestId: string, uid: string): Promise<void> {
  const requestRef = db.collection(BOOKING_REQUESTS_COLLECTION).doc(requestId);
  const request = (await requestRef.get()).data();
  if (!request || request.tenantId !== tenantId) throw new BookingError(404, "Pedido não encontrado.");
  if (request.status !== "pending") throw new BookingError(409, "Esse pedido já foi respondido.");

  const eventRef = db.collection(CALENDAR_EVENTS).doc(String(request.eventId));
  const eventData = (await eventRef.get()).data() as CalendarEventDocument | undefined;
  if (eventData) {
    const confirmed: CalendarEventDocument = {
      ...eventData,
      title: `${request.visitTypeLabel}: ${request.name}`.slice(0, 140),
      status: "scheduled",
      color: CONFIRMED_COLOR,
      updatedByUserId: uid,
      updatedAt: new Date().toISOString(),
    };
    confirmed.googleSync = await syncEventToGoogle(eventRef.id, confirmed);
    await eventRef.set(confirmed, { merge: true });
  }

  await requestRef.update({ status: "confirmed", decidedAt: new Date().toISOString(), decidedBy: uid });
  await notifyClient(tenantId, request, "confirmed", null, null);
}

/**
 * A empresa recusa: o horário volta a ficar livre e o cliente recebe o recado
 * e o link para escolher outro horário.
 */
export async function declineBookingRequest(
  tenantId: string,
  requestId: string,
  uid: string,
  message: string | null,
): Promise<void> {
  const requestRef = db.collection(BOOKING_REQUESTS_COLLECTION).doc(requestId);
  const request = (await requestRef.get()).data();
  if (!request || request.tenantId !== tenantId) throw new BookingError(404, "Pedido não encontrado.");
  if (request.status !== "pending") throw new BookingError(409, "Esse pedido já foi respondido.");

  await db.collection(CALENDAR_EVENTS).doc(String(request.eventId)).delete();
  await requestRef.update({
    status: "declined",
    decidedAt: new Date().toISOString(),
    decidedBy: uid,
    declineMessage: message,
  });

  const settings = await loadBookingSettings(tenantId);
  await notifyClient(
    tenantId,
    request,
    "declined",
    message,
    settings.enabled ? settings.publicToken : null,
  );
}
