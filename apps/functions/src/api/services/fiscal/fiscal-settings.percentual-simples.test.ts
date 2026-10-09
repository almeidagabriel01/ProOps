/**
 * O percentual de tributos do Simples é opcional na configuração fiscal. Em
 * branco ele chegava como `undefined` ao `set` do Firestore, que recusa o
 * valor: salvar a configuração sem ele devolvia 500.
 */

const get = jest.fn();
const set = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get, set }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/token-encryption", () => ({
  encryptToken: jest.fn(async (v: string) => `enc:${v}`),
  decryptToken: jest.fn(async (v: string) => v.replace("enc:", "")),
}));

import { FieldValue } from "firebase-admin/firestore";
import { saveFiscalSettings, type SaveFiscalSettingsInput } from "./fiscal-settings.service";

const INPUT = {
  provider: "focus",
  environment: "homologacao",
  cnpj: "50759330000133",
  razaoSocial: "EMPRESA TESTE",
  regimeTributario: 3,
  email: "fiscal@exemplo.com.br",
  endereco: {
    logradouro: "Rua A",
    numero: "1",
    bairro: "Centro",
    municipio: "Machado",
    codigoIbge: "3139003",
    uf: "MG",
    cep: "37750000",
  },
  habilitaNfe: true,
  habilitaNfse: false,
  autoIssueRule: "manual",
} as unknown as SaveFiscalSettingsInput;

function payload(): Record<string, unknown> {
  return set.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  set.mockResolvedValue(undefined);
  // Depois de gravar, o serviço relê o documento: devolve o que foi gravado.
  get.mockImplementation(async () => {
    const saved = set.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    return { exists: Boolean(saved), data: () => saved };
  });
});

describe("saveFiscalSettings: percentual do Simples", () => {
  it("em branco não entra na gravação, e nenhum campo vai como undefined", async () => {
    await saveFiscalSettings("t1", { ...INPUT, percentualTotalTributosSimplesNacional: undefined });
    const saved = payload();
    expect(saved).not.toHaveProperty("percentualTotalTributosSimplesNacional");
    expect(Object.entries(saved).filter(([, v]) => v === undefined)).toEqual([]);
  });

  it("0% é alíquota informada e é gravada", async () => {
    await saveFiscalSettings("t1", { ...INPUT, percentualTotalTributosSimplesNacional: 0 });
    expect(payload().percentualTotalTributosSimplesNacional).toBe(0);
  });

  it("o valor informado é gravado", async () => {
    await saveFiscalSettings("t1", { ...INPUT, percentualTotalTributosSimplesNacional: 4.5 });
    expect(payload().percentualTotalTributosSimplesNacional).toBe(4.5);
  });

  it("salvar de novo sem o campo mantém o que já estava gravado (merge)", async () => {
    const stored = { status: "registered", cnpj: "50759330000133", webhookSecret: "s", percentualTotalTributosSimplesNacional: 6 };
    get.mockImplementation(async () => ({ exists: true, data: () => stored }));
    await saveFiscalSettings("t1", { ...INPUT, percentualTotalTributosSimplesNacional: undefined });
    expect(payload()).not.toHaveProperty("percentualTotalTributosSimplesNacional");
    expect(set.mock.calls[0]?.[1]).toEqual({ merge: true });
  });
});

describe("saveFiscalSettings: alíquota do crédito de ICMS do Simples", () => {
  it("ausente não entra na gravação (mantém o gravado)", async () => {
    await saveFiscalSettings("t1", { ...INPUT });
    expect(payload()).not.toHaveProperty("aliquotaCreditoIcmsSimples");
  });

  it("o valor informado é gravado, inclusive 0", async () => {
    await saveFiscalSettings("t1", { ...INPUT, aliquotaCreditoIcmsSimples: 1.25 });
    expect(payload().aliquotaCreditoIcmsSimples).toBe(1.25);
    set.mockClear();
    await saveFiscalSettings("t1", { ...INPUT, aliquotaCreditoIcmsSimples: 0 });
    expect(payload().aliquotaCreditoIcmsSimples).toBe(0);
  });

  it("em branco apaga o gravado", async () => {
    await saveFiscalSettings("t1", { ...INPUT, aliquotaCreditoIcmsSimples: "" });
    expect(payload().aliquotaCreditoIcmsSimples).toEqual(FieldValue.delete());
  });
});
