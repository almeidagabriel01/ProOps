/**
 * `dry_run` tem que chegar ao provedor.
 *
 * O bug: o handler lia `body.dryRun`, chamava `registerIssuer(config, env)` sem
 * repassá-lo e só pulava a gravação local. A empresa era criada de verdade no
 * provedor por um pedido que só queria validar — e o ProOps ficava sem o token
 * que assina as notas dela, que é exatamente o estado que produz
 * `FISCAL_EMITENTE_NAO_REGISTRADO` na primeira emissão.
 *
 * A causa raiz estava na interface `FiscalProvider`, que não declarava o
 * parâmetro: a implementação o tinha, mas nenhum chamador conseguia passá-lo.
 */

const registerIssuer = jest.fn();
const saveFiscalSettings = jest.fn();

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
jest.mock("../services/fiscal/fiscal-provider.registry", () => ({
  getFiscalProvider: () => ({ registerIssuer }),
  resolveFiscalEnvironment: () => "homologacao",
}));
jest.mock("../services/fiscal/fiscal-settings.service", () => ({
  getFiscalSettings: jest.fn(async () => ({
    provider: "focus",
    environment: "homologacao",
    cnpj: "50759330000133",
    razaoSocial: "EMPRESA TESTE",
  })),
  buildIssuerConfig: jest.fn(() => ({ cnpj: "50759330000133" })),
  saveFiscalSettings,
  setFiscalStatus: jest.fn(),
  toPublicSettings: jest.fn(() => ({})),
  getCertificatePassword: jest.fn(),
  deleteFiscalSettings: jest.fn(),
}));

import { registerIssuerHandler } from "./fiscal.controller";

function buildRes() {
  const res = {
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
  return res;
}

const CERT = { certificadoBase64: "YmFzZTY0", certificadoSenha: "1234" };

function buildReq(body: Record<string, unknown>) {
  return { user: { uid: "user-1" }, body } as never;
}

describe("registerIssuerHandler — dry run", () => {
  beforeEach(() => {
    registerIssuer.mockReset();
    saveFiscalSettings.mockReset();
    registerIssuer.mockResolvedValue({
      cnpj: "50759330000133",
      habilitaNfe: false,
      habilitaNfse: true,
    });
  });

  it("repassa dryRun ao provedor", async () => {
    const res = buildRes();
    await registerIssuerHandler(buildReq({ ...CERT, dryRun: true }), res as never);

    expect(registerIssuer).toHaveBeenCalledTimes(1);
    // O terceiro argumento é o que impede a empresa de ser criada de verdade.
    expect(registerIssuer.mock.calls[0][2]).toBe(true);
  });

  it("não persiste nada num dry run", async () => {
    const res = buildRes();
    await registerIssuerHandler(buildReq({ ...CERT, dryRun: true }), res as never);

    expect(saveFiscalSettings).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ dryRun: true });
  });

  it("cadastro real não vai como dry run", async () => {
    const res = buildRes();
    await registerIssuerHandler(buildReq(CERT), res as never);

    // Falso, não indefinido: um `undefined` aqui significaria que o handler
    // voltou a não repassar o parâmetro e o padrão da implementação é que
    // estaria salvando a chamada.
    expect(registerIssuer.mock.calls[0][2]).toBe(false);
  });

  it("senha ausente é recusada antes de chamar o provedor", async () => {
    const res = buildRes();
    await registerIssuerHandler(
      buildReq({ certificadoBase64: "YmFzZTY0" }),
      res as never,
    );

    expect(registerIssuer).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });
});
