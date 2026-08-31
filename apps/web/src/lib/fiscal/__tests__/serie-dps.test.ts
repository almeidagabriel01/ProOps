import { describe, expect, it } from "vitest";
import { validarSerieNfse } from "../serie-dps";

/**
 * Rejeição real E0010 em produção: a empresa emite pelo portal nacional com
 * série 70000, e usamos esse valor no cadastro. A faixa 70000–79999 é reservada
 * ao emissor web — aplicativo próprio usa 1 a 49999.
 */

describe("validarSerieNfse", () => {
  it("aceita a faixa de aplicativo próprio", () => {
    expect(validarSerieNfse("1")).toBeNull();
    expect(validarSerieNfse("49999")).toBeNull();
  });

  it("explica a faixa do portal em vez de só recusar", () => {
    // 70000 não é um erro de digitação: é o que a empresa realmente usa hoje.
    // A mensagem precisa dizer por que aqui é diferente.
    const erro = validarSerieNfse("70000");
    expect(erro).toContain("portal");
    expect(erro).toContain("1 e 49999");
  });

  it("recusa as demais faixas", () => {
    expect(validarSerieNfse("50000")).toContain("fora da faixa");
    expect(validarSerieNfse("80000")).toContain("fora da faixa");
  });

  it("campo vazio não é erro — a série é opcional", () => {
    expect(validarSerieNfse("")).toBeNull();
    expect(validarSerieNfse("   ")).toBeNull();
  });

  it("recusa zero e valor não numérico", () => {
    expect(validarSerieNfse("0")).toContain("entre 1");
    expect(validarSerieNfse("abc")).toContain("entre 1");
  });
});
