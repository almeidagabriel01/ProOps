/**
 * computeTransactionTotals deve espelhar EXATAMENTE a semântica do summary
 * legado do frontend: pai por status do pai; extraCosts pelo próprio status
 * (default "pending"); overdue conta como pendente.
 */

import {
  computeTransactionTotals,
  storedTotalsDiffer,
} from "./transaction-totals";

describe("computeTransactionTotals", () => {
  it("pai pago sem extras → tudo em paidTotal", () => {
    expect(computeTransactionTotals({ amount: 100, status: "paid" })).toEqual({
      paidTotal: 100,
      pendingTotal: 0,
    });
  });

  it("pai pendente → pendingTotal; overdue também conta como pendente", () => {
    expect(computeTransactionTotals({ amount: 50, status: "pending" })).toEqual({
      paidTotal: 0,
      pendingTotal: 50,
    });
    expect(computeTransactionTotals({ amount: 50, status: "overdue" })).toEqual({
      paidTotal: 0,
      pendingTotal: 50,
    });
  });

  it("pai pago + extraCost pendente → contribui para os DOIS baldes", () => {
    expect(
      computeTransactionTotals({
        amount: 100,
        status: "paid",
        extraCosts: [{ amount: 30, status: "pending" }],
      }),
    ).toEqual({ paidTotal: 100, pendingTotal: 30 });
  });

  it("pai pendente + extraCost pago → baldes invertidos", () => {
    expect(
      computeTransactionTotals({
        amount: 100,
        status: "pending",
        extraCosts: [{ amount: 30, status: "paid" }],
      }),
    ).toEqual({ paidTotal: 30, pendingTotal: 100 });
  });

  it("extraCost sem status → default pending (paridade com o frontend)", () => {
    expect(
      computeTransactionTotals({
        amount: 10,
        status: "paid",
        extraCosts: [{ amount: 5 }],
      }),
    ).toEqual({ paidTotal: 10, pendingTotal: 5 });
  });

  it("múltiplos extraCosts com status mistos", () => {
    expect(
      computeTransactionTotals({
        amount: 100,
        status: "paid",
        extraCosts: [
          { amount: 10, status: "paid" },
          { amount: 20, status: "pending" },
          { amount: 5, status: "paid" },
        ],
      }),
    ).toEqual({ paidTotal: 115, pendingTotal: 20 });
  });

  it("valores inválidos viram 0 (nunca NaN)", () => {
    expect(
      computeTransactionTotals({
        amount: "abc",
        status: "paid",
        extraCosts: [{ amount: null, status: "paid" }, null],
      }),
    ).toEqual({ paidTotal: 0, pendingTotal: 0 });
  });

  it("status ausente no pai → pending", () => {
    expect(computeTransactionTotals({ amount: 7 })).toEqual({
      paidTotal: 0,
      pendingTotal: 7,
    });
  });
});

describe("storedTotalsDiffer", () => {
  it("false quando iguais (dentro do epsilon) — impede loop do trigger", () => {
    expect(
      storedTotalsDiffer(
        { paidTotal: 100.001, pendingTotal: 30 },
        { paidTotal: 100, pendingTotal: 30 },
      ),
    ).toBe(false);
  });

  it("true quando ausentes (docs antigos, pré-backfill)", () => {
    expect(storedTotalsDiffer({}, { paidTotal: 0, pendingTotal: 0 })).toBe(true);
  });

  it("true quando divergem de verdade", () => {
    expect(
      storedTotalsDiffer(
        { paidTotal: 100, pendingTotal: 30 },
        { paidTotal: 100, pendingTotal: 35 },
      ),
    ).toBe(true);
  });
});
