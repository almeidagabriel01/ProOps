import { buildAccountantInvoices, buildAccountantReceived, buildAccountantTransactions } from "./accountant-model";

const params = {
  from: "2026-09",
  to: "2026-09",
  walletNames: new Map([["w1", "Conta Principal"]]),
  today: "2026-09-26",
};

describe("lançamentos para o contador", () => {
  it("entra o que foi lançado OU pago no período, com o nome da carteira e sem id interno", () => {
    const rows = buildAccountantTransactions(
      [
        { id: "a", data: { type: "income", description: "Venda", amount: 100, status: "paid", date: "2026-09-05", wallet: "w1", category: "Propostas" } },
        // Lançado em agosto, pago em setembro.
        { id: "b", data: { type: "expense", description: "Aluguel", amount: 50, status: "paid", date: "2026-08-20", paidAt: "2026-09-10T15:00:00.000Z" } },
        // Fora do período.
        { id: "c", data: { type: "income", description: "Outubro", amount: 1, status: "pending", date: "2026-10-01" } },
        // Vencido pela data mesmo antes do cron.
        { id: "d", data: { type: "income", description: "Parcela", amount: 70, status: "pending", date: "2026-09-01", dueDate: "2026-09-20", isInstallment: true, installmentNumber: 2, installmentCount: 3, extraCosts: [{ amount: 5 }] } },
      ],
      params,
    );
    expect(rows.map((r) => r.id)).toEqual(["b", "d", "a"]);
    expect(rows.find((r) => r.id === "a")).toMatchObject({ wallet: "Conta Principal", paidAt: "2026-09-05", category: "Propostas" });
    expect(rows.find((r) => r.id === "b")).toMatchObject({ paidAt: "2026-09-10" });
    expect(rows.find((r) => r.id === "d")).toMatchObject({ status: "overdue", paidAt: null, installment: "2/3", extraCosts: 5 });
  });
});

describe("notas para o contador", () => {
  it("emitidas: só autorizada e cancelada, sem caminho de arquivo", () => {
    const rows = buildAccountantInvoices([
      { id: "n1", data: { type: "nfse", status: "authorized", numero: 10, serie: "1", valorTotal: 300, authorizedAt: "2026-09-02T13:00:00.000Z", storagePdfPath: "tenants/x/fiscal/n1/danfe.pdf" } },
      { id: "n2", data: { type: "nfe", status: "cancelled", numero: 11, valorTotal: 100, createdAt: "2026-09-03T13:00:00.000Z", cancelledAt: "2026-09-04T13:00:00.000Z", xmlUrl: "https://focus/x.xml" } },
      { id: "n3", data: { type: "nfe", status: "rejected", valorTotal: 1 } },
    ]);
    expect(rows.map((r) => [r.id, r.status, r.hasPdf, r.hasXml])).toEqual([
      ["n1", "authorized", true, false],
      ["n2", "cancelled", false, true],
    ]);
    expect(JSON.stringify(rows)).not.toContain("tenants/x");
  });

  it("de entrada: emitente, valor e se tem XML", () => {
    const rows = buildAccountantReceived([
      { id: "r1", data: { emitenteNome: "Fornecedor", emitenteCnpj: "123", dataEmissao: "2026-09-10T10:00:00-03:00", valorTotal: 99.9, status: "completa", storageXmlPath: "p" } },
    ]);
    expect(rows).toEqual([
      { id: "r1", issuer: "Fornecedor", issuerCnpj: "123", number: null, series: null, issuedAt: "2026-09-10", amount: 99.9, status: "completa", hasXml: true },
    ]);
  });
});
