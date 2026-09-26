/**
 * Link de agendamento: o expediente é do administrador; responder pedido pede
 * a permissão de editar a Agenda; o robô que preenche o campo escondido não
 * gera pedido.
 */

const svc = {
  loadBookingSettings: jest.fn(),
  saveBookingSettings: jest.fn(),
  listPendingRequests: jest.fn(),
  confirmBookingRequest: jest.fn(),
  declineBookingRequest: jest.fn(),
  publicBookingView: jest.fn(),
  createBookingRequest: jest.fn(),
};

jest.mock("../services/booking/booking.service", () => {
  class BookingError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    BookingError,
    loadBookingSettings: (...a: unknown[]) => svc.loadBookingSettings(...a),
    saveBookingSettings: (...a: unknown[]) => svc.saveBookingSettings(...a),
    listPendingRequests: (...a: unknown[]) => svc.listPendingRequests(...a),
    confirmBookingRequest: (...a: unknown[]) => svc.confirmBookingRequest(...a),
    declineBookingRequest: (...a: unknown[]) => svc.declineBookingRequest(...a),
    publicBookingView: (...a: unknown[]) => svc.publicBookingView(...a),
    createBookingRequest: (...a: unknown[]) => svc.createBookingRequest(...a),
  };
});

const hasPagePermission = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => hasPagePermission(...a),
}));

import type { Request, Response } from "express";
import {
  confirmBooking,
  declineBooking,
  getBookingSettings,
  submitPublicBooking,
  updateBookingSettings,
} from "./booking.controller";

interface FakeResponse {
  statusCode: number;
  body: Record<string, unknown>;
  status: (code: number) => FakeResponse;
  json: (body: Record<string, unknown>) => FakeResponse;
}

function res(): FakeResponse & Response {
  const r: FakeResponse = {
    statusCode: 200,
    body: {},
    status: (code) => {
      r.statusCode = code;
      return r;
    },
    json: (body) => {
      r.body = body;
      return r;
    },
  };
  return r as FakeResponse & Response;
}

function req(role: string, extra: Partial<Request> = {}): Request {
  return {
    params: { id: "r1", token: "tok_abcdefgh" },
    body: {},
    user: { uid: "u1", role, tenantId: "t1" },
    ...extra,
  } as unknown as Request;
}

const validSettings = {
  enabled: true,
  days: [1, 2, 3, 4, 5],
  startMin: 540,
  endMin: 1080,
  leadHours: 24,
  horizonDays: 21,
  visitTypes: [{ label: "Medição", durationMin: 60 }],
};

const validRequest = {
  visitTypeId: "medicao",
  date: "2026-09-28",
  startMin: 540,
  name: "Ana Cliente",
  phone: "11999990000",
};

beforeEach(() => {
  jest.clearAllMocks();
  hasPagePermission.mockResolvedValue(true);
  svc.loadBookingSettings.mockResolvedValue({});
  svc.saveBookingSettings.mockResolvedValue({});
});

describe("expediente", () => {
  it("membro não lê nem grava", async () => {
    const leitura = res();
    await getBookingSettings(req("MEMBER"), leitura);
    expect(leitura.statusCode).toBe(403);

    const escrita = res();
    await updateBookingSettings(req("MEMBER", { body: validSettings }), escrita);
    expect(escrita.statusCode).toBe(403);
    expect(svc.saveBookingSettings).not.toHaveBeenCalled();
  });

  it("o dono grava", async () => {
    const r = res();
    await updateBookingSettings(req("MASTER", { body: validSettings }), r);
    expect(r.statusCode).toBe(200);
    expect(svc.saveBookingSettings).toHaveBeenCalledWith("t1", expect.objectContaining({ enabled: true }), "u1");
  });

  it("expediente inválido leva 400 antes de gravar", async () => {
    const r = res();
    await updateBookingSettings(req("MASTER", { body: { ...validSettings, endMin: 300 } }), r);
    expect(r.statusCode).toBe(400);
    expect(svc.saveBookingSettings).not.toHaveBeenCalled();
  });
});

describe("responder pedido", () => {
  it("sem permissão de editar a Agenda: 403, nada muda", async () => {
    hasPagePermission.mockResolvedValue(false);
    const r = res();
    await confirmBooking(req("MEMBER"), r);
    expect(r.statusCode).toBe(403);
    expect(svc.confirmBookingRequest).not.toHaveBeenCalled();
    expect(hasPagePermission).toHaveBeenCalledWith(expect.anything(), "calendar", "canEdit");
  });

  it("confirmar e recusar com recado chegam no serviço", async () => {
    await confirmBooking(req("MEMBER"), res());
    expect(svc.confirmBookingRequest).toHaveBeenCalledWith("t1", "r1", "u1");

    await declineBooking(req("MEMBER", { body: { message: "Só na semana que vem" } }), res());
    expect(svc.declineBookingRequest).toHaveBeenCalledWith("t1", "r1", "u1", "Só na semana que vem");
  });
});

describe("pedido público", () => {
  it("pedido válido é criado", async () => {
    const r = res();
    await submitPublicBooking(req("", { body: validRequest }), r);
    expect(r.statusCode).toBe(201);
    expect(svc.createBookingRequest).toHaveBeenCalledWith("tok_abcdefgh", expect.objectContaining({ name: "Ana Cliente" }));
  });

  it("robô que preenche o campo escondido recebe 'ok' e não gera pedido", async () => {
    const r = res();
    await submitPublicBooking(req("", { body: { ...validRequest, website: "spam.com" } }), r);
    expect(r.statusCode).toBe(201);
    expect(svc.createBookingRequest).not.toHaveBeenCalled();
  });

  it("sem telefone é recusado", async () => {
    const r = res();
    await submitPublicBooking(req("", { body: { ...validRequest, phone: "" } }), r);
    expect(r.statusCode).toBe(400);
  });

  it("horário ocupado volta como 409 com a mensagem para escolher outro", async () => {
    const { BookingError } = jest.requireMock("../services/booking/booking.service");
    svc.createBookingRequest.mockRejectedValue(new BookingError(409, "Esse horário acabou de ser ocupado. Escolha outro."));
    const r = res();
    await submitPublicBooking(req("", { body: validRequest }), r);
    expect(r.statusCode).toBe(409);
    expect(r.body.message).toMatch(/Escolha outro/);
  });
});
