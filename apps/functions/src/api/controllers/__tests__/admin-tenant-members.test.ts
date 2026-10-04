const tenantUsers: Array<{ id: string; data: Record<string, unknown> }> = [];
const permissionsByUser: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {};
let superAdmin = true;

jest.mock("../../../init", () => ({
  db: {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: tenantUsers.map((u) => ({ id: u.id, data: () => u.data })),
          }),
        }),
      }),
      doc: (uid: string) => ({
        collection: () => ({
          get: async () => ({
            docs: (permissionsByUser[uid] ?? []).map((p) => ({ id: p.id, data: () => p.data })),
          }),
        }),
      }),
    }),
  },
}));

const assertTenantExists = jest.fn(async (_id: string) => undefined);
jest.mock("../../../lib/tenant-resolution", () => ({
  assertTenantExists: (id: string) => assertTenantExists(id),
}));
jest.mock("../../../lib/request-auth", () => ({ isSuperAdminClaim: () => superAdmin }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock("../../middleware/impersonation", () => ({
  resolveTenantOwnerUid: async () => "dono",
}));

import { listTenantMembers } from "../admin-tenant-members.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function call() {
  const res = makeRes();
  await listTenantMembers({ params: { tenantId: "t1" }, user: { uid: "sa" } } as never, res as never);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  superAdmin = true;
  tenantUsers.length = 0;
  tenantUsers.push(
    { id: "vendedor", data: { name: "Zeca", email: "z@x.com", role: "MEMBER", masterId: "dono" } },
    { id: "dono", data: { name: "Ana", email: "a@x.com", role: "MASTER" } },
    { id: "suporte", data: { name: "Suporte", role: "SUPERADMIN" } },
    { id: "gerente", data: { name: "Bia", role: "ADMIN", masterId: "dono" } },
  );
  permissionsByUser.vendedor = [
    { id: "proposals", data: { canView: true, canCreate: true } },
    { id: "transactions", data: { canView: false, canEdit: true } },
  ];
});

describe("GET /v1/admin/tenants/:tenantId/members", () => {
  it("quem nao e superadmin leva 403", async () => {
    superAdmin = false;
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("empresa inexistente leva 404", async () => {
    assertTenantExists.mockRejectedValueOnce(new Error("x"));
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("lista a empresa com o dono primeiro e sem superadmin", async () => {
    const res = await call();
    const { members } = res.json.mock.calls[0][0] as {
      members: Array<{ id: string; isOwner: boolean }>;
    };
    expect(members.map((m) => m.id)).toEqual(["dono", "gerente", "vendedor"]);
    expect(members[0].isOwner).toBe(true);
    expect(members.slice(1).every((m) => !m.isOwner)).toBe(true);
  });

  it("o membro traz as permissoes normalizadas (sem ver, nada mais vale)", async () => {
    const res = await call();
    const { members } = res.json.mock.calls[0][0] as {
      members: Array<{ id: string; permissions: Record<string, Record<string, boolean>> }>;
    };
    const vendedor = members.find((m) => m.id === "vendedor")!;
    expect(vendedor.permissions.proposals).toEqual({
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
    });
    expect(vendedor.permissions.transactions.canEdit).toBe(false);
  });
});
