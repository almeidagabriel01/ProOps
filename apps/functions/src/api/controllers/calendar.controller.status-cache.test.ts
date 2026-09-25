/**
 * O cache de "empresa sem Google conectado" e por instancia, e a invalidacao
 * ao conectar so alcanca a instancia que recebeu o callback.
 *
 * O caso real: o status respondido antes de conectar ficou em cache numa
 * instancia; o callback caiu em outra e gravou a integracao. De volta a tela,
 * os eventos do Google ja tinham sido importados e o card seguia dizendo
 * "Desconectado", logo depois do toast de sucesso. Desconectar tinha o mesmo
 * defeito, e respondia 204 sem revogar nada.
 *
 * Aqui a "outra instancia" e simulada gravando a integracao no banco SEM
 * chamar `invalidateGoogleIntegrationCache`.
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

import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  getGoogleIntegration,
} from "./calendar.controller";
import { db } from "../../init";

const collectionMock = db.collection as unknown as jest.Mock;

const INTEGRATION = {
  tenantId: "tenant-1",
  provider: "google",
  enabled: true,
  calendarId: "primary",
  connectedEmail: "dono@empresa.com.br",
  refreshTokenEnc: "kms:v1:refresh-abc",
};

let stored: typeof INTEGRATION | undefined;
const integrationDelete = jest.fn(async () => {
  stored = undefined;
});

function installDb() {
  const integrationDoc = {
    get: jest.fn(async () => ({ id: "tenant-1", data: () => stored })),
    delete: integrationDelete,
  };
  collectionMock.mockImplementation((name: string) => {
    if (name === "calendar_events") {
      const col: Record<string, unknown> = {
        get: jest.fn(async () => ({ empty: true, docs: [] })),
      };
      col.where = jest.fn(() => col);
      return col;
    }
    const col: Record<string, unknown> = {
      doc: jest.fn(() => integrationDoc),
      get: jest.fn(async () =>
        stored
          ? { empty: false, docs: [{ ref: { delete: integrationDelete } }] }
          : { empty: true, docs: [] },
      ),
    };
    col.where = jest.fn(() => col);
    return col;
  });
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

async function primeNegativeCache() {
  stored = undefined;
  // Leitura comum (a da sincronizacao de eventos) guarda o "nao conectado".
  expect(await getGoogleIntegration("tenant-1")).toBeNull();
  // Outra instancia recebe o callback e grava, sem invalidar o cache daqui.
  stored = { ...INTEGRATION };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRevokeToken.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  installDb();
});

describe("cache negativo da integracao Google", () => {
  it("status enxerga a integracao gravada por outra instancia", async () => {
    await primeNegativeCache();
    const { req, res } = makeReqRes();

    await getGoogleCalendarStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ connected: true, email: "dono@empresa.com.br" }),
    );
  });

  it("desconectar revoga e apaga mesmo com o cache dizendo 'nao conectado'", async () => {
    await primeNegativeCache();
    const { req, res } = makeReqRes();

    await disconnectGoogleCalendar(req, res);

    expect(mockRevokeToken).toHaveBeenCalledWith("refresh-abc");
    expect(integrationDelete).toHaveBeenCalled();
  });

  it("leitura comum continua usando o cache (economia de leitura mantida)", async () => {
    await primeNegativeCache();

    expect(await getGoogleIntegration("tenant-1")).toBeNull();
  });

  it("status sem integracao nenhuma continua 'desconectado'", async () => {
    stored = undefined;
    const { req, res } = makeReqRes();

    await getGoogleCalendarStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ connected: false }),
    );
  });
});
