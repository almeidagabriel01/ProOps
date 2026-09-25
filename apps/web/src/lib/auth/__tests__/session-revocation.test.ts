/**
 * Revogação do session cookie na rota de billing, com cache de 60s. Sessão
 * revogada e usuário desativado seguem barrados com os códigos do Admin SDK.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecodedIdToken } from "firebase-admin/auth";
import {
  SESSION_REVOCATION_TTL_MS,
  assertSessionNotRevoked,
  clearSessionRevocationCacheForTest,
} from "../session-revocation";

const AUTH_TIME = 1_700_000_000;
const NOW = AUTH_TIME * 1000 + 10_000;
const decoded = { uid: "u1", auth_time: AUTH_TIME } as DecodedIdToken;
const valid = { disabled: false, tokensValidAfterTime: new Date((AUTH_TIME - 60) * 1000).toUTCString() };
const revoked = { disabled: false, tokensValidAfterTime: new Date((AUTH_TIME + 5) * 1000).toUTCString() };

beforeEach(() => clearSessionRevocationCacheForTest());

describe("assertSessionNotRevoked", () => {
  it("sessão válida passa", async () => {
    await expect(assertSessionNotRevoked(decoded, async () => valid, NOW)).resolves.toBeUndefined();
  });

  it("sessão revogada lança auth/session-cookie-revoked", async () => {
    await expect(assertSessionNotRevoked(decoded, async () => revoked, NOW)).rejects.toMatchObject({
      code: "auth/session-cookie-revoked",
    });
  });

  it("usuário desativado lança auth/user-disabled", async () => {
    await expect(
      assertSessionNotRevoked(decoded, async () => ({ disabled: true }), NOW),
    ).rejects.toMatchObject({ code: "auth/user-disabled" });
  });

  it("dentro do TTL não busca o usuário de novo; depois dele, busca", async () => {
    const load = vi.fn().mockResolvedValueOnce(valid).mockResolvedValueOnce(revoked);
    await assertSessionNotRevoked(decoded, load, NOW);
    await assertSessionNotRevoked(decoded, load, NOW + 1000);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(
      assertSessionNotRevoked(decoded, load, NOW + SESSION_REVOCATION_TTL_MS + 1),
    ).rejects.toMatchObject({ code: "auth/session-cookie-revoked" });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
