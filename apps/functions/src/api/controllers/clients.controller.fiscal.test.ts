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
  compactFiscalDefaults,
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

describe("padrão fiscal do contato (fiscalDefaults)", () => {
  it("aceita observação e IPI de saída", () => {
    const parsed = ClientFiscalFieldsSchema.safeParse({
      fiscalDefaults: { observacoes: "IPI conforme pedido", ipi: { cst: "50", aliquota: 5 } },
    });
    expect(parsed.success).toBe(true);
  });

  it("recusa CST de IPI de entrada e alíquota acima de 100", () => {
    expect(
      ClientFiscalFieldsSchema.safeParse({ fiscalDefaults: { ipi: { cst: "00" } } }).success,
    ).toBe(false);
    expect(
      ClientFiscalFieldsSchema.safeParse({ fiscalDefaults: { ipi: { cst: "50", aliquota: 101 } } })
        .success,
    ).toBe(false);
  });

  it("aceita null para apagar", () => {
    expect(ClientFiscalFieldsSchema.safeParse({ fiscalDefaults: null }).success).toBe(true);
  });

  it("guarda só o que tem conteúdo", () => {
    expect(
      compactFiscalDefaults({ observacoes: "  ", ipi: { cst: "53", codigoEnquadramento: "" } }),
    ).toEqual({ ipi: { cst: "53" } });
    expect(compactFiscalDefaults({ observacoes: "Pedido do cliente", ipi: null })).toEqual({
      observacoes: "Pedido do cliente",
    });
  });

  it("vazio vira undefined, que o controller traduz em apagar o campo", () => {
    expect(compactFiscalDefaults({ observacoes: "" })).toBeUndefined();
    expect(compactFiscalDefaults(null)).toBeUndefined();
  });
});

describe("padrão fiscal do contato: ICMS, PIS e COFINS (cliente 101 da AWA)", () => {
  it("aceita CSOSN 101 e PIS/COFINS com alíquota", () => {
    const parsed = ClientFiscalFieldsSchema.safeParse({
      fiscalDefaults: {
        icms: { situacao: "101" },
        pis: { cst: "01", aliquota: 0.65 },
        cofins: { cst: "01", aliquota: 3 },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("recusa código fora da lista (ST não tem onde ser declarado) e alíquota acima de 100", () => {
    for (const fiscalDefaults of [
      { icms: { situacao: "201" } },
      { icms: { situacao: "10" } },
      { icms: { situacao: "101", aliquotaCredito: 120 } },
      { pis: { cst: "03" } },
      { cofins: { cst: "01", aliquota: -1 } },
    ]) {
      expect(ClientFiscalFieldsSchema.safeParse({ fiscalDefaults }).success).toBe(false);
    }
  });

  it("guarda só o que foi informado, e null num imposto o tira", () => {
    expect(
      compactFiscalDefaults({
        icms: { situacao: "101" },
        pis: { cst: "07" },
        cofins: null,
      }),
    ).toEqual({ icms: { situacao: "101" }, pis: { cst: "07" } });
    expect(
      compactFiscalDefaults({ icms: { situacao: "00", aliquota: 17, reducaoBase: 10 } }),
    ).toEqual({ icms: { situacao: "00", aliquota: 17, reducaoBase: 10 } });
  });
});
