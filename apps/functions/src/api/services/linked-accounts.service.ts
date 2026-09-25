/**
 * Contas vinculadas: o resumo, numa tela so, de toda conta externa que a
 * empresa (ou o proprio usuario) ligou na ProOps.
 *
 * Cada integracao ja tem o proprio endpoint de status, mas eles nao servem para
 * um resumo: cada um esta atras do proprio `requirePlanCapability` (402 quando o
 * plano nao inclui), o fiscal e so do master, e a Agenda nao distingue um token
 * revogado de uma falha qualquer. Aqui os documentos sao lidos direto e
 * classificados num vocabulario unico.
 *
 * **Nada sensivel sai daqui.** A resposta leva e-mail, CNPJ, telefone mascarado
 * e estado; nunca token, `apiKey`, segredo de webhook ou senha de certificado.
 *
 * Integracao nova com conta externa entra AQUI tambem, senao ela fica fora da
 * tela e a pessoa so descobre que a conexao caiu quando precisar dela.
 */

import { db } from "../../init";
import { isTenantAdminRole } from "../../lib/auth-context";
import {
  isGoogleCalendarSyncEnabled,
  isInsufficientScopeError,
  RECONNECT_REQUIRED_MESSAGE,
} from "../../lib/google-calendar-feature";
import { resolveTenantCapabilities } from "../../lib/tenant-capabilities";
import { selectRefreshTokenSource } from "../../lib/token-source";
import {
  addonsGrantingCapability,
  isAddonAvailableForTier,
} from "../../shared/addon-definitions";
import {
  minimumTierForCapability,
  type PlanCapabilities,
  type PlanCapabilityKey,
  type PlanTierId,
} from "../../shared/plan-capabilities";
import { isPlatformConfigured, type TenantAsaasData } from "./asaas.service";
import {
  isInvalidGrantError,
  type DriveIntegrationDocument,
} from "./drive/drive-oauth.service";
import {
  toPublicSettings,
  type FiscalSettingsDocument,
} from "./fiscal/fiscal-settings.service";

export type LinkedAccountId =
  | "google_calendar"
  | "google_drive"
  | "asaas"
  | "fiscal"
  | "whatsapp";

export type LinkedAccountStatus =
  | "connected"
  | "attention"
  | "needs_reconnect"
  | "disconnected"
  | "not_in_plan"
  | "platform_unavailable";

export interface LinkedAccountPlanInfo {
  availableInPlan: boolean;
  /** Menor plano que inclui a integracao nativamente. */
  minimumTier: PlanTierId | null;
  /** O plano atual pode comprar um add-on que libera a integracao. */
  addonAvailable: boolean;
}

export interface LinkedAccount {
  id: LinkedAccountId;
  /** `tenant`: vale para a empresa inteira. `user`: so para quem esta vendo. */
  scope: "tenant" | "user";
  status: LinkedAccountStatus;
  /** Quem esta conectado: e-mail, razao social ou telefone mascarado. */
  accountLabel: string | null;
  accountDetail: string | null;
  connectedAt: string | null;
  lastActivityAt: string | null;
  /** O que precisa ser feito, em texto para o usuario. */
  issue: string | null;
  /** Etapa em andamento que NAO e problema, em texto neutro. */
  notice: string | null;
  plan: LinkedAccountPlanInfo;
  canManage: boolean;
  manageHref: string;
}

export interface LinkedAccountsViewer {
  role: string;
  isSuperAdmin: boolean;
}

export interface LinkedAccountsSources {
  calendar: Record<string, unknown> | null;
  drive: Partial<DriveIntegrationDocument> | null;
  asaas: Partial<TenantAsaasData> | null;
  fiscal: FiscalSettingsDocument | null;
  user: Record<string, unknown> | null;
  capabilities: PlanCapabilities;
  tier: PlanTierId;
  calendarPlatformEnabled: boolean;
  asaasPlatformAvailable: boolean;
}

