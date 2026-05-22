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

describe("useFinancialFilters — filterStatus default and persistence", () => {
  it("defaults filterStatus to [pending, overdue] when nothing is persisted", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("persists filterStatus changes to localStorage scoped by tenantId", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));

    act(() => {
      result.current.setFilterStatus(["paid"]);
    });

    const stored = window.localStorage.getItem(
      "transactions:filterStatus:tenant-test",
    );
    expect(stored).toBe(JSON.stringify(["paid"]));
  });

  it("restores filterStatus from localStorage on mount", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:tenant-test",
      JSON.stringify(["pending"]),
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["pending"]);
  });

  it("ignores malformed localStorage values and falls back to default", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:tenant-test",
      "not-json",
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("sanitizes unknown status values from localStorage", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:tenant-test",
      JSON.stringify(["paid", "bogus", "overdue"]),
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["paid", "overdue"]);
  });

  it("preserves filterStatus when viewMode toggles byDueDate → grouped → byDueDate", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));

    act(() => {
      result.current.setFilterStatus(["paid"]);
    });
    expect(result.current.filterStatus).toEqual(["paid"]);

    act(() => {
      result.current.setViewMode("grouped");
    });
    expect(result.current.filterStatus).toEqual(["paid"]);

    act(() => {
      result.current.setViewMode("byDueDate");
    });
    expect(result.current.filterStatus).toEqual(["paid"]);
  });
});
