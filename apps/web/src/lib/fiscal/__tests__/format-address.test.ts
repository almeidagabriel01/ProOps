import { describe, expect, it } from "vitest";
import { formatEnderecoFiscal } from "../format-address";

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
