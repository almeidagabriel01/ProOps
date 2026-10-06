/**
 * Contato que está numa proposta não se exclui: a proposta ficaria sem
 * cliente. A tela conferia antes de chamar a API, mas o backend não, então
 * uma chamada direta (ou a Lia) apagava o contato assim mesmo.
 */

import type { Request, Response } from "express";

let mockUsed = false;
const deletes: string[] = [];

jest.mock("../services/proposal-usage.service", () => ({
  isClientUsed: async () => mockUsed,
}));
jest.mock("../../init", () => {
  const ref = (path: string) => ({
    path,
    get: async () => ({
      exists: true,
      data: () => (path.startsWith("clients/") ? { tenantId: "t1", name: "Ana" } : {}),
    }),
  });
  return {
    db: {
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      runTransaction: async (fn: (t: unknown) => Promise<void>) =>
        fn({
          get: async () => ({ exists: false }),
          delete: (r: { path: string }) => deletes.push(r.path),
          update: () => undefined,
        }),
    },
  };
});
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => ({}), increment: (n: number) => ({ __inc: n }) },
  Timestamp: { now: () => "agora" },
}));
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: async () => ({
    tenantId: "t1",
    isMaster: true,
    isSuperAdmin: false,
    masterRef: { path: "users/master" },
  }),
  checkPermission: async () => true,
}));
jest.mock("../../lib/tenant-plan-policy", () => ({
  enforceTenantPlanLimit: async () => ({ allowed: true }),
  getTenantClientsUsage: async () => 0,
}));
jest.mock("../../lib/tenant-resolution", () => ({
  assertTenantExists: async () => undefined,
  auditSuperAdminCrossTenantWrite: () => undefined,
}));
jest.mock("../../lib/tenant-capabilities", () => ({ tenantHasCapability: async () => true }));
jest.mock("../../lib/security-observability", () => ({
  incrementSecurityCounter: jest.fn().mockResolvedValue(undefined),
  writeSecurityAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

import { deleteClient } from "./clients.controller";

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
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

const req = { params: { id: "c1" }, user: { uid: "u1", tenantId: "t1", role: "MASTER" } } as unknown as Request;

beforeEach(() => {
  deletes.length = 0;
});

describe("excluir contato", () => {
  it("contato numa proposta: 409 e nada é apagado, nem pelo dono", async () => {
    mockUsed = true;
    const res = fakeRes();
    await deleteClient(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("CLIENT_IN_USE");
    expect(deletes).toHaveLength(0);
  });

  it("contato fora de proposta é apagado", async () => {
    mockUsed = false;
    const res = fakeRes();
    await deleteClient(req, res);
    expect(res.statusCode).toBe(200);
    expect(deletes).toEqual(["clients/c1"]);
  });
});
