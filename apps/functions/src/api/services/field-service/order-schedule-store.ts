import { db } from "../../../init";
import { SERVICE_ORDERS_COLLECTION } from "./field-service-model";

/**
 * A data da OS mora no evento da Agenda (`calendar_events.serviceOrderId`),
 * como a visita da obra. Arrastar o evento na Agenda, mudá-lo no Google ou
 * apagá-lo regrava a agenda da OS por aqui.
 *
 * Só mexe se a OS ainda aponta para esse evento (`calendarEventId`): um evento
 * antigo, de uma OS já remarcada, não sobrescreve a data atual. OS encerrada
 * também não muda: a data dela é histórico.
 */
export async function mirrorOrderScheduleFromEvent(params: {
  tenantId: string;
  serviceOrderId: string;
  eventId: string;
  /** Evento como ficou; null quando foi apagado ou cancelado. */
  event: { startMs: number; endMs: number } | null;
}): Promise<void> {
  const ref = db.collection(SERVICE_ORDERS_COLLECTION).doc(params.serviceOrderId);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== params.tenantId) return;
    if (data.calendarEventId !== params.eventId) return;
    if (data.status === "completed" || data.status === "canceled") return;
    const now = new Date().toISOString();
    if (!params.event) {
      t.update(ref, {
        scheduledStart: null,
        scheduledEnd: null,
        calendarEventId: null,
        ...(data.status === "scheduled" ? { status: "open" } : {}),
        updatedAt: now,
      });
      return;
    }
    t.update(ref, {
      scheduledStart: new Date(params.event.startMs).toISOString(),
      scheduledEnd: new Date(params.event.endMs).toISOString(),
      ...(data.status === "open" ? { status: "scheduled" } : {}),
      updatedAt: now,
    });
  });
}
