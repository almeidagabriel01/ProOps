import { describe, it, expect } from "vitest";
import { buildMemberViewPermissions, resolveMemberViewHome } from "@/lib/permissions/member-view";
import type { TenantMemberInfo } from "@/services/admin-service";

function member(overrides: Partial<TenantMemberInfo> = {}): TenantMemberInfo {
  return {
    id: "vendedor",
    name: "Vendedor",
    email: "v@x.com",
    role: "MEMBER",
    masterId: "dono",
    isOwner: false,
    createdAt: null,
    permissions: {
      proposals: { canView: true, canCreate: true, canEdit: false, canDelete: false },
      transactions: { canView: false, canCreate: false, canEdit: false, canDelete: false },
    },
    ...overrides,
  };
}

describe("permissões na visão de membro", () => {
  it("membro vira MEMBER com o mapa dele, e não master", () => {
    const perms = buildMemberViewPermissions(member());
    expect(perms.role).toBe("MEMBER");
    expect(perms.masterId).toBe("dono");
    expect(perms.pages.proposals.canView).toBe(true);
    expect(perms.pages.proposals.canEdit).toBe(false);
    expect(perms.pages.transactions.canView).toBe(false);
    expect(perms.pages.dashboard).toBeUndefined();
  });

  it("o perfil fica sempre visível, como para o próprio membro", () => {
    const perms = buildMemberViewPermissions(member({ permissions: {} }));
    expect(perms.pages.profile.canView).toBe(true);
  });

  it.each(["ADMIN", "MASTER", "WK"])("administrador (%s) é visto como master", (role) => {
    expect(buildMemberViewPermissions(member({ role, permissions: {} })).role).toBe("MASTER");
  });
});

describe("início do membro visto", () => {
  it("cai na primeira tela que ele vê, como no login dele", () => {
    expect(resolveMemberViewHome(member())).toBe("/proposals");
  });

  it("com o Dashboard liberado, abre no Dashboard", () => {
    const m = member();
    m.permissions.dashboard = { canView: true, canCreate: false, canEdit: false, canDelete: false };
    expect(resolveMemberViewHome(m)).toBe("/dashboard");
  });

  it("sem tela nenhuma, abre no perfil", () => {
    expect(resolveMemberViewHome(member({ permissions: {} }))).toBe("/profile");
  });

  it("administrador abre no Dashboard", () => {
    expect(resolveMemberViewHome(member({ role: "ADMIN", permissions: {} }))).toBe("/dashboard");
  });
});
