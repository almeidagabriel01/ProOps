/**
 * Unit tests for tenant-resolution.ts — the centralized super-admin
 * cross-tenant resolution, validation and write-audit choke point.
 */

type Existence = { tenants: boolean; companies: boolean; usersFound: boolean };

let mockExistence: Existence = {
  tenants: false,
  companies: false,
  usersFound: false,
};

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: async () => ({
          exists:
            name === "tenants"
              ? mockExistence.tenants
              : name === "companies"
                ? mockExistence.companies
                : false,
        }),
      }),
      where: () => ({
        limit: () => ({
          get: async () => ({ empty: !mockExistence.usersFound }),
        }),
      }),
    }),
  },
}));

jest.mock("../security-observability", () => ({
  writeSecurityAuditEvent: jest.fn(),
  incrementSecurityCounter: jest.fn(),
}));

import type { Request } from "express";
import {
  assertTenantExists,
  auditSuperAdminCrossTenantWrite,
  resolveEffectiveTenantId,
} from "../tenant-resolution";
import {
  incrementSecurityCounter,
  writeSecurityAuditEvent,
} from "../security-observability";

const mockWriteAudit = writeSecurityAuditEvent as jest.Mock;
const mockIncrement = incrementSecurityCounter as jest.Mock;

let tenantCounter = 0;
function uniqueTenantId(prefix: string): string {
  tenantCounter += 1;
  return `${prefix}-${tenantCounter}`;
}

function makeReq(opts: {
  method?: string;
  header?: string;
  user?: { uid?: string; tenantId?: string; isSuperAdmin?: boolean };
}): Request {
  return {
    method: opts.method || "POST",
    headers: opts.header ? { "x-tenant-id": opts.header } : {},
    user: opts.user,
    originalUrl: "/v1/resource",
    path: "/v1/resource",
    requestId: "req-test",
  } as unknown as Request;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExistence = { tenants: false, companies: false, usersFound: false };
});

describe("assertTenantExists", () => {
  it("throws on an empty tenantId", async () => {
    await expect(assertTenantExists("")).rejects.toThrow(/inválida/i);
  });

  it("resolves when a tenants document exists", async () => {
    mockExistence.tenants = true;
    await expect(assertTenantExists(uniqueTenantId("t"))).resolves.toBeUndefined();
  });

  it("resolves via legacy users fallback when no tenants/companies doc exists", async () => {
    mockExistence.usersFound = true;
    await expect(assertTenantExists(uniqueTenantId("t"))).resolves.toBeUndefined();
  });

  it("throws when the tenant cannot be found anywhere", async () => {
    await expect(assertTenantExists(uniqueTenantId("t"))).rejects.toThrow(
      /inválida/i,
    );
  });
});

describe("resolveEffectiveTenantId", () => {
  it("ignores header/body overrides for regular users", async () => {
    const own = uniqueTenantId("own");
    const other = uniqueTenantId("other");
    const req = makeReq({
      header: other,
      user: { uid: "u1", tenantId: own, isSuperAdmin: false },
    });

    const result = await resolveEffectiveTenantId(req, {
      bodyTargetTenantId: other,
    });

    expect(result).toEqual({ tenantId: own, impersonated: false });
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  it("resolves and audits a super admin write to an existing target tenant", async () => {
    mockExistence.tenants = true;
    const target = uniqueTenantId("target");
    const req = makeReq({
      method: "POST",
      header: target,
      user: { uid: "admin", tenantId: "", isSuperAdmin: true },
    });

    const result = await resolveEffectiveTenantId(req);

    expect(result).toEqual({ tenantId: target, impersonated: true });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "super_admin_tenant_write",
        tenantId: target,
        uid: "admin",
      }),
    );
    expect(mockIncrement).toHaveBeenCalledWith(
      "super_admin_tenant_write",
      expect.any(Object),
    );
  });

  it("does not audit a super admin read (GET) of another tenant", async () => {
    mockExistence.tenants = true;
    const target = uniqueTenantId("target");
    const req = makeReq({
      method: "GET",
      header: target,
      user: { uid: "admin", tenantId: "", isSuperAdmin: true },
    });

    const result = await resolveEffectiveTenantId(req);

    expect(result).toEqual({ tenantId: target, impersonated: true });
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  it("rejects a super admin override to a non-existent tenant", async () => {
    const target = uniqueTenantId("ghost");
    const req = makeReq({
      method: "POST",
      header: target,
      user: { uid: "admin", tenantId: "", isSuperAdmin: true },
    });

    await expect(resolveEffectiveTenantId(req)).rejects.toThrow(/inválida/i);
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  it("falls back to the super admin's own tenant when no override is provided", async () => {
    const own = uniqueTenantId("own");
    const req = makeReq({
      method: "POST",
      user: { uid: "admin", tenantId: own, isSuperAdmin: true },
    });

    const result = await resolveEffectiveTenantId(req);

    expect(result).toEqual({ tenantId: own, impersonated: false });
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });
});

describe("auditSuperAdminCrossTenantWrite", () => {
  it("emits an audit event and a metrics counter", () => {
    auditSuperAdminCrossTenantWrite({
      uid: "admin",
      tenantId: "tenant-x",
      route: "/v1/resource",
      requestId: "req-1",
    });

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "super_admin_tenant_write",
        tenantId: "tenant-x",
        uid: "admin",
      }),
    );
    expect(mockIncrement).toHaveBeenCalledWith(
      "super_admin_tenant_write",
      expect.objectContaining({ tenantId: "tenant-x" }),
    );
  });
});
