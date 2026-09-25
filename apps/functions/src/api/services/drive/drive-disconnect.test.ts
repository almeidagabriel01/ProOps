/**
 * Desconectar NAO pode esquecer a pasta.
 *
 * Apagar o documento inteiro parecia mais limpo e estava errado: a pasta nao e
 * segredo, e esquecer o id dela fazia reconectar criar uma SEGUNDA
 * "ProOps - Propostas" ao lado da primeira, porque o sistema nao tinha como
 * saber que ja existia uma. Aconteceu no teste real, duas vezes.
 *
 * O que precisa sumir e o refresh token, e ele tambem e revogado no Google.
 */

const get = jest.fn();
const set = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get, set }) }) },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => "__DELETE__" },
}));
const warn = jest.fn();
jest.mock("../../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: (...a: unknown[]) => warn(...a),
    error: jest.fn(),
  },
}));
const revokeToken = jest.fn();
jest.mock("@googleapis/drive", () => ({
  auth: {
    OAuth2: jest.fn().mockImplementation(() => ({
      revokeToken: (t: string) => revokeToken(t),
    })),
  },
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
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
  revokeToken.mockResolvedValue(undefined);
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

  it("REVOGA o token no Google antes de apagar", async () => {
    await disconnectDrive("t1");

    // decryptToken e mockado como identidade: o valor revogado e o decifrado.
    expect(revokeToken).toHaveBeenCalledWith("enc:token");
    expect(set).toHaveBeenCalled();
  });

  it("desconecta mesmo se o Google recusar a revogacao", async () => {
    revokeToken.mockRejectedValue(new Error("invalid_token"));

    await disconnectDrive("t1");

    expect(gravado().refreshTokenEnc).toBe("__DELETE__");
    expect(warn).toHaveBeenCalledWith(
      "drive_disconnect_revoke_failed",
      expect.objectContaining({ tenantId: "t1" }),
    );
  });

  it("desconecta mesmo sem credencial do app configurada", async () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;

    await disconnectDrive("t1");

    expect(revokeToken).not.toHaveBeenCalled();
    expect(gravado().refreshTokenEnc).toBe("__DELETE__");
  });

  it("nao tenta revogar quando ja nao ha token guardado", async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({ ...CONECTADO, refreshTokenEnc: undefined }),
    });

    await disconnectDrive("t1");

    expect(revokeToken).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalled();
  });
});
