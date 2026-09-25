/**
 * Revogação de sessão com cache curto. Antes, toda request fazia
 * `verifyIdToken(token, true)`, ou seja, uma busca no Firebase Auth por clique.
 * Agora a assinatura segue verificada em toda request e o estado do usuário
 * (desativado / tokensValidAfterTime) fica em cache por até 60s.
 *
 * O que estes testes garantem:
 * - sessão revogada e usuário desativado continuam barrados;
 * - o cache evita a ida à rede, e expira;
 * - o fluxo que já buscou o usuário (claims frescas) não busca de novo;
 * - o auth-context verifica o token SEM checkRevoked e barra o revogado.
 */

const getUser = jest.fn();
const verifyIdToken = jest.fn();
const verifySessionCookie = jest.fn();
const userDocGet = jest.fn();

jest.mock("../../init", () => ({
  auth: {
    getUser: (...a: unknown[]) => getUser(...a),
    verifyIdToken: (...a: unknown[]) => verifyIdToken(...a),
    verifySessionCookie: (...a: unknown[]) => verifySessionCookie(...a),
  },
  db: {
    collection: () => ({ doc: () => ({ get: () => userDocGet() }) }),
  },
}));

import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import type { Request } from "express";
import {
  assertTokenNotRevoked,
  clearRevocationCacheForTest,
  evaluateRevocation,
  invalidateRevocationState,
} from "../token-revocation";
import { resolveAuthContextFromRequest } from "../auth-context";

const AUTH_TIME_S = 1_700_000_000;

function decoded(overrides: Partial<DecodedIdToken> = {}): DecodedIdToken {
  return {
    uid: "u1",
    auth_time: AUTH_TIME_S,
    role: "MASTER",
    tenantId: "t1",
    ...overrides,
  } as DecodedIdToken;
}

function record(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    uid: "u1",
    disabled: false,
    tokensValidAfterTime: new Date((AUTH_TIME_S - 60) * 1000).toUTCString(),
    customClaims: {},
    ...overrides,
  } as UserRecord;
}

const revokedAfterLogin = () =>
  record({ tokensValidAfterTime: new Date((AUTH_TIME_S + 60) * 1000).toUTCString() });

beforeEach(() => {
  delete process.env.AUTH_REVOCATION_CACHE_TTL_MS;
  clearRevocationCacheForTest();
  getUser.mockReset();
  verifyIdToken.mockReset();
  verifySessionCookie.mockReset();
  userDocGet.mockReset();
});

describe("evaluateRevocation", () => {
  it("ok quando a sessão é posterior ao validSince", () => {
    expect(evaluateRevocation({ auth_time: AUTH_TIME_S }, { disabled: false, validSinceMs: (AUTH_TIME_S - 1) * 1000 })).toBe("ok");
  });
  it("revoked quando a sessão é anterior ao validSince", () => {
    expect(evaluateRevocation({ auth_time: AUTH_TIME_S }, { disabled: false, validSinceMs: (AUTH_TIME_S + 1) * 1000 })).toBe("revoked");
  });
  it("disabled vence qualquer outra coisa", () => {
    expect(evaluateRevocation({ auth_time: AUTH_TIME_S }, { disabled: true, validSinceMs: null })).toBe("disabled");
  });
  it("sem validSince é ok", () => {
    expect(evaluateRevocation({ auth_time: AUTH_TIME_S }, { disabled: false, validSinceMs: null })).toBe("ok");
  });
});

