/**
 * Regressao: no "Acessar Painel" a linha do WhatsApp em Contas vinculadas
 * mostrava o numero e o 2FA do proprio superadmin, e nao o do dono da empresa.
 */

const getLinkedAccounts = jest.fn(async () => []);
jest.mock("../../services/linked-accounts.service", () => ({
  getLinkedAccounts: (...a: unknown[]) => getLinkedAccounts(...(a as [])),
}));
jest.mock("../../../lib/logger", () => ({ logger: { error: jest.fn() } }));

import { getLinkedAccountsHandler } from "../linked-accounts.controller";

async function call(user: Record<string, unknown>) {
  const res: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  await getLinkedAccountsHandler({ user } as never, res as never);
  return (getLinkedAccounts.mock.calls[0] as unknown as unknown[]) ?? [];
}

beforeEach(() => getLinkedAccounts.mockClear());

describe("WhatsApp de quem em Contas vinculadas", () => {
  it("usuario comum: o dele", async () => {
    const [tenantId, uid] = await call({ uid: "u1", tenantId: "t1", role: "MASTER" });
    expect([tenantId, uid]).toEqual(["t1", "u1"]);
  });

  it("superadmin na visao da empresa: o do dono", async () => {
    const [, uid] = await call({
      uid: "root",
      tenantId: "alvo",
      role: "SUPERADMIN",
      isSuperAdmin: true,
      impersonation: { targetTenantId: "alvo", ownerUid: "dono", writeEnabled: false },
    });
    expect(uid).toBe("dono");
  });

  it("superadmin vendo um membro: o do membro", async () => {
    const [, uid] = await call({
      uid: "vendedor",
      tenantId: "alvo",
      role: "MEMBER",
      isSuperAdmin: false,
      impersonation: { targetTenantId: "alvo", ownerUid: "dono", memberUid: "vendedor", actorUid: "root" },
    });
    expect(uid).toBe("vendedor");
  });

  it("empresa sem dono encontrado: cai no proprio uid em vez de quebrar", async () => {
    const [, uid] = await call({
      uid: "root",
      tenantId: "alvo",
      role: "SUPERADMIN",
      isSuperAdmin: true,
      impersonation: { targetTenantId: "alvo", ownerUid: null, writeEnabled: false },
    });
    expect(uid).toBe("root");
  });
});