const CERTIFICATE_WARNING_DAYS = 30;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function text(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function planInfo(
  capabilities: PlanCapabilities,
  tier: PlanTierId,
  required: PlanCapabilityKey[],
): LinkedAccountPlanInfo {
  const missing = required.filter((key) => capabilities[key] !== true);
  if (missing.length === 0) {
    return { availableInPlan: true, minimumTier: null, addonAvailable: false };
  }
  const tierOrder: PlanTierId[] = ["free", "starter", "pro", "enterprise"];
  const minimumTier = missing
    .map((key) => minimumTierForCapability(key))
    .reduce<PlanTierId | null>((highest, current) => {
      if (!current) return highest;
      if (!highest) return current;
      return tierOrder.indexOf(current) > tierOrder.indexOf(highest)
        ? current
        : highest;
    }, null);
  const addonAvailable = missing.every((key) =>
    addonsGrantingCapability(key).some((addon) =>
      isAddonAvailableForTier(addon, tier),
    ),
  );
  return { availableInPlan: false, minimumTier, addonAvailable };
}

function base(
  id: LinkedAccountId,
  scope: "tenant" | "user",
  plan: LinkedAccountPlanInfo,
  canManage: boolean,
  manageHref: string,
): LinkedAccount {
  return {
    id,
    scope,
    status: "disconnected",
    accountLabel: null,
    accountDetail: null,
    connectedAt: null,
    lastActivityAt: null,
    issue: null,
    notice: null,
    plan,
    canManage,
    manageHref,
  };
}

export function classifyGoogleCalendar(
  doc: Record<string, unknown> | null,
  tenantId: string,
  plan: LinkedAccountPlanInfo,
  canManage: boolean,
  platformEnabled: boolean,
): LinkedAccount {
  const item = base("google_calendar", "tenant", plan, canManage, "/calendar");
  if (!plan.availableInPlan) return { ...item, status: "not_in_plan" };
  if (!platformEnabled) return { ...item, status: "platform_unavailable" };

  // Mesma regra de `getGoogleIntegration`: documento do tenant, ligado e com
  // algum token guardado.
  const hasToken =
    doc !== null &&
    selectRefreshTokenSource({
      refreshToken: String(doc.refreshToken || "").trim(),
      refreshTokenEnc: String(doc.refreshTokenEnc || "").trim() || null,
    }).source !== "none";
  const connected =
    doc !== null &&
    doc.enabled === true &&
    String(doc.tenantId || "").trim() === tenantId &&
    hasToken;
  if (!connected) return item;

  const connectedItem: LinkedAccount = {
    ...item,
    status: "connected",
    accountLabel: text(doc.connectedEmail),
    accountDetail:
      text(doc.calendarId) && doc.calendarId !== "primary"
        ? `Agenda: ${text(doc.calendarId)}`
        : "Agenda principal",
    connectedAt: toIso(doc.createdAt),
    lastActivityAt: toIso(doc.lastSuccessfulSyncAt),
  };

  const lastSyncError = text(doc.lastSyncError);
  if (!lastSyncError) return connectedItem;

  // Token revogado ou consentimento antigo: tentar de novo nao resolve, so
  // reconectar. O controller nao marca isso num campo, entao a classificacao e
  // feita pelo texto do erro.
  if (
    isInvalidGrantError(lastSyncError) ||
    isInsufficientScopeError(lastSyncError) ||
    lastSyncError === RECONNECT_REQUIRED_MESSAGE
  ) {
    return {
      ...connectedItem,
      status: "needs_reconnect",
      issue:
        "O Google não aceita mais a autorização dada à ProOps. Reconecte a conta para voltar a sincronizar os eventos.",
    };
  }
  return {
    ...connectedItem,
    status: "attention",
    issue: `A última sincronização falhou: ${lastSyncError.slice(0, 200)}`,
  };
}

export function classifyGoogleDrive(
  doc: Partial<DriveIntegrationDocument> | null,
  plan: LinkedAccountPlanInfo,
  canManage: boolean,
): LinkedAccount {
  const item = base("google_drive", "tenant", plan, canManage, "/settings/drive");
  if (!plan.availableInPlan) return { ...item, status: "not_in_plan" };
  if (!doc) return item;

  const needsReconnect = doc.lastError === "invalid_grant";
  // O documento sobrevive ao desconectar para guardar a pasta: conectado e ter
  // token, nao ter documento.
  if (!doc.refreshTokenEnc && !needsReconnect) return item;

  const connectedItem: LinkedAccount = {
    ...item,
    status: "connected",
    accountLabel: text(doc.connectedEmail),
    accountDetail: text(doc.rootFolderName)
      ? `Pasta: ${text(doc.rootFolderName)}`
      : null,
    connectedAt: toIso(doc.createdAt),
  };

  if (needsReconnect) {
    return {
      ...connectedItem,
      status: "needs_reconnect",
      issue:
        "O Google revogou o acesso da ProOps ao Drive. Reconecte a conta para voltar a salvar as propostas na pasta do cliente.",
    };
  }
  if (!doc.rootFolderId) {
    return {
      ...connectedItem,
      status: "attention",
      issue: "Falta criar a pasta onde as propostas serão salvas.",
    };
  }
  return connectedItem;
}

const ASAAS_ACCOUNT_ISSUES: Record<string, string> = {
  REJECTED:
    "O Asaas recusou o cadastro da conta. Revise os dados e os documentos para receber pagamentos.",
  PENDING:
    "O cadastro no Asaas ainda tem pendências. Envie os documentos para começar a receber.",
  AWAITING_APPROVAL:
    "O cadastro está em análise no Asaas. Os pagamentos online começam a funcionar depois da aprovação.",
};

export function classifyAsaas(
  asaas: Partial<TenantAsaasData> | null,
  plan: LinkedAccountPlanInfo,
  canManage: boolean,
  platformAvailable: boolean,
): LinkedAccount {
  const item = base("asaas", "tenant", plan, canManage, "/settings/payments");
  if (!plan.availableInPlan) return { ...item, status: "not_in_plan" };

  const connected = Boolean(asaas && (asaas.apiKey || asaas.connectedAt));
  if (!connected || !asaas) {
    return platformAvailable ? item : { ...item, status: "platform_unavailable" };
  }

  const connectedItem: LinkedAccount = {
    ...item,
    status: "connected",
    accountLabel: "Subconta Asaas",
    accountDetail:
      asaas.environment === "sandbox"
        ? "Ambiente de testes (sandbox)"
        : "Ambiente de produção",
    connectedAt: toIso(asaas.connectedAt),
    lastActivityAt: toIso(asaas.accountStatus?.checkedAt),
  };

  const general = asaas.accountStatus?.general;
  if (general && general !== "APPROVED" && ASAAS_ACCOUNT_ISSUES[general]) {
    return {
      ...connectedItem,
      status: "attention",
      issue: ASAAS_ACCOUNT_ISSUES[general],
    };
  }
  if (asaas.webhookStatus?.state === "failed") {
    return {
      ...connectedItem,
      status: "attention",
      issue:
        "O Asaas não está conseguindo avisar a ProOps sobre os pagamentos recebidos. Tente registrar o aviso de novo.",
    };
  }
  return connectedItem;
}

function formatCnpj(cnpj: string | null | undefined): string | null {
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) return text(cnpj);
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

export function classifyFiscal(
  doc: FiscalSettingsDocument | null,
  plan: LinkedAccountPlanInfo,
  canManage: boolean,
  now: Date = new Date(),
): LinkedAccount {
  const item = base("fiscal", "tenant", plan, canManage, "/settings/fiscal");
  if (!plan.availableInPlan) return { ...item, status: "not_in_plan" };

  const settings = toPublicSettings(doc, now);
  if (!settings.configured || !doc) return item;

  const cnpj = formatCnpj(settings.cnpj);
  const environment =
    settings.environment === "homologacao" ? "homologação" : "produção";
  const connectedItem: LinkedAccount = {
    ...item,
    status: "connected",
    accountLabel: text(settings.razaoSocial) ?? cnpj,
    accountDetail: [cnpj ? `CNPJ ${cnpj}` : null, `Ambiente de ${environment}`]
      .filter(Boolean)
      .join(", "),
    connectedAt: toIso(doc.createdAt),
    lastActivityAt: toIso(settings.updatedAt),
  };

  const daysLeft = settings.certificadoDiasParaVencer;
  if (typeof daysLeft === "number" && daysLeft < 0) {
    return {
      ...connectedItem,
      status: "needs_reconnect",
      issue:
        "O certificado digital A1 venceu. Envie um certificado novo para voltar a emitir notas.",
    };
  }
  if (settings.status === "error") {
    return {
      ...connectedItem,
      status: "attention",
      issue: settings.lastError
        ? `A configuração fiscal está com erro: ${settings.lastError.slice(0, 200)}`
        : "A configuração fiscal está com erro. Revise os dados da empresa.",
    };
  }
  if (settings.status === "pending") {
    return {
      ...connectedItem,
      status: "attention",
      issue:
        "Falta enviar o certificado digital A1 para concluir a configuração fiscal.",
    };
  }
  if (
    settings.webhookStatus?.state === "failed" ||
    settings.webhookStatus?.state === "partial"
  ) {
    return {
      ...connectedItem,
      status: "attention",
      issue:
        "O emissor de notas não está conseguindo avisar a ProOps sobre o resultado das notas. Tente registrar o aviso de novo.",
    };
  }
  // `registered` e configuracao COMPLETA: o que falta e a primeira nota
  // autorizada (`markIssuerReady`), que depende do fisco e nao do usuario.
  // Trata-lo como problema mandava a pessoa "resolver" algo que nao tem conserto
  // na tela dela.
  const awaitingFirstInvoice: Partial<LinkedAccount> =
    settings.status === "registered"
      ? {
          notice:
            "Aguardando a primeira nota autorizada para liberar a emissão real.",
        }
      : {};
  if (typeof daysLeft === "number" && daysLeft <= CERTIFICATE_WARNING_DAYS) {
    return {
      ...connectedItem,
      status: "attention",
      issue:
        daysLeft === 0
          ? "O certificado digital A1 vence hoje."
          : `O certificado digital A1 vence em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}.`,
      ...awaitingFirstInvoice,
    };
  }
  return { ...connectedItem, ...awaitingFirstInvoice };
}

export function maskPhone(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `•••• ${digits.slice(-4)}`;
}

export function classifyWhatsApp(
  user: Record<string, unknown> | null,
  plan: LinkedAccountPlanInfo,
): LinkedAccount {
  // O telefone e do proprio usuario, entao quem ve sempre pode mexer.
  const item = base("whatsapp", "user", plan, true, "/profile");
  if (!plan.availableInPlan) return { ...item, status: "not_in_plan" };

  const phone = maskPhone(text(user?.phoneNumber));
  if (!phone) return item;

  return {
    ...item,
    status: "connected",
    accountLabel: phone,
    accountDetail:
      user?.whatsappMfaEnabled === true
        ? "Também usado na verificação em duas etapas"
        : null,
  };
}

/** Monta a lista a partir dos documentos ja lidos. Pura, para ser testada sem Firestore. */
export function buildLinkedAccounts(
  tenantId: string,
  sources: LinkedAccountsSources,
  viewer: LinkedAccountsViewer,
  now: Date = new Date(),
): LinkedAccount[] {
  // Conectar e desconectar e coisa de admin em todas as integracoes da empresa
  // (Agenda e Drive por `isTenantAdminRole`, Asaas e fiscal por
  // `resolveUserAndTenant().isMaster`, que aceita os mesmos papeis).
  const canManageTenant =
    viewer.isSuperAdmin || isTenantAdminRole(String(viewer.role || "").toUpperCase());
  const { capabilities, tier } = sources;

  return [
    classifyGoogleCalendar(
      sources.calendar,
      tenantId,
      planInfo(capabilities, tier, ["calendarSync"]),
      canManageTenant,
      sources.calendarPlatformEnabled,
    ),
    classifyGoogleDrive(
      sources.drive,
      planInfo(capabilities, tier, ["driveSync"]),
      canManageTenant,
    ),
    classifyAsaas(
      sources.asaas,
      planInfo(capabilities, tier, ["financial", "onlinePayments"]),
      canManageTenant,
      sources.asaasPlatformAvailable,
    ),
    classifyFiscal(
      sources.fiscal,
      planInfo(capabilities, tier, ["fiscal"]),
      canManageTenant,
      now,
    ),
    classifyWhatsApp(sources.user, planInfo(capabilities, tier, ["whatsapp"])),
  ];
}

export async function getLinkedAccounts(
  tenantId: string,
  uid: string,
  viewer: LinkedAccountsViewer,
): Promise<LinkedAccount[]> {
  const [calendarSnap, driveSnap, tenantSnap, fiscalSnap, userSnap, profile] =
    await Promise.all([
      db.collection("calendar_integrations").doc(tenantId).get(),
      db.collection("google_drive_integrations").doc(tenantId).get(),
      db.collection("tenants").doc(tenantId).get(),
      db.collection("fiscal_settings").doc(tenantId).get(),
      db.collection("users").doc(uid).get(),
      resolveTenantCapabilities(tenantId),
    ]);

  const tenantData = tenantSnap.exists ? tenantSnap.data() : undefined;

  return buildLinkedAccounts(
    tenantId,
    {
      calendar: calendarSnap.exists ? (calendarSnap.data() ?? null) : null,
      drive: driveSnap.exists
        ? (driveSnap.data() as Partial<DriveIntegrationDocument>)
        : null,
      asaas: (tenantData?.asaas as Partial<TenantAsaasData> | undefined) ?? null,
      fiscal: fiscalSnap.exists
        ? ({ ...(fiscalSnap.data() as FiscalSettingsDocument), tenantId })
        : null,
      user: userSnap.exists ? (userSnap.data() ?? null) : null,
      capabilities: profile.capabilities,
      tier: profile.tier,
      calendarPlatformEnabled: isGoogleCalendarSyncEnabled(),
      asaasPlatformAvailable: isPlatformConfigured(),
    },
    viewer,
  );
}
