/**
 * Agrupamento do relatorio mensal: "quanto eu devo para cada arquiteto e para
 * cada vendedor este mes".
 *
 * O que erra em silencio:
 *
 * 1. **Contar "overdue" como pago.** `overdue` e derivado, nunca escrito; so
 *    `paid` significa que o parceiro recebeu. Tratar o resto como pago
 *    esconderia justamente a comissao atrasada.
 * 2. **Agrupar so por contato.** A mesma pessoa pode ser vendedor numa proposta
 *    e arquiteto em outra, com percentuais diferentes; somar as duas numa linha
 *    so tornaria impossivel conferir.
 * 3. **Ignorar o tenant do superadmin.** Um tenant pedido por quem nao e
 *    superadmin tem que ser descartado.
 */

const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
const checkFinancialPermission = jest.fn();
let ultimoTenantConsultado = "";

jest.mock("../../init", () => ({
  db: {
    collection: () => {
      const chain = {
        where(campo: string, _op: string, valor: unknown) {
          if (campo === "tenantId") ultimoTenantConsultado = String(valor);
          return chain;
        },
        orderBy: () => chain,
        limit: () => chain,
        get: async () => ({ docs }),
      };
      return chain;
    },
  },
}));

jest.mock("../../lib/finance-helpers", () => ({
  checkFinancialPermission: (...args: unknown[]) =>
    checkFinancialPermission(...args),
}));
const checkPermission = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: jest.fn(),
  checkPermission: (...args: unknown[]) => checkPermission(...args),
}));

import { getCommissionReport } from "./commission-report.service";

function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

const BASE = {
  isCommission: true,
  commissionContactId: "arq1",
  commissionContactName: "Ana Souza",
  commissionRole: "arquiteto",
  dueDate: "2026-10-10",
  status: "pending",
  proposalId: "p1",
  description: "Comissão Ana Souza: Casa Alphaville",
};

beforeEach(() => {
  docs.length = 0;
  checkPermission.mockReset();
  checkPermission.mockResolvedValue(false);
  ultimoTenantConsultado = "";
  checkFinancialPermission.mockResolvedValue({
    tenantId: "t1",
    isMaster: true,
    isSuperAdmin: false,
  });
});

