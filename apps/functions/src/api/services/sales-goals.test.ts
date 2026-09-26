jest.mock("../../init", () => ({ db: {} }));

import {
  approvalTimestampUpdate,
  computeGoalProgress,
  monthWindowUtc,
  soldValue,
} from "./sales-goals";

describe("mês da venda (fuso de Brasília)", () => {
  it("começa e termina à meia-noite de Brasília", () => {
    expect(monthWindowUtc("2026-09")).toEqual({
      start: "2026-09-01T03:00:00.000Z",
      end: "2026-10-01T03:00:00.000Z",
    });
  });

  it("dezembro vira o ano", () => {
    expect(monthWindowUtc("2026-12").end).toBe("2027-01-01T03:00:00.000Z");
  });

  it("aprovada às 23h do último dia (Brasília) conta no próprio mês", () => {
    // 30/09 23:30 em Brasília = 01/10 02:30 UTC
    const approvedAt = "2026-10-01T02:30:00.000Z";
    const { start, end } = monthWindowUtc("2026-09");
    expect(approvedAt >= start && approvedAt < end).toBe(true);
  });
});

describe("data da aprovação", () => {
  const now = "2026-09-26T12:00:00.000Z";
  it("grava na entrada em aprovada", () => {
    expect(approvalTimestampUpdate(false, true, now)).toEqual({ approvedAt: now });
  });
  it("apaga na saída de aprovada (a venda foi desfeita)", () => {
    expect(approvalTimestampUpdate(true, false, now)).toEqual({ approvedAt: null });
  });
  it("não mexe quando continua aprovada nem quando continua aberta", () => {
    expect(approvalTimestampUpdate(true, true, now)).toEqual({});
    expect(approvalTimestampUpdate(false, false, now)).toEqual({});
  });
});

describe("valor vendido", () => {
  it("o valor fechado vence o total", () => {
    expect(soldValue({ closedValue: 9000, totalValue: 10000 })).toBe(9000);
  });
  it("sem valor fechado, vale o total", () => {
    expect(soldValue({ closedValue: 0, totalValue: 10000 })).toBe(10000);
    expect(soldValue({ totalValue: "12000" })).toBe(12000);
  });
  it("valor inválido conta zero", () => {
    expect(soldValue({ totalValue: "abc" })).toBe(0);
  });
});

describe("progresso", () => {
  const people = [
    { id: "ana", name: "Ana" },
    { id: "beto", name: "Beto" },
    { id: "carla", name: "Carla" },
  ];

  it("soma por vendedor e na empresa; sem vendedor entra só na empresa", () => {
    const progress = computeGoalProgress(
      [
        { sellerId: "ana", totalValue: 10000 },
        { sellerId: "ana", closedValue: 5000, totalValue: 6000 },
        { sellerId: "beto", totalValue: 3000 },
        { sellerId: null, totalValue: 2000 },
      ],
      { companyTarget: 30000, targets: { ana: 20000, carla: 8000 } },
      people,
    );
    expect(progress.companyAchieved).toBe(20000);
    expect(progress.companyCount).toBe(4);
    expect(progress.unassignedAchieved).toBe(2000);
    expect(progress.people).toEqual([
      { id: "ana", name: "Ana", target: 20000, achieved: 15000, count: 2 },
      { id: "beto", name: "Beto", target: null, achieved: 3000, count: 1 },
      // Tem meta e ainda não vendeu: aparece com zero.
      { id: "carla", name: "Carla", target: 8000, achieved: 0, count: 0 },
    ]);
  });

  it("quem saiu da empresa continua com o nome gravado na proposta", () => {
    const progress = computeGoalProgress(
      [{ sellerId: "ex", sellerName: "Ex-vendedor", totalValue: 1000 }],
      { companyTarget: null, targets: {} },
      people,
    );
    expect(progress.people).toEqual([{ id: "ex", name: "Ex-vendedor", target: null, achieved: 1000, count: 1 }]);
  });

  it("mês sem venda e sem meta: vazio", () => {
    const progress = computeGoalProgress([], { companyTarget: null, targets: {} }, people);
    expect(progress).toEqual({
      companyTarget: null,
      companyAchieved: 0,
      companyCount: 0,
      people: [],
      unassignedAchieved: 0,
    });
  });
});
