// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "tenant-test" } }),
}));

vi.mock("@/services/tenant-service", () => ({
  TenantService: { updateTenant: vi.fn() },
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useTransactionStatuses } from "../useTransactionStatuses";

describe("useTransactionStatuses — editable vs display split", () => {
  it("statuses exposes paid, pending and overdue for display", () => {
    const { result } = renderHook(() => useTransactionStatuses());
    const ids = result.current.statuses.map((s) => s.id).sort();
    expect(ids).toEqual(["overdue", "paid", "pending"]);
  });

  it("editableStatuses omits overdue — users cannot set it manually", () => {
    const { result } = renderHook(() => useTransactionStatuses());
    const ids = result.current.editableStatuses.map((s) => s.id).sort();
    expect(ids).toEqual(["paid", "pending"]);
    expect(ids).not.toContain("overdue");
  });
});
