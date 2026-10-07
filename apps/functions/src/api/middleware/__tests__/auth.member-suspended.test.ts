/**
 * Membro suspenso pelo dono: a conta do Firebase fica desativada e as sessões
 * caem (com até 60s de cache da revogação). O status no doc do usuário fecha
 * essa janela em toda instância: a API recusa já na próxima request.
 */
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

async function run(userDoc: Record<string, unknown> | null) {
  mockResolve.mockResolvedValue({
    uid: "vend",
    tenantId: "t1",
    role: "MEMBER",
    hasRequiredClaims: true,
    mfaRequired: false,
    whatsappMfaPending: false,
    userDoc,
  });
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json, send: jest.fn() });
  const next = jest.fn();
  const req = { method: "GET", path: "/v1/proposals", headers: {} } as unknown as Request;
  await validateFirebaseIdToken(req, { status } as unknown as Response, next);
  return { status, json, next };
}

describe("validateFirebaseIdToken: membro suspenso", () => {
  it("recusa com 403 MEMBER_SUSPENDED", async () => {
    const { status, json, next } = await run({ status: "suspended" });
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: "MEMBER_SUSPENDED" }));
  });

  it("ativo, sem status, ou sem doc segue", async () => {
    for (const doc of [{ status: "active" }, {}, null]) {
      const { next } = await run(doc);
      expect(next).toHaveBeenCalled();
    }
  });
});
