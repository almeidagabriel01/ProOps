/**
 * Ações finas de Carteiras: transferir, ajustar saldo e arquivar pedem a
 * chave própria (ausente, vale o Editar). Quem só edita nome e cor de uma
 * carteira não mexe no dinheiro dela.
 */
import type { Request, Response } from "express";

const mockPerms = new Map<string, boolean>();
jest.mock("../../lib/finance-helpers", () => {
  const { resolvePermissionKey } = jest.requireActual("../../shared/permission-catalog");
  return {
    checkFinancialPermission: async (_uid: string, pageId: string, key: string) => {
      const doc: Record<string, boolean> = {};
      for (const [k, v] of mockPerms) {
        const [page, field] = k.split(".");
        if (page === pageId) doc[field] = v;
      }
      if (!resolvePermissionKey(pageId, doc, key)) throw new Error("Sem permissão financeira.");
      return { tenantId: "t1", isMaster: false, isSuperAdmin: false };
    },
  };
});
jest.mock("../../lib/tenant-plan-policy", () => ({
  enforceTenantPlanLimit: jest.fn(),
  getTenantWalletsUsage: jest.fn(),
}));
const mockDbTouched = jest.fn();
jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      mockDbTouched(name);
      throw new Error("SEM_BANCO_NO_TESTE");
    },
    runTransaction: async () => {
      mockDbTouched("tx");
      throw new Error("SEM_BANCO_NO_TESTE");
    },
  },
}));

import { adjustBalance, transferValues, updateWallet } from "./wallets.controller";

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
  return res as unknown as Response & { statusCode: number; body: { message?: string } };
}

const req = (body: Record<string, unknown>, params: Record<string, string> = {}) =>
  ({ user: { uid: "m1", tenantId: "t1", role: "MEMBER" }, params, body }) as unknown as Request;

beforeEach(() => {
  mockPerms.clear();
  mockDbTouched.mockClear();
  for (const k of ["canView", "canCreate", "canEdit"]) mockPerms.set(`wallet.${k}`, true);
});

describe("carteiras: ações finas", () => {
  it("sem 'Transferir', a transferência é recusada antes de tocar no banco", async () => {
    mockPerms.set("wallet.transfer", false);
    const res = fakeRes();
    await transferValues(req({ fromWalletId: "w1", toWalletId: "w2", amount: 10 }), res);
    expect(res.statusCode).toBe(403);
    expect(mockDbTouched).not.toHaveBeenCalled();
  });

  it("sem 'Ajustar saldo', o ajuste é recusado", async () => {
    mockPerms.set("wallet.adjustBalance", false);
    const res = fakeRes();
    await adjustBalance(req({ walletId: "w1", amount: 10, description: "Conferência" }), res);
    expect(res.statusCode).toBe(403);
    expect(mockDbTouched).not.toHaveBeenCalled();
  });

  it("sem 'Arquivar', mudar o status é recusado", async () => {
    mockPerms.set("wallet.archive", false);
    const res = fakeRes();
    await updateWallet(req({ status: "archived" }, { id: "w1" }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/arquivar/);
  });

  it("com as chaves ausentes, quem edita segue transferindo e ajustando (chega ao banco)", async () => {
    const transfer = fakeRes();
    await transferValues(req({ fromWalletId: "w1", toWalletId: "w2", amount: 10 }), transfer);
    expect(transfer.statusCode).toBe(500);
    const adjust = fakeRes();
    await adjustBalance(req({ walletId: "w1", amount: 10, description: "Conferência" }), adjust);
    expect(adjust.statusCode).toBe(500);
    expect(mockDbTouched).toHaveBeenCalled();
  });
});
