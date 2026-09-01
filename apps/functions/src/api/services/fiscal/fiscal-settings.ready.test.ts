/**
 * Salvar a configuração NÃO pode derrubar o `ready`.
 *
 * `ready` significa "uma nota já foi autorizada por este CNPJ" — a única prova
 * de credenciamento na SEFAZ/prefeitura. Qualquer salvamento rebaixava para
 * `registered`, em silêncio, e o estrago era invisível: a emissão automática e
 * o convite pós-aprovação dependem de `ready`, então corrigir um e-mail os
 * desligava. Pior, mexer no próprio `autoIssueRule` desligava o que se acabara
 * de configurar.
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

import { saveFiscalSettings, type SaveFiscalSettingsInput } from "./fiscal-settings.service";

const CNPJ = "50759330000133";

const INPUT = {
  provider: "focus",
  environment: "producao",
  cnpj: CNPJ,
  razaoSocial: "EMPRESA TESTE",
  regimeTributario: 1,
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
  habilitaNfe: false,
  habilitaNfse: true,
} as unknown as SaveFiscalSettingsInput;

/** Devolve o estado gravado — o `set` do save e a releitura final. */
function mockExisting(doc: Record<string, unknown> | null) {
  get.mockImplementation(async () => ({
    exists: doc !== null,
    data: () => doc ?? undefined,
  }));
}

function savedPayload(): Record<string, unknown> {
  return set.mock.calls[0]?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  set.mockResolvedValue(undefined);
});

describe("saveFiscalSettings — status", () => {
  it("preserva `ready` ao salvar sem trocar de empresa", async () => {
    mockExisting({ status: "ready", cnpj: CNPJ, webhookSecret: "s" });

    await saveFiscalSettings("t1", INPUT);

    expect(savedPayload().status).toBe("ready");
  });

  it("preserva `ready` mesmo com o CNPJ vindo mascarado", async () => {
    // O formulário manda "50.759.330/0001-33"; comparar sem normalizar leria
    // isso como troca de empresa e rebaixaria o emitente a cada salvamento.
    mockExisting({ status: "ready", cnpj: CNPJ, webhookSecret: "s" });

    await saveFiscalSettings("t1", {
      ...INPUT,
      cnpj: "50.759.330/0001-33",
    } as SaveFiscalSettingsInput);

    expect(savedPayload().status).toBe("ready");
  });

  it("rebaixa para `registered` quando o CNPJ muda — é outra empresa", async () => {
    // A prova de credenciamento é do CNPJ anterior e não se transfere.
    mockExisting({ status: "ready", cnpj: "11222333000181", webhookSecret: "s" });

    await saveFiscalSettings("t1", INPUT);

    expect(savedPayload().status).toBe("registered");
  });

  it("mantém um status intermediário como está", async () => {
    mockExisting({ status: "registered", cnpj: CNPJ, webhookSecret: "s" });

    await saveFiscalSettings("t1", INPUT);

    expect(savedPayload().status).toBe("registered");
  });

  it("nasce em `pending` quando não havia configuração", async () => {
    mockExisting(null);

    await saveFiscalSettings("t1", INPUT).catch(() => undefined);

    expect(savedPayload().status).toBe("pending");
  });
});
