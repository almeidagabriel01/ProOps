/**
 * A nota da mensalidade sai uma vez só, quando o lançamento do contrato vira
 * pago e o contrato pede nota. Qualquer caminho de baixa passa pelo gatilho
 * dos lançamentos; a trava por lançamento segura a entrega repetida.
 */

type Doc = Record<string, unknown>;
let docs: Record<string, Doc>;
const claims = new Set<string>();
const issueFromTransaction = jest.fn();
let fiscalCapability = true;
let fiscalSettings: Doc | null = { status: "ready" };

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: Boolean(docs[`${name}/${id}`]), data: () => docs[`${name}/${id}`] }),
        create: async () => {
          if (claims.has(id)) {
            const error = new Error("6 ALREADY_EXISTS: Document already exists") as Error & { code: number };
            error.code = 6;
            throw error;
          }
          claims.add(id);
        },
      }),
    }),
  },
}));
jest.mock("../../../lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../../../lib/tenant-capabilities", () => ({
  resolveTenantCapabilities: async () => ({ capabilities: { fiscal: fiscalCapability } }),
}));
jest.mock("../fiscal/fiscal-settings.service", () => ({ getFiscalSettings: async () => fiscalSettings }));
jest.mock("../fiscal/invoice-issue.service", () => ({
  issueFromTransaction: (...args: unknown[]) => issueFromTransaction(...args),
}));

import { issueContractChargeInvoice } from "./contract-invoice";
import { becamePaidContractCharge } from "./contract-model";

const PAID = { tenantId: "t1", serviceContractId: "ct1", status: "paid", amount: 129 };

beforeEach(() => {
  docs = { "service_contracts/ct1": { tenantId: "t1", issueNfse: true } };
  claims.clear();
  issueFromTransaction.mockReset();
  issueFromTransaction.mockResolvedValue({ invoices: [{ id: "inv1" }], gaps: [] });
  fiscalCapability = true;
  fiscalSettings = { status: "ready" };
});

describe("becamePaidContractCharge", () => {
  it("só a passagem para pago de um lançamento de contrato", () => {
    expect(becamePaidContractCharge({ ...PAID, status: "pending" }, PAID)).toBe(true);
    expect(becamePaidContractCharge(undefined, PAID)).toBe(true);
    expect(becamePaidContractCharge(PAID, { ...PAID, amount: 130 })).toBe(false);
    expect(becamePaidContractCharge({ ...PAID, status: "pending" }, { ...PAID, status: "overdue" })).toBe(false);
    expect(becamePaidContractCharge({ status: "pending" }, { status: "paid", proposalId: "p1" })).toBe(false);
  });
});

describe("issueContractChargeInvoice", () => {
  it("emite uma vez; a segunda entrega do gatilho encontra a trava", async () => {
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("issued");
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("already_claimed");
    expect(issueFromTransaction).toHaveBeenCalledTimes(1);
    expect(issueFromTransaction).toHaveBeenCalledWith("t1", "tx1", { createdBy: "system" });
  });

  it("contrato sem a chave de nota não emite", async () => {
    docs["service_contracts/ct1"].issueNfse = false;
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("not_enabled");
    expect(issueFromTransaction).not.toHaveBeenCalled();
  });

  it("contrato de outra empresa não emite", async () => {
    docs["service_contracts/ct1"].tenantId = "t2";
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("not_enabled");
  });

  it("sem o módulo fiscal, ou sem a emissão pronta, não emite nem trava", async () => {
    fiscalCapability = false;
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("no_fiscal");
    fiscalCapability = true;
    fiscalSettings = { status: "registered" };
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("not_ready");
    expect(claims.size).toBe(0);
    expect(issueFromTransaction).not.toHaveBeenCalled();
  });

  it("falta de dado fiscal fica registrada e não repete a emissão", async () => {
    issueFromTransaction.mockResolvedValue({ invoices: [], gaps: [{ scope: "client", field: "documento" }] });
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("gaps");
    expect(await issueContractChargeInvoice("tx1", PAID)).toBe("already_claimed");
  });

  it("erro do provedor nunca derruba o gatilho", async () => {
    issueFromTransaction.mockRejectedValue(new Error("FOCUS_FORA"));
    await expect(issueContractChargeInvoice("tx1", PAID)).resolves.toBe("failed");
  });
});
