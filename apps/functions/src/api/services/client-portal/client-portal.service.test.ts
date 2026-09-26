/**
 * O token do portal abre, sem login, tudo o que é de UM contato. Estes testes
 * cuidam das duas fronteiras: o link só vale com o plano e com o contato
 * existindo, e um item só abre se for daquele contato e daquela empresa.
 */

type Row = Record<string, unknown>;
const store: Record<string, Record<string, Row>> = {};
const capabilities: Record<string, boolean> = {};

function snap(collection: string, id: string) {
  const data = store[collection]?.[id];
  return { id, exists: data !== undefined, data: () => data, ref: { update: jest.fn(async () => undefined) } };
}

function query(collection: string, filters: Array<[string, unknown]>) {
  return {
    where: (field: string, _op: string, value: unknown) => query(collection, [...filters, [field, value]]),
    limit: () => query(collection, filters),
    get: async () => {
      const docs = Object.entries(store[collection] ?? {})
        .filter(([, row]) => filters.every(([field, value]) => row[field] === value))
        .map(([id]) => snap(collection, id));
      return { docs, empty: docs.length === 0 };
    },
  };
}

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => snap(name, id),
        update: jest.fn(async () => undefined),
      }),
      where: (field: string, _op: string, value: unknown) => query(name, [[field, value]]),
    }),
  },
}));
jest.mock("../../../lib/frontend-app-url", () => ({ resolveFrontendAppOrigin: () => "https://erp.test" }));
jest.mock("../../../lib/tenant-capabilities", () => ({
  tenantHasCapability: async (tenantId: string, capability: string) =>
    capabilities[`${tenantId}:${capability}`] === true,
}));

const createProposalLink = jest.fn(async () => ({ shareUrl: "https://erp.test/share/prop-token" }));
const getTxInfo = jest.fn();
const createTxLink = jest.fn(async () => ({ shareUrl: "https://erp.test/share/transaction/novo" }));
const createProjectLink = jest.fn(async () => ({ url: "https://erp.test/share/project/obra", sharedProjectId: "s" }));

jest.mock("../shared-proposal.service", () => ({
  SharedProposalService: { createShareLink: (...a: unknown[]) => (createProposalLink as jest.Mock)(...a) },
}));
jest.mock("../shared-transactions.service", () => ({
  SharedTransactionService: {
    getShareLinkInfo: (...a: unknown[]) => getTxInfo(...a),
    createShareLink: (...a: unknown[]) => (createTxLink as jest.Mock)(...a),
  },
}));
jest.mock("../projects/project.service", () => ({
  createProjectShareLink: (...a: unknown[]) => (createProjectLink as jest.Mock)(...a),
}));

import { openPortalItem, publicPortalView } from "./client-portal.service";

const TOKEN = "tokentokentoken123456";

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(store)) delete store[key];
  for (const key of Object.keys(capabilities)) delete capabilities[key];
  capabilities["alpha:clientPortal"] = true;
  store.client_portal_links = { alpha_ana: { tenantId: "alpha", clientId: "ana", token: TOKEN } };
  store.tenants = { alpha: { name: "Casa Viva", asaasEnabled: true } };
  store.clients = {
    ana: { tenantId: "alpha", name: "Ana Ribeiro" },
    bruno: { tenantId: "alpha", name: "Bruno" },
  };
  store.proposals = {
    p_ana: { tenantId: "alpha", clientId: "ana", status: "sent", title: "Casa", totalValue: 100 },
    p_rascunho: { tenantId: "alpha", clientId: "ana", status: "draft", title: "Rascunho" },
    p_bruno: { tenantId: "alpha", clientId: "bruno", status: "sent", title: "Do Bruno" },
    p_outra: { tenantId: "beta", clientId: "ana", status: "sent", title: "Outra empresa" },
  };
  store.transactions = {
    t_ana: { tenantId: "alpha", clientId: "ana", type: "income", status: "pending", amount: 50, dueDate: "2099-01-01" },
    t_comissao: { tenantId: "alpha", clientId: "ana", type: "income", isCommission: true, status: "pending" },
  };
  store.projects = { o_ana: { tenantId: "alpha", clientId: "ana", status: "active", stages: [] } };
  store.invoices = {};
  store.kanban_statuses = {};
});

