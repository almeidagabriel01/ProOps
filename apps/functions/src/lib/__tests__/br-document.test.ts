import { isValidCnpj, isValidCpf, isValidCpfOrCnpj } from "../br-document";

describe("br-document", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("recusa CPF com dígito errado ou repetido", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("aceita CNPJ válido e recusa inválido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });

  it("isValidCpfOrCnpj escolhe pelo tamanho", () => {
    expect(isValidCpfOrCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfOrCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCpfOrCnpj("5299822472")).toBe(false);
    expect(isValidCpfOrCnpj(undefined)).toBe(false);
  });
});
