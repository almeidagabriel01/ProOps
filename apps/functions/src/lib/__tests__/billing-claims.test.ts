/**
 * Status de cobrança atualiza as claims de toda a empresa e NÃO revoga a
 * sessão: quem perde o acesso fica logado em /subscription-blocked, com a
 * mensagem, em vez de cair no login sem explicação.
 */

const setCustomUserClaims = jest.fn(async (_uid: string, _claims: Record<string, unknown>) => undefined);
const revokeRefreshTokens = jest.fn(async (_uid: string) => undefined);

jest.mock("../../init", () => ({
  auth: {
    getUser: async (uid: string) => ({ uid, customClaims: { tenantId: "t1", role: uid === "dono" ? "MASTER" : "MEMBER" } }),
    setCustomUserClaims: (uid: string, claims: Record<string, unknown>) => setCustomUserClaims(uid, claims),
    revokeRefreshTokens: (uid: string) => revokeRefreshTokens(uid),
  },
  db: {
    collection: () => {
      const query = {
        where: () => query,
        limit: () => query,
        startAfter: () => query,
        get: async () => ({ empty: false, docs: [{ id: "dono" }, { id: "membro" }] }),
      };
      return query;
    },
  },
}));
jest.mock("../logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { applyBillingClaimsToTenantUsers } from "../billing-claims";

beforeEach(() => jest.clearAllMocks());

it.each(["unpaid", "payment_failed", "inactive", "canceled", "past_due"])(
  "%s atualiza as claims do dono e do membro sem revogar a sessão",
  async (status) => {
    await applyBillingClaimsToTenantUsers("t1", { subscriptionStatus: status });

    expect(setCustomUserClaims).toHaveBeenCalledTimes(2);
    expect(setCustomUserClaims).toHaveBeenCalledWith(
      "membro",
      expect.objectContaining({ tenantId: "t1", role: "MEMBER", subscriptionStatus: status }),
    );
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  },
);
