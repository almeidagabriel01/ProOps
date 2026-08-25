jest.mock("../../../init", () => ({ db: { collection: jest.fn() } }));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/token-encryption", () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
}));

import {
  buildIssuerConfig,
  daysUntil,
  toPublicSettings,
  type FiscalSettingsDocument,
} from "./fiscal-settings.service";

const settings: FiscalSettingsDocument = {
  tenantId: "tenant-1",
  provider: "focus",
  environment: "homologacao",
  status: "registered",
  cnpj: "12345678000123",
  razaoSocial: "Automacao Residencial Ltda",
  nomeFantasia: "AutoCasa",
  inscricaoEstadual: "1234567",
  inscricaoMunicipal: "98765",
  cnae: "4321500",
  regimeTributario: 1,
  email: "fiscal@autocasa.example.br",
  telefone: "4130333333",
  endereco: {
    logradouro: "Rua Joao da Silva",
    numero: "153",
    bairro: "Vila Isabel",
    municipio: "Curitiba",
    codigoIbge: "4106902",
    uf: "PR",
    cep: "80210000",
  },
  habilitaNfe: true,
  habilitaNfse: true,
  certificadoSenhaEnc: "kms:v1:c2VuaGEtc3VwZXItc2VjcmV0YQ==",
  certificadoValidade: "2027-03-15",
  providerIssuerId: "9911",
  autoIssueRule: "manual",
  updatedAt: "2026-08-25T12:00:00.000Z",
};

describe("toPublicSettings", () => {
  it("reports an unconfigured tenant without inventing fields", () => {
    expect(toPublicSettings(null)).toEqual({ configured: false });
  });

  it("never exposes the encrypted certificate password", () => {
    // This projection is the only thing between a stored secret and an API
    // response. Serializing it is how a leak would actually reach a client.
    const view = toPublicSettings(settings);

    expect(view).not.toHaveProperty("certificadoSenhaEnc");
    expect(view).not.toHaveProperty("certificadoSenha");
    expect(JSON.stringify(view)).not.toContain("kms:v1:");
  });

  it("reports only whether a certificate password is on file", () => {
    expect(toPublicSettings(settings).certificadoArmazenado).toBe(true);
    expect(
      toPublicSettings({ ...settings, certificadoSenhaEnc: undefined }).certificadoArmazenado,
    ).toBe(false);
  });

  it("carries the identifying and configuration fields through", () => {
    expect(toPublicSettings(settings)).toMatchObject({
      configured: true,
      provider: "focus",
      environment: "homologacao",
      status: "registered",
      cnpj: "12345678000123",
      razaoSocial: "Automacao Residencial Ltda",
      inscricaoMunicipal: "98765",
      regimeTributario: 1,
      habilitaNfe: true,
      habilitaNfse: true,
      autoIssueRule: "manual",
    });
  });

  it("omits optional fields that are absent instead of sending empties", () => {
    const view = toPublicSettings({
      ...settings,
      nomeFantasia: undefined,
      inscricaoEstadual: "",
      lastError: undefined,
    });

    expect(view).not.toHaveProperty("nomeFantasia");
    expect(view).not.toHaveProperty("inscricaoEstadual");
    expect(view).not.toHaveProperty("lastError");
  });

  it("derives the days remaining on the A1 certificate", () => {
    const now = new Date("2026-08-25T09:00:00.000Z");
    expect(toPublicSettings(settings, now).certificadoDiasParaVencer).toBe(202);
  });

  it("reports a negative count once the certificate has expired", () => {
    // An expired A1 breaks every issue attempt silently, so the UI has to be
    // able to tell "expiring" from "already dead".
    const now = new Date("2026-08-25T09:00:00.000Z");
    const view = toPublicSettings({ ...settings, certificadoValidade: "2026-08-01" }, now);

    expect(view.certificadoDiasParaVencer).toBe(-24);
  });

  it("skips the countdown when the stored expiry is unparseable", () => {
    const view = toPublicSettings({ ...settings, certificadoValidade: "nao-e-data" });
    expect(view).not.toHaveProperty("certificadoDiasParaVencer");
  });
});

describe("daysUntil", () => {
  it("counts whole days regardless of the time of day", () => {
    const now = new Date("2026-08-25T23:30:00.000Z");
    expect(daysUntil("2026-08-26", now)).toBe(1);
    expect(daysUntil("2026-08-25", now)).toBe(0);
  });

  it("returns NaN for an invalid date", () => {
    expect(Number.isNaN(daysUntil("qualquer coisa"))).toBe(true);
  });
});

describe("buildIssuerConfig", () => {
  it("injects the certificate supplied by the caller", () => {
    // The .pfx is never stored — it comes from the upload in the wizard and is
    // dropped after the provider accepts it.
    const config = buildIssuerConfig(settings, "MIIj4gIBAzCCI54=", "senha-secreta");

    expect(config.certificadoBase64).toBe("MIIj4gIBAzCCI54=");
    expect(config.certificadoSenha).toBe("senha-secreta");
  });

  it("carries the issuer identity and the enabled documents", () => {
    const config = buildIssuerConfig(settings, "cert", "senha");

    expect(config).toMatchObject({
      cnpj: "12345678000123",
      razaoSocial: "Automacao Residencial Ltda",
      inscricaoMunicipal: "98765",
      regimeTributario: 1,
      habilitaNfe: true,
      habilitaNfse: true,
    });
    expect(config.endereco.codigoIbge).toBe("4106902");
  });
});
