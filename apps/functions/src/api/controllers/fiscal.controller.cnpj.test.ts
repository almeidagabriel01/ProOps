/**
 * CNPJ é validado pelos dígitos verificadores, não só pelo tamanho.
 *
 * O caso real: `30001507593300` foi digitado no lugar de `50759330000133`.
 * Tem 14 dígitos, passava na checagem de tamanho, e o provedor respondeu
 * **404** — que se confunde com rota errada e mandou a investigação para o
 * lado errado por um bom tempo.
 *
 * O risco maior não é o 404. É um CNPJ digitado errado que por acaso seja
 * *válido*: aí a empresa seria cadastrada no provedor sob um CNPJ que não é o
 * do cliente, e a nota sairia no nome de outra pessoa.
 */

const lookupCnpj = jest.fn();

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
  getFiscalProvider: () => ({ lookupCnpj }),
  resolveFiscalEnvironment: () => "homologacao",
}));
jest.mock("../services/fiscal/fiscal-settings.service", () => ({
  getFiscalSettings: jest.fn(async () => ({
    provider: "focus",
    environment: "homologacao",
  })),
  buildIssuerConfig: jest.fn(),
  saveFiscalSettings: jest.fn(),
  setFiscalStatus: jest.fn(),
  toPublicSettings: jest.fn(() => ({})),
  getCertificatePassword: jest.fn(),
  deleteFiscalSettings: jest.fn(),
}));

import { lookupCnpjHandler } from "./fiscal.controller";

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

const req = (cnpj: string) => ({ user: { uid: "u1" }, params: { cnpj } }) as never;

describe("lookupCnpjHandler", () => {
  beforeEach(() => {
    lookupCnpj.mockReset();
    lookupCnpj.mockResolvedValue({ razaoSocial: "EMPRESA" });
  });

  it("recusa CNPJ com dígitos verificadores errados sem chamar o provedor", async () => {
    const res = buildRes();
    await lookupCnpjHandler(req("30001507593300"), res as never);

    expect(res.statusCode).toBe(400);
    expect(lookupCnpj).not.toHaveBeenCalled();
  });

  it("aceita o CNPJ real do primeiro emitente", async () => {
    const res = buildRes();
    await lookupCnpjHandler(req("50759330000133"), res as never);

    expect(lookupCnpj).toHaveBeenCalledWith("50759330000133", "homologacao");
    expect(res.statusCode).toBe(200);
  });

  it("aceita CNPJ formatado, normalizando antes de validar", async () => {
    const res = buildRes();
    await lookupCnpjHandler(req("50.759.330/0001-33"), res as never);

    expect(lookupCnpj).toHaveBeenCalledWith("50759330000133", "homologacao");
  });

  it("recusa tamanho errado e sequência repetida", async () => {
    for (const invalido of ["123", "", "00000000000000", "11111111111111"]) {
      const res = buildRes();
      await lookupCnpjHandler(req(invalido), res as never);
      expect(res.statusCode).toBe(400);
    }
    expect(lookupCnpj).not.toHaveBeenCalled();
  });
});
