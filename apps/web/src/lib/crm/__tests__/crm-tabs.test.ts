import { describe, expect, it } from "vitest";
import { canShowCrmTransactionsTab, resolveCrmTab } from "../crm-tabs";

describe("aba Lançamentos do CRM", () => {
  it("membro com CRM e sem Lançamentos não vê a aba", () => {
    expect(canShowCrmTransactionsTab({ canViewTransactions: false, hasFinancial: true })).toBe(false);
  });

  it("membro com Lançamentos vê a aba quando o plano tem o financeiro", () => {
    expect(canShowCrmTransactionsTab({ canViewTransactions: true, hasFinancial: true })).toBe(true);
  });

  it("plano sem o financeiro não mostra a aba, nem para o dono", () => {
    expect(canShowCrmTransactionsTab({ canViewTransactions: true, hasFinancial: false })).toBe(false);
  });

  it("link direto para a aba (?tab=transactions ou ?scope=transactions) cai em Propostas sem a permissão", () => {
    expect(resolveCrmTab("transactions", false)).toBe("proposals");
    expect(resolveCrmTab("transactions", true)).toBe("transactions");
    expect(resolveCrmTab("leads", false)).toBe("leads");
  });
});
