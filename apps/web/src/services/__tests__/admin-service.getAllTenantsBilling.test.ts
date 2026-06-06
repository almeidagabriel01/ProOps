import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// admin-service only depends on callApi — mock it to drive the paginated endpoint.
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

import { callApi } from "@/lib/api-client";
import { AdminService } from "../admin-service";
import type { TenantBillingInfo } from "../admin-service";

const mockedCallApi = callApi as unknown as Mock;

function tenant(id: string): TenantBillingInfo {
  return {
    tenant: { id, name: id, createdAt: "" },
    admin: { id, email: "" },
    planName: "Gratuito",
    usage: { users: 0, proposals: 0, clients: 0, products: 0 },
  } as unknown as TenantBillingInfo;
}

describe("AdminService.getAllTenantsBilling", () => {
  beforeEach(() => {
    mockedCallApi.mockReset();
  });

  // Regression: the backend returns { items, nextCursor, hasMore }. The service
  // used to return that envelope (an object), so the overview page crashed with
  // "tenantsData.reduce is not a function". It must return a flat array.
  it("unwraps a single paginated page into a flat array", async () => {
    mockedCallApi.mockResolvedValueOnce({
      items: [tenant("a"), tenant("b")],
      nextCursor: null,
      hasMore: false,
    });

    const result = await AdminService.getAllTenantsBilling();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    // The exact operation that crashed the overview must now work.
    expect(() => result.reduce((acc) => acc + 1, 0)).not.toThrow();
  });

  it("accumulates items across multiple pages", async () => {
    mockedCallApi
      .mockResolvedValueOnce({
        items: [tenant("a")],
        nextCursor: "cursor-1",
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [tenant("b")],
        nextCursor: null,
        hasMore: false,
      });

    const result = await AdminService.getAllTenantsBilling();

    expect(result.map((t) => t.tenant.id)).toEqual(["a", "b"]);
    expect(mockedCallApi).toHaveBeenCalledTimes(2);
  });

  it("stops paginating when hasMore is false even if a nextCursor is present", async () => {
    mockedCallApi.mockResolvedValueOnce({
      items: [tenant("a")],
      nextCursor: "cursor-1",
      hasMore: false,
    });

    const result = await AdminService.getAllTenantsBilling();

    expect(result).toHaveLength(1);
    expect(mockedCallApi).toHaveBeenCalledTimes(1);
  });

  it("tolerates a legacy flat-array response (no pagination support)", async () => {
    mockedCallApi.mockResolvedValueOnce([tenant("a")] as unknown as TenantBillingInfo[]);

    const result = await AdminService.getAllTenantsBilling();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when a page has no items", async () => {
    mockedCallApi.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
    });

    const result = await AdminService.getAllTenantsBilling();

    expect(result).toEqual([]);
  });
});
