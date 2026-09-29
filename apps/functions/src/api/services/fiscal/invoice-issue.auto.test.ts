/**
 * O gatilho automatico roda fora de qualquer rota, entao o gate de plano nao
 * passa por ele. Sem a checagem, um tenant que perdeu o modulo fiscal
 * continuaria emitindo (e consumindo unidade paga do Focus) pela configuracao
 * antiga.
 */

const getFiscalSettings = jest.fn();
const resolveTenantCapabilities = jest.fn();
const getProposal = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get: getProposal }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("./fiscal-settings.service", () => ({ getFiscalSettings }));
jest.mock("./invoice-assembly.service", () => ({ assembleInvoices: jest.fn() }));
jest.mock("./invoice.service", () => ({
  listInvoicesByProposal: jest.fn(),
  createInvoice: jest.fn(),
  issueInvoice: jest.fn(),
}));
jest.mock("./invoice-quota.service", () => ({
  assertInvoiceQuota: jest.fn(),
  getInvoiceQuota: jest.fn(),
  remainingInvoices: jest.fn(),
}));
jest.mock("../../../lib/tenant-capabilities", () => ({
  resolveTenantCapabilities: (id: string) => resolveTenantCapabilities(id),
}));

import { contractInvoiceItems, tryAutoIssue } from "./invoice-issue.service";

beforeEach(() => {
  jest.clearAllMocks();
  getFiscalSettings.mockResolvedValue({ status: "ready", autoIssueRule: "on_payment" });
  getProposal.mockResolvedValue({ exists: false });
});

describe("tryAutoIssue", () => {
  it("nao emite para tenant sem o modulo fiscal (downgrade)", async () => {
    resolveTenantCapabilities.mockResolvedValue({ capabilities: { fiscal: false } });
    await tryAutoIssue("t1", "on_payment", { proposalId: "p1" });
    expect(getProposal).not.toHaveBeenCalled();
  });

  it("segue para a emissao quando o modulo esta ativo", async () => {
    resolveTenantCapabilities.mockResolvedValue({ capabilities: { fiscal: true } });
    await tryAutoIssue("t1", "on_payment", { proposalId: "p1" });
    expect(getProposal).toHaveBeenCalled();
  });
});

describe("mensalidade de contrato", () => {
  it("a regra geral de emissão não emite a mensalidade: quem decide é o contrato", async () => {
    resolveTenantCapabilities.mockResolvedValue({ capabilities: { fiscal: true } });
    getProposal.mockResolvedValue({ exists: true, data: () => ({ tenantId: "t1", serviceContractId: "ct1" }) });
    await tryAutoIssue("t1", "on_payment", { transactionId: "tx1" });
    // Só a leitura que descobre que é contrato; nada de montar nota.
    expect(getProposal).toHaveBeenCalledTimes(1);
  });

  it("lançamento comum segue o caminho de sempre", async () => {
    resolveTenantCapabilities.mockResolvedValue({ capabilities: { fiscal: true } });
    getProposal.mockResolvedValue({ exists: true, data: () => ({ tenantId: "t1", proposalId: "p1" }) });
    await tryAutoIssue("t1", "on_payment", { transactionId: "tx1" });
    expect(getProposal.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("contractInvoiceItems", () => {
  const lines = [
    { kind: "service", refId: "s1", name: "Monitoramento", quantity: 1, unitPrice: 100 },
    { kind: "service", refId: "s2", name: "App", quantity: 2, unitPrice: 14.5 },
    { kind: "product", refId: "p1", name: "Comodato do DVR", quantity: 1, unitPrice: 30 },
    { kind: "service", refId: null, name: "Avulso", quantity: 1, unitPrice: 5 },
  ];

  it("só as linhas de serviço do catálogo, somando o valor do lançamento", () => {
    const items = contractInvoiceItems(lines, 129);
    expect(items.map((i) => i.productId)).toEqual(["s1", "s2"]);
    expect(items.every((i) => i.itemType === "service")).toBe(true);
    expect(items.reduce((sum, i) => sum + Number(i.total), 0)).toBeCloseTo(129, 2);
  });

  it("valor diferente do contrato (reajuste depois de lançar) segue o lançamento, na proporção", () => {
    const items = contractInvoiceItems(lines, 100);
    expect(items.reduce((sum, i) => sum + Number(i.total), 0)).toBeCloseTo(100, 2);
    expect(Number(items[0].total)).toBeCloseTo(77.52, 2);
  });

  it("sem serviço do catálogo, nenhum item", () => {
    expect(contractInvoiceItems([lines[2], lines[3]], 35)).toEqual([]);
    expect(contractInvoiceItems(lines, 0)).toEqual([]);
  });
});
