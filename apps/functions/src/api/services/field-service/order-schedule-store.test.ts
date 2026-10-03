/**
 * O espelho da data da OS: só a OS que ainda aponta para o evento muda, e OS
 * encerrada guarda a data como histórico.
 */
type Doc = Record<string, unknown>;
let orders: Record<string, Doc>;
const updates: Doc[] = [];

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({ id }),
    }),
    runTransaction: async (fn: (t: unknown) => Promise<void>) =>
      fn({
        get: async (ref: { id: string }) => ({ exists: !!orders[ref.id], data: () => orders[ref.id] }),
        update: (_ref: unknown, data: Doc) => updates.push(data),
      }),
  },
}));

import { mirrorOrderScheduleFromEvent } from "./order-schedule-store";

const START = Date.parse("2026-10-22T11:00:00.000Z");
const END = Date.parse("2026-10-22T13:00:00.000Z");

beforeEach(() => {
  updates.length = 0;
  orders = {
    o1: { tenantId: "t1", calendarEventId: "ev1", status: "scheduled" },
    aberta: { tenantId: "t1", calendarEventId: "ev2", status: "open" },
    concluida: { tenantId: "t1", calendarEventId: "ev3", status: "completed" },
  };
});

const run = (serviceOrderId: string, eventId: string, event: { startMs: number; endMs: number } | null, tenantId = "t1") =>
  mirrorOrderScheduleFromEvent({ tenantId, serviceOrderId, eventId, event });

it("o evento movido leva a data para a OS", async () => {
  await run("o1", "ev1", { startMs: START, endMs: END });
  expect(updates).toEqual([
    expect.objectContaining({ scheduledStart: "2026-10-22T11:00:00.000Z", scheduledEnd: "2026-10-22T13:00:00.000Z" }),
  ]);
});

it("OS aberta que ganha data pela Agenda passa a agendada", async () => {
  await run("aberta", "ev2", { startMs: START, endMs: END });
  expect(updates[0].status).toBe("scheduled");
});

it("evento apagado tira a data e volta a OS para aberta", async () => {
  await run("o1", "ev1", null);
  expect(updates).toEqual([
    expect.objectContaining({ scheduledStart: null, scheduledEnd: null, calendarEventId: null, status: "open" }),
  ]);
});

it("evento antigo, de outra empresa ou de OS encerrada não mexe em nada", async () => {
  await run("o1", "evento-velho", { startMs: START, endMs: END });
  await run("o1", "ev1", { startMs: START, endMs: END }, "t2");
  await run("concluida", "ev3", null);
  await run("inexistente", "ev9", null);
  expect(updates).toEqual([]);
});
