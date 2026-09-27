/**
 * O nicho muda como a empresa inteira funciona: produto por unidade ou por
 * medida, proposta por sistema ou por ambiente, etapas de obra. Por isso ele
 * nasce no cadastro e nunca muda, nem pelo superadmin. Reenviar o valor atual
 * (o formulário da organização faz isso) continua salvando o resto.
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
  it("master reenviando o nicho atual continua salvando", async () => {
    const r = await call({ name: "X", niche: "automacao_residencial" });
    expect(r.status).not.toHaveBeenCalled();
    expect(written()).not.toHaveProperty("niche");
  });

  it("master pedindo outro nicho leva 409 e nada é gravado", async () => {
    const r = await call({ name: "Novo nome", niche: "cortinas" });
    expect(r.status).toHaveBeenCalledWith(409);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["cortinas", "seguranca_eletronica", "", "decoracao", null])(
    "superadmin também não troca o nicho (%p leva 409)",
    async (niche) => {
      superAdmin = true;
      const r = await call({ niche });
      expect(r.status).toHaveBeenCalledWith(409);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("superadmin reenviando o nicho atual salva o resto", async () => {
    superAdmin = true;
    const r = await call({ name: "X", niche: "automacao_residencial" });
    expect(r.status).not.toHaveBeenCalled();
    expect(written()).toMatchObject({ name: "X" });
    expect(written()).not.toHaveProperty("niche");
  });
});
