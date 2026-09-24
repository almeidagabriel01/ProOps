jest.mock("../../../init", () => ({ db: {}, auth: {} }));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { resolvePlanCapabilities, type PlanTierId } from "../../../shared/plan-capabilities";
import { RECONNECT_REQUIRED_MESSAGE } from "../../../lib/google-calendar-feature";
import {
  buildLinkedAccounts,
  maskPhone,
  type LinkedAccount,
  type LinkedAccountId,
  type LinkedAccountsSources,
  type LinkedAccountsViewer,
} from "../linked-accounts.service";
import type { FiscalSettingsDocument } from "../fiscal/fiscal-settings.service";
import type { TenantAsaasData } from "../asaas.service";

const TENANT = "tenant-1";
const NOW = new Date("2026-09-24T12:00:00Z");
const MASTER: LinkedAccountsViewer = { role: "MASTER", isSuperAdmin: false };

function sources(
  tier: PlanTierId,
  overrides: Partial<LinkedAccountsSources> = {},
): LinkedAccountsSources {
  return {
    calendar: null,
    drive: null,
    asaas: null,
    fiscal: null,
    user: null,
    capabilities: resolvePlanCapabilities(tier),
    tier,
    calendarPlatformEnabled: true,
    asaasPlatformAvailable: true,
    ...overrides,
  };
}

function pick(
  list: LinkedAccount[],
  id: LinkedAccountId,
): LinkedAccount {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function build(
  tier: PlanTierId,
  overrides: Partial<LinkedAccountsSources> = {},
  viewer: LinkedAccountsViewer = MASTER,
) {
  return buildLinkedAccounts(TENANT, sources(tier, overrides), viewer, NOW);
}

const calendarDoc = (extra: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  enabled: true,
  refreshTokenEnc: "enc-secret",
  connectedEmail: "agenda@empresa.com",
  calendarId: "primary",
  createdAt: "2026-08-01T10:00:00.000Z",
  lastSuccessfulSyncAt: "2026-09-24T11:00:00.000Z",
  lastSyncError: null,
  ...extra,
});

const driveDoc = (extra: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  provider: "google" as const,
  connectedEmail: "drive@empresa.com",
  refreshTokenEnc: "enc-drive",
  rootFolderId: "folder-1",
  rootFolderName: "ProOps",
  createdAt: "2026-08-02T10:00:00.000Z",
  lastError: null,
  ...extra,
});

const fiscalDoc = (extra: Partial<FiscalSettingsDocument> = {}) =>
  ({
    tenantId: TENANT,
    provider: "focus",
    environment: "producao",
    status: "ready",
    cnpj: "12345678000195",
    razaoSocial: "Empresa Teste LTDA",
    email: "fiscal@empresa.com",
    certificadoValidade: "2027-06-01",
    certificadoSenhaEnc: "enc-senha",
    webhookSecret: "segredo-webhook",
    focusTokenProducaoEnc: "enc-token",
    webhookStatus: { state: "registered", attemptedAt: "x", registered: [] },
    autoIssueRule: "manual",
    createdAt: "2026-08-03T10:00:00.000Z",
    ...extra,
  }) as unknown as FiscalSettingsDocument;

const asaasData = (extra: Record<string, unknown> = {}) =>
  ({
  apiKey: "aact_chave_secreta",
  environment: "production",
  connectedAt: "2026-08-04T10:00:00.000Z",
  webhookAuthToken: "token-webhook",
  webhookStatus: { state: "registered", attemptedAt: "x" },
  accountStatus: { general: "APPROVED", checkedAt: "2026-09-20T10:00:00.000Z" },
  ...extra,
  }) as unknown as Partial<TenantAsaasData>;

