/**
 * O seletor de carteira da proposta e do contrato lia `wallets` pelo SDK, com
 * o saldo junto. As rules passaram a exigir Lançamentos ou Carteiras para ler
 * o documento, então o seletor usa esta rota, que devolve só o nome.
 */

import type { Request, Response } from "express";

const queries: Array<{ tenantId: string }> = [];
let walletDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      if (name !== "wallets") throw new Error(`coleção inesperada: ${name}`);
      return {
        where: (_field: string, _op: string, tenantId: string) => ({
          limit: () => ({
            get: async () => {
              queries.push({ tenantId });
              return {
                docs: walletDocs
                  .filter((d) => d.data.tenantId === tenantId)
                  .map((d) => ({ id: d.id, data: () => d.data })),
              };
            },
          }),
        }),
      };
    },
  },
}));

jest.mock("../../lib/tenant-doc-cache", () => ({
  getTenantDocCached: async () => ({ data: { niche: "cortinas" } }),
}));

jest.mock("../../lib/logger", () => ({ logger: { error: jest.fn() } }));

import { listWalletOptions, toWalletOptions } from "./wallet-options.controller";
import { demoTenantIdForNiche } from "../../shared/demo-tenant";

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { json, status } as unknown as Response, json, status };
}

beforeEach(() => {
  queries.length = 0;
  walletDocs = [
    { id: "w2", data: { tenantId: "t1", name: "Caixa", balance: 98765, isDefault: true, status: "active" } },
    { id: "w1", data: { tenantId: "t1", name: "Banco Inter", balance: 12345, status: "archived" } },
    { id: "w3", data: { tenantId: "t2", name: "Outra empresa", balance: 1 } },
  ];
});

describe("toWalletOptions", () => {
  it("devolve id, nome, situação e a padrão, ordenado pelo nome, sem saldo", () => {
    const options = toWalletOptions(walletDocs.filter((d) => d.data.tenantId === "t1"));
    expect(options).toEqual([
      { id: "w1", name: "Banco Inter", isDefault: false, status: "archived" },
      { id: "w2", name: "Caixa", isDefault: true, status: "active" },
    ]);
    expect(JSON.stringify(options)).not.toContain("balance");
  });
});

describe("GET /v1/wallets/options", () => {
  it("membro sem acesso ao financeiro recebe as carteiras da empresa dele, sem saldo", async () => {
    const { res, json } = makeRes();
    await listWalletOptions(
      { user: { uid: "u1", tenantId: "t1", role: "MEMBER" } } as unknown as Request,
      res,
    );

    expect(queries).toEqual([{ tenantId: "t1" }]);
    const body = json.mock.calls[0][0] as { wallets: Array<Record<string, unknown>> };
    expect(body.wallets.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(JSON.stringify(body)).not.toContain("98765");
  });

  it("conta free lê o tenant de demonstração do nicho dela", async () => {
    const { res } = makeRes();
    await listWalletOptions(
      { user: { uid: "f1", tenantId: "t-free", role: "free" } } as unknown as Request,
      res,
    );
    expect(queries).toEqual([{ tenantId: demoTenantIdForNiche("cortinas") }]);
  });

  it("sem tenant nas claims, 403", async () => {
    const { res, status } = makeRes();
    await listWalletOptions({ user: { uid: "u1", role: "MEMBER" } } as unknown as Request, res);
    expect(status).toHaveBeenCalledWith(403);
  });
});
