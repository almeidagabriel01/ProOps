/**
 * Codigo interno nao pode chegar na tela do cliente.
 *
 * `FISCAL_EMITENTE_NAO_REGISTRADO` aparecia cru na resposta — uma string de
 * maquina, sem dizer o que fazer, num caminho facil de alcancar: desconectar a
 * configuracao fiscal e salvar de novo recria o cadastro **sem os tokens**,
 * porque token so nasce do envio do certificado. O usuario ficava com uma tela
 * que parece configurada e um erro que nao explica nada.
 *
 * Vale para emitir, cancelar, corrigir e manifestar — todos passam por
 * `getIssuingToken`.
 */

import {
  isKnownFiscalError,
  mapFiscalErrorMessage,
} from "../fiscal.controller";

describe("mensagens de erro fiscal", () => {
  it("diz o que fazer quando falta registrar o emitente", () => {
    const msg = mapFiscalErrorMessage(new Error("FISCAL_EMITENTE_NAO_REGISTRADO"));

    expect(msg).not.toContain("FISCAL_EMITENTE");
    // A acao concreta tem que estar na mensagem, nao num manual.
    expect(msg.toLowerCase()).toContain("certificado");
  });

  it("traduz os demais codigos de pre-condicao", () => {
    for (const codigo of [
      "FISCAL_CERTIFICADO_AUSENTE",
      "CCE_APENAS_NFE",
      "INVOICE_NAO_AUTORIZADA",
    ]) {
      expect(mapFiscalErrorMessage(new Error(codigo))).not.toBe(codigo);
    }
  });

  it("preserva a mensagem de um erro nao previsto", () => {
    // Inventar texto amigavel para erro desconhecido esconderia a unica pista
    // que sobrou para investigar.
    const original = "Falha inesperada ao falar com o provedor";
    expect(mapFiscalErrorMessage(new Error(original))).toBe(original);
  });

  it("reconhece o que e erro NOSSO e o que veio do provedor", () => {
    expect(isKnownFiscalError(new Error("CCE_APENAS_NFE"))).toBe(true);
    expect(isKnownFiscalError(new Error("Rejeicao 594: sequencia"))).toBe(false);
  });
});
