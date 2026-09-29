import {
  addMonthsOnDay,
  buildChargeTransaction,
  canContractTransition,
  chargeTransactionId,
  computeMonthlyAmount,
  CreateContractSchema,
  dueCharges,
  dueVisit,
  firstBillingDate,
  MAX_CHARGES_PER_RUN,
  monthlyLinesFromProposal,
  resumeBillingDate,
  todayInBrazil,
  visitOrderId,
} from "./contract-model";

describe("datas de cobrança", () => {
  it("soma meses mantendo o dia, virando o ano", () => {
    expect(addMonthsOnDay("2026-11-10", 1, 10)).toBe("2026-12-10");
    expect(addMonthsOnDay("2026-12-10", 1, 10)).toBe("2027-01-10");
    expect(addMonthsOnDay("2026-01-31", 1, 28)).toBe("2026-02-28");
  });

  it("a primeira cobrança é o dia escolhido no mês do início, ou no seguinte se já passou", () => {
    expect(firstBillingDate("2026-10-03", 10)).toBe("2026-10-10");
    expect(firstBillingDate("2026-10-10", 10)).toBe("2026-10-10");
    expect(firstBillingDate("2026-10-15", 10)).toBe("2026-11-10");
  });

  it("o dia de hoje sai no fuso de Brasília, não em UTC", () => {
    // 01:30 UTC do dia 5 ainda é dia 4 em Brasília.
    expect(todayInBrazil(new Date("2026-10-05T01:30:00Z"))).toBe("2026-10-04");
  });
});

