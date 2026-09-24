/**
 * Cores personalizadas (Pro+) e o PDF padrao da empresa (editor de PDF) so
 * eram barrados na tela. O backend passou a recusar a MUDANCA sem a
 * capacidade, e so a mudanca: o formulario da organizacao reenvia a cor atual
 * em todo salvamento, e um tenant rebaixado precisa continuar salvando o nome.
 */

const update = jest.fn(async (_data: Record<string, unknown>) => undefined);
let stored: Record<string, unknown> = {};
jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => stored }),
        update: (data: Record<string, unknown>) => update(data),
      }),
    }),
  },
}));
let superAdmin = false;
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: async () => ({
    tenantId: "t1",
    isMaster: true,
    isSuperAdmin: superAdmin,
  }),
}));
const caps = { customTheme: false, pdfEditor: false };
jest.mock("../../lib/catalog-plan-guards", () => ({
  ...jest.requireActual("../../lib/catalog-plan-guards"),
  canCustomizeTheme: async () => caps.customTheme,
  canUsePdfEditor: async () => caps.pdfEditor,
}));

import { updateTenant } from "./tenants.controller";

function res() {
  const r: Record<string, jest.Mock> = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
}

async function call(body: Record<string, unknown>) {
  const r = res();
  await updateTenant({ user: { uid: "u1" }, params: { id: "t1" }, body } as never, r as never);
  return r;
}

beforeEach(() => {
  jest.clearAllMocks();
  superAdmin = false;
  caps.customTheme = false;
  caps.pdfEditor = false;
  stored = { primaryColor: "#123456", proposalDefaults: { theme: "classic" } };
});

it("Starter nao troca a cor", async () => {
  const r = await call({ name: "X", primaryColor: "#ff0000" });
  expect(r.status).toHaveBeenCalledWith(402);
  expect(update).not.toHaveBeenCalled();
});

it("Starter rebaixado salva o nome reenviando a cor que ja tinha", async () => {
  const r = await call({ name: "Novo nome", primaryColor: "#123456" });
  expect(r.status).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: "Novo nome" }));
});

it("Pro troca a cor", async () => {
  caps.customTheme = true;
  const r = await call({ primaryColor: "#ff0000" });
  expect(r.status).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalled();
});

it("sem editor de PDF nao grava um PDF padrao novo, mas reenviar o atual passa", async () => {
  expect((await call({ proposalDefaults: { theme: "bold" } })).status).toHaveBeenCalledWith(402);
  expect(
    (await call({ proposalDefaults: { theme: "classic" } })).status,
  ).not.toHaveBeenCalled();
});

it("super admin nao e barrado", async () => {
  superAdmin = true;
  const r = await call({ primaryColor: "#ff0000", proposalDefaults: { theme: "bold" } });
  expect(r.status).not.toHaveBeenCalled();
});
