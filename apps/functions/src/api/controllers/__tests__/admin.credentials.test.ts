/**
 * updateCredentials: o painel troca e-mail e senha de QUALQUER usuario.
 *
 * - Nao pode alcancar outro superadmin (seria tomar o painel sem o 2o fator).
 * - E-mail passa pela mesma validacao do cadastro, normalizado.
 * - Trocar credencial derruba as sessoes abertas com a antiga.
 */

const updateUser = jest.fn(async () => undefined);
const revokeRefreshTokens = jest.fn(async () => undefined);
let targetDoc: Record<string, unknown> | null = null;

jest.mock("../../../init", () => ({
  auth: {
    updateUser: (...a: unknown[]) => updateUser(...(a as [])),
    revokeRefreshTokens: (...a: unknown[]) => revokeRefreshTokens(...(a as [])),
  },
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: targetDoc !== null,
          get: (field: string) => targetDoc?.[field],
          data: () => targetDoc,
        }),
        update: jest.fn(async () => undefined),
      }),
    }),
    runTransaction: jest.fn(),
  },
}));

const auditAdminAction = jest.fn(async () => undefined);
jest.mock("../../../lib/admin-audit", () => ({
  auditAdminAction: (...a: unknown[]) => auditAdminAction(...(a as [])),
}));
jest.mock("../../../lib/request-auth", () => ({
  isSuperAdminClaim: () => true,
  isTenantAdminClaim: () => true,
}));
jest.mock("../../../lib/contact-validation", () => ({
  validateEmailForSignup: jest.fn(async (email: string) =>
    email.includes("@")
      ? { valid: true, normalizedEmail: email.trim().toLowerCase() }
      : { valid: false, reason: "Email inválido." },
  ),
  normalizeBrazilPhoneNumber: (v: string) => v,
  validateBrazilMobilePhone: jest.fn(),
}));
jest.mock("../../../stripe/stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
jest.mock("../../../stripe/stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../../../billing", () => ({ enqueueTenantSync: jest.fn(), isStale: jest.fn() }));
jest.mock("../../../billing/price-drift", () => ({ detectPriceDrift: jest.fn() }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { updateCredentials } from "../admin.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

async function run(body: Record<string, unknown>) {
  const res = makeRes();
  await updateCredentials({ body, user: { uid: "sa" } } as never, res as never);
  return res;
}

beforeEach(() => {
  updateUser.mockClear();
  revokeRefreshTokens.mockClear();
  auditAdminAction.mockClear();
  targetDoc = { role: "admin", tenantId: "t1" };
});

describe("updateCredentials", () => {
  it("recusa alvo superadmin sem tocar no Auth", async () => {
    targetDoc = { role: "superadmin" };
    const res = await run({ userId: "u2", password: "novasenha" });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("usuario inexistente da 404", async () => {
    targetDoc = null;
    const res = await run({ userId: "nada", password: "novasenha" });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("normaliza o e-mail, derruba as sessoes e audita", async () => {
    const res = await run({ userId: "u1", email: " Dono@Empresa.com " });
    expect(res.status).not.toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith("u1", { email: "dono@empresa.com" });
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u1");
    expect(auditAdminAction).toHaveBeenCalledWith(
      expect.anything(),
      "super_admin_credentials_updated",
      expect.objectContaining({ tenantId: "t1", targetId: "u1", reason: "email" }),
    );
  });

  it("senha curta e recusada (antes era ignorada em silencio)", async () => {
    const res = await run({ userId: "u1", password: "123" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("e-mail invalido e recusado", async () => {
    const res = await run({ userId: "u1", email: "sem-arroba" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("e-mail ja usado vira 409", async () => {
    updateUser.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "auth/email-already-exists" }) as never,
    );
    const res = await run({ userId: "u1", email: "outro@empresa.com" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
