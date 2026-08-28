process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";

jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));
jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
  isEncryptedToken: jest.fn(),
}));

import {
  isInsufficientScopeError,
  RECONNECT_REQUIRED_MESSAGE,
} from "./calendar.controller";

describe("isInsufficientScopeError", () => {
  it("reconhece a mensagem exata que o Google devolve", () => {
    // Foi o erro real observado em produção em 25/08/2026, ao chamar
    // events.list com apenas calendar.events.owned concedido.
    expect(isInsufficientScopeError("Request had insufficient authentication scopes.")).toBe(
      true,
    );
  });

  it("reconhece a variante do cabeçalho OAuth", () => {
    expect(isInsufficientScopeError('error="insufficient_scope"')).toBe(true);
  });

  it("ignora caixa e texto ao redor", () => {
    expect(
      isInsufficientScopeError("GaxiosError: REQUEST HAD INSUFFICIENT AUTHENTICATION SCOPES"),
    ).toBe(true);
  });

  it("não captura outros erros do Google", () => {
    // Confundir aqui mandaria o usuário reconectar por um problema que a
    // reconexão não resolve.
    for (const other of [
      "Invalid Credentials",
      "Rate Limit Exceeded",
      "Calendar usage limits exceeded",
      "Not Found",
      "",
    ]) {
      expect(isInsufficientScopeError(other)).toBe(false);
    }
  });
});

describe("RECONNECT_REQUIRED_MESSAGE", () => {
  it("diz o que fazer, não o que aconteceu", () => {
    // "Request had insufficient authentication scopes" não significa nada para
    // quem instala cortina. A mensagem tem que nomear a ação.
    expect(RECONNECT_REQUIRED_MESSAGE).toContain("Reconectar");
    expect(RECONNECT_REQUIRED_MESSAGE).not.toMatch(/scope|token|OAuth/i);
  });
});
