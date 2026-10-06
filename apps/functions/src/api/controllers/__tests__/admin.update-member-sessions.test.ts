/**
 * O dono troca a senha (ou o e-mail) de um membro na tela de Equipe. A troca
 * pelo painel do superadmin e pela própria pessoa já derrubava as sessões
 * abertas com a credencial antiga; a do dono não, e quem tinha a senha antiga
 * (o funcionário que saiu, por exemplo) seguia logado até a sessão expirar.
 */

const updateUser = jest.fn(async () => undefined);
const revokeRefreshTokens = jest.fn(async () => undefined);
const invalidateRevocationState = jest.fn();

jest.mock("../../../init", () => ({
  auth: {
    updateUser: (...a: unknown[]) => updateUser(...(a as [])),
    revokeRefreshTokens: (...a: unknown[]) => revokeRefreshTokens(...(a as [])),
  },
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ masterId: "dono", tenantId: "t1", email: "ana@empresa.com" }),
        }),
      }),
    }),
    runTransaction: async (fn: (t: unknown) => Promise<void>) => fn({ update: () => undefined }),
  },
}));
jest.mock("../../../lib/token-revocation", () => ({
  invalidateRevocationState: (...a: unknown[]) => invalidateRevocationState(...a),
}));
jest.mock("../../../lib/admin-audit", () => ({ auditAdminAction: jest.fn(async () => undefined) }));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => false,
  isTenantAdminClaim: () => true,
}));
jest.mock("../../../lib/contact-validation", () => ({
  validateEmailForSignup: jest.fn(async (email: string) => ({ valid: true, normalizedEmail: email.trim().toLowerCase() })),
  normalizeBrazilPhoneNumber: (v: string) => v,
  validateBrazilMobilePhone: jest.fn(() => ({ valid: true })),
}));
jest.mock("../../../stripe/stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { updateMember } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function run(body: Record<string, unknown>) {
  const res = makeRes();
  await updateMember({ params: { id: "ana" }, body, user: { uid: "dono" } } as never, res as never);
  return res;
}

beforeEach(() => {
  updateUser.mockClear();
  revokeRefreshTokens.mockClear();
  invalidateRevocationState.mockClear();
});

describe("updateMember: sessões do membro", () => {
  it("trocar a senha derruba as sessões abertas", async () => {
    const res = await run({ password: "novasenha123" });
    expect(res.status).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith("ana", { password: "novasenha123" });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("ana");
    expect(invalidateRevocationState).toHaveBeenCalledWith("ana");
  });

  it("trocar o e-mail também derruba", async () => {
    await run({ email: "ana.nova@empresa.com" });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("ana");
  });

  it("trocar só o nome não desloga ninguém", async () => {
    await run({ name: "Ana Paula" });
    expect(updateUser).toHaveBeenCalledWith("ana", { displayName: "Ana Paula" });
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