describe("assertTokenNotRevoked", () => {
  it("passa quando a sessão é válida", async () => {
    getUser.mockResolvedValue(record());
    await expect(assertTokenNotRevoked(decoded(), "bearer")).resolves.toBeUndefined();
  });

  it("barra ID token revogado com o código do Admin SDK", async () => {
    getUser.mockResolvedValue(revokedAfterLogin());
    await expect(assertTokenNotRevoked(decoded(), "bearer")).rejects.toMatchObject({
      code: "auth/id-token-revoked",
    });
  });

  it("barra session cookie revogado com o código de cookie", async () => {
    getUser.mockResolvedValue(revokedAfterLogin());
    await expect(assertTokenNotRevoked(decoded(), "session_cookie")).rejects.toMatchObject({
      code: "auth/session-cookie-revoked",
    });
  });

  it("barra usuário desativado", async () => {
    getUser.mockResolvedValue(record({ disabled: true }));
    await expect(assertTokenNotRevoked(decoded(), "bearer")).rejects.toMatchObject({
      code: "auth/user-disabled",
    });
  });

  it("cache hit não vai ao Firebase Auth de novo", async () => {
    getUser.mockResolvedValue(record());
    await assertTokenNotRevoked(decoded(), "bearer");
    await assertTokenNotRevoked(decoded(), "bearer");
    await assertTokenNotRevoked(decoded(), "session_cookie");
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("o cache expira e a revogação passa a valer", async () => {
    process.env.AUTH_REVOCATION_CACHE_TTL_MS = "20";
    getUser.mockResolvedValueOnce(record()).mockResolvedValueOnce(revokedAfterLogin());
    await assertTokenNotRevoked(decoded(), "bearer");
    await new Promise((r) => setTimeout(r, 40));
    await expect(assertTokenNotRevoked(decoded(), "bearer")).rejects.toMatchObject({
      code: "auth/id-token-revoked",
    });
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("TTL 0 confere em toda request", async () => {
    process.env.AUTH_REVOCATION_CACHE_TTL_MS = "0";
    getUser.mockResolvedValue(record());
    await assertTokenNotRevoked(decoded(), "bearer");
    await assertTokenNotRevoked(decoded(), "bearer");
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("invalidar o uid (revogação feita nesta instância) vale na hora", async () => {
    getUser.mockResolvedValueOnce(record()).mockResolvedValueOnce(revokedAfterLogin());
    await assertTokenNotRevoked(decoded(), "bearer");
    invalidateRevocationState("u1");
    await expect(assertTokenNotRevoked(decoded(), "bearer")).rejects.toMatchObject({
      code: "auth/id-token-revoked",
    });
  });

  it("registro já buscado pelo chamador é usado sem nova busca", async () => {
    await expect(
      assertTokenNotRevoked(decoded(), "bearer", revokedAfterLogin()),
    ).rejects.toMatchObject({ code: "auth/id-token-revoked" });
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe("resolveAuthContextFromRequest", () => {
  const req = (auth: string) =>
    ({ headers: { authorization: auth }, cookies: {} }) as unknown as Request;

  beforeEach(() => {
    userDocGet.mockResolvedValue({ exists: true, data: () => ({ tenantId: "t1", role: "MASTER" }) });
  });

  it("verifica a assinatura SEM checkRevoked e aceita sessão válida", async () => {
    verifyIdToken.mockResolvedValue(decoded());
    getUser.mockResolvedValue(record());
    const ctx = await resolveAuthContextFromRequest(req("Bearer tok"));
    expect(verifyIdToken).toHaveBeenCalledWith("tok", false);
    expect(ctx.uid).toBe("u1");
  });

  it("barra token de pagante estável (MASTER) revogado", async () => {
    verifyIdToken.mockResolvedValue(decoded());
    getUser.mockResolvedValue(revokedAfterLogin());
    await expect(resolveAuthContextFromRequest(req("Bearer tok"))).rejects.toMatchObject({
      code: "auth/id-token-revoked",
    });
  });

  it("FREE busca o usuário uma vez só (claims frescas + revogação)", async () => {
    verifyIdToken.mockResolvedValue(decoded({ role: "FREE" }));
    getUser.mockResolvedValue(record({ customClaims: { role: "FREE", tenantId: "t1" } }));
    await resolveAuthContextFromRequest(req("Bearer tok"));
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("FREE revogado é barrado pela mesma busca", async () => {
    verifyIdToken.mockResolvedValue(decoded({ role: "FREE" }));
    getUser.mockResolvedValue(revokedAfterLogin());
    await expect(resolveAuthContextFromRequest(req("Bearer tok"))).rejects.toMatchObject({
      code: "auth/id-token-revoked",
    });
  });

  it("assinatura inválida continua rejeitada antes de tudo", async () => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("bad"), { code: "auth/argument-error" }));
    await expect(resolveAuthContextFromRequest(req("Bearer tok"))).rejects.toMatchObject({
      code: "auth/argument-error",
    });
    expect(getUser).not.toHaveBeenCalled();
  });
});