describe("buildLinkedAccounts: lista e plano", () => {
  it("devolve sempre as cinco integracoes, na mesma ordem", () => {
    expect(build("enterprise").map((i) => i.id)).toEqual([
      "google_calendar",
      "google_drive",
      "asaas",
      "fiscal",
      "whatsapp",
    ]);
  });

  it("enterprise sem nada conectado: tudo desconectado, nada fora do plano", () => {
    for (const item of build("enterprise")) {
      expect(item.status).toBe("disconnected");
      expect(item.plan.availableInPlan).toBe(true);
    }
  });

  it("starter: Agenda, Drive, Asaas, fiscal e WhatsApp ficam fora do plano", () => {
    const list = build("starter", {
      calendar: calendarDoc(),
      drive: driveDoc(),
    });
    for (const item of list) {
      expect(item.status).toBe("not_in_plan");
    }
    // Fiscal e pagamento online sao vendidos como add-on no starter.
    expect(pick(list, "fiscal").plan).toEqual({
      availableInPlan: false,
      minimumTier: "enterprise",
      addonAvailable: true,
    });
    expect(pick(list, "google_drive").plan).toMatchObject({
      minimumTier: "pro",
      addonAvailable: false,
    });
  });

  it("pro com add-on fiscal: fiscal passa a contar como incluido", () => {
    const capabilities = { ...resolvePlanCapabilities("pro"), fiscal: true };
    const list = build("pro", { capabilities, fiscal: fiscalDoc() });
    expect(pick(list, "fiscal").status).toBe("connected");
    expect(pick(list, "asaas").status).toBe("not_in_plan");
    expect(pick(list, "asaas").plan.addonAvailable).toBe(true);
  });
});

describe("Google Agenda", () => {
  it("conectada mostra e-mail, data e ultima sincronizacao", () => {
    const item = pick(build("pro", { calendar: calendarDoc() }), "google_calendar");
    expect(item).toMatchObject({
      status: "connected",
      accountLabel: "agenda@empresa.com",
      connectedAt: "2026-08-01T10:00:00.000Z",
      lastActivityAt: "2026-09-24T11:00:00.000Z",
      issue: null,
    });
  });

  it.each([
    ["invalid_grant", "invalid_grant"],
    ["token revogado", "Token has been expired or revoked."],
    ["escopo insuficiente", "Request had insufficient authentication scopes."],
    ["mensagem de reconexao gravada", RECONNECT_REQUIRED_MESSAGE],
  ])("%s pede reconexao", (_label, lastSyncError) => {
    const item = pick(
      build("pro", { calendar: calendarDoc({ lastSyncError }) }),
      "google_calendar",
    );
    expect(item.status).toBe("needs_reconnect");
    expect(item.issue).toMatch(/Reconecte/);
  });

  it("outro erro de sincronizacao vira atencao, sem pedir reconexao", () => {
    const item = pick(
      build("pro", { calendar: calendarDoc({ lastSyncError: "Rate limit exceeded" }) }),
      "google_calendar",
    );
    expect(item.status).toBe("attention");
    expect(item.issue).toContain("Rate limit exceeded");
  });

  it.each([
    ["desligada", { enabled: false }],
    ["de outro tenant", { tenantId: "outro" }],
    ["sem token", { refreshTokenEnc: "", refreshToken: "" }],
  ])("documento %s nao conta como conectado", (_label, extra) => {
    const item = pick(build("pro", { calendar: calendarDoc(extra) }), "google_calendar");
    expect(item.status).toBe("disconnected");
    expect(item.accountLabel).toBeNull();
  });

  it("kill switch desligado: indisponivel na plataforma", () => {
    const item = pick(
      build("pro", { calendar: calendarDoc(), calendarPlatformEnabled: false }),
      "google_calendar",
    );
    expect(item.status).toBe("platform_unavailable");
  });
});

