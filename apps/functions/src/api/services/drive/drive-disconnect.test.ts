/**
 * Desconectar NAO pode esquecer a pasta.
 *
 * Apagar o documento inteiro parecia mais limpo e estava errado: a pasta nao e
 * segredo, e esquecer o id dela fazia reconectar criar uma SEGUNDA
 * "ProOps - Propostas" ao lado da primeira, porque o sistema nao tinha como
 * saber que ja existia uma. Aconteceu no teste real, duas vezes.
 *
 * O que precisa sumir e o refresh token.
 */

const get = jest.fn();
const set = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get, set }) }) },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => "__DELETE__" },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/token-encryption", () => ({
  encryptToken: jest.fn(async (v: string) => `enc:${v}`),
  decryptToken: jest.fn(async (v: string) => v),
}));
jest.mock("../../../lib/frontend-app-url", () => ({
  resolveFrontendAppOrigin: () => "https://app.exemplo.com",
}));

import { disconnectDrive } from "./drive-oauth.service";

const CONECTADO = {
  tenantId: "t1",
  provider: "google",
  refreshTokenEnc: "enc:token",
  connectedEmail: "dono@empresa.com.br",
  rootFolderId: "raiz-1",
  rootFolderName: "ProOps - Propostas",
};

function gravado(): Record<string, unknown> {
  return set.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  set.mockResolvedValue(undefined);
  get.mockResolvedValue({ exists: true, data: () => CONECTADO });
});

describe("disconnectDrive", () => {
  it("APAGA o refresh token", async () => {
    await disconnectDrive("t1");

    expect(gravado().refreshTokenEnc).toBe("__DELETE__");
    expect(gravado().connectedEmail).toBeNull();
  });

  it("PRESERVA a pasta escolhida", async () => {
    // O teste que mais importa: sem isto, reconectar cria uma segunda pasta.
    await disconnectDrive("t1");

    // `merge: true` mantem o que nao foi citado — rootFolderId inclusive.
    expect(set.mock.calls[0]?.[1]).toEqual({ merge: true });
    expect(gravado()).not.toHaveProperty("rootFolderId");
  });

  it("nao cria documento para quem nunca conectou", async () => {
    get.mockResolvedValue({ exists: false, data: () => undefined });

    await disconnectDrive("t1");

    expect(set).not.toHaveBeenCalled();
  });
});
