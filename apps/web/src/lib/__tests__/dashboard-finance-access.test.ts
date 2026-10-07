import { describe, expect, it } from "vitest";
import { canSeeDashboardFinance } from "../dashboard-finance-access";

describe("financeiro no Dashboard", () => {
  it("membro sem Lançamentos nem Carteiras não vê saldo nem gráficos", () => {
    expect(canSeeDashboardFinance({ canViewTransactions: false, canViewWallet: false })).toBe(false);
  });

  it("quem vê Lançamentos ou Carteiras vê o financeiro do painel", () => {
    expect(canSeeDashboardFinance({ canViewTransactions: true, canViewWallet: false })).toBe(true);
    expect(canSeeDashboardFinance({ canViewTransactions: false, canViewWallet: true })).toBe(true);
  });
});