describe("Google Drive", () => {
  it("conectado mostra e-mail e pasta", () => {
    const item = pick(build("pro", { drive: driveDoc() }), "google_drive");
    expect(item).toMatchObject({
      status: "connected",
      accountLabel: "drive@empresa.com",
      accountDetail: "Pasta: ProOps",
    });
  });

  it("invalid_grant pede reconexao", () => {
    const item = pick(
      build("pro", { drive: driveDoc({ lastError: "invalid_grant" }) }),
      "google_drive",
    );
    expect(item.status).toBe("needs_reconnect");
  });

  it("documento sem token (desconectado pelo usuario) conta como desconectado", () => {
    const item = pick(
      build("pro", {
        drive: driveDoc({ refreshTokenEnc: "", connectedEmail: null }),
      }),
      "google_drive",
    );
    expect(item.status).toBe("disconnected");
  });

  it("conectado sem pasta raiz pede atencao", () => {
    const item = pick(
      build("pro", { drive: driveDoc({ rootFolderId: null, rootFolderName: null }) }),
      "google_drive",
    );
    expect(item.status).toBe("attention");
  });
});

describe("Asaas", () => {
  it("conectado e aprovado", () => {
    const item = pick(build("enterprise", { asaas: asaasData() }), "asaas");
    expect(item).toMatchObject({
      status: "connected",
      accountDetail: "Ambiente de produção",
      connectedAt: "2026-08-04T10:00:00.000Z",
    });
  });

  it.each(["REJECTED", "PENDING", "AWAITING_APPROVAL"])(
    "cadastro %s pede atencao",
    (general) => {
      const item = pick(
        build("enterprise", {
          asaas: asaasData({ accountStatus: { general, checkedAt: "x" } }),
        }),
        "asaas",
      );
      expect(item.status).toBe("attention");
      expect(item.issue).toBeTruthy();
    },
  );

  it("aviso de pagamento (webhook) falhou pede atencao", () => {
    const item = pick(
      build("enterprise", {
        asaas: asaasData({ webhookStatus: { state: "failed", attemptedAt: "x" } }),
      }),
      "asaas",
    );
    expect(item.status).toBe("attention");
  });

  it("sem conexao e sem chave mestre na plataforma: indisponivel", () => {
    const item = pick(
      build("enterprise", { asaasPlatformAvailable: false }),
      "asaas",
    );
    expect(item.status).toBe("platform_unavailable");
  });

  it("exige financeiro E pagamento online", () => {
    const capabilities = { ...resolvePlanCapabilities("enterprise"), financial: false };
    const item = pick(build("enterprise", { capabilities, asaas: asaasData() }), "asaas");
    expect(item.status).toBe("not_in_plan");
  });
});

describe("Notas fiscais", () => {
  it("pronta mostra razao social, CNPJ formatado e ambiente", () => {
    const item = pick(build("enterprise", { fiscal: fiscalDoc() }), "fiscal");
    expect(item).toMatchObject({
      status: "connected",
      accountLabel: "Empresa Teste LTDA",
      accountDetail: "CNPJ 12.345.678/0001-95, Ambiente de produção",
    });
  });

  it("registered (aguardando a primeira nota autorizada) conta como conectado, com aviso neutro", () => {
    const item = pick(
      build("enterprise", { fiscal: fiscalDoc({ status: "registered" }) }),
      "fiscal",
    );
    expect(item.status).toBe("connected");
    expect(item.issue).toBeNull();
    expect(item.notice).toMatch(/primeira nota autorizada/);
  });

  it("registered em homologacao, como o emitente real de dev, nao pede atencao", () => {
    const item = pick(
      build("enterprise", {
        fiscal: fiscalDoc({ status: "registered", environment: "homologacao" }),
      }),
      "fiscal",
    );
    expect(item.status).toBe("connected");
    expect(item.accountDetail).toContain("homologação");
  });

  it("registered com certificado vencendo: a atencao do certificado vence, e o aviso continua", () => {
    const item = pick(
      build("enterprise", {
        fiscal: fiscalDoc({ status: "registered", certificadoValidade: "2026-10-04" }),
      }),
      "fiscal",
    );
    expect(item.status).toBe("attention");
    expect(item.issue).toContain("10 dias");
    expect(item.notice).toMatch(/primeira nota autorizada/);
  });

  it("pending pede o certificado, sem falar em configuracao generica", () => {
    const item = pick(
      build("enterprise", { fiscal: fiscalDoc({ status: "pending" }) }),
      "fiscal",
    );
    expect(item.status).toBe("attention");
    expect(item.issue).toMatch(/certificado digital A1/);
    expect(item.notice).toBeNull();
  });

  it("ready nao tem aviso", () => {
    const item = pick(build("enterprise", { fiscal: fiscalDoc() }), "fiscal");
    expect(item.notice).toBeNull();
  });

  it("certificado vencido pede reconexao", () => {
    const item = pick(
      build("enterprise", { fiscal: fiscalDoc({ certificadoValidade: "2026-09-01" }) }),
      "fiscal",
    );
    expect(item.status).toBe("needs_reconnect");
  });

  it("certificado vencendo em ate 30 dias pede atencao", () => {
    const item = pick(
      build("enterprise", { fiscal: fiscalDoc({ certificadoValidade: "2026-10-04" }) }),
      "fiscal",
    );
    expect(item.status).toBe("attention");
    expect(item.issue).toContain("10 dias");
  });

  it.each([
    ["status error", { status: "error", lastError: "CNPJ recusado" }],
    ["certificado ainda nao enviado", { status: "pending" }],
    ["webhook falhou", { webhookStatus: { state: "failed", attemptedAt: "x", registered: [] } }],
    ["webhook parcial", { webhookStatus: { state: "partial", attemptedAt: "x", registered: [] } }],
  ])("%s pede atencao", (_label, extra) => {
    const item = pick(
      build("enterprise", {
        fiscal: fiscalDoc(extra as Partial<FiscalSettingsDocument>),
      }),
      "fiscal",
    );
    expect(item.status).toBe("attention");
  });
});

