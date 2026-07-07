// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "tenant-test" } }),
}));

import { useFinancialFilters } from "../useFinancialFilters";
import type { Transaction } from "@/services/transaction-service";
import type { Wallet } from "@/types";

const noTx: Transaction[] = [];
const noWallets: Wallet[] = [];

beforeEach(() => {
  window.localStorage.clear();
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
