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

import { tryAutoIssue } from "./invoice-issue.service";

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
