import { describe, expect, it } from "vitest";
import type { Transaction } from "@/services/transaction-service";
import {
  computeFinanceOverview,
  computeMonthStats,
  toMonthKey,
} from "../dashboard-metrics";

const tx = (id: string, extra: Partial<Transaction> = {}): Transaction =>
  ({
    id,
    tenantId: "t1",
    type: "expense",
    description: id,
    amount: 100,
    date: "2026-09-10",
    status: "paid",
    paidAt: "2026-09-10T12:00:00.000Z",
    createdAt: "",
    updatedAt: "",
    ...extra,
  }) as Transaction;

describe("computeMonthStats", () => {
  it("soma só o que foi pago no mês escolhido", () => {
    const stats = computeMonthStats(
      [
        tx("a", { category: "Material", wallet: "Caixa" }),
        tx("b", { category: "Material", amount: 50, wallet: "Caixa" }),
        tx("c", { paidAt: "2026-08-20T12:00:00.000Z", category: "Material" }),
        tx("d", { status: "pending", category: "Material" }),
      ],
      "2026-09",
    );
    expect(stats.expensesByCategory).toEqual({ Material: 150 });
    expect(stats.expensesByWallet).toEqual({ Caixa: 150 });
  });

  it("um mês passado conta o que foi pago nele", () => {
    const stats = computeMonthStats(
      [tx("c", { paidAt: "2026-08-20T12:00:00.000Z", type: "income", wallet: "Banco" })],
      "2026-08",
    );
    expect(stats.incomeByWallet).toEqual({ Banco: 100 });
  });

  it("inclui custo extra pago e usa rótulos para o que falta", () => {
    const stats = computeMonthStats(
      [
        tx("a", {
          category: undefined,
          wallet: undefined,
          extraCosts: [
            { id: "ec1", amount: 30, status: "paid", createdAt: "" } as never,
          ],
        }),
      ],
      "2026-09",
    );
    expect(stats.expensesByCategory).toEqual({ "Sem Categoria": 130 });
    expect(stats.expensesByWallet).toEqual({ "Sem Carteira": 130 });
  });
});

describe("computeFinanceOverview", () => {
  it("saldo soma só carteiras ativas e alerta os atrasados", () => {
    const overview = computeFinanceOverview(
      [tx("a", { status: "overdue", dueDate: "2026-09-01" })],
      [
        { id: "w1", name: "Caixa", balance: 500, status: "active" },
        { id: "w2", name: "Antiga", balance: 999, status: "archived" },
      ] as never,
      new Date(2026, 8, 25),
    );
    expect(overview.balance).toBe(500);
    expect(overview.overdueTransactions.map((t) => t.id)).toEqual(["a"]);
    expect(overview.overdueAmount).toBe(100);
  });
});

describe("toMonthKey", () => {
  it("formata em hora local", () => {
    expect(toMonthKey(new Date(2026, 0, 31, 23, 59))).toBe("2026-01");
  });
});
