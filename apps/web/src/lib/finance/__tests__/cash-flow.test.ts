import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIOS, addDays, brazilToday, computeCashFlow, type OpenItem } from "../cash-flow";

const TODAY = "2026-09-26";
const FULL = { receiveRate: 100, delayDays: 0 };

function flow(items: OpenItem[], scenario = FULL, startingBalance = 1000, horizonMonths = 3) {
  return computeCashFlow({ items, startingBalance, horizonMonths, scenario, today: TODAY });
}

describe("datas", () => {
  it("hoje em Brasília e soma de dias virando o mês", () => {
    expect(brazilToday(Date.UTC(2026, 9, 1, 1))).toBe("2026-09-30");
    expect(addDays("2026-09-20", 15)).toBe("2026-10-05");
  });
});

describe("fluxo projetado", () => {
  it("saldo de hoje mais o que entra, menos o que sai, mês a mês", () => {
    const result = flow([
      { type: "income", status: "pending", amount: 500, dueDate: "2026-10-10" },
      { type: "expense", status: "pending", amount: 200, dueDate: "2026-09-30" },
      { type: "expense", status: "pending", amount: 2000, dueDate: "2026-11-05" },
    ]);
    expect(result.months.map((m) => [m.key, m.income, m.expense, m.balance])).toEqual([
      ["2026-09", 0, 200, 800],
      ["2026-10", 500, 0, 1300],
      ["2026-11", 0, 2000, -700],
    ]);
    expect(result.endBalance).toBe(-700);
    expect(result.firstNegative).toBe("2026-11");
    expect(result.lowest).toEqual({ key: "2026-11", balance: -700 });
  });

  it("vencido dos dois lados conta como hoje", () => {
    const result = flow([
      { type: "income", status: "overdue", amount: 300, dueDate: "2026-07-01" },
      { type: "expense", status: "overdue", amount: 100, dueDate: "2026-08-01" },
    ]);
    expect(result.months[0]).toMatchObject({ key: "2026-09", income: 300, expense: 100 });
    expect(result.overdueReceivable).toBe(300);
  });

  it("o cenário mexe só no que entra: porcentagem e atraso", () => {
    const items: OpenItem[] = [
      { type: "income", status: "pending", amount: 1000, dueDate: "2026-09-28" },
      { type: "expense", status: "pending", amount: 400, dueDate: "2026-09-28" },
    ];
    const pessimista = flow(items, DEFAULT_SCENARIOS.pessimistic);
    // 80% e 30 dias depois: sai de setembro e vai para outubro.
    expect(pessimista.months[0]).toMatchObject({ income: 0, expense: 400 });
    expect(pessimista.months[1]).toMatchObject({ income: 800 });
    const otimista = flow(items, DEFAULT_SCENARIOS.optimistic);
    expect(otimista.months[0]).toMatchObject({ income: 1000, expense: 400 });
  });

  it("o que cai depois do horizonte fica de fora", () => {
    const result = flow([{ type: "income", status: "pending", amount: 999, dueDate: "2027-06-01" }]);
    expect(result.endBalance).toBe(1000);
  });

  it("custo extra pendente entra, inclusive de lançamento já pago; o pago não", () => {
    const result = flow([
      {
        type: "expense",
        status: "paid",
        amount: 500,
        dueDate: "2026-10-01",
        extraCosts: [
          { amount: 50, status: "pending" },
          { amount: 30, status: "paid" },
        ],
      },
    ]);
    expect(result.months[1].expense).toBe(50);
  });

  it("sem vencimento usa a data; sem nenhuma, ignora", () => {
    const result = flow([
      { type: "expense", status: "pending", amount: 10, date: "2026-10-02" },
      { type: "expense", status: "pending", amount: 99 },
    ]);
    expect(result.months[1].expense).toBe(10);
    expect(result.endBalance).toBe(990);
  });
});
