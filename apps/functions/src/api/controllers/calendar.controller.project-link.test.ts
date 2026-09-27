/**
 * Evento da Agenda ligado a outra tela (a etapa de uma obra, o pedido do link
 * de agendamento). A edição na Agenda regrava o documento sem merge, e antes
 * disso o vínculo sumia: mover a visita da obra na Agenda a desligava da obra.
 * Agora o vínculo atravessa a regravação, nunca vem do corpo da requisição, e
 * a data da etapa acompanha o evento.
 */
import type { Request, Response } from "express";

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
  isEncryptedToken: () => false,
}));
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: async () => false,
}));
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: async () => true,
}));

const mirror = jest.fn();
jest.mock("../services/projects/project-schedule-store", () => ({
  mirrorStageScheduleFromEvent: (...a: unknown[]) => mirror(...a),
}));

let events: Record<string, Record<string, unknown>>;
const sets: Array<{ id: string; data: Record<string, unknown> }> = [];
jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: (given?: string) => {
        const id = given ?? "novo";
        return {
          id,
          get: async () => ({ id, exists: !!events[id], data: () => events[id] }),
          set: async (data: Record<string, unknown>) => {
            events[id] = data;
            sets.push({ id, data });
          },
          delete: async () => {
            delete events[id];
          },
        };
      },
    }),
  },
}));

import {
  buildCalendarEventDocument,
  createCalendarEvent,
  deleteCalendarEvent,
  pickEventLinks,
  updateCalendarEvent,
} from "./calendar.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    send() {
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number };
}

function req(params: Record<string, string>, body: Record<string, unknown> = {}) {
  return { params, body, user: { uid: "u1", tenantId: "t1", role: "MEMBER" } } as unknown as Request;
}

const base = {
  tenantId: "t1",
  ownerUserId: "u1",
  createdByUserId: "u1",
  updatedByUserId: "u1",
  title: "Instalação: Casa",
  description: null,
  location: "Rua X, 123",
  status: "scheduled",
  color: "#0891b2",
  isAllDay: false,
  startsAt: "2026-10-20T11:00:00.000Z",
  endsAt: "2026-10-20T14:00:00.000Z",
  startDate: null,
  endDate: null,
  startMs: Date.parse("2026-10-20T11:00:00.000Z"),
  endMs: Date.parse("2026-10-20T14:00:00.000Z"),
  googleSync: { enabled: false, provider: "google", status: "disabled" },
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

beforeEach(() => {
  mirror.mockReset();
  mirror.mockResolvedValue(undefined);
  sets.length = 0;
  events = {
    obra: { ...base, projectId: "p1", projectStageId: "s1" },
    pedido: { ...base, title: "Visita", status: "pending", bookingRequestId: "req1" },
    solto: { ...base, title: "Reunião" },
  };
});

describe("pickEventLinks", () => {
  it("leva a obra e a etapa juntas, e o pedido de visita", () => {
    expect(pickEventLinks({ projectId: "p1", projectStageId: "s1" })).toEqual({ projectId: "p1", projectStageId: "s1" });
    expect(pickEventLinks({ bookingRequestId: "req1" })).toEqual({ bookingRequestId: "req1" });
    expect(pickEventLinks(null)).toEqual({});
    expect(pickEventLinks({ projectStageId: "s1" })).toEqual({});
  });

  it("buildCalendarEventDocument herda o vínculo do existente e ignora o do corpo", () => {
    const edited = buildCalendarEventDocument({
      input: { ...base, projectId: "invasor", projectStageId: "x" },
      tenantId: "t1",
      ownerUserId: "u1",
      actingUserId: "u1",
      existing: events.obra as never,
    });
    expect(edited).toMatchObject({ projectId: "p1", projectStageId: "s1" });

    const created = buildCalendarEventDocument({
      input: { ...base, projectId: "invasor" },
      tenantId: "t1",
      ownerUserId: "u1",
      actingUserId: "u1",
    });
    expect(created.projectId).toBeUndefined();
  });
});

describe("Agenda x obra", () => {
  it("arrastar a visita na Agenda mantém o vínculo e muda a data da etapa", async () => {
    const res = fakeRes();
    await updateCalendarEvent(
      req({ id: "obra" }, { startsAt: "2026-10-22T11:00:00.000Z", endsAt: "2026-10-22T13:00:00.000Z" }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(sets[0].data).toMatchObject({ projectId: "p1", projectStageId: "s1", startsAt: "2026-10-22T11:00:00.000Z" });
    expect(mirror).toHaveBeenCalledWith({
      tenantId: "t1",
      projectId: "p1",
      stageId: "s1",
      eventId: "obra",
      schedule: expect.objectContaining({ eventId: "obra", startsAt: "2026-10-22T11:00:00.000Z" }),
    });
  });

  it("cancelar na Agenda tira a data da etapa", async () => {
    await updateCalendarEvent(req({ id: "obra" }, { status: "canceled" }), fakeRes());
    expect(mirror).toHaveBeenCalledWith(expect.objectContaining({ eventId: "obra", schedule: null }));
  });

  it("excluir na Agenda tira a data da etapa", async () => {
    await deleteCalendarEvent(req({ id: "obra" }), fakeRes());
    expect(events.obra).toBeUndefined();
    expect(mirror).toHaveBeenCalledWith(expect.objectContaining({ eventId: "obra", schedule: null }));
  });

  it("evento sem obra não mexe em obra nenhuma", async () => {
    await updateCalendarEvent(req({ id: "solto" }, { title: "Reunião longa" }), fakeRes());
    expect(mirror).not.toHaveBeenCalled();
    expect(sets[0].data.projectId).toBeUndefined();
  });

  it("o corpo não consegue ligar um evento a uma obra", async () => {
    await updateCalendarEvent(req({ id: "solto" }, { projectId: "p1", projectStageId: "s1" }), fakeRes());
    expect(sets[0].data.projectId).toBeUndefined();
    await createCalendarEvent(req({}, { ...base, projectId: "p1", projectStageId: "s1" }), fakeRes());
    expect(sets[1].data.projectId).toBeUndefined();
    expect(mirror).not.toHaveBeenCalled();
  });

  it("editar o pedido do link de agendamento na Agenda não perde o bookingRequestId", async () => {
    await updateCalendarEvent(req({ id: "pedido" }, { title: "Visita técnica" }), fakeRes());
    expect(sets[0].data.bookingRequestId).toBe("req1");
  });

  it("falha ao espelhar não derruba a edição da Agenda", async () => {
    mirror.mockRejectedValueOnce(new Error("boom"));
    const res = fakeRes();
    await updateCalendarEvent(req({ id: "obra" }, { title: "Instalação: Casa (2ª visita)" }), res);
    expect(res.statusCode).toBe(200);
  });
});
