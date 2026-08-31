import { describe, it, expect } from "vitest";
import { formatDocumento, isDocumentoValido } from "../format-document";

describe("formatDocumento", () => {
  it("mascara CPF conforme se digita", () => {
    expect(formatDocumento("123")).toBe("123");
    expect(formatDocumento("1234567")).toBe("123.456.7");
    expect(formatDocumento("12345678901")).toBe("123.456.789-01");
  });

  it("vira máscara de CNPJ ao passar de 11 dígitos", () => {
    expect(formatDocumento("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("descarta o que passa de 14 dígitos em vez de deformar a máscara", () => {
    expect(formatDocumento("123456780001959999")).toBe("12.345.678/0001-95");
  });

  it("ignora o que já vem mascarado, sem duplicar separadores", () => {
    expect(formatDocumento("123.456.789-01")).toBe("123.456.789-01");
  });
});

describe("isDocumentoValido", () => {
  it("aceita vazio — o documento é opcional no cadastro", () => {
    expect(isDocumentoValido("")).toBe(true);
    expect(isDocumentoValido("   ")).toBe(true);
  });

  it("valida dígito verificador de CPF e CNPJ", () => {
    expect(isDocumentoValido("529.982.247-25")).toBe(true);
    expect(isDocumentoValido("111.111.111-11")).toBe(false);
    expect(isDocumentoValido("13.347.016/0001-17")).toBe(true);
    expect(isDocumentoValido("11.111.111/1111-11")).toBe(false);
  });

  it("recusa comprimento que não é nem CPF nem CNPJ", () => {
    // Meio digitado precisa bloquear o avanço: o backend responde 400 e
    // derrubaria o salvamento da proposta inteira.
    expect(isDocumentoValido("123.456")).toBe(false);
    expect(isDocumentoValido("123456789012")).toBe(false);
  });
});
