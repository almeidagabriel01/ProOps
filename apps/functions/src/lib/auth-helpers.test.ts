/**
 * Unit tests for resolveUserAndTenant — specifically the reuse of the
 * users/{uid} snapshot preloaded by the auth middleware (claims.userDoc),
 * which must eliminate the second Firestore read on the request hot path.
 */

const docGetMock = jest.fn();

jest.mock("../init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn((id: string) => ({
        id,
        get: () => docGetMock(id),
      })),
    })),
  },
}));

import { resolveUserAndTenant } from "./auth-helpers";

beforeEach(() => {
  jest.clearAllMocks();
  docGetMock.mockImplementation((id: string) => {
    throw new Error(`FIRESTORE_SHOULD_NOT_BE_CALLED:${id}`);
  });
});

describe("resolveUserAndTenant with preloaded userDoc", () => {
  it("does not re-read users/{uid} when claims.userDoc is provided (MASTER)", async () => {
    const result = await resolveUserAndTenant("uid-1", {
      uid: "uid-1",
      role: "MASTER",
      tenantId: "tenant-1",
      userDoc: { role: "MASTER", tenantId: "tenant-1" },
    });

    expect(result.tenantId).toBe("tenant-1");
    expect(result.isMaster).toBe(true);
    expect(result.userData.role).toBe("MASTER");
    expect(docGetMock).not.toHaveBeenCalled();
  });

  it("throws User not found when userDoc is null (doc inexistente)", async () => {
    await expect(
      resolveUserAndTenant("uid-1", {
        uid: "uid-1",
        role: "MASTER",
        tenantId: "tenant-1",
        userDoc: null,
      }),
    ).rejects.toThrow("User not found");
    expect(docGetMock).not.toHaveBeenCalled();
  });

  it("still detects FORBIDDEN_TENANT_MISMATCH from preloaded doc", async () => {
    await expect(
      resolveUserAndTenant("uid-1", {
        uid: "uid-1",
        role: "MASTER",
        tenantId: "tenant-1",
        userDoc: { role: "MASTER", tenantId: "tenant-OTHER" },
      }),
    ).rejects.toThrow("FORBIDDEN_TENANT_MISMATCH");
    expect(docGetMock).not.toHaveBeenCalled();
  });

  it("MEMBER with preloaded userDoc only fetches the master doc", async () => {
    docGetMock.mockImplementation((id: string) => {
      if (id === "master-1") {
        return {
          exists: true,
          data: () => ({ role: "MASTER", tenantId: "tenant-1" }),
        };
      }
      throw new Error(`FIRESTORE_SHOULD_NOT_BE_CALLED:${id}`);
    });

    const result = await resolveUserAndTenant("uid-2", {
      uid: "uid-2",
      role: "MEMBER",
      tenantId: "tenant-1",
      masterId: "master-1",
      userDoc: { role: "MEMBER", tenantId: "tenant-1", masterId: "master-1" },
    });

    expect(result.tenantId).toBe("tenant-1");
    expect(result.isMaster).toBe(false);
    expect(result.masterData.role).toBe("MASTER");
    expect(docGetMock).toHaveBeenCalledTimes(1);
    expect(docGetMock).toHaveBeenCalledWith("master-1");
  });
});

describe("resolveUserAndTenant without preloaded userDoc (fallback)", () => {
  it("fetches users/{uid} from Firestore as before", async () => {
    docGetMock.mockImplementation((id: string) => {
      if (id === "uid-3") {
        return {
          exists: true,
          data: () => ({ role: "MASTER", tenantId: "tenant-3" }),
        };
      }
      throw new Error(`FIRESTORE_SHOULD_NOT_BE_CALLED:${id}`);
    });

    const result = await resolveUserAndTenant("uid-3", {
      uid: "uid-3",
      role: "MASTER",
      tenantId: "tenant-3",
    });

    expect(result.tenantId).toBe("tenant-3");
    expect(docGetMock).toHaveBeenCalledWith("uid-3");
  });

  it("throws User not found when the doc does not exist", async () => {
    docGetMock.mockImplementation(() => ({ exists: false, data: () => undefined }));

    await expect(
      resolveUserAndTenant("uid-4", {
        uid: "uid-4",
        role: "MASTER",
        tenantId: "tenant-4",
      }),
    ).rejects.toThrow("User not found");
  });
});
