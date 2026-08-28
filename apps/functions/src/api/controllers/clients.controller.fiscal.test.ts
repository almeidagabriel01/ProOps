/**
 * Campos fiscais do destinatário — allowlist do cadastro de cliente.
 *
 * `invoice-assembly.service.ts` lia `client.enderecoFiscal` desde sempre, mas
 * nada gravava: o campo não estava no schema do controller nem na tela. O gate
 * então barrava toda NF-e com "preencha o endereço do cliente" — uma lacuna que
 * o usuário não tinha como resolver.
 *
 * Este teste cobre a normalização, que é onde estão as decisões: o que é
 * descartado, o que é normalizado e o que apaga.
 */

import {
  compactEnderecoFiscal,
  ClientFiscalFieldsSchema,
} from "./clients.controller";

describe("compactEnderecoFiscal", () => {
  it("descarta campos vazios em vez de gravar strings em branco", () => {
    expect(
      compactEnderecoFiscal({
        logradouro: "Rua A",
        numero: "",
        bairro: "   ",
        municipio: "Machado",
      }),
    ).toEqual({ logradouro: "Rua A", municipio: "Machado" });
  });

  it("devolve undefined quando nada sobra", () => {
    // O controller traduz isso em "apagar o endereço", que é como o usuário
    // limpa um endereço fiscal errado.
    expect(compactEnderecoFiscal({ logradouro: "", numero: "  " })).toBeUndefined();
    expect(compactEnderecoFiscal(undefined)).toBeUndefined();
  });

  it("normaliza UF para maiúscula", () => {
    expect(compactEnderecoFiscal({ uf: "mg" })).toEqual({ uf: "MG" });
  });

  it("tira a máscara de CEP e código IBGE", () => {
    // A SEFAZ valida o município pelo código IBGE; um ponto sobrando reprova.
    expect(
      compactEnderecoFiscal({ cep: "37750-000", codigoIbge: "3.139.003" }),
    ).toEqual({ cep: "37750000", codigoIbge: "3139003" });
  });

  it("preserva o endereço real do cliente da nota de referência", () => {
    expect(
      compactEnderecoFiscal({
        logradouro: "AVENIDA OSCAR DE PAIVA WESTIN",
        numero: "291",
        bairro: "CENTRO",
        municipio: "MACHADO",
        uf: "mg",
        cep: "37.750-000",
        codigoIbge: "3139003",
      }),
    ).toEqual({
      logradouro: "AVENIDA OSCAR DE PAIVA WESTIN",
      numero: "291",
      bairro: "CENTRO",
      municipio: "MACHADO",
      uf: "MG",
      cep: "37750000",
      codigoIbge: "3139003",
    });
  });
});

describe("ClientFiscalFieldsSchema", () => {
  it("aceita os três indicadores de IE e recusa o resto", () => {
    for (const valor of ["contribuinte", "isento", "nao_contribuinte"]) {
      expect(ClientFiscalFieldsSchema.safeParse({ indicadorIe: valor }).success).toBe(true);
    }
    expect(ClientFiscalFieldsSchema.safeParse({ indicadorIe: "sim" }).success).toBe(false);
  });

  it("aceita o objeto ausente — só a NF-e exige endereço", () => {
    // A NFS-e se contenta com nome e documento; obrigar endereço aqui
    // bloquearia o caso principal do primeiro cliente.
    expect(ClientFiscalFieldsSchema.safeParse({}).success).toBe(true);
  });
});
