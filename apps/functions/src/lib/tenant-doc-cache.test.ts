/**
 * Unit tests for the shared 5s tenant-doc cache — single Firestore read source
 * for require-active-subscription and tenant-plan-policy.
 */

const tenantGetMock = jest.fn();

jest.mock("../init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn((id: string) => ({
        get: () => tenantGetMock(id),
      })),
    })),
  },
}));

import { getTenantDocCached, invalidateTenantDoc } from "./tenant-doc-cache";

beforeEach(() => {
  jest.clearAllMocks();
  tenantGetMock.mockResolvedValue({
    exists: true,
    data: () => ({ subscriptionStatus: "active" }),
  });
});

describe("getTenantDocCached", () => {
  it("reads Firestore once for consecutive calls within TTL", async () => {
    invalidateTenantDoc("t-cache");
    const a = await getTenantDocCached("t-cache");
    const b = await getTenantDocCached("t-cache");

    expect(a.exists).toBe(true);
    expect(a.data?.subscriptionStatus).toBe("active");
    expect(b).toEqual(a);
    expect(tenantGetMock).toHaveBeenCalledTimes(1);
  });

  it("re-reads after invalidateTenantDoc", async () => {
    invalidateTenantDoc("t-inv");
    await getTenantDocCached("t-inv");
    invalidateTenantDoc("t-inv");
    await getTenantDocCached("t-inv");

    expect(tenantGetMock).toHaveBeenCalledTimes(2);
  });

  it("caches non-existing tenants too (negative caching)", async () => {
    tenantGetMock.mockResolvedValue({ exists: false, data: () => undefined });
    invalidateTenantDoc("t-missing");

    const a = await getTenantDocCached("t-missing");
    const b = await getTenantDocCached("t-missing");

    expect(a.exists).toBe(false);
    expect(a.data).toBeUndefined();
    expect(b.exists).toBe(false);
    expect(tenantGetMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache rejected reads", async () => {
    tenantGetMock.mockRejectedValueOnce(new Error("firestore down"));
    invalidateTenantDoc("t-err");

    await expect(getTenantDocCached("t-err")).rejects.toThrow("firestore down");
    const after = await getTenantDocCached("t-err");
    expect(after.exists).toBe(true);
    expect(tenantGetMock).toHaveBeenCalledTimes(2);
  });
});
