import { describe, it, expect } from "vitest";
import { resolveInitialTransactionType } from "../initial-transaction-type";

describe("resolveInitialTransactionType", () => {
  it("?type=expense abre o formulário como despesa", () => {
    expect(resolveInitialTransactionType("expense")).toBe("expense");
  });

  it("?type=income abre como receita", () => {
    expect(resolveInitialTransactionType("income")).toBe("income");
  });

  it("sem parâmetro ou com valor desconhecido cai em receita", () => {
    expect(resolveInitialTransactionType(null)).toBe("income");
    expect(resolveInitialTransactionType(undefined)).toBe("income");
    expect(resolveInitialTransactionType("despesa")).toBe("income");
    expect(resolveInitialTransactionType("")).toBe("income");
  });
});
