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

describe("FocusFiscalProvider — recurso da NFS-e por padrão", () => {
  const provider = new FocusFiscalProvider();

  const serviceInput = (padraoNfse?: "nacional" | "municipal") =>
    ({
      ref: "ref-1",
      type: "nfse",
      dataEmissao: "2026-07-27T10:28:44-03:00",
      valorTotal: 1500,
      issuer: { ...(ISSUER as Record<string, unknown>), padraoNfse },
      recipient: { nome: "Cliente", documento: "12345678909" },
      service: {
        descricao: "Instalacao",
        codigoLc116: "31.01",
        codigoTributacaoNacional: "310102",
        valorServicos: 1500,
        aliquotaIss: 0,
        issRetido: false,
      },
    }) as never;

  beforeEach(() => {
    process.env.FOCUS_NFE_MASTER_TOKEN = "token-de-conta";
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockResolvedValue({ data: { status: "processando_autorizacao" } });
    mockedAxios.get.mockResolvedValue({ data: { status: "autorizado" } });
  });

  it("emite NFS-e nacional em /nfsen", async () => {
    await provider.issue(serviceInput(), "homologacao", "token-empresa");

    expect(String(mockedAxios.post.mock.calls[0][0])).toContain("/v2/nfsen?ref=");
  });

  it("cai para /nfse quando o emitente é municipal", async () => {
    await provider.issue(serviceInput("municipal"), "homologacao", "token-empresa");

    const url = String(mockedAxios.post.mock.calls[0][0]);
    expect(url).toContain("/v2/nfse?ref=");
    expect(url).not.toContain("/v2/nfsen");
  });

  it("consulta usa o padrão gravado na nota, não o do tenant hoje", async () => {
    // Se o tenant migrar de municipal para nacional, as notas antigas ainda
    // precisam ser alcançáveis para consulta e cancelamento.
    await provider.consult("ref-1", "nfse", "homologacao", "token-empresa", "municipal");

    expect(String(mockedAxios.get.mock.calls[0][0])).toContain("/v2/nfse/ref-1");
  });

  it("sem padrão informado, assume nacional", async () => {
    await provider.consult("ref-1", "nfse", "homologacao", "token-empresa");

    expect(String(mockedAxios.get.mock.calls[0][0])).toContain("/v2/nfsen/ref-1");
  });
});

describe("FocusFiscalProvider — gatilho segue o ambiente, não o cadastro", () => {
  const provider = new FocusFiscalProvider();

  beforeEach(() => {
    process.env.FOCUS_NFE_MASTER_TOKEN = "token-de-conta";
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockResolvedValue({ data: { id: "hook-1" } });
    mockedAxios.get.mockResolvedValue({ data: [] });
  });

  it("registra no host do ambiente com o token da empresa", async () => {
    // É o TOKEN que define o ambiente do gatilho no provedor. Registrar com o
    // token da conta cria um hook de produção — o painel mostra "Ambiente:
    // Produção" — e ele nunca notifica uma nota emitida em homologação.
    await provider.registerWebhook(
      "50759330000133",
      "nfsen",
      "https://exemplo/webhooks/focus/t/s/nfsen",
      "homologacao",
      "token-da-empresa-homologacao",
    );

    const [url, , config] = mockedAxios.post.mock.calls[0];
    expect(String(url)).toBe(`${HOMOLOG_HOST}/v2/hooks`);
    expect(String(url)).not.toContain(REGISTRY_HOST);

    // HTTP Basic com o token no usuário e senha em branco — é o que o provedor
    // usa, e é o token que decide o ambiente do gatilho.
    const auth = (config as { headers?: Record<string, string> })?.headers
      ?.Authorization;
    const decoded = Buffer.from(String(auth).replace("Basic ", ""), "base64").toString();
    expect(decoded).toContain("token-da-empresa-homologacao");
  });

  it("lista com o token do ambiente, para o reconcile ver os hooks certos", async () => {
    // Listar com o token da conta devolveria os de produção, e o reconcile
    // apagaria os errados — ou nenhum.
    await provider.listWebhooks("homologacao", "token-da-empresa-homologacao");

    expect(String(mockedAxios.get.mock.calls[0][0])).toBe(`${HOMOLOG_HOST}/v2/hooks`);
  });

  it("em produção usa o host de produção", async () => {
    await provider.registerWebhook(
      "50759330000133",
      "nfsen",
      "https://exemplo/webhooks/focus/t/s/nfsen",
      "producao",
      "token-da-empresa-producao",
    );

    expect(String(mockedAxios.post.mock.calls[0][0])).toBe(`${REGISTRY_HOST}/v2/hooks`);
  });
});
