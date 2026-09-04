/**
 * Data de inicio de recebimento de notas de entrada.
 *
 * Dois riscos distintos, e os dois so aparecem na fatura:
 *
 * 1. **Em branco o provedor puxa TODO o historico disponivel e cobra por nota.**
 *    Ela nao e detalhe tecnico, e controle de custo.
 * 2. **O provedor NAO deixa altera-la depois de definida.** Guardar aqui um
 *    valor diferente do que esta la seria a pior versao do problema: a tela
 *    mostrando uma data, a cobranca seguindo outra, e nada denunciando.
 *
 * Por isso ela congela quando a empresa ja existe no provedor
 * (`providerIssuerId`), e nao no primeiro salvamento — antes de enviar o
 * certificado nada foi comunicado, e um erro de digitacao ainda tem conserto.
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

import {
  saveFiscalSettings,
  type SaveFiscalSettingsInput,
} from "./fiscal-settings.service";

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

function mockExisting(doc: Record<string, unknown> | null) {
  get.mockImplementation(async () => ({
    exists: doc !== null,
    data: () => doc ?? undefined,
  }));
}

function savedPayload(): Record<string, unknown> {
  return set.mock.calls[0]?.[0] as Record<string, unknown>;
}

const BASE = { status: "registered", cnpj: CNPJ, webhookSecret: "s" };

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  set.mockResolvedValue(undefined);
});

describe("saveFiscalSettings — dataInicioRecebimento", () => {
  it("grava a data escolhida", async () => {
    mockExisting({ ...BASE });

    await saveFiscalSettings("t1", {
      ...INPUT,
      dataInicioRecebimento: "2026-09-04",
    } as SaveFiscalSettingsInput);

    expect(savedPayload().dataInicioRecebimento).toBe("2026-09-04");
  });

  it("ainda deixa corrigir enquanto a empresa nao existe no provedor", async () => {
    // Sem `providerIssuerId` nada foi enviado — travar aqui transformaria um
    // erro de digitacao em decisao permanente.
    mockExisting({ ...BASE, dataInicioRecebimento: "2020-01-01" });

    await saveFiscalSettings("t1", {
      ...INPUT,
      dataInicioRecebimento: "2026-09-04",
    } as SaveFiscalSettingsInput);

    expect(savedPayload().dataInicioRecebimento).toBe("2026-09-04");
  });

  it("CONGELA depois que a empresa foi registrada no provedor", async () => {
    // O teste que mais importa: o provedor recusa a alteracao, entao aceita-la
    // aqui faria a tela mentir sobre o que esta valendo la.
    mockExisting({
      ...BASE,
      providerIssuerId: "9911",
      dataInicioRecebimento: "2026-01-15",
    });

    await saveFiscalSettings("t1", {
      ...INPUT,
      dataInicioRecebimento: "2020-01-01",
    } as SaveFiscalSettingsInput);

    // `undefined` no array `optional` = mantem o que esta gravado.
    expect(savedPayload().dataInicioRecebimento).toBeUndefined();
  });

  it("nao congela quando ha emitente registrado mas nenhuma data definida", async () => {
    // Quem registrou o certificado com a recepcao desligada nunca enviou data
    // nenhuma — ligar a recepcao depois tem que poder escolher.
    mockExisting({ ...BASE, providerIssuerId: "9911" });

    await saveFiscalSettings("t1", {
      ...INPUT,
      dataInicioRecebimento: "2026-09-04",
    } as SaveFiscalSettingsInput);

    expect(savedPayload().dataInicioRecebimento).toBe("2026-09-04");
  });
});