describe("abrir o portal", () => {
  it("mostra só o que é do contato, sem rascunho nem comissão", async () => {
    const view = await publicPortalView(TOKEN);
    expect(view.client.firstName).toBe("Ana");
    expect(view.proposals.map((p) => p.id)).toEqual(["p_ana"]);
    expect(view.payments.map((p) => p.id)).toEqual(["t_ana"]);
    expect(view.projects.map((p) => p.id)).toEqual(["o_ana"]);
    // Abrir o portal não cria link nenhum.
    expect(createProposalLink).not.toHaveBeenCalled();
  });

  it("pagamento online só com a capacidade E o Asaas ligado", async () => {
    expect((await publicPortalView(TOKEN)).canPayOnline).toBe(false);
    capabilities["alpha:onlinePayments"] = true;
    expect((await publicPortalView(TOKEN)).canPayOnline).toBe(true);
    store.tenants.alpha.asaasEnabled = false;
    expect((await publicPortalView(TOKEN)).canPayOnline).toBe(false);
  });

  it.each([
    ["empresa sem o plano", () => (capabilities["alpha:clientPortal"] = false)],
    ["contato apagado", () => delete store.clients.ana],
    ["contato de outra empresa", () => (store.clients.ana = { tenantId: "beta", name: "Ana" })],
    ["link desligado", () => delete store.client_portal_links.alpha_ana],
  ])("%s: 404", async (_name, arrange) => {
    arrange();
    await expect(publicPortalView(TOKEN)).rejects.toMatchObject({ status: 404 });
  });

  it("token malformado nem consulta", async () => {
    await expect(publicPortalView("../x")).rejects.toMatchObject({ status: 404 });
  });
});

describe("abrir um item", () => {
  it("proposta do contato: link criado só no clique", async () => {
    await expect(openPortalItem(TOKEN, "proposal", "p_ana")).resolves.toEqual({
      url: "https://erp.test/share/prop-token",
    });
    expect(createProposalLink).toHaveBeenCalledWith("p_ana", "alpha", "client_portal");
  });

  it.each([
    ["proposal", "p_bruno", "de outro contato"],
    ["proposal", "p_outra", "de outra empresa"],
    ["proposal", "p_rascunho", "rascunho"],
    ["payment", "t_comissao", "comissão"],
    ["proposal", "nao_existe", "inexistente"],
  ] as const)("%s %s (%s): 404 e nenhum link criado", async (kind, id, _motivo) => {
    await expect(openPortalItem(TOKEN, kind, id)).rejects.toMatchObject({ status: 404 });
    expect(createProposalLink).not.toHaveBeenCalled();
    expect(createTxLink).not.toHaveBeenCalled();
  });

  it("pagamento com link válido reaproveita sem mexer na validade", async () => {
    getTxInfo.mockResolvedValue({ exists: true, shareUrl: "https://erp.test/share/transaction/antigo", expiresAt: null });
    await expect(openPortalItem(TOKEN, "payment", "t_ana")).resolves.toEqual({
      url: "https://erp.test/share/transaction/antigo",
    });
    expect(createTxLink).not.toHaveBeenCalled();
  });

  it("pagamento sem link, ou com link vencido, cria um de 30 dias", async () => {
    getTxInfo.mockResolvedValue({ exists: true, shareUrl: "x", expiresAt: "2000-01-01T00:00:00.000Z" });
    await openPortalItem(TOKEN, "payment", "t_ana");
    expect(createTxLink).toHaveBeenCalledWith("t_ana", "alpha", "client_portal", 30);
  });

  it("obra do contato", async () => {
    await expect(openPortalItem(TOKEN, "project", "o_ana")).resolves.toEqual({
      url: "https://erp.test/share/project/obra",
    });
  });

  it("item com barra no id não vira caminho", async () => {
    await expect(openPortalItem(TOKEN, "proposal", "a/b")).rejects.toMatchObject({ status: 404 });
  });
});
