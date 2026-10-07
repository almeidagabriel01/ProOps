import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O Perfil do "Acessar Painel" mostrava o e-mail de um membro: a busca antiga
 * procurava `role == "admin"` (o dono costuma estar como ADMIN ou MASTER) e,
 * sem achar, devolvia qualquer usuário da empresa. O dono agora é o mesmo que o
 * backend marca como "Dono" na lista de membros.
 */

const getTenantMembers = vi.fn();
const getDoc = vi.fn();

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  getDoc: (ref: { id: string }) => getDoc(ref),
  updateDoc: vi.fn(),
}));
vi.mock("@/services/admin-service", () => ({
  AdminService: { getTenantMembers: (id: string) => getTenantMembers(id) },
}));

import { UserService, clearTenantOwnerCacheForTest } from "../user-service";

function member(id: string, role: string, isOwner: boolean, masterId: string | null = null) {
  return {
    id,
    name: id,
    email: `${id}@empresa.com`,
    role,
    masterId,
    isOwner,
    createdAt: null,
    permissions: {},
  };
}

function userSnap(id: string, data: Record<string, unknown>) {
  return { id, exists: () => true, data: () => data };
}

beforeEach(() => {
  clearTenantOwnerCacheForTest();
  getTenantMembers.mockReset();
  getDoc.mockReset();
  getDoc.mockImplementation((ref: { id: string }) =>
    Promise.resolve(userSnap(ref.id, { name: ref.id, email: `${ref.id}@empresa.com` })),
  );
});

describe("UserService.getTenantOwnerUser", () => {
  it("caso da AWA: dono ADMIN com um membro admin minúsculo antes na lista", async () => {
    getTenantMembers.mockResolvedValue([
      member("membro", "ADMIN", false, "dono"),
      member("dono", "ADMIN", true),
    ]);
    const owner = await UserService.getTenantOwnerUser("awa");
    expect(owner?.id).toBe("dono");
    expect(owner?.email).toBe("dono@empresa.com");
  });

  it("dono gravado como MASTER", async () => {
    getTenantMembers.mockResolvedValue([
      member("vendedor", "MEMBER", false, "dono"),
      member("dono", "MASTER", true),
    ]);
    expect((await UserService.getTenantOwnerUser("t1"))?.id).toBe("dono");
  });

  it("empresa sem dono devolve null, nunca um membro", async () => {
    getTenantMembers.mockResolvedValue([member("vendedor", "MEMBER", false, "x")]);
    expect(await UserService.getTenantOwnerUser("t2")).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("guarda por empresa: a faixa do topo e o Perfil não buscam duas vezes", async () => {
    getTenantMembers.mockResolvedValue([member("dono", "ADMIN", true)]);
    await UserService.getTenantOwnerUser("t3");
    await UserService.getTenantOwnerUser("t3");
    expect(getTenantMembers).toHaveBeenCalledTimes(1);
  });

  it("falha não fica guardada", async () => {
    getTenantMembers.mockRejectedValueOnce(new Error("rede"));
    await expect(UserService.getTenantOwnerUser("t4")).rejects.toThrow("rede");
    getTenantMembers.mockResolvedValue([member("dono", "ADMIN", true)]);
    expect((await UserService.getTenantOwnerUser("t4"))?.id).toBe("dono");
  });
});
