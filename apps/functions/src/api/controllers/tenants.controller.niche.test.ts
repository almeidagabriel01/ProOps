/**
 * O nicho muda como a empresa inteira funciona: produto por unidade ou por
 * medida, proposta por sistema ou por ambiente, etapas de obra. Trocar deixa
 * os dados no formato do nicho antigo, entao so o superadmin troca, e so para
 * um nicho que existe. Antes o master trocava para qualquer texto, e um nicho
 * desconhecido virava automacao em silencio.
 */

const update = jest.fn(async (_data: Record<string, unknown>) => undefined);
jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ niche: "automacao_residencial" }) }),
        update: (data: Record<string, unknown>) => update(data),
      }),
    }),
  },
}));
let superAdmin = false;
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: async () => ({ tenantId: "t1", isMaster: true, isSuperAdmin: superAdmin }),
}));
jest.mock("../../lib/catalog-plan-guards", () => ({
  ...jest.requireActual("../../lib/catalog-plan-guards"),
  canCustomizeTheme: async () => true,
  canUsePdfEditor: async () => true,
}));

import { updateTenant } from "./tenants.controller";

async function call(body: Record<string, unknown>) {
  const r: Record<string, jest.Mock> = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  await updateTenant({ user: { uid: "u1" }, params: { id: "t1" }, body } as never, r as never);
  return r;
}

const written = () => update.mock.calls[0]?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  superAdmin = false;
});

describe("updateTenant: nicho", () => {
  it("master nao troca o nicho (o campo e ignorado, o resto grava)", async () => {
    const r = await call({ name: "Novo nome", niche: "cortinas" });
    expect(r.status).not.toHaveBeenCalled();
    expect(written()).toMatchObject({ name: "Novo nome" });
    expect(written()).not.toHaveProperty("niche");
  });

  it("master reenviando o nicho atual continua salvando", async () => {
    const r = await call({ name: "X", niche: "automacao_residencial" });
    expect(r.status).not.toHaveBeenCalled();
    expect(written()).not.toHaveProperty("niche");
  });

  it("superadmin troca para um nicho que existe", async () => {
    superAdmin = true;
    const r = await call({ niche: "cortinas" });
    expect(r.status).not.toHaveBeenCalled();
    expect(written()).toMatchObject({ niche: "cortinas" });
  });

  it.each(["", "decoracao", "CORTINAS", 42, null])(
    "superadmin com nicho invalido (%p) leva 400 e nada e gravado",
    async (niche) => {
      superAdmin = true;
      const r = await call({ niche });
      expect(r.status).toHaveBeenCalledWith(400);
      expect(update).not.toHaveBeenCalled();
    },
  );
});
