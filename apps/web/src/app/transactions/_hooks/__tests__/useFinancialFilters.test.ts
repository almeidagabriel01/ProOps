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

  it("persists filterStatus changes to localStorage scoped by tenantId in grouped mode", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets, "grouped"));

    act(() => {
      result.current.setFilterStatus(["paid"]);
    });

    const stored = window.localStorage.getItem(
      "transactions:filterStatus:v2:tenant-test",
    );
    expect(stored).toBe(JSON.stringify(["paid"]));
  });

  it("does not persist filterStatus changes to localStorage in byDueDate mode", () => {
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets, "byDueDate"));

    act(() => {
      result.current.setFilterStatus(["paid"]);
    });

    const stored = window.localStorage.getItem(
      "transactions:filterStatus:v2:tenant-test",
    );
    expect(stored).toBeNull();
  });

  it("restores filterStatus from localStorage on mount in grouped mode", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:v2:tenant-test",
      JSON.stringify(["pending"]),
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets, "grouped"));
    expect(result.current.filterStatus).toEqual(["pending"]);
  });

  it("does not restore filterStatus from localStorage on mount in byDueDate mode", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:v2:tenant-test",
      JSON.stringify(["pending"]),
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets, "byDueDate"));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("ignores malformed localStorage values and falls back to default in grouped mode", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:v2:tenant-test",
      "not-json",
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets, "grouped"));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });

  it("sanitizes unknown status values from localStorage in grouped mode", () => {
    window.localStorage.setItem(
      "transactions:filterStatus:v2:tenant-test",
      JSON.stringify(["paid", "bogus", "overdue"]),
    );

    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets, "grouped"));
    expect(result.current.filterStatus).toEqual(["paid", "overdue"]);
  });

  it("handles filterStatus resetting and restoring when toggling viewMode", () => {
    // 1. Persist a value for grouped mode
    window.localStorage.setItem(
      "transactions:filterStatus:v2:tenant-test",
      JSON.stringify(["paid"]),
    );

    // 2. Load hook (defaults to byDueDate, which ignores localStorage and uses pending+overdue)
    const { result } = renderHook(() => useFinancialFilters(noTx, noWallets));
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);

    // 3. Toggle to grouped mode (should restore ["paid"] from localStorage)
    act(() => {
      result.current.setViewMode("grouped");
    });
    expect(result.current.filterStatus).toEqual(["paid"]);

    // 4. Toggle back to byDueDate mode (should reset to default ["pending", "overdue"])
    act(() => {
      result.current.setViewMode("byDueDate");
    });
    expect(result.current.filterStatus).toEqual(["pending", "overdue"]);
  });
});
