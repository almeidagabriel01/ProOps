/**
 * Mapeamento da consulta de CNPJ.
 *
 * O bug real: o endereço vem **aninhado** em `endereco`, e nós líamos os campos
 * como se fossem planos. Resultado silencioso — a busca "funcionava", trazia só
 * a razão social, e o usuário preenchia endereço, CNAE e IBGE à mão sem
 * desconfiar de nada. Sem erro, sem log, sem sintoma.
 *
 * A resposta também usa nomes que não são os óbvios: `cnae_principal` (não
 * `cnae_fiscal`), `nome_municipio` (não `municipio`), `codigo_ibge` (não
 * `codigo_municipio_ibge`).
 */

jest.mock("axios");
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from "axios";
import { FocusFiscalProvider } from "./focus.provider";

const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Resposta no formato real da API, para o CNPJ do primeiro emitente. */
const RESPONSE = {
  razao_social: "50.759.330 WINICIUS GONCALVES ARAUJO DIAS",
  cnpj: "50759330000133",
  situacao_cadastral: "Ativa",
  cnae_principal: "4321500",
  optante_simples_nacional: true,
  optante_mei: false,
  endereco: {
    codigo_ibge: 3139003,
    nome_municipio: "MACHADO",
    logradouro: "MAJOR FELICIANO",
    numero: "549",
    complemento: "",
    bairro: "CENTRO",
    cep: "37750000",
    uf: "MG",
  },
};

describe("FocusFiscalProvider.lookupCnpj", () => {
  const provider = new FocusFiscalProvider();

  beforeEach(() => {
    process.env.FOCUS_NFE_MASTER_TOKEN = "token-de-conta";
    mockedAxios.get.mockReset();
    mockedAxios.get.mockResolvedValue({ data: RESPONSE });
  });

  it("achata o endereço aninhado", async () => {
    const result = await provider.lookupCnpj("50759330000133", "homologacao");

    expect(result.logradouro).toBe("MAJOR FELICIANO");
    expect(result.numero).toBe("549");
    expect(result.bairro).toBe("CENTRO");
    expect(result.cep).toBe("37750000");
    expect(result.uf).toBe("MG");
  });

  it("lê o município e o IBGE pelos nomes que a resposta usa", async () => {
    const result = await provider.lookupCnpj("50759330000133", "homologacao");

    expect(result.municipio).toBe("MACHADO");
    // Vem como número na resposta e precisa sair string — a SEFAZ valida o
    // município por ele, e é o campo que o usuário não digita.
    expect(result.codigoIbge).toBe("3139003");
  });

  it("lê o CNAE de cnae_principal", async () => {
    const result = await provider.lookupCnpj("50759330000133", "homologacao");
    expect(result.cnae).toBe("4321500");
  });

  it("deriva o regime tributário das flags do Simples", async () => {
    expect(
      (await provider.lookupCnpj("50759330000133", "homologacao")).regimeTributario,
    ).toBe(1);

    mockedAxios.get.mockResolvedValue({
      data: { ...RESPONSE, optante_mei: true },
    });
    expect(
      (await provider.lookupCnpj("50759330000133", "homologacao")).regimeTributario,
    ).toBe(4);

    mockedAxios.get.mockResolvedValue({
      data: { ...RESPONSE, optante_simples_nacional: false, optante_mei: false },
    });
    expect(
      (await provider.lookupCnpj("50759330000133", "homologacao")).regimeTributario,
    ).toBe(3);
  });

  it("não chuta o regime quando a resposta não traz as flags", async () => {
    // Ausência é diferente de "não é optante": assumir Regime Normal trocaria
    // CSOSN por CST na nota inteira de uma empresa do Simples.
    mockedAxios.get.mockResolvedValue({
      data: { razao_social: "EMPRESA", endereco: {} },
    });

    const result = await provider.lookupCnpj("50759330000133", "homologacao");
    expect(result).not.toHaveProperty("regimeTributario");
  });

  it("devolve a situação cadastral para a UI poder avisar", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { ...RESPONSE, situacao_cadastral: "Baixada" },
    });

    const result = await provider.lookupCnpj("50759330000133", "homologacao");
    expect(result.situacaoCadastral).toBe("Baixada");
  });

  it("omite campo vazio em vez de mandar string vazia", async () => {
    // O wizard faz `data.x || prev.x`: uma string vazia sobrescreveria o que o
    // usuário já tinha digitado.
    const result = await provider.lookupCnpj("50759330000133", "homologacao");
    expect(result.complemento).toBeUndefined();
  });
});
