const verifyIdToken = jest.fn();
const userGet = jest.fn();

jest.mock("../../init", () => ({
  auth: { verifyIdToken: (...a: unknown[]) => verifyIdToken(...a) },
  db: { collection: () => ({ doc: () => ({ get: () => userGet() }) }) },
}));

import { clearActivityIdentityCacheForTest, resolveActivityIdentity } from "../tenant-activity-identity";

const NOW = Date.parse("2026-10-03T15:00:00.000Z");
const EXP = Math.floor(NOW / 1000) + 3600;

beforeEach(() => {
  verifyIdToken.mockReset();
  userGet.mockReset();
  clearActivityIdentityCacheForTest();
  delete process.env.SUPERADMIN_ALLOWLIST;
});

describe("resolveActivityIdentity", () => {
  it("token com claims: não lê o doc do usuário", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", role: "MASTER", tenantId: "t1", exp: EXP });
    await expect(resolveActivityIdentity("tok-a", NOW)).resolves.toEqual({
      uid: "u1",
      tenantId: "t1",
      role: "master",
      isSuperAdmin: false,
    });
    expect(userGet).not.toHaveBeenCalled();
  });

  it("conta recém-criada sem claims: usa o doc do usuário (é a jornada que importa)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u2", exp: EXP });
    userGet.mockResolvedValue({ exists: true, data: () => ({ role: "free", tenantId: "tenant_u2" }) });
    await expect(resolveActivityIdentity("tok-b", NOW)).resolves.toMatchObject({
      tenantId: "tenant_u2",
      role: "free",
      isSuperAdmin: false,
    });
  });

  it("super admin pelo papel ou pela allowlist", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u3", role: "superadmin", exp: EXP });
    userGet.mockResolvedValue({ exists: false });
    await expect(resolveActivityIdentity("tok-c", NOW)).resolves.toMatchObject({ isSuperAdmin: true });

    process.env.SUPERADMIN_ALLOWLIST = "ops@proops.com.br";
    verifyIdToken.mockResolvedValue({ uid: "u4", role: "master", tenantId: "t4", email: "OPS@proops.com.br", exp: EXP });
    await expect(resolveActivityIdentity("tok-d", NOW)).resolves.toMatchObject({ isSuperAdmin: true });
  });

  it("token inválido devolve null sem lançar", async () => {
    verifyIdToken.mockRejectedValue(new Error("expired"));
    await expect(resolveActivityIdentity("tok-e", NOW)).resolves.toBeNull();
    await expect(resolveActivityIdentity(undefined, NOW)).resolves.toBeNull();
    await expect(resolveActivityIdentity("", NOW)).resolves.toBeNull();
  });

  it("o mesmo token não é verificado de novo dentro do cache", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u5", role: "free", tenantId: "t5", exp: EXP });
    await resolveActivityIdentity("tok-f", NOW);
    await resolveActivityIdentity("tok-f", NOW + 60_000);
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
  });

  it("o cache não passa da validade do token", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u6", role: "free", tenantId: "t6", exp: Math.floor(NOW / 1000) + 30 });
    await resolveActivityIdentity("tok-g", NOW);
    await resolveActivityIdentity("tok-g", NOW + 60_000);
    expect(verifyIdToken).toHaveBeenCalledTimes(2);
  });
});
