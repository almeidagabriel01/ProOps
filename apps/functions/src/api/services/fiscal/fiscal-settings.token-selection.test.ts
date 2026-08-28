/**
 * Qual token assina a nota.
 *
 * É a linha mais perigosa do módulo. O provedor devolve DOIS tokens por empresa
 * — `token_homologacao` e `token_producao` — e a escolha entre eles é o que
 * separa "nota de teste sem valor fiscal" de "documento com validade jurídica".
 *
 * Inverter essa escolha não daria erro: os dois tokens são válidos e autenticam.
 * A nota simplesmente sairia no ambiente errado. Em homologação com o token de
 * produção, um teste viraria uma nota real no nome do cliente, com numeração
 * consumida e obrigação acessória gerada.
 *
 * Por isso o teste existe mesmo sendo uma condição de uma linha.
 */

const getDoc = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: () => ({ doc: () => ({ get: getDoc }) }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  // Devolve o próprio valor guardado, para o teste enxergar QUAL foi escolhido.
  decryptToken: jest.fn(async (stored: string) => `decifrado:${stored}`),
}));

import { getIssuingToken } from "./fiscal-settings.service";

const DOC = {
  tenantId: "tenant-1",
  provider: "focus",
  environment: "homologacao",
  focusTokenHomologacaoEnc: "kms:v1:HOMOLOGACAO",
  focusTokenProducaoEnc: "kms:v1:PRODUCAO",
};

function mockSettings(doc: Record<string, unknown> | null) {
  getDoc.mockResolvedValue({
    exists: doc !== null,
    id: "tenant-1",
    data: () => doc ?? undefined,
  });
}

describe("getIssuingToken", () => {
  beforeEach(() => {
    getDoc.mockReset();
    mockSettings(DOC);
  });

  it("usa o token de HOMOLOGAÇÃO no ambiente de homologação", async () => {
    await expect(getIssuingToken("tenant-1", "homologacao")).resolves.toBe(
      "decifrado:kms:v1:HOMOLOGACAO",
    );
  });

  it("usa o token de PRODUÇÃO no ambiente de produção", async () => {
    await expect(getIssuingToken("tenant-1", "producao")).resolves.toBe(
      "decifrado:kms:v1:PRODUCAO",
    );
  });

  it("falha em vez de cair no outro token quando o do ambiente falta", async () => {
    // O perigo aqui é um fallback "conveniente": sem token de homologação,
    // usar o de produção emitiria uma nota real num teste. Falhar é o certo.
    mockSettings({ ...DOC, focusTokenHomologacaoEnc: undefined });

    await expect(getIssuingToken("tenant-1", "homologacao")).rejects.toThrow(
      "FISCAL_EMITENTE_NAO_REGISTRADO",
    );
  });

  it("falha quando a empresa nunca foi registrada", async () => {
    mockSettings(null);

    await expect(getIssuingToken("tenant-1", "homologacao")).rejects.toThrow(
      "FISCAL_EMITENTE_NAO_REGISTRADO",
    );
  });

  it("nunca cai no token da conta", async () => {
    // O token da conta (FOCUS_NFE_MASTER_TOKEN) gerencia cadastro e não emite.
    // Se algum dia ele virar fallback aqui, um bug conseguiria emitir sob o
    // CNPJ de outro tenant.
    process.env.FOCUS_NFE_MASTER_TOKEN = "TOKEN-DA-CONTA";
    mockSettings({ ...DOC, focusTokenProducaoEnc: undefined });

    await expect(getIssuingToken("tenant-1", "producao")).rejects.toThrow(
      "FISCAL_EMITENTE_NAO_REGISTRADO",
    );
  });
});
