const mockResolve = jest.fn();
jest.mock("../../../lib/auth-context", () => ({
  resolveAuthContextFromRequest: (...args: unknown[]) => mockResolve(...args),
  shouldRequireStrictClaimsInMiddleware: () => false,
}));
jest.mock("../../../lib/security-observability", () => ({
  buildSecurityLogContext: () => ({}),
  incrementSecurityCounter: jest.fn(),
  logSecurityEvent: jest.fn(),
  writeSecurityAuditEvent: jest.fn(),
}));
jest.mock("../../../init", () => ({ db: {}, auth: {} }));

import type { Request, Response } from "express";
import { validateFirebaseIdToken } from "../auth";

const CONTEXT = {
  uid: "u1",
  tenantId: "t1",
  role: "MASTER",
  hasRequiredClaims: true,
  mfaRequired: false,
};

async function run(path: string, whatsappMfaPending: boolean) {
  mockResolve.mockResolvedValue({ ...CONTEXT, whatsappMfaPending });
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json, send: jest.fn() });
  const next = jest.fn();
  const req = { method: "GET", path, headers: {} } as unknown as Request;
  await validateFirebaseIdToken(req, { status } as unknown as Response, next);
  return { status, json, next };
}

describe("validateFirebaseIdToken: 2FA do WhatsApp", () => {
  // Regressão: um ID token obtido só com a senha passava por toda a API.
  it("barra com 403 o login que ainda deve o código", async () => {
    const { status, json, next } = await run("/v1/proposals", true);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "WHATSAPP_MFA_REQUIRED" }),
    );
  });

  it("barra desligar o 2FA, recadastrar o número e gerar códigos sem o código", async () => {
    for (const path of [
      "/v1/auth/whatsapp-mfa/disable",
      "/v1/auth/recovery-codes/generate",
      "/v1/auth/whatsapp-mfa/enroll/start",
    ]) {
      const { next, status } = await run(path, true);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
    }
  });

  it("deixa passar as rotas que o login usa antes do código", async () => {
    for (const path of [
      "/v1/auth/whatsapp-mfa/challenge",
      "/v1/auth/whatsapp-mfa/verify",
      "/v1/auth/recovery-codes/verify",
    ]) {
      const { next } = await run(path, true);
      expect(next).toHaveBeenCalled();
    }
  });

  it("deixa passar o login já verificado", async () => {
    const { next } = await run("/v1/proposals", false);
    expect(next).toHaveBeenCalled();
  });
});
