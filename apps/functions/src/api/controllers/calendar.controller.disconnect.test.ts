/**
 * Desconectar o Google Agenda tem que revogar o token e apagar a integracao
 * SEMPRE, mesmo quando a limpeza dos eventos sincronizados falha.
 *
 * Antes, a limpeza rodava primeiro e sem protecao: se ela lancasse (o caso
 * real era um lote com mais de 500 escritas), o handler devolvia 500 antes de
 * revogar, e o token seguia valido no Google com a integracao gravada. A
 * politica de privacidade promete o contrario.
 */

import type { Request, Response } from "express";

process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";
process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CALENDAR_REDIRECT_URI =
  "https://dev.example.com/api/backend/v1/calendar/google/callback";

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("../../lib/token-encryption", () => ({
  encryptToken: async (t: string) => `kms:v1:${t}`,
  decryptToken: async (c: string) => c.replace(/^kms:v1:/, ""),
  isEncryptedToken: (v: unknown) =>
    typeof v === "string" && v.startsWith("kms:v1:"),
}));

const mockRevokeToken = jest.fn();

jest.mock("@googleapis/calendar", () => ({
  auth: {
    OAuth2: jest.fn().mockImplementation(() => ({
      revokeToken: (t: string) => mockRevokeToken(t),
      setCredentials: jest.fn(),
    })),
  },
  calendar: jest.fn(() => ({ events: { get: jest.fn() } })),
}));

jest.mock("../../init", () => ({ db: { collection: jest.fn(), batch: jest.fn() } }));

import { disconnectGoogleCalendar } from "./calendar.controller";
import { db } from "../../init";

const collectionMock = db.collection as unknown as jest.Mock;
const batchMock = db.batch as unknown as jest.Mock;

const INTEGRATION = {
  tenantId: "tenant-1",
  provider: "google",
  enabled: true,
  calendarId: "primary",
  refreshTokenEnc: "kms:v1:refresh-abc",
};

function importedEvent(i: number) {
  return {
    id: `evt-${i}`,
    ref: { id: `evt-${i}` },
    data: () => ({
      tenantId: "tenant-1",
      googleSync: {
        provider: "google",
        externalEventId: `g-${i}`,
        origin: "imported",
      },
    }),
  };
}

function installDb(opts: { eventCount: number; commitFails?: boolean }) {
  const integrationDelete = jest.fn(async () => undefined);
  const integrationDoc = {
    id: "tenant-1",
    get: jest.fn(async () => ({ id: "tenant-1", data: () => INTEGRATION })),
    delete: integrationDelete,
  };
  const events = Array.from({ length: opts.eventCount }, (_, i) => importedEvent(i));

  const commits: number[] = [];
  batchMock.mockImplementation(() => {
    let ops = 0;
    return {
      delete: jest.fn(() => {
        ops += 1;
      }),
      set: jest.fn(() => {
        ops += 1;
      }),
      commit: jest.fn(async () => {
        if (opts.commitFails) throw new Error("commit failed");
        if (ops > 500) throw new Error("maximum 500 writes allowed per request");
        commits.push(ops);
      }),
    };
  });

  collectionMock.mockImplementation((name: string) => {
    if (name === "calendar_events") {
      const col: Record<string, unknown> = {
        get: jest.fn(async () => ({ empty: events.length === 0, docs: events })),
      };
      col.where = jest.fn(() => col);
      return col;
    }
    const col: Record<string, unknown> = {
      doc: jest.fn(() => integrationDoc),
      get: jest.fn(async () => ({
        empty: false,
        docs: [{ ref: { delete: integrationDelete } }],
      })),
    };
    col.where = jest.fn(() => col);
    return col;
  });

  return { integrationDelete, commits };
}

function makeReqRes() {
  const req = {
    user: { uid: "admin-1", tenantId: "tenant-1", role: "ADMIN" },
  } as unknown as Request;
  const res = {
    status: jest.fn(function status() {
      return res;
    }),
    json: jest.fn(function json() {
      return res;
    }),
    send: jest.fn(function send() {
      return res;
    }),
  } as unknown as Response;
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRevokeToken.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("disconnectGoogleCalendar", () => {
  it("apaga os eventos importados, revoga o token e apaga a integracao", async () => {
    const { integrationDelete, commits } = installDb({ eventCount: 3 });
    const { req, res } = makeReqRes();

    await disconnectGoogleCalendar(req, res);

    expect(commits).toEqual([3]);
    expect(mockRevokeToken).toHaveBeenCalledWith("refresh-abc");
    expect(integrationDelete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("agenda com mais de 500 eventos sincronizados e limpa em lotes", async () => {
    const { commits } = installDb({ eventCount: 1200 });
    const { req, res } = makeReqRes();

    await disconnectGoogleCalendar(req, res);

    expect(commits.reduce((a, b) => a + b, 0)).toBe(1200);
    expect(Math.max(...commits)).toBeLessThanOrEqual(500);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("revoga e apaga a integracao mesmo se a limpeza falhar", async () => {
    const { integrationDelete } = installDb({ eventCount: 3, commitFails: true });
    const { req, res } = makeReqRes();

    await disconnectGoogleCalendar(req, res);

    expect(mockRevokeToken).toHaveBeenCalledWith("refresh-abc");
    expect(integrationDelete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("apaga a integracao mesmo se o Google recusar a revogacao", async () => {
    const { integrationDelete } = installDb({ eventCount: 0 });
    mockRevokeToken.mockRejectedValue(new Error("invalid_token"));
    const { req, res } = makeReqRes();

    await disconnectGoogleCalendar(req, res);

    expect(integrationDelete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("membro que nao e admin nao desconecta", async () => {
    const { integrationDelete } = installDb({ eventCount: 3 });
    const { req, res } = makeReqRes();
    (req.user as { role: string }).role = "MEMBER";

    await disconnectGoogleCalendar(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockRevokeToken).not.toHaveBeenCalled();
    expect(integrationDelete).not.toHaveBeenCalled();
  });
});
