/**
 * Regressao: fiscal, Asaas, notificacoes e a funcao de PDF repetem o
 * `validateFirebaseIdToken` por rota, depois do `app.use` global. Refazer o
 * `req.user` desfazia a troca do "Acessar Painel" (`resolveImpersonation`), e
 * a tela de Notas Fiscais do superadmin agia no tenant dele, com erro no toast.
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

const status = jest.fn().mockReturnValue({ json: jest.fn(), send: jest.fn() });

beforeEach(() => {
  mockResolve.mockReset();
  mockResolve.mockResolvedValue({
    uid: "root",
    tenantId: "proprio",
    role: "SUPERADMIN",
    isSuperAdmin: true,
    hasRequiredClaims: true,
    mfaRequired: false,
  });
});

describe("validateFirebaseIdToken repetido na mesma request", () => {
  it("nao refaz o usuario que o Acessar Painel ja trocou de empresa", async () => {
    const swapped = {
      uid: "root",
      tenantId: "alvo",
      role: "SUPERADMIN",
      isSuperAdmin: true,
      impersonation: { originalTenantId: "proprio", targetTenantId: "alvo" },
    };
    const req = { method: "GET", path: "/v1/fiscal/settings", headers: {}, user: swapped } as unknown as Request;
    const next = jest.fn();
    await validateFirebaseIdToken(req, { status } as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
    expect(req.user).toBe(swapped);
  });

  it("nao refaz o membro visto no ver como membro", async () => {
    const asMember = { uid: "vendedor", tenantId: "alvo", role: "MEMBER", isSuperAdmin: false };
    const req = { method: "GET", path: "/v1/fiscal/invoices", headers: {}, user: asMember } as unknown as Request;
    await validateFirebaseIdToken(req, { status } as unknown as Response, jest.fn());
    expect(req.user).toBe(asMember);
  });

  it("sem usuario na request continua autenticando pelo token", async () => {
    const req = { method: "GET", path: "/v1/fiscal/settings", headers: {} } as unknown as Request;
    const next = jest.fn();
    await validateFirebaseIdToken(req, { status } as unknown as Response, next);
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect((req.user as unknown as Record<string, unknown>).tenantId).toBe("proprio");
    expect(next).toHaveBeenCalled();
  });
});
