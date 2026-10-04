import { describe, expect, it } from "vitest";
import { resolveBlockedSessionIdentity } from "../blocked-session-identity";

describe("resolveBlockedSessionIdentity", () => {
  const ownerDoc = { role: "MASTER", tenantId: "tenant-demo" };

  it("claim vazia com doc de dono: a tela usa o doc (caso da conta montada à mão)", () => {
    expect(resolveBlockedSessionIdentity({}, ownerDoc)).toEqual({
      role: "MASTER",
      tenantId: "tenant-demo",
      masterId: "",
      isSuperAdmin: false,
    });
  });

  it("claim free com doc de dono: o doc vence, a pessoa não é tratada como demonstração", () => {
    const identity = resolveBlockedSessionIdentity({ role: "free", tenantId: "tenant-demo" }, ownerDoc);
    expect(identity.role).toBe("MASTER");
    expect(identity.tenantId).toBe("tenant-demo");
  });

  it("claim sem tenant e doc com companyId legado", () => {
    expect(resolveBlockedSessionIdentity({ role: "admin" }, { role: "admin", companyId: "tenant-x" }).tenantId).toBe(
      "tenant-x",
    );
  });

  it("doc ausente: as claims bastam", () => {
    expect(resolveBlockedSessionIdentity({ role: "MEMBER", tenantId: "t1", masterId: "m1" }, null)).toEqual({
      role: "MEMBER",
      tenantId: "t1",
      masterId: "m1",
      isSuperAdmin: false,
    });
  });

  it("membro: o responsável vem do doc, com a claim como reserva", () => {
    expect(resolveBlockedSessionIdentity({ masterId: "m-claim" }, { role: "member", tenantId: "t1" }).masterId).toBe(
      "m-claim",
    );
    expect(
      resolveBlockedSessionIdentity({ masterId: "m-claim" }, { role: "member", tenantId: "t1", masterId: "m-doc" })
        .masterId,
    ).toBe("m-doc");
  });

  it("conta free de verdade (doc free) continua free", () => {
    expect(resolveBlockedSessionIdentity({ role: "free" }, { role: "free", tenantId: "t1" }).role).toBe("FREE");
  });

  it("super admin pela claim ou pelo papel", () => {
    expect(resolveBlockedSessionIdentity({ isSuperAdmin: true }, ownerDoc).isSuperAdmin).toBe(true);
    expect(resolveBlockedSessionIdentity({ role: "SUPERADMIN" }, null).isSuperAdmin).toBe(true);
    expect(resolveBlockedSessionIdentity({}, { role: "superadmin" }).isSuperAdmin).toBe(true);
  });
});
