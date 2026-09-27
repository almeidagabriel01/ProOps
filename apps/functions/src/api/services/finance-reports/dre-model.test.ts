import { brazilDateOf, cashDateOf, computeDre, monthsBetween, normalizeCategoryName } from "./dre-model";

const CATEGORIES = [
  { name: "Vendas", kind: "income" as const, group: "revenue" as const },
  { name: "Rendimentos", kind: "income" as const, group: "other_income" as const },
  { name: "Impostos", kind: "expense" as const, group: "deduction" as const },
  { name: "Mão de obra", kind: "expense" as const, group: "cost" as const },
  { name: "Aluguel", kind: "expense" as const, group: "operating" as const },
  { name: "Taxas bancárias", kind: "expense" as const, group: "other_expense" as const },
];

describe("datas", () => {
  it("meses do período, virando o ano", () => {
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("pagamento às 01:00 UTC do dia 1 ainda é o mês anterior em Brasília", () => {
    expect(brazilDateOf("2026-10-01T01:00:00.000Z")).toBe("2026-09-30");
    expect(brazilDateOf("2026-10-01T03:00:00.000Z")).toBe("2026-10-01");
  });

  it("caixa usa o paidAt; quem nasceu pago usa a data do lançamento", () => {
    expect(cashDateOf({ date: "2026-08-10", paidAt: "2026-09-05T15:00:00.000Z" })).toBe("2026-09-05");
    expect(cashDateOf({ date: "2026-08-10" })).toBe("2026-08-10");
  });

  it("nome da categoria sem acento, caixa nem espaço sobrando", () => {
    expect(normalizeCategoryName("  Mão  de Obra ")).toBe("mao de obra");
  });
});

describe("DRE", () => {
  const txs = [
    // Receita de agosto paga em setembro.
    { type: "income", category: "vendas", amount: 1000, status: "paid", date: "2026-08-20", paidAt: "2026-09-02T12:00:00.000Z" },
    // Receita que nasceu paga em setembro, sem paidAt.
    { type: "income", category: "Vendas", amount: 500, status: "paid", date: "2026-09-10" },
    // Receita de setembro ainda a receber.
    { type: "income", category: "Vendas", amount: 300, status: "pending", date: "2026-09-15" },
    { type: "income", category: "Rendimentos", amount: 20, status: "paid", date: "2026-09-30" },
    { type: "expense", category: "Impostos", amount: 60, status: "paid", date: "2026-09-12" },
    // Custo com custo extra: o extra pago conta; o pendente só na competência.
    {
      type: "expense",
      category: "Mão de Obra",
      amount: 200,
      status: "paid",
      date: "2026-09-05",
      extraCosts: [
        { amount: 50, status: "paid" },
        { amount: 30, status: "pending" },
      ],
    },
    { type: "expense", category: "Aluguel", amount: 400, status: "overdue", date: "2026-09-01" },
    // Categoria fora da lista: despesa cai em Despesas operacionais.
    { type: "expense", category: "Comissao", amount: 100, status: "paid", date: "2026-09-20" },
    { type: "expense", category: "", amount: 10, status: "paid", date: "2026-09-21" },
    { type: "expense", category: "Taxas bancárias", amount: 5, status: "paid", date: "2026-09-22" },
    // Fora do período.
    { type: "income", category: "Vendas", amount: 9999, status: "paid", date: "2026-10-01" },
  ];

  it("caixa: só o que entrou e saiu no mês, com os subtotais", () => {
    const dre = computeDre({ transactions: txs, categories: CATEGORIES, basis: "cash", from: "2026-09", to: "2026-09" });
    expect(dre.groups.revenue.total).toBe(1500);
    expect(dre.groups.deduction.total).toBe(60);
    expect(dre.groups.cost.total).toBe(250);
    // Aluguel vencido não saiu do caixa; comissão e "Sem categoria" caem em operacionais.
    expect(dre.groups.operating.total).toBe(110);
    expect(dre.groups.operating.categories.map((c) => c.name)).toEqual(["Comissao", "Sem categoria"]);
    expect(dre.totals.netRevenue.total).toBe(1440);
    expect(dre.totals.grossProfit.total).toBe(1190);
    expect(dre.totals.operatingResult.total).toBe(1080);
    expect(dre.totals.result.total).toBe(1080 + 20 - 5);
  });

  it("competência: tudo o que foi lançado no mês, pago ou não, com todo custo extra", () => {
    const dre = computeDre({ transactions: txs, categories: CATEGORIES, basis: "accrual", from: "2026-09", to: "2026-09" });
    // A venda de agosto sai; a pendente entra.
    expect(dre.groups.revenue.total).toBe(800);
    expect(dre.groups.cost.total).toBe(280);
    expect(dre.groups.operating.total).toBe(510);
  });

  it("junta a categoria pelo nome da lista, qualquer que seja a grafia", () => {
    const dre = computeDre({ transactions: txs, categories: CATEGORIES, basis: "cash", from: "2026-09", to: "2026-09" });
    expect(dre.groups.revenue.categories).toEqual([{ name: "Vendas", byMonth: { "2026-09": 1500 }, total: 1500 }]);
    expect(dre.groups.cost.categories[0].name).toBe("Mão de obra");
  });

  it("vários meses, com o valor em cada coluna", () => {
    const dre = computeDre({ transactions: txs, categories: CATEGORIES, basis: "accrual", from: "2026-08", to: "2026-10" });
    expect(dre.months).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(dre.groups.revenue.byMonth).toEqual({ "2026-08": 1000, "2026-09": 800, "2026-10": 9999 });
  });

  it("receita de proposta sem categoria conta em Propostas; comissão e categoria própria não mudam", () => {
    const dre = computeDre({
      transactions: [
        { type: "income", proposalId: "p1", amount: 700, status: "paid", date: "2026-09-01" },
        { type: "income", proposalId: "p2", category: "Projetos", amount: 100, status: "paid", date: "2026-09-02" },
        { type: "income", amount: 50, status: "paid", date: "2026-09-03" },
        { type: "expense", proposalId: "p1", isCommission: true, category: "Comissao", amount: 70, status: "paid", date: "2026-09-04" },
      ],
      categories: CATEGORIES,
      basis: "cash",
      from: "2026-09",
      to: "2026-09",
    });
    expect(dre.groups.revenue.categories.map((c) => [c.name, c.total])).toEqual([
      ["Propostas", 700],
      ["Projetos", 100],
      ["Sem categoria", 50],
    ]);
    expect(dre.groups.operating.categories.map((c) => c.name)).toEqual(["Comissao"]);
  });

  it("período sem nada", () => {
    const dre = computeDre({ transactions: [], categories: CATEGORIES, basis: "cash", from: "2026-01", to: "2026-01" });
    expect(dre.count).toBe(0);
    expect(dre.totals.result.total).toBe(0);
  });
});
