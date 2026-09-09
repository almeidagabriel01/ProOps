/**
 * Autorizacao revogada nao e erro de servidor.
 *
 * Acontece de verdade em producao: o usuario revoga o acesso do app na conta
 * Google, troca a senha, ou o refresh token passa 6 meses sem uso. O Google
 * responde `invalid_grant`, e tentar de novo nunca resolve — so reconectar.
 *
 * Tratar isso como 500 com o codigo cru mandava a pessoa esperar por um bug
 * nosso que nao existia, enquanto a integracao ficava parada em silencio.
 */

import { isInvalidGrantError } from "./drive-oauth.service";

describe("isInvalidGrantError", () => {
  it("reconhece as formas que o Google usa", () => {
    for (const mensagem of [
      "invalid_grant",
      "Error: invalid_grant: Token has been expired or revoked.",
      "invalid_rapt",
    ]) {
      expect(isInvalidGrantError(new Error(mensagem))).toBe(true);
    }
  });

  it("nao confunde com outra falha", () => {
    // Classificar demais faria o usuario reconectar a toa e nao resolveria o
    // problema real.
    for (const mensagem of [
      "invalid_client",
      "quota exceeded",
      "File not found",
      "DRIVE_SEM_PASTA_RAIZ",
    ]) {
      expect(isInvalidGrantError(new Error(mensagem))).toBe(false);
    }
  });

  it("aceita valor que nao e Error", () => {
    expect(isInvalidGrantError("invalid_grant")).toBe(true);
    expect(isInvalidGrantError(undefined)).toBe(false);
  });
});
