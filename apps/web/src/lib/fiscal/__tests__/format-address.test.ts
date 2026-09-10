import { describe, expect, it } from "vitest";
import { formatEnderecoFiscal, isDerivedFreeAddress } from "../format-address";

describe("formatEnderecoFiscal", () => {
  it("monta o endereço do destinatário da nota real", () => {
    expect(
      formatEnderecoFiscal({
        logradouro: "Avenida Oscar de Paiva Westin",
        numero: "291",
        bairro: "Centro",
        municipio: "Machado",
        uf: "MG",
        cep: "37750-000",
      }),
    ).toBe("Avenida Oscar de Paiva Westin, 291, Centro, Machado/MG, 37750-000");
  });

  it("omite as partes ausentes em vez de deixar vírgulas soltas", () => {
    // Um CEP geral de cidade não traz logradouro; o resultado não pode ser
    // ", , Machado/MG".
    expect(formatEnderecoFiscal({ municipio: "Machado", uf: "MG" })).toBe("Machado/MG");
  });

  it("inclui o complemento quando existe", () => {
    expect(
      formatEnderecoFiscal({ logradouro: "Rua A", numero: "10", complemento: "Sala 2" }),
    ).toBe("Rua A, 10, Sala 2");
  });

  it("não deixa a barra sozinha quando falta a UF", () => {
    expect(formatEnderecoFiscal({ municipio: "Machado" })).toBe("Machado");
    expect(formatEnderecoFiscal({ uf: "MG" })).toBe("MG");
  });

  it("devolve string vazia quando não há nada", () => {
    expect(formatEnderecoFiscal({})).toBe("");
  });
});

describe("isDerivedFreeAddress", () => {
  it("segue acompanhando enquanto o campo livre está vazio", () => {
    expect(isDerivedFreeAddress("", {})).toBe(true);
    expect(isDerivedFreeAddress("   ", { logradouro: "Rua A" })).toBe(true);
  });

  it("segue acompanhando enquanto o campo livre é o que derivamos", () => {
    // Este é o caso que a condição antiga ("está vazio") perdia: digitando o
    // logradouro letra a letra, o campo livre parava de acompanhar na PRIMEIRA
    // tecla e o cadastro terminava com "R" no lugar do endereço.
    const fiscal = { logradouro: "Rua das Flores" };
    expect(isDerivedFreeAddress("Rua das Flores", fiscal)).toBe(true);
  });

  it("para de acompanhar o que foi escrito à mão", () => {
    expect(
      isDerivedFreeAddress("Rua tal, portão azul", { logradouro: "Rua A" }),
    ).toBe(false);
  });
});
