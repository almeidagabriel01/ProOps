import { describe, expect, it } from "vitest";
import { humanizeRejection } from "../rejection-messages";

describe("humanizeRejection", () => {
  it("traduz a rejeição 805 e aponta a correção", () => {
    // A mais comum do mercado. "Rejeição 805" não diz nada para quem instala
    // cortina — a tradução tem que dizer o que fazer.
    const result = humanizeRejection("805", "Rejeicao: A SEFAZ do destinatario nao permite...");

    expect(result.titulo).toContain("isento");
    expect(result.explicacao).toContain("não contribuinte");
    expect(result.acao?.focusField).toBe("indicadorIe");
  });

  it("preserva sempre a mensagem original do fisco", () => {
    // O contador do cliente precisa dela; esconder trocaria um problema por outro.
    const original = "Rejeicao 805: detalhe tecnico do fisco";
    expect(humanizeRejection("805", original).original).toBe(original);
  });

  it("aponta para a numeração quando a série sai de sincronia", () => {
    const result = humanizeRejection("539", "Duplicidade de NF-e");
    expect(result.acao?.href).toBe("/settings/fiscal");
    expect(result.acao?.focusField).toBe("proximoNumeroNfe");
  });

  it("explica que cancelamento fora do prazo vira devolução", () => {
    const result = humanizeRejection("252", "Prazo excedido");
    expect(result.explicacao).toContain("devolução");
  });

  it("reconhece certificado vencido pela mensagem, sem código", () => {
    // Erros de certificado chegam do provedor, não da SEFAZ, e não trazem
    // código numérico.
    const result = humanizeRejection(undefined, "Certificado com prazo de validade vencido");

    expect(result.titulo).toContain("venceu");
    expect(result.acao?.href).toBe("/settings/fiscal");
  });

  it("reconhece certificado de outro CNPJ", () => {
    const result = humanizeRejection(undefined, "Certificado não pertence ao CNPJ informado");
    expect(result.titulo).toContain("outro CNPJ");
    expect(result.acao?.focusField).toBe("cnpj");
  });

  it("reconhece senha de certificado incorreta", () => {
    const result = humanizeRejection(undefined, "Verifique se a senha do certificado está correta");
    expect(result.titulo).toContain("senha");
  });

  it("explica a falta de credenciamento, que é o erro nº 1 de onboarding", () => {
    // O usuário configura tudo e nunca pediu liberação na prefeitura/SEFAZ.
    const result = humanizeRejection(undefined, "Emitente nao credenciado para emissao");

    expect(result.titulo).toContain("não está autorizada");
    expect(result.explicacao).toContain("webservice");
  });

  it("reconhece divergência de município contra a tabela do IBGE", () => {
    const result = humanizeRejection(undefined, "Municipio do destinatario invalido");
    expect(result.acao?.focusField).toBe("endereco.municipio");
  });

  it("mostra a mensagem crua quando não conhece a rejeição", () => {
    // Melhor exibir o que veio do que esconder atrás de um texto genérico.
    const result = humanizeRejection("9999", "Erro exotico que ninguem mapeou");

    expect(result.explicacao).toBe("Erro exotico que ninguem mapeou");
    expect(result.original).toContain("9999");
  });

  it("não quebra quando não há código nem mensagem", () => {
    const result = humanizeRejection(undefined, undefined);

    expect(result.titulo).toBe("A nota foi rejeitada");
    expect(result.explicacao.length).toBeGreaterThan(0);
  });

  it("prefere o código à mensagem quando os dois casam", () => {
    // O código é mais específico que uma heurística de texto.
    const result = humanizeRejection("805", "certificado vencido e outras coisas");
    expect(result.titulo).toContain("isento");
  });
});
