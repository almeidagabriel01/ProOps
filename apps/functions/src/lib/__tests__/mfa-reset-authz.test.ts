import { authorizeMfaReset } from "../mfa-reset-authz";

const SUPERADMIN = {
  isSuperAdmin: true,
  isTenantAdmin: true,
  requesterUid: "super-1",
  requesterTenantId: "",
};

const MASTER = {
  isSuperAdmin: false,
  isTenantAdmin: true,
  requesterUid: "master-1",
  requesterTenantId: "tenant-A",
};

const MEMBER = {
  isSuperAdmin: false,
  isTenantAdmin: false,
  requesterUid: "member-1",
  requesterTenantId: "tenant-A",
};

describe("authorizeMfaReset", () => {
  it("super admin can reset any user (different tenant)", () => {
    const result = authorizeMfaReset({
      ...SUPERADMIN,
      target: { exists: true, tenantId: "tenant-Z", masterId: "other" },
    });
    expect(result.allowed).toBe(true);
  });

  it("master can reset a member of own tenant", () => {
    const result = authorizeMfaReset({
      ...MASTER,
      target: {
        exists: true,
        tenantId: "tenant-A",
        masterId: "master-1",
      },
    });
    expect(result.allowed).toBe(true);
  });

  it("master from another tenant is denied with 403 (cross-tenant)", () => {
    const result = authorizeMfaReset({
      ...MASTER,
      requesterTenantId: "tenant-B",
      target: {
        exists: true,
        tenantId: "tenant-A",
        masterId: "master-1",
      },
    });
    expect(result).toEqual({
      allowed: false,
      status: 403,
      message: "Permissão negada.",
      crossTenant: true,
    });
  });

  it("tenant admin who is not the member's master is denied with 403", () => {
    const result = authorizeMfaReset({
      ...MASTER,
      target: {
        exists: true,
        tenantId: "tenant-A",
        masterId: "another-master",
      },
    });
    expect(result).toEqual({
      allowed: false,
      status: 403,
      message: "Permissão negada.",
    });
  });

  it("plain member is denied with 403", () => {
    const result = authorizeMfaReset({
      ...MEMBER,
      target: { exists: true, tenantId: "tenant-A", masterId: "member-1" },
    });
    expect(result).toEqual({
      allowed: false,
      status: 403,
      message: "Permissão negada.",
    });
  });

  it("non-existent target returns 404 even for super admin", () => {
    const result = authorizeMfaReset({
      ...SUPERADMIN,
      target: { exists: false },
    });
    expect(result).toEqual({
      allowed: false,
      status: 404,
      message: "Usuário não encontrado.",
    });
  });
});
