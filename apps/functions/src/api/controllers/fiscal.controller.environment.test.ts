/**
 * Saída do modo de teste.
 *
 * Depois dessa troca toda nota vale juridicamente, consome numeração e gera
 * imposto. É a mudança mais consequente do módulo, e a única que não pode
 * acontecer por acidente.
 */

const saveFiscalSettings = jest.fn();
const getFiscalSettings = jest.fn();
const registerFiscalWebhooks = jest.fn();

jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));
jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: jest.fn(async () => ({
    tenantId: "tenant-1",
    isMaster: true,
    isSuperAdmin: false,
  })),
}));
jest.mock("../services/fiscal/fiscal-webhook-registration.service", () => ({
  registerFiscalWebhooks,
}));
jest.mock("../services/fiscal/fiscal-provider.registry", () => ({
  getFiscalProvider: () => ({}),
  resolveFiscalEnvironment: (value: string | undefined) =>
    String(value || "").trim() === "producao" ? "producao" : "homologacao",
}));
jest.mock("../services/fiscal/fiscal-settings.service", () => ({
  getFiscalSettings,
  saveFiscalSettings,
  toPublicSettings: (s: unknown) => s,
  buildIssuerConfig: jest.fn(),
  setFiscalStatus: jest.fn(),
  getCertificatePassword: jest.fn(),
  deleteFiscalSettings: jest.fn(),
}));

import { setFiscalEnvironmentHandler } from "./fiscal.controller";

function buildRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

const req = (body: Record<string, unknown>) =>
  ({ user: { uid: "u1" }, body }) as never;

const SETTINGS = {
  tenantId: "tenant-1",
  environment: "homologacao",
  status: "registered",
  provider: "focus",
  cnpj: "50759330000133",
  webhookSecret: "segredo",
  habilitaNfe: true,
  habilitaNfse: true,
  padraoNfse: "nacional",
};

describe("setFiscalEnvironmentHandler", () => {
  beforeEach(() => {
    saveFiscalSettings.mockReset().mockResolvedValue(SETTINGS);
    getFiscalSettings.mockReset().mockResolvedValue(SETTINGS);
    registerFiscalWebhooks.mockReset().mockResolvedValue({ state: "registered" });
  });

  it("recusa ativar produção sem uma nota de teste autorizada", async () => {
    // Homologação prova que o nosso código monta a nota certa. Só a
    // AUTORIZAÇÃO prova que o emitente está credenciado no fisco — sem isso a
    // primeira falha aconteceria na primeira venda real.
    const res = buildRes();
    await setFiscalEnvironmentHandler(req({ environment: "producao" }), res as never);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({ code: "FISCAL_SEM_NOTA_DE_TESTE" });
    expect(saveFiscalSettings).not.toHaveBeenCalled();
  });

  it("libera produção depois que o emitente chega a ready", async () => {
    getFiscalSettings.mockResolvedValue({ ...SETTINGS, status: "ready" });

    const res = buildRes();
    await setFiscalEnvironmentHandler(req({ environment: "producao" }), res as never);

    expect(res.statusCode).toBe(200);
    expect(saveFiscalSettings).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ environment: "producao" }),
    );
  });

  it("permite forçar para quem já emite por outro sistema", async () => {
    // O portão pode estar errado: quem já emite nota hoje não precisa provar
    // nada para nós. Bling, Omie e Tiny nem travam a troca.
    const res = buildRes();
    await setFiscalEnvironmentHandler(
      req({ environment: "producao", force: true }),
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(saveFiscalSettings).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ environment: "producao" }),
    );
  });

  it("voltar para teste nunca é barrado", async () => {
    // O caminho seguro não precisa de portão: parar de emitir nota com valor
    // fiscal nunca causa dano.
    getFiscalSettings.mockResolvedValue({ ...SETTINGS, environment: "producao" });

    const res = buildRes();
    await setFiscalEnvironmentHandler(req({ environment: "homologacao" }), res as never);

    expect(res.statusCode).toBe(200);
    expect(saveFiscalSettings).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ environment: "homologacao" }),
    );
  });

  it("valor desconhecido cai em homologação, nunca em produção", async () => {
    // O default do parser é o lado seguro: um typo não pode ligar emissão real.
    const res = buildRes();
    await setFiscalEnvironmentHandler(req({ environment: "produção" }), res as never);

    expect(saveFiscalSettings).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ environment: "homologacao" }),
    );
  });

  it("re-registra os gatilhos no ambiente novo", async () => {
    // O gatilho nasce com o token da empresa DAQUELE ambiente. Trocar sem
    // re-registrar deixaria a emissão num lugar e a notificação no outro — as
    // notas voltariam a depender do cron, sem erro e sem explicação.
    getFiscalSettings.mockResolvedValue({ ...SETTINGS, status: "ready" });

    await setFiscalEnvironmentHandler(
      req({ environment: "producao" }),
      buildRes() as never,
    );

    expect(registerFiscalWebhooks).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "producao", padraoNfse: "nacional" }),
    );
  });

  it("não bloqueia a troca se o registro do gatilho falhar", async () => {
    // Best-effort: o cron continua como rede, e o card fiscal mostra o estado.
    getFiscalSettings.mockResolvedValue({ ...SETTINGS, status: "ready" });
    registerFiscalWebhooks.mockRejectedValue(new Error("provedor fora do ar"));

    const res = buildRes();
    await setFiscalEnvironmentHandler(req({ environment: "producao" }), res as never);

    // O ambiente JÁ foi gravado quando o registro roda. Devolver erro faria o
    // usuário tentar de novo achando que a troca falhou.
    expect(res.statusCode).toBe(200);
    expect(saveFiscalSettings).toHaveBeenCalled();
  });

  it("exige configuração fiscal antes de qualquer troca", async () => {
    getFiscalSettings.mockResolvedValue(null);

    const res = buildRes();
    await setFiscalEnvironmentHandler(req({ environment: "producao" }), res as never);

    expect(res.statusCode).toBe(404);
    expect(saveFiscalSettings).not.toHaveBeenCalled();
  });
});
