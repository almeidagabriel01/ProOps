/**
 * Preferências de notificação: são da pessoa, gravadas por cima só nos tipos
 * enviados, e só aceitam tipos do catálogo.
 */

let stored: Record<string, unknown> | undefined;
const updates: Array<Record<string, unknown>> = [];

jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ data: () => stored }),
      }),
    }),
    runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
      fn({
        get: async () => ({ data: () => stored }),
        update: (_ref: unknown, data: Record<string, unknown>) => updates.push(data),
      }),
  },
}));

const invalidateTenantAudience = jest.fn();
jest.mock("../services/notification-audience", () => ({
  invalidateTenantAudience: (...a: unknown[]) => invalidateTenantAudience(...a),
}));
jest.mock("../services/notification.service", () => ({ NotificationService: {} }));
jest.mock("../../lib/auth-helpers", () => ({ resolveUserAndTenant: jest.fn() }));
jest.mock("../helpers/notification-scope", () => ({ resolveNotificationScopeFromRequest: jest.fn() }));

import type { Request, Response } from "express";
import { getPreferences, updatePreferences } from "./notifications.controller";

interface FakeResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => FakeResponse;
}

function res(): FakeResponse & Response {
  const r: FakeResponse = {
    statusCode: 0,
    body: undefined,
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

function req(body?: unknown): Request {
  return { body, user: { uid: "ana", tenantId: "t1" } } as unknown as Request;
}

beforeEach(() => {
  stored = undefined;
  updates.length = 0;
  jest.clearAllMocks();
});

it("sem nada gravado devolve vazio (os padrões moram no catálogo)", async () => {
  const r = res();
  await getPreferences(req(), r);
  expect(r.body).toEqual({ preferences: {} });
});

it("grava por cima só o tipo enviado e preserva os outros canais e tipos", async () => {
  stored = {
    preferences: {
      liaSoundsEnabled: true,
      notifications: { proposal_viewed: { email: true }, proposal_accepted: { inApp: true, email: true } },
    },
  };
  const r = res();
  await updatePreferences(req({ preferences: { proposal_accepted: { email: false } } }), r);

  expect(r.statusCode).toBe(200);
  expect(updates).toEqual([
    {
      "preferences.notifications": {
        proposal_viewed: { email: true },
        proposal_accepted: { inApp: true, email: false },
      },
    },
  ]);
  // A próxima notificação da empresa já respeita a escolha.
  expect(invalidateTenantAudience).toHaveBeenCalledWith("t1");
});

it("recusa tipo fora do catálogo", async () => {
  const r = res();
  await updatePreferences(req({ preferences: { inventado: { email: true } } }), r);
  expect(r.statusCode).toBe(400);
  expect(updates).toEqual([]);
});

it("recusa canal desconhecido e valor que não é booleano", async () => {
  const r1 = res();
  await updatePreferences(req({ preferences: { proposal_viewed: { sms: true } } }), r1);
  expect(r1.statusCode).toBe(400);

  const r2 = res();
  await updatePreferences(req({ preferences: { proposal_viewed: { email: "sim" } } }), r2);
  expect(r2.statusCode).toBe(400);
  expect(updates).toEqual([]);
});
