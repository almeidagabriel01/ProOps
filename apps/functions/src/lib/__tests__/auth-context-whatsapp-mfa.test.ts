const mockVerifyIdToken = jest.fn();
const mockUserDoc = jest.fn();
const mockSessionVerified = jest.fn();

jest.mock("../../init", () => ({
  auth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    getUser: jest.fn(),
  },
  db: {
    collection: () => ({
      doc: () => ({ get: () => mockUserDoc() }),
    }),
  },
}));
jest.mock("../token-revocation", () => ({
  assertTokenNotRevoked: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../whatsapp-mfa-session", () => {
  const actual = jest.requireActual("../whatsapp-mfa-session");
  return {
    ...actual,
    isMfaSessionVerified: (...args: unknown[]) => mockSessionVerified(...args),
  };
});

import type { Request } from "express";
import { resolveAuthContextFromRequest } from "../auth-context";

const AUTH_TIME = 1_700_000_000;

function token(extra: Record<string, unknown> = {}) {
  return {
    uid: "u1",
    role: "MASTER",
    tenantId: "t1",
    auth_time: AUTH_TIME,
    firebase: {},
    ...extra,
  };
}

function userDoc(data: Record<string, unknown>) {
  return { exists: true, data: () => ({ tenantId: "t1", ...data }) };
}

const WITH_WHATSAPP = { whatsappMfaEnabled: true, whatsappMfaPhone: "5511999998888" };

function request(): Request {
  return { headers: { authorization: "Bearer x" } } as unknown as Request;
}

beforeEach(() => {
  mockVerifyIdToken.mockReset();
  mockUserDoc.mockReset();
  mockSessionVerified.mockReset();
});

describe("resolveAuthContextFromRequest: 2FA do WhatsApp", () => {
  it("marca pendente quem tem o WhatsApp ativo e não passou o código neste login", async () => {
    mockVerifyIdToken.mockResolvedValue(token());
    mockUserDoc.mockResolvedValue(userDoc(WITH_WHATSAPP));
    mockSessionVerified.mockResolvedValue(false);

    const ctx = await resolveAuthContextFromRequest(request());

    expect(ctx.authTime).toBe(AUTH_TIME);
    expect(ctx.whatsappMfaPending).toBe(true);
    expect(mockSessionVerified).toHaveBeenCalledWith("u1", AUTH_TIME);
  });

  it("libera o login que passou o código", async () => {
    mockVerifyIdToken.mockResolvedValue(token());
    mockUserDoc.mockResolvedValue(userDoc(WITH_WHATSAPP));
    mockSessionVerified.mockResolvedValue(true);

    const ctx = await resolveAuthContextFromRequest(request());

    expect(ctx.whatsappMfaPending).toBe(false);
  });

  it("libera TOTP, código de recuperação e o WhatsApp da tela do TOTP sem ler a marca", async () => {
    for (const extra of [
      { firebase: { sign_in_second_factor: "totp" } },
      { recovery_login: true },
      { whatsapp_login: true },
    ]) {
      mockVerifyIdToken.mockResolvedValue(token(extra));
      mockUserDoc.mockResolvedValue(userDoc(WITH_WHATSAPP));

      const ctx = await resolveAuthContextFromRequest(request());

      expect(ctx.whatsappMfaPending).toBe(false);
    }
    expect(mockSessionVerified).not.toHaveBeenCalled();
  });

  // O caminho quente: sem WhatsApp ativo, nenhuma leitura a mais.
  it("não consulta nada para quem não tem o WhatsApp ativo", async () => {
    mockVerifyIdToken.mockResolvedValue(token());
    mockUserDoc.mockResolvedValue(userDoc({}));

    const ctx = await resolveAuthContextFromRequest(request());

    expect(ctx.whatsappMfaPending).toBe(false);
    expect(mockSessionVerified).not.toHaveBeenCalled();
  });
});
