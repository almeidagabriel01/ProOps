/**
 * As operações de **cadastro** têm que bater na base de produção, mesmo com o
 * tenant em homologação.
 *
 * `/empresas` e `/cnpjs` só existem em `api.focusnfe.com.br`. Verificado em
 * 27/08/2026 batendo nos dois hosts sem token: `homologacao.focusnfe.com.br`
 * responde 404 nos dois caminhos, `api.focusnfe.com.br` responde 401.
 *
 * Não é limitação do provedor: o cadastro de empresas é único, e o ambiente é
 * expresso por qual token a empresa devolve e por quais flags `habilita_*` ela
 * recebe. Consultar CNPJ é consultar a Receita, que não tem versão de teste.
 *
 * O sintoma quando isso quebra é enganoso — o Focus responde
 * "Endpoint não encontrado", que parece erro de rota nossa.
 */

jest.mock("axios");
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import axios from "axios";
import { FocusFiscalProvider } from "./focus.provider";

const mockedAxios = axios as jest.Mocked<typeof axios>;

const REGISTRY_HOST = "https://api.focusnfe.com.br";
const HOMOLOG_HOST = "https://homologacao.focusnfe.com.br";

const ISSUER = {
  cnpj: "50759330000133",
  razaoSocial: "EMPRESA TESTE",
  email: "fiscal@exemplo.com.br",
  regimeTributario: 1,
  habilitaNfe: false,
  habilitaNfse: true,
  certificadoBase64: "YmFzZTY0",
  certificadoSenha: "1234",
  endereco: {
    logradouro: "Rua Major Feliciano",
    numero: "549",
    bairro: "Centro",
    municipio: "Machado",
    uf: "MG",
    cep: "37750000",
    codigoIbge: "3139003",
  },
} as never;

describe("FocusFiscalProvider — base de URL por tipo de operação", () => {
  const provider = new FocusFiscalProvider();

  beforeEach(() => {
    process.env.FOCUS_NFE_MASTER_TOKEN = "token-de-conta";
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockResolvedValue({ data: { cnpj: "50759330000133" } });
    mockedAxios.get.mockResolvedValue({ data: {} });
  });

  it("cadastra empresa em produção mesmo com o tenant em homologação", async () => {
    await provider.registerIssuer(ISSUER, "homologacao");

    const url = String(mockedAxios.post.mock.calls[0][0]);
    expect(url).toContain(`${REGISTRY_HOST}/v2/empresas`);
    expect(url).not.toContain(HOMOLOG_HOST);
  });

  it("mantém o dry_run na URL de cadastro", async () => {
    await provider.registerIssuer(ISSUER, "homologacao", true);

    expect(String(mockedAxios.post.mock.calls[0][0])).toBe(
      `${REGISTRY_HOST}/v2/empresas?dry_run=1`,
    );
  });

  it("consulta CNPJ em produção mesmo com o tenant em homologação", async () => {
    await provider.lookupCnpj("50.759.330/0001-33", "homologacao");

    const url = String(mockedAxios.get.mock.calls[0][0]);
    expect(url).toBe(`${REGISTRY_HOST}/v2/cnpjs/50759330000133`);
  });

  it("emissão continua seguindo o ambiente do tenant", async () => {
    // A contrapartida: o que o token da *empresa* assina tem que ir para o
    // ambiente do tenant, senão uma nota de teste sairia com validade fiscal.
    mockedAxios.post.mockResolvedValue({ data: { status: "processando_autorizacao" } });

    await provider.issue(
      {
        ref: "ref-1",
        type: "nfe",
        dataEmissao: "2026-08-27T10:00:00-03:00",
        valorTotal: 100,
        issuer: ISSUER,
        recipient: { nome: "Cliente", documento: "12345678909" },
        products: [{ descricao: "Item", quantidade: 1, valorUnitario: 100, ncm: "85444900" }],
      } as never,
      "homologacao",
      "token-da-empresa",
    );

    expect(String(mockedAxios.post.mock.calls[0][0])).toContain(HOMOLOG_HOST);
  });
});