describe("dueCharges", () => {
  it("lança a mensalidade dez dias antes do vencimento, não antes", () => {
    expect(dueCharges({ nextBillingDate: "2026-10-20", billingDay: 20, endDate: null, today: "2026-10-09" }).charges).toEqual([]);
    const due = dueCharges({ nextBillingDate: "2026-10-20", billingDay: 20, endDate: null, today: "2026-10-10" });
    expect(due.charges).toEqual([{ dueDate: "2026-10-20", period: "2026-10" }]);
    expect(due.nextBillingDate).toBe("2026-11-20");
    expect(due.ended).toBe(false);
  });

  it("recupera os meses em que a rotina ficou parada, até o teto por execução", () => {
    const due = dueCharges({ nextBillingDate: "2026-01-05", billingDay: 5, endDate: null, today: "2026-10-01" });
    expect(due.charges).toHaveLength(MAX_CHARGES_PER_RUN);
    expect(due.charges.map((c) => c.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(due.nextBillingDate).toBe("2026-04-05");
  });

  it("não cobra depois do fim do contrato e avisa que ele terminou", () => {
    const due = dueCharges({ nextBillingDate: "2026-10-05", billingDay: 5, endDate: "2026-10-31", today: "2026-10-01" });
    expect(due.charges.map((c) => c.period)).toEqual(["2026-10"]);
    expect(due.ended).toBe(true);

    const past = dueCharges({ nextBillingDate: "2026-11-05", billingDay: 5, endDate: "2026-10-31", today: "2026-11-01" });
    expect(past.charges).toEqual([]);
    expect(past.ended).toBe(true);
  });

  it("o id do lançamento é o mesmo para o mesmo mês, então rodar duas vezes não cobra em dobro", () => {
    expect(chargeTransactionId("c1", "2026-10")).toBe("contract_c1_202610");
    expect(chargeTransactionId("c1", "2026-10")).toBe(chargeTransactionId("c1", "2026-10"));
    expect(chargeTransactionId("c1", "2026-11")).not.toBe(chargeTransactionId("c1", "2026-10"));
  });
});

describe("resumeBillingDate", () => {
  it("não cobra o período em que o contrato ficou suspenso", () => {
    expect(resumeBillingDate("2026-12-15", 10, "2026-09")).toBe("2027-01-10");
    expect(resumeBillingDate("2026-12-05", 10, "2026-09")).toBe("2026-12-10");
  });

  it("não cobra de novo um mês que já foi cobrado", () => {
    expect(resumeBillingDate("2026-10-02", 10, "2026-10")).toBe("2026-11-10");
  });
});

describe("dueVisit", () => {
  const plan = { enabled: true, intervalMonths: 3, technicianId: null, checklist: [], nextVisitDate: "2026-10-20" };

  it("abre a OS uma semana antes e avança pelo intervalo", () => {
    expect(dueVisit({ plan, endDate: null, today: "2026-10-12" })).toBeNull();
    expect(dueVisit({ plan, endDate: null, today: "2026-10-13" })).toEqual({
      visitDate: "2026-10-20",
      nextVisitDate: "2027-01-20",
    });
  });

  it("sem plano, desligado ou depois do fim, não abre nada", () => {
    expect(dueVisit({ plan: { ...plan, enabled: false }, endDate: null, today: "2026-10-20" })).toBeNull();
    expect(dueVisit({ plan: { ...plan, nextVisitDate: null }, endDate: null, today: "2026-10-20" })).toBeNull();
    expect(dueVisit({ plan, endDate: "2026-10-15", today: "2026-10-20" })).toBeNull();
  });

  it("o id da OS é o mesmo para a mesma visita", () => {
    expect(visitOrderId("c1", "2026-10-20")).toBe("contract_c1_visit_20261020");
  });
});

describe("valores e linhas", () => {
  it("soma a mensalidade em centavos", () => {
    expect(computeMonthlyAmount([{ quantity: 3, unitPrice: 33.333 }, { quantity: 1, unitPrice: 29.9 }])).toBe(129.9);
  });

  it("da proposta, só as linhas de mensalidade ativas e com quantidade", () => {
    const lines = monthlyLinesFromProposal([
      { productId: "p1", productName: "Câmera", quantity: 4, total: 1200 },
      { productId: "s1", productName: "Monitoramento 24h", itemType: "service", isMonthly: true, quantity: 1, total: 129 },
      { productId: "s2", productName: "App", itemType: "service", isMonthly: true, quantity: 2, total: 39.8 },
      { productId: "s3", productName: "Inativo", itemType: "service", isMonthly: true, status: "inactive", quantity: 1, total: 10 },
      { productId: "s4", productName: "Zerado", isMonthly: true, quantity: 0, total: 0 },
    ]);
    expect(lines.map((l) => [l.refId, l.kind, l.quantity, l.unitPrice])).toEqual([
      ["s1", "service", 1, 129],
      ["s2", "service", 2, 19.9],
    ]);
    expect(monthlyLinesFromProposal(undefined)).toEqual([]);
  });
});

describe("buildChargeTransaction", () => {
  const contract = {
    id: "c1",
    tenantId: "t1",
    title: "Monitoramento",
    code: "CT-0001",
    clientId: "cl1",
    clientName: "Ana",
    monthlyAmount: 129,
    wallet: "w1",
  };

  it("nasce a receber, fora de série e sem proposta", () => {
    const tx = buildChargeTransaction({ contract, charge: { dueDate: "2026-10-10", period: "2026-10" }, today: "2026-10-01" });
    expect(tx).toMatchObject({
      tenantId: "t1",
      type: "income",
      description: "Monitoramento (10/2026)",
      amount: 129,
      dueDate: "2026-10-10",
      status: "pending",
      isRecurring: false,
      isInstallment: false,
      proposalId: null,
      category: "Contratos",
      serviceContractId: "c1",
      contractPeriod: "2026-10",
      wallet: "w1",
    });
  });
});

describe("transições", () => {
  it("rascunho ativa; ativo suspende; encerrado não volta", () => {
    expect(canContractTransition("draft", "active")).toBe(true);
    expect(canContractTransition("active", "suspended")).toBe(true);
    expect(canContractTransition("suspended", "active")).toBe(true);
    expect(canContractTransition("ended", "active")).toBe(false);
    expect(canContractTransition("draft", "suspended")).toBe(false);
  });
});

describe("CreateContractSchema", () => {
  const base = {
    clientId: "cl1",
    title: "Manutenção",
    type: "maintenance",
    lines: [{ id: "l1", kind: "service", refId: null, name: "Manutenção", quantity: 1, unitPrice: 200 }],
    billingDay: 10,
    wallet: "w1",
    issueNfse: false,
  };

  it("aceita o contrato mínimo", () => {
    expect(CreateContractSchema.safeParse(base).success).toBe(true);
  });

  it("recusa dia de cobrança acima de 28, que não existe em fevereiro", () => {
    expect(CreateContractSchema.safeParse({ ...base, billingDay: 30 }).success).toBe(false);
  });

  it("recusa contrato sem item e intervalo de visita fora da lista", () => {
    expect(CreateContractSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(
      CreateContractSchema.safeParse({ ...base, visitPlan: { enabled: true, intervalMonths: 5, technicianId: null, checklist: [] } }).success,
    ).toBe(false);
  });
});
