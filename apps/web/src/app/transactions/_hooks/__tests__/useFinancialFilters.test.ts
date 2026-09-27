// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const tenantMock = vi.hoisted(() => ({
  tenant: { id: "tenant-test" } as { id: string } | null,
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: tenantMock.tenant }),
}));

import { useFinancialFilters } from "../useFinancialFilters";
import type { Transaction } from "@/services/transaction-service";
import type { Wallet } from "@/types";

const noTx: Transaction[] = [];
const noWallets: Wallet[] = [];

beforeEach(() => {
  window.localStorage.clear();
  tenantMock.tenant = { id: "tenant-test" };
});

/**
 * Spec (2026-07-06): o filtro de status é LIGADO À ABA, sem persistência.
 * - Lista (byDueDate): SEMPRE entra com [pending, overdue] — mesmo que o
 *   usuário tenha desativado antes de sair da aba.
 * - Agrupados (grouped): SEMPRE entra limpo ([] = todos os status).
 */
describe("useFinancialFilters — filterStatus por aba", () => {
  it("Lista: default [pending, overdue]", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("Agrupados: entra limpo (todos os status)", () => {
    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "grouped"),
    );
    expect(result.current.filterStatus).toEqual([]);
  });

  it("mudar para Agrupados limpa o filtro de status", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);

    act(() => {
      result.current.setViewMode("grouped");
    });
    expect(result.current.filterStatus).toEqual([]);
  });

  it("voltar para Lista reativa [pending, overdue] mesmo após o usuário desativar", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));

    // usuário desativa o filtro dentro da Lista
    act(() => {
      result.current.setFilterStatus([]);
    });
    expect(result.current.filterStatus).toEqual([]);

    // sai para Agrupados e volta — Lista SEMPRE vem com o filtro ativo
    act(() => {
      result.current.setViewMode("grouped");
    });
    act(() => {
      result.current.setViewMode("byDueDate");
    });
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("seleção feita em Agrupados não vaza ao alternar de aba", () => {
    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "grouped"),
    );

    act(() => {
      result.current.setFilterStatus(["paid"]);
    });
    expect(result.current.filterStatus).toEqual(["paid"]);

    act(() => {
      result.current.setViewMode("byDueDate");
    });
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);

    act(() => {
      result.current.setViewMode("grouped");
    });
    expect(result.current.filterStatus).toEqual([]);
  });

  it("valores persistidos legados no localStorage são ignorados (e não quebram)", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:v2:tenant-test",
      JSON.stringify(["paid"]),
    );

    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "grouped"),
    );
    expect(result.current.filterStatus).toEqual([]);
  });

  it("mudanças de status dentro da aba não são persistidas no localStorage", () => {
    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "grouped"),
    );

    act(() => {
      result.current.setFilterStatus(["paid"]);
    });

    expect(
      window.localStorage.getItem("transactions:filterStatus:v2:tenant-test"),
    ).toBeNull();
  });
});

/**
 * Filtros no endereço (2026-09-25): voltar de um lançamento aberto ou
 * recarregar a página devolve a lista como estava. A troca de aba continua
 * zerando o status, como manda a spec acima.
 */
describe("useFinancialFilters — filtros vindos do endereço", () => {
  it("aplica os filtros do endereço na entrada", () => {
    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "byDueDate", {
        searchTerm: "aluguel",
        filterType: "expense",
        filterStatus: ["paid"],
        filterWallet: "w1",
        filterStartDate: "2026-09-01",
        filterEndDate: "2026-09-30",
        filterDateType: "date",
        sortBy: "date",
      }),
    );
    expect(result.current.searchTerm).toBe("aluguel");
    expect(result.current.filterType).toBe("expense");
    expect(result.current.filterStatus).toEqual(["paid"]);
    expect(result.current.filterWallet).toBe("w1");
    expect(result.current.filterStartDate).toBe("2026-09-01");
    expect(result.current.filterEndDate).toBe("2026-09-30");
    expect(result.current.filterDateType).toBe("date");
    expect(result.current.sortBy).toBe("date");
  });

  it("a aba do endereço vale na entrada", () => {
    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "byDueDate", { viewMode: "grouped" }),
    );
    expect(result.current.viewMode).toBe("grouped");
    expect(result.current.filterStatus).toEqual([]);
  });

  it("trocar de aba ainda zera o status que veio do endereço", () => {
    const { result } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "byDueDate", { filterStatus: ["paid"] }),
    );
    act(() => result.current.setViewMode("grouped"));
    act(() => result.current.setViewMode("byDueDate"));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("o tenant carregar depois não apaga o status do endereço", () => {
    tenantMock.tenant = null;
    const { result, rerender } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "byDueDate", { filterStatus: ["paid"] }),
    );
    tenantMock.tenant = { id: "tenant-test" };
    rerender();
    expect(result.current.filterStatus).toEqual(["paid"]);
  });

  it("trocar de empresa depois de carregada volta ao padrão", () => {
    tenantMock.tenant = null;
    const { result, rerender } = renderHook(() =>
      useFinancialFilters(noTx, noWallets, "byDueDate", { filterStatus: ["paid"] }),
    );
    tenantMock.tenant = { id: "tenant-a" };
    rerender();
    tenantMock.tenant = { id: "tenant-b" };
    rerender();
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });
});