describe("WhatsApp do usuario", () => {
  it("telefone vinculado aparece mascarado, com a verificacao em duas etapas", () => {
    const item = pick(
      build("enterprise", {
        user: { phoneNumber: "5511987654321", whatsappMfaEnabled: true },
      }),
      "whatsapp",
    );
    expect(item).toMatchObject({
      scope: "user",
      status: "connected",
      accountLabel: "•••• 4321",
      canManage: true,
    });
    expect(item.accountDetail).toMatch(/duas etapas/);
  });

  it("sem telefone: desconectado", () => {
    expect(pick(build("enterprise", { user: {} }), "whatsapp").status).toBe(
      "disconnected",
    );
  });

  it("maskPhone nunca devolve mais que os 4 ultimos digitos", () => {
    expect(maskPhone("+55 (11) 98765-4321")).toBe("•••• 4321");
    expect(maskPhone("12")).toBeNull();
    expect(maskPhone(null)).toBeNull();
  });
});

describe("canManage por papel", () => {
  const tenantIds: LinkedAccountId[] = ["google_calendar", "google_drive", "asaas", "fiscal"];

  it.each([
    ["MASTER", false, true],
    ["ADMIN", false, true],
    ["WK", false, true],
    ["master", false, true],
    ["MEMBER", false, false],
    ["USER", false, false],
    ["SUPERADMIN", true, true],
  ])("papel %s (superadmin=%s) gerencia integracoes da empresa: %s", (role, isSuperAdmin, expected) => {
    const list = build("enterprise", {}, { role, isSuperAdmin });
    for (const id of tenantIds) {
      expect(pick(list, id).canManage).toBe(expected);
    }
    // O telefone e do proprio usuario.
    expect(pick(list, "whatsapp").canManage).toBe(true);
  });
});

describe("nenhum segredo sai na resposta", () => {
  it("token, apiKey, segredos de webhook e senha de certificado ficam de fora", () => {
    const list = build(
      "enterprise",
      {
        calendar: calendarDoc({ refreshToken: "plain-refresh" }),
        drive: driveDoc(),
        asaas: asaasData(),
        fiscal: fiscalDoc(),
        user: { phoneNumber: "5511987654321", whatsappMfaPhone: "5511987654321" },
      },
    );
    const serialized = JSON.stringify(list);
    for (const secret of [
      "enc-secret",
      "plain-refresh",
      "enc-drive",
      "aact_chave_secreta",
      "token-webhook",
      "segredo-webhook",
      "enc-senha",
      "enc-token",
      "5511987654321",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
