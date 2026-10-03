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

type Filter = [string, string, unknown];

function matches(row: Row, [field, op, value]: Filter): boolean {
  return op === "in" ? (value as unknown[]).includes(row[field]) : row[field] === value;
}

function query(collection: string, filters: Filter[]) {
  return {
    where: (field: string, op: string, value: unknown) => query(collection, [...filters, [field, op, value]]),
    limit: () => query(collection, filters),
    get: async () => {
      const docs = Object.entries(store[collection] ?? {})
        .filter(([, row]) => filters.every((filter) => matches(row, filter)))
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
      where: (field: string, op: string, value: unknown) => query(name, [[field, op, value]]),
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

const ensureOrderToken = jest.fn(async () => "ostoken");
const ensurePmocToken = jest.fn(async () => "pmoctoken");
jest.mock("../field-service/field-service.service", () => ({
  ensureOrderShareToken: (...a: unknown[]) => (ensureOrderToken as jest.Mock)(...a),
  buildOrderShareUrl: (token: string) => `https://erp.test/share/os/${token}`,
}));
jest.mock("../field-service/pmoc-document", () => ({
  ensurePmocShareToken: (...a: unknown[]) => (ensurePmocToken as jest.Mock)(...a),
  buildPmocShareUrl: (token: string) => `https://erp.test/share/pmoc/${token}`,
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
    p_aberto: { tenantId: "alpha", clientId: "ana", status: "in_progress", title: "Montando" },
    p_coluna: { tenantId: "alpha", clientId: "ana", status: "col_neg", title: "Negociando" },
    p_bruno: { tenantId: "alpha", clientId: "bruno", status: "sent", title: "Do Bruno" },
    p_outra: { tenantId: "beta", clientId: "ana", status: "sent", title: "Outra empresa" },
  };
  store.transactions = {
    t_ana: { tenantId: "alpha", clientId: "ana", type: "income", status: "pending", amount: 50, dueDate: "2099-01-01" },
    t_comissao: { tenantId: "alpha", clientId: "ana", type: "income", isCommission: true, status: "pending" },
  };
  store.projects = { o_ana: { tenantId: "alpha", clientId: "ana", status: "active", stages: [] } };
  store.invoices = {};
  store.kanban_statuses = { col_neg: { tenantId: "alpha", category: "open", label: "Negociação" } };
  store.shared_proposals = {};
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

describe("proposta só depois de ir para o cliente", () => {
  it("em aberto nunca aparece, nem com link gerado", async () => {
    store.shared_proposals = { s1: { tenantId: "alpha", proposalId: "p_aberto", purpose: "external_share" } };
    const view = await publicPortalView(TOKEN);
    expect(view.proposals.map((p) => p.id)).not.toContain("p_aberto");
    await expect(openPortalItem(TOKEN, "proposal", "p_aberto")).rejects.toMatchObject({ status: 404 });
  });

  it("coluna própria entra quando a empresa já gerou o link para o cliente", async () => {
    expect((await publicPortalView(TOKEN)).proposals.map((p) => p.id)).not.toContain("p_coluna");
    store.shared_proposals = { s1: { tenantId: "alpha", proposalId: "p_coluna", purpose: "external_share" } };
    expect((await publicPortalView(TOKEN)).proposals.map((p) => p.id)).toContain("p_coluna");
    await expect(openPortalItem(TOKEN, "proposal", "p_coluna")).resolves.toEqual({
      url: "https://erp.test/share/prop-token",
    });
  });

  it.each([
    ["link interno do PDF", { tenantId: "alpha", proposalId: "p_coluna", purpose: "system_pdf_render" }],
    ["link de outra empresa", { tenantId: "beta", proposalId: "p_coluna", purpose: "external_share" }],
  ])("%s não conta como enviada", async (_name, link) => {
    store.shared_proposals = { s1: link };
    expect((await publicPortalView(TOKEN)).proposals.map((p) => p.id)).not.toContain("p_coluna");
    await expect(openPortalItem(TOKEN, "proposal", "p_coluna")).rejects.toMatchObject({ status: 404 });
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

describe("assistência técnica no portal", () => {
  beforeEach(() => {
    store.service_orders = {
      os_feita: {
        tenantId: "alpha", clientId: "ana", status: "completed", code: "OS-0001", title: "Limpeza",
        completedAt: "2026-09-10T14:00:00.000Z", technicianName: "Téo", signature: { name: "Ana" },
        technicianUids: ["uid-teo"],
      },
      os_marcada: {
        tenantId: "alpha", clientId: "ana", status: "scheduled", code: "OS-0002", title: "Preventiva",
        scheduledStart: "2099-01-10T11:00:00.000Z",
      },
      os_aberta: { tenantId: "alpha", clientId: "ana", status: "open", code: "OS-0003", title: "Chamado" },
      os_bruno: { tenantId: "alpha", clientId: "bruno", status: "completed", code: "OS-0004", title: "Do Bruno" },
    };
    store.service_contracts = {
      ct_pmoc: {
        tenantId: "alpha", clientId: "ana", status: "active", type: "pmoc", code: "CT-0001", title: "PMOC",
        monthlyAmount: 890, billingDay: 10, visitPlan: { enabled: true, nextVisitDate: "2099-01-10" },
        pmoc: { responsibleId: "rt1", items: [] }, wallet: "w1",
      },
      ct_rascunho: { tenantId: "alpha", clientId: "ana", status: "draft", type: "maintenance", title: "Rascunho" },
      ct_manut: { tenantId: "alpha", clientId: "ana", status: "active", type: "maintenance", code: "CT-0002", title: "Manutenção", monthlyAmount: 200, billingDay: 5 },
    };
  });

  it("sem o módulo no plano, a seção vem vazia", async () => {
    const view = await publicPortalView(TOKEN);
    expect(view.serviceOrders).toEqual([]);
    expect(view.contracts).toEqual([]);
  });

  it("com o módulo: o marcado e o feito, os contratos ativos com a mensalidade", async () => {
    capabilities["alpha:fieldService"] = true;
    const view = await publicPortalView(TOKEN);
    expect(view.serviceOrders.map((o) => [o.id, o.state])).toEqual([
      ["os_marcada", "scheduled"],
      ["os_feita", "completed"],
    ]);
    expect(view.contracts.map((c) => [c.id, c.monthlyAmount, c.isPmoc])).toEqual([
      ["ct_manut", 200, false],
      ["ct_pmoc", 890, true],
    ]);
    expect(JSON.stringify(view)).not.toMatch(/uid-teo|"w1"|responsibleId/);
  });

  it("abre o comprovante da OS do contato e o PMOC dele", async () => {
    capabilities["alpha:fieldService"] = true;
    expect(await openPortalItem(TOKEN, "service_order", "os_feita")).toEqual({ url: "https://erp.test/share/os/ostoken" });
    expect(ensureOrderToken).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "alpha", orderId: "os_feita" }));
    expect(await openPortalItem(TOKEN, "pmoc", "ct_pmoc")).toEqual({ url: "https://erp.test/share/pmoc/pmoctoken" });
  });

  it.each([
    ["OS de outro contato", "service_order", "os_bruno"],
    ["OS aberta sem data", "service_order", "os_aberta"],
    ["contrato que não é PMOC", "pmoc", "ct_manut"],
    ["contrato em rascunho", "pmoc", "ct_rascunho"],
  ] as const)("%s não abre", async (_label, kind, id) => {
    capabilities["alpha:fieldService"] = true;
    await expect(openPortalItem(TOKEN, kind, id)).rejects.toMatchObject({ status: 404 });
    expect(ensureOrderToken).not.toHaveBeenCalled();
    expect(ensurePmocToken).not.toHaveBeenCalled();
  });

  it("sem o módulo, nem o comprovante nem o PMOC abrem", async () => {
    await expect(openPortalItem(TOKEN, "service_order", "os_feita")).rejects.toMatchObject({ status: 404 });
    await expect(openPortalItem(TOKEN, "pmoc", "ct_pmoc")).rejects.toMatchObject({ status: 404 });
  });
});