describe("getCommissionReport", () => {
  it("agrupa por parceiro e separa a pagar de pago", async () => {
    docs.push(
      doc("c1", { ...BASE, amount: 1000 }),
      doc("c2", { ...BASE, amount: 1000, status: "paid" }),
      doc("c3", { ...BASE, amount: 1000, status: "overdue" }),
      doc("c4", {
        ...BASE,
        amount: 250,
        commissionContactId: "ven1",
        commissionContactName: "Bruno Lima",
        commissionRole: "vendedor",
      }),
    );

    const report = await getCommissionReport("u1", undefined, {
      month: "2026-10",
    });

    expect(report.month).toBe("2026-10");
    expect(report.partners).toHaveLength(2);

    const ana = report.partners.find((p) => p.contactId === "arq1")!;
    // Vencido continua sendo dinheiro a pagar ao parceiro.
    expect(ana.aPagar).toBe(2000);
    expect(ana.pago).toBe(1000);
    expect(ana.total).toBe(3000);
    expect(ana.role).toBe("arquiteto");
    expect(ana.entries).toHaveLength(3);

    const bruno = report.partners.find((p) => p.contactId === "ven1")!;
    expect(bruno.aPagar).toBe(250);
    expect(bruno.role).toBe("vendedor");

    expect(report.aPagar).toBe(2250);
    expect(report.pago).toBe(1000);
    expect(report.total).toBe(3250);
  });

  it("separa a mesma pessoa em papeis diferentes", async () => {
    docs.push(
      doc("c1", { ...BASE, contactId: "x", commissionContactId: "x", amount: 100 }),
      doc("c2", {
        ...BASE,
        commissionContactId: "x",
        commissionRole: "vendedor",
        amount: 50,
      }),
    );

    const report = await getCommissionReport("u1", undefined, {
      month: "2026-10",
    });

    expect(report.partners).toHaveLength(2);
    expect(report.partners.map((p) => p.role).sort()).toEqual([
      "arquiteto",
      "vendedor",
    ]);
  });

  it("ordena por quem tem mais a receber", async () => {
    docs.push(
      doc("c1", { ...BASE, amount: 100 }),
      doc("c2", {
        ...BASE,
        commissionContactId: "ven1",
        commissionContactName: "Bruno Lima",
        commissionRole: "vendedor",
        amount: 900,
      }),
    );

    const report = await getCommissionReport("u1", undefined, {
      month: "2026-10",
    });
    expect(report.partners[0].contactId).toBe("ven1");
  });

  it("descarta doc sem contato em vez de criar uma linha fantasma", async () => {
    docs.push(doc("c1", { ...BASE, commissionContactId: "", amount: 100 }));

    const report = await getCommissionReport("u1", undefined, {
      month: "2026-10",
    });
    expect(report.partners).toHaveLength(0);
    expect(report.total).toBe(0);
  });

  it("mes sem comissao devolve relatorio zerado, nao erro", async () => {
    const report = await getCommissionReport("u1", undefined, {
      month: "2026-10",
    });
    expect(report).toEqual({
      month: "2026-10",
      aPagar: 0,
      pago: 0,
      total: 0,
      partners: [],
    });
  });

  it("membro com Ver em Lancamentos e sem 'Ver comissoes' nao le o relatorio", async () => {
    docs.push(doc("c1", { ...BASE, amount: 1000 }));
    checkFinancialPermission.mockResolvedValue({
      tenantId: "t1",
      isMaster: false,
      isSuperAdmin: false,
    });

    await expect(
      getCommissionReport("u1", undefined, { month: "2026-10" }),
    ).rejects.toThrow("FORBIDDEN_COMMISSIONS_ADMIN_ONLY");
    expect(ultimoTenantConsultado).toBe("");
  });

  it("membro com 'Ver comissoes' le o relatorio", async () => {
    docs.push(doc("c1", { ...BASE, amount: 1000 }));
    checkFinancialPermission.mockResolvedValue({
      tenantId: "t1",
      isMaster: false,
      isSuperAdmin: false,
    });
    checkPermission.mockResolvedValue(true);

    await expect(
      getCommissionReport("u1", undefined, { month: "2026-10" }),
    ).resolves.toMatchObject({ month: "2026-10", total: 1000 });
    expect(checkPermission).toHaveBeenCalledWith("u1", "transactions", "viewCommissions");
  });

  it("dono nao depende da chave", async () => {
    await getCommissionReport("u1", undefined, { month: "2026-10" });
    expect(checkPermission).not.toHaveBeenCalled();
  });

  it("superadmin le o relatorio", async () => {
    checkFinancialPermission.mockResolvedValue({
      tenantId: "t1",
      isMaster: true,
      isSuperAdmin: true,
    });
    await expect(
      getCommissionReport("u1", undefined, { month: "2026-10" }),
    ).resolves.toMatchObject({ month: "2026-10" });
  });

  it("exige a permissao de Lancamentos", async () => {
    checkFinancialPermission.mockRejectedValue(
      new Error("Sem permissão financeira."),
    );
    await expect(
      getCommissionReport("u1", undefined, { month: "2026-10" }),
    ).rejects.toThrow("Sem permissão financeira.");
  });

  it("ignora tenantId pedido por quem nao e superadmin", async () => {
    docs.push(doc("c1", { ...BASE, amount: 100 }));
    await getCommissionReport("u1", undefined, {
      month: "2026-10",
      requestedTenantId: "outro-tenant",
    });
    expect(ultimoTenantConsultado).toBe("t1");
  });

  it("superadmin consulta o tenant pedido", async () => {
    checkFinancialPermission.mockResolvedValue({
      tenantId: "t1",
      isSuperAdmin: true,
    });
    await getCommissionReport("u1", undefined, {
      month: "2026-10",
      requestedTenantId: "outro-tenant",
    });
    expect(ultimoTenantConsultado).toBe("outro-tenant");
  });

  it("no Acessar Painel vale a empresa vista, nao o tenant pedido", async () => {
    checkFinancialPermission.mockResolvedValue({ tenantId: "alvo", isSuperAdmin: true });
    await getCommissionReport(
      "u1",
      { uid: "u1", impersonation: { targetTenantId: "alvo" } },
      { month: "2026-10", requestedTenantId: "outro-tenant" },
    );
    expect(ultimoTenantConsultado).toBe("alvo");
  });

  it("sem tenant nenhum falha em vez de varrer a colecao inteira", async () => {
    checkFinancialPermission.mockResolvedValue({
      tenantId: "",
      isMaster: true,
      isSuperAdmin: false,
    });
    await expect(
      getCommissionReport("u1", undefined, { month: "2026-10" }),
    ).rejects.toThrow("AUTH_CLAIMS_MISSING_TENANT");
  });
});
