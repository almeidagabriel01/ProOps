/**
 * O `state` do OAuth e a unica protecao de CSRF deste fluxo.
 *
 * O callback e PUBLICO — quem chama e o Google, sem token nosso —, entao nao ha
 * autenticacao para conferir. Se o `state` pudesse ser reusado, um `code`
 * interceptado seria trocavel duas vezes; se nao expirasse, um link de consenso
 * esquecido numa aba valeria para sempre.
 */

const get = jest.fn();
const set = jest.fn();
const del = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get, set, delete: del }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/token-encryption", () => ({
  encryptToken: jest.fn(async (v: string) => `enc:${v}`),
  decryptToken: jest.fn(async (v: string) => v.replace("enc:", "")),
}));
jest.mock("../../../lib/frontend-app-url", () => ({
  resolveFrontendAppOrigin: () => "https://app.exemplo.com",
}));

import {
  consumeOAuthState,
  GOOGLE_DRIVE_SCOPES,
  resolveDriveRedirectUri,
} from "./drive-oauth.service";

function mockState(doc: Record<string, unknown> | null) {
  get.mockResolvedValue({ exists: doc !== null, data: () => doc ?? undefined });
}

beforeEach(() => {
  jest.clearAllMocks();
  del.mockResolvedValue(undefined);
  set.mockResolvedValue(undefined);
  delete process.env.GOOGLE_DRIVE_REDIRECT_URI;
});

describe("consumeOAuthState", () => {
  it("devolve o tenant e o usuario que iniciaram o fluxo", async () => {
    mockState({ uid: "u1", tenantId: "t1", expiresAtMs: Date.now() + 60_000 });

    expect(await consumeOAuthState("s")).toEqual({ uid: "u1", tenantId: "t1" });
  });

  it("APAGA o state ao consumir — um code so pode ser trocado uma vez", async () => {
    mockState({ uid: "u1", tenantId: "t1", expiresAtMs: Date.now() + 60_000 });

    await consumeOAuthState("s");

    expect(del).toHaveBeenCalledTimes(1);
  });

  it("recusa state que nao existe", async () => {
    mockState(null);

    expect(await consumeOAuthState("s")).toEqual({ error: "invalid_state" });
  });

  it("recusa state vencido — e apaga assim mesmo", async () => {
    // Deixar o documento para tras acumularia lixo e daria uma segunda chance
    // a um link antigo se o relogio fosse manipulado.
    mockState({ uid: "u1", tenantId: "t1", expiresAtMs: Date.now() - 1 });

    expect(await consumeOAuthState("s")).toEqual({ error: "expired_state" });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("recusa state sem tenant", async () => {
    mockState({ uid: "u1", expiresAtMs: Date.now() + 60_000 });

    expect(await consumeOAuthState("s")).toEqual({ error: "invalid_state" });
  });
});

describe("escopos", () => {
  it("pede drive.file, nunca um escopo amplo", () => {
    // `drive` e `drive.readonly` sao RESTRITOS e disparam o assessment CASA,
    // refeito a cada 12 meses enquanto o app existir.
    expect(GOOGLE_DRIVE_SCOPES).toContain(
      "https://www.googleapis.com/auth/drive.file",
    );
    for (const escopo of GOOGLE_DRIVE_SCOPES) {
      expect(escopo).not.toBe("https://www.googleapis.com/auth/drive");
      expect(escopo).not.toBe("https://www.googleapis.com/auth/drive.readonly");
    }
  });

  it("nao pede escopo de agenda — o consentimento e separado", () => {
    // Pedir calendar aqui faria o Drive concorrer com o consentimento da
    // Agenda, que e exatamente o que este desenho evita.
    expect(GOOGLE_DRIVE_SCOPES.join(" ")).not.toContain("calendar");
  });
});

describe("resolveDriveRedirectUri", () => {
  it("deriva da origem configurada, nunca do host da request", () => {
    expect(resolveDriveRedirectUri()).toBe(
      "https://app.exemplo.com/api/backend/v1/drive/google/callback",
    );
  });

  it("respeita a sobrescrita explicita", () => {
    process.env.GOOGLE_DRIVE_REDIRECT_URI = "https://outro/callback";

    expect(resolveDriveRedirectUri()).toBe("https://outro/callback");
  });
});
