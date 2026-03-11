import axios, { AxiosInstance } from "axios";
import { db } from "../init";

export const FISCAL_CONFIG_COLLECTION = "tenant_fiscal_configs";
export const FISCAL_DOCUMENT_COLLECTION = "fiscal_documents";

const FISCAL_DOCUMENT_VERSION = 1;
const PROCESSING_LEASE_MS = 2 * 60 * 1000;
const FOCUS_DEFAULT_TIMEOUT_MS = 20_000;
const FOCUS_POLL_DELAYS_MS = [2_000, 4_000, 6_000];

export type FiscalProvider = "focus_nfe";
export type FiscalEnvironment = "homologation" | "production";
export type FiscalOnboardingStatus = "incomplete" | "ready";
export type FiscalDocumentStatus =
  | "pending"
  | "processing"
  | "authorized"
  | "manual_review"
  | "blocked"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export type FiscalEligibilityStatus = "pending" | "manual_review" | "blocked";

export type FiscalAuditEntry = {
  at: string;
  code: string;
  message: string;
  actorId?: string | null;
};

export type TenantFiscalConfig = {
  id: string;
  tenantId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  onboardingStatus: FiscalOnboardingStatus;
  issuer: {
    legalName: string;
    cnpj: string;
    municipalRegistration: string;
    municipalCode: string;
    email?: string | null;
    phone?: string | null;
  };
  nfse: {
    serviceItemCode: string;
    municipalTaxCode?: string | null;
    taxRate: number;
    natureOperation?: string | null;
    simpleNational?: boolean;
    culturalIncentive?: boolean;
    specialTaxRegime?: string | null;
    withheldIss?: boolean;
  };
  focus: {
    companyReference?: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type FiscalServiceItemSnapshot = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type FiscalProposalSnapshot = {
  proposalId: string;
  tenantId: string;
  title: string;
  status: string;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  serviceItems: FiscalServiceItemSnapshot[];
  serviceTotal: number;
  hasProductItems: boolean;
  generatedAt: string;
};

export type FiscalDocument = {
  id: string;
  version: number;
  tenantId: string;
  proposalId: string;
  documentType: "nfse";
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  status: FiscalDocumentStatus;
  proposalTitle: string;
  serviceTotal: number;
  serviceItemsCount: number;
  hasProductItems: boolean;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  providerReference: string;
  providerStatus?: string | null;
  providerMessage?: string | null;
  providerNumber?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  cancellationXmlUrl?: string | null;
  attempts: number;
  lastError?: string | null;
  lastRequestedAt?: string | null;
  lastProcessedAt?: string | null;
  lockedUntil?: string | null;
  lockedBy?: string | null;
  payload?: Record<string, unknown> | null;
  providerResponse?: Record<string, unknown> | null;
  snapshot: FiscalProposalSnapshot;
  auditTrail: FiscalAuditEntry[];
  createdAt: string;
  updatedAt: string;
};

type ProposalLike = {
  id?: string;
  tenantId?: string;
  title?: string;
  status?: string;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  products?: Array<{
    productId?: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
    itemType?: "product" | "service";
    status?: "active" | "inactive";
  }>;
};

type FocusIssueResult = {
  status: FiscalDocumentStatus;
  providerStatus?: string | null;
  providerMessage?: string | null;
  providerNumber?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  cancellationXmlUrl?: string | null;
  raw: Record<string, unknown>;
};

type FiscalEligibilityResult = {
  status: FiscalEligibilityStatus;
  reasonCode?: string;
  reasonMessage?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendAuditTrail(
  currentTrail: FiscalAuditEntry[] | undefined,
  entry: FiscalAuditEntry,
): FiscalAuditEntry[] {
  const nextTrail = [...(Array.isArray(currentTrail) ? currentTrail : []), entry];
  return nextTrail.slice(-20);
}

function toFirestoreTimestampString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function buildAbsoluteFocusFileUrl(
  environment: FiscalEnvironment,
  path: unknown,
): string | null {
  const normalizedPath = normalizeString(path);
  if (!normalizedPath) return null;
  const baseUrl =
    environment === "production"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return `${baseUrl}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
}

function buildProposalSummaryPatch(document: FiscalDocument) {
  return {
    fiscalStatus: document.status,
    fiscalDocumentId: document.id,
    fiscalLastError: document.lastError || document.reasonMessage || null,
    fiscalUpdatedAt: document.updatedAt,
  };
}

async function syncProposalFiscalSummary(document: FiscalDocument): Promise<void> {
  await db
    .collection("proposals")
    .doc(document.proposalId)
    .set(buildProposalSummaryPatch(document), { merge: true });
}

export function buildFiscalDocumentId(proposalId: string): string {
  return `${proposalId}_nfse`;
}

export function sanitizeTenantFiscalConfigInput(
  tenantId: string,
  input: Record<string, unknown>,
  existing?: Partial<TenantFiscalConfig> | null,
): Omit<TenantFiscalConfig, "id"> {
  const now = nowIso();

  return {
    tenantId,
    provider: "focus_nfe",
    environment:
      normalizeString(input.environment) === "production"
        ? "production"
        : "homologation",
    onboardingStatus:
      normalizeString(input.onboardingStatus) === "ready"
        ? "ready"
        : "incomplete",
    issuer: {
      legalName: normalizeString(
        input.issuer && typeof input.issuer === "object"
          ? (input.issuer as Record<string, unknown>).legalName
          : existing?.issuer?.legalName,
      ),
      cnpj: sanitizeDigits(
        input.issuer && typeof input.issuer === "object"
          ? (input.issuer as Record<string, unknown>).cnpj
          : existing?.issuer?.cnpj,
      ),
      municipalRegistration: sanitizeDigits(
        input.issuer && typeof input.issuer === "object"
          ? (input.issuer as Record<string, unknown>).municipalRegistration
          : existing?.issuer?.municipalRegistration,
      ),
      municipalCode: sanitizeDigits(
        input.issuer && typeof input.issuer === "object"
          ? (input.issuer as Record<string, unknown>).municipalCode
          : existing?.issuer?.municipalCode,
      ),
      email: normalizeOptionalString(
        input.issuer && typeof input.issuer === "object"
          ? (input.issuer as Record<string, unknown>).email
          : existing?.issuer?.email,
      ),
      phone: normalizeOptionalString(
        input.issuer && typeof input.issuer === "object"
          ? (input.issuer as Record<string, unknown>).phone
          : existing?.issuer?.phone,
      ),
    },
    nfse: {
      serviceItemCode: normalizeString(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).serviceItemCode
          : existing?.nfse?.serviceItemCode,
      ),
      municipalTaxCode: normalizeOptionalString(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).municipalTaxCode
          : existing?.nfse?.municipalTaxCode,
      ),
      taxRate: roundCurrency(
        toFiniteNumber(
          input.nfse && typeof input.nfse === "object"
            ? (input.nfse as Record<string, unknown>).taxRate
            : existing?.nfse?.taxRate,
          0,
        ),
      ),
      natureOperation: normalizeOptionalString(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).natureOperation
          : existing?.nfse?.natureOperation,
      ),
      simpleNational: normalizeBoolean(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).simpleNational
          : existing?.nfse?.simpleNational,
        true,
      ),
      culturalIncentive: normalizeBoolean(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).culturalIncentive
          : existing?.nfse?.culturalIncentive,
        false,
      ),
      specialTaxRegime: normalizeOptionalString(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).specialTaxRegime
          : existing?.nfse?.specialTaxRegime,
      ),
      withheldIss: normalizeBoolean(
        input.nfse && typeof input.nfse === "object"
          ? (input.nfse as Record<string, unknown>).withheldIss
          : existing?.nfse?.withheldIss,
        false,
      ),
    },
    focus: {
      companyReference: normalizeOptionalString(
        input.focus && typeof input.focus === "object"
          ? (input.focus as Record<string, unknown>).companyReference
          : existing?.focus?.companyReference,
      ),
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export async function getTenantFiscalConfig(
  tenantId: string,
): Promise<TenantFiscalConfig | null> {
  const docRef = db.collection(FISCAL_CONFIG_COLLECTION).doc(tenantId);
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    tenantId,
    provider: "focus_nfe",
    environment:
      normalizeString(data.environment) === "production"
        ? "production"
        : "homologation",
    onboardingStatus:
      normalizeString(data.onboardingStatus) === "ready"
        ? "ready"
        : "incomplete",
    issuer: {
      legalName: normalizeString(
        data.issuer && typeof data.issuer === "object"
          ? (data.issuer as Record<string, unknown>).legalName
          : "",
      ),
      cnpj: sanitizeDigits(
        data.issuer && typeof data.issuer === "object"
          ? (data.issuer as Record<string, unknown>).cnpj
          : "",
      ),
      municipalRegistration: sanitizeDigits(
        data.issuer && typeof data.issuer === "object"
          ? (data.issuer as Record<string, unknown>).municipalRegistration
          : "",
      ),
      municipalCode: sanitizeDigits(
        data.issuer && typeof data.issuer === "object"
          ? (data.issuer as Record<string, unknown>).municipalCode
          : "",
      ),
      email: normalizeOptionalString(
        data.issuer && typeof data.issuer === "object"
          ? (data.issuer as Record<string, unknown>).email
          : "",
      ),
      phone: normalizeOptionalString(
        data.issuer && typeof data.issuer === "object"
          ? (data.issuer as Record<string, unknown>).phone
          : "",
      ),
    },
    nfse: {
      serviceItemCode: normalizeString(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).serviceItemCode
          : "",
      ),
      municipalTaxCode: normalizeOptionalString(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).municipalTaxCode
          : "",
      ),
      taxRate: roundCurrency(
        toFiniteNumber(
          data.nfse && typeof data.nfse === "object"
            ? (data.nfse as Record<string, unknown>).taxRate
            : 0,
          0,
        ),
      ),
      natureOperation: normalizeOptionalString(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).natureOperation
          : "",
      ),
      simpleNational: normalizeBoolean(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).simpleNational
          : true,
        true,
      ),
      culturalIncentive: normalizeBoolean(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).culturalIncentive
          : false,
        false,
      ),
      specialTaxRegime: normalizeOptionalString(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).specialTaxRegime
          : "",
      ),
      withheldIss: normalizeBoolean(
        data.nfse && typeof data.nfse === "object"
          ? (data.nfse as Record<string, unknown>).withheldIss
          : false,
        false,
      ),
    },
    focus: {
      companyReference: normalizeOptionalString(
        data.focus && typeof data.focus === "object"
          ? (data.focus as Record<string, unknown>).companyReference
          : "",
      ),
    },
    createdAt: toFirestoreTimestampString(data.createdAt) || nowIso(),
    updatedAt: toFirestoreTimestampString(data.updatedAt) || nowIso(),
  };
}

export function validateTenantFiscalConfig(
  config: TenantFiscalConfig | null | undefined,
): { ready: boolean; reasonCode?: string; reasonMessage?: string } {
  if (!config) {
    return {
      ready: false,
      reasonCode: "MISSING_CONFIG",
      reasonMessage: "Configuracao fiscal do tenant nao encontrada.",
    };
  }

  if (config.onboardingStatus !== "ready") {
    return {
      ready: false,
      reasonCode: "ONBOARDING_INCOMPLETE",
      reasonMessage: "Onboarding fiscal ainda nao esta marcado como pronto.",
    };
  }

  if (
    !config.issuer.legalName ||
    !config.issuer.cnpj ||
    !config.issuer.municipalRegistration ||
    !config.issuer.municipalCode ||
    !config.nfse.serviceItemCode ||
    !Number.isFinite(config.nfse.taxRate) ||
    config.nfse.taxRate <= 0
  ) {
    return {
      ready: false,
      reasonCode: "CONFIG_INCOMPLETE",
      reasonMessage:
        "Configuracao fiscal incompleta. Revise emitente, codigo de servico e aliquota.",
    };
  }

  return { ready: true };
}

export function buildFiscalProposalSnapshot(
  proposal: ProposalLike,
): FiscalProposalSnapshot {
  const products = Array.isArray(proposal.products) ? proposal.products : [];
  const activeProducts = products.filter((product) => product.status !== "inactive");
  const serviceItems = activeProducts
    .filter((product) => (product.itemType || "product") === "service")
    .map((product) => ({
      productId: normalizeString(product.productId),
      productName: normalizeString(product.productName) || "Servico",
      quantity: toFiniteNumber(product.quantity, 0),
      unitPrice: roundCurrency(toFiniteNumber(product.unitPrice, 0)),
      total: roundCurrency(
        toFiniteNumber(
          product.total,
          toFiniteNumber(product.unitPrice, 0) * toFiniteNumber(product.quantity, 0),
        ),
      ),
    }))
    .filter((item) => item.total > 0 || item.quantity > 0);
  const hasProductItems = activeProducts.some(
    (product) => (product.itemType || "product") !== "service",
  );
  const serviceTotal = roundCurrency(
    serviceItems.reduce((sum, item) => sum + item.total, 0),
  );

  return {
    proposalId: normalizeString(proposal.id),
    tenantId: normalizeString(proposal.tenantId),
    title: normalizeString(proposal.title),
    status: normalizeString(proposal.status),
    clientId: normalizeOptionalString(proposal.clientId),
    clientName: normalizeOptionalString(proposal.clientName),
    clientEmail: normalizeOptionalString(proposal.clientEmail),
    clientPhone: normalizeOptionalString(proposal.clientPhone),
    clientAddress: normalizeOptionalString(proposal.clientAddress),
    serviceItems,
    serviceTotal,
    hasProductItems,
    generatedAt: nowIso(),
  };
}

export function analyzeProposalFiscalEligibility(
  snapshot: FiscalProposalSnapshot,
): FiscalEligibilityResult {
  if (snapshot.serviceItems.length === 0) {
    return {
      status: "blocked",
      reasonCode: "NO_SERVICE_ITEMS",
      reasonMessage:
        "A proposta nao possui itens de servico ativos elegiveis para NFS-e.",
    };
  }

  if (snapshot.hasProductItems) {
    return {
      status: "manual_review",
      reasonCode: "MIXED_ITEMS",
      reasonMessage:
        "A proposta contem itens de produto e servico; a emissao deve passar por revisao manual.",
    };
  }

  return { status: "pending" };
}

function buildServiceDiscrimination(snapshot: FiscalProposalSnapshot): string {
  const lines = snapshot.serviceItems.map((item) => {
    const qty = item.quantity > 0 ? `${item.quantity}x` : "1x";
    return `${qty} ${item.productName} - R$ ${item.total.toFixed(2)}`;
  });
  return lines.join(" | ").slice(0, 1900);
}

export function mapProposalToFocusNfsePayload(
  config: TenantFiscalConfig,
  document: FiscalDocument,
): Record<string, unknown> {
  const snapshot = document.snapshot;

  return {
    data_emissao: new Date().toISOString(),
    natureza_operacao: config.nfse.natureOperation || "1",
    prestador: {
      cnpj: config.issuer.cnpj,
      inscricao_municipal: config.issuer.municipalRegistration,
      codigo_municipio: config.issuer.municipalCode,
    },
    tomador: {
      razao_social: snapshot.clientName || "Cliente",
      email: snapshot.clientEmail || undefined,
      telefone: sanitizeDigits(snapshot.clientPhone || ""),
      endereco: snapshot.clientAddress
        ? {
            logradouro: snapshot.clientAddress,
          }
        : undefined,
    },
    servico: {
      aliquota: config.nfse.taxRate,
      discriminacao: buildServiceDiscrimination(snapshot),
      iss_retido: String(Boolean(config.nfse.withheldIss)),
      item_lista_servico: config.nfse.serviceItemCode,
      codigo_tributario_municipio: config.nfse.municipalTaxCode || undefined,
      valor_servicos: snapshot.serviceTotal,
      base_calculo: snapshot.serviceTotal,
    },
    optante_simples_nacional: String(Boolean(config.nfse.simpleNational)),
    incentivador_cultural: String(Boolean(config.nfse.culturalIncentive)),
    regime_especial_tributacao: config.nfse.specialTaxRegime || undefined,
  };
}

function mapFocusStatusToFiscalStatus(status: string): FiscalDocumentStatus {
  const normalized = normalizeString(status).toLowerCase();
  if (normalized === "autorizado") return "authorized";
  if (normalized === "cancelado") return "cancelled";
  if (normalized === "processando_autorizacao") return "processing";
  if (normalized === "processando_cancelamento") return "processing";
  return "failed";
}

function normalizeFocusResponse(
  environment: FiscalEnvironment,
  payload: Record<string, unknown>,
): FocusIssueResult {
  const providerStatus = normalizeOptionalString(payload.status) || "unknown";
  const providerMessage =
    normalizeOptionalString(payload.mensagem_sefaz) ||
    normalizeOptionalString(payload.mensagem) ||
    normalizeOptionalString(payload.status_sefaz);

  return {
    status: mapFocusStatusToFiscalStatus(providerStatus),
    providerStatus,
    providerMessage,
    providerNumber:
      normalizeOptionalString(payload.numero) ||
      normalizeOptionalString(payload.numero_rps) ||
      normalizeOptionalString(payload.numero_protocolo),
    pdfUrl:
      buildAbsoluteFocusFileUrl(environment, payload.caminho_danfse) ||
      buildAbsoluteFocusFileUrl(environment, payload.caminho_danfe),
    xmlUrl:
      buildAbsoluteFocusFileUrl(environment, payload.caminho_xml_nota_fiscal) ||
      buildAbsoluteFocusFileUrl(environment, payload.caminho_xml),
    cancellationXmlUrl: buildAbsoluteFocusFileUrl(
      environment,
      payload.caminho_xml_cancelamento,
    ),
    raw: payload,
  };
}

export function isFiscalMockMode(): boolean {
  const val = normalizeString(process.env.FOCUS_NFE_MOCK_MODE).toLowerCase();
  return val === "true" || val === "1" || val === "yes";
}

interface FocusGateway {
  issueNfse(
    providerReference: string,
    payload: Record<string, unknown>,
  ): Promise<FocusIssueResult>;
  consultNfse(providerReference: string): Promise<FocusIssueResult>;
  cancelNfse(providerReference: string): Promise<FocusIssueResult>;
}

class FocusMockGateway implements FocusGateway {
  private readonly environment: FiscalEnvironment;

  constructor(environment: FiscalEnvironment) {
    this.environment = environment;
  }

  async issueNfse(
    _providerReference: string,
    _payload: Record<string, unknown>,
  ): Promise<FocusIssueResult> {
    // Simulate a small processing delay
    await sleep(400);
    return {
      status: "authorized",
      providerStatus: "autorizado",
      providerMessage: "[MOCK] NFS-e autorizada com sucesso em ambiente simulado.",
      providerNumber: `MOCK-${Date.now()}`,
      pdfUrl: null,
      xmlUrl: null,
      cancellationXmlUrl: null,
      raw: { mock: true, environment: this.environment },
    };
  }

  async consultNfse(_providerReference: string): Promise<FocusIssueResult> {
    await sleep(200);
    return {
      status: "authorized",
      providerStatus: "autorizado",
      providerMessage: "[MOCK] Consulta simulada — nota autorizada.",
      providerNumber: `MOCK-${Date.now()}`,
      pdfUrl: null,
      xmlUrl: null,
      cancellationXmlUrl: null,
      raw: { mock: true },
    };
  }

  async cancelNfse(_providerReference: string): Promise<FocusIssueResult> {
    await sleep(300);
    return {
      status: "cancelled",
      providerStatus: "cancelado",
      providerMessage: "[MOCK] NFS-e cancelada com sucesso em ambiente simulado.",
      providerNumber: null,
      pdfUrl: null,
      xmlUrl: null,
      cancellationXmlUrl: null,
      raw: { mock: true },
    };
  }
}

function createFocusGateway(environment: FiscalEnvironment): FocusGateway {
  if (isFiscalMockMode()) {
    return new FocusMockGateway(environment);
  }
  return new FocusNfeGateway(environment);
}

class FocusNfeGateway implements FocusGateway {
  private readonly client: AxiosInstance;
  private readonly environment: FiscalEnvironment;

  constructor(environment: FiscalEnvironment) {
    this.environment = environment;
    const token = normalizeString(process.env.FOCUS_NFE_API_TOKEN);
    if (!token) {
      throw new Error("FOCUS_NFE_API_TOKEN is not configured.");
    }

    const baseURL =
      environment === "production"
        ? "https://api.focusnfe.com.br"
        : "https://homologacao.focusnfe.com.br";

    this.client = axios.create({
      baseURL,
      timeout: FOCUS_DEFAULT_TIMEOUT_MS,
      auth: {
        username: token,
        password: "",
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async issueNfse(
    providerReference: string,
    payload: Record<string, unknown>,
  ): Promise<FocusIssueResult> {
    const response = await this.client.post("/v2/nfse", payload, {
      params: {
        ref: providerReference,
      },
    });
    return normalizeFocusResponse(
      this.environment,
      response.data as Record<string, unknown>,
    );
  }

  async consultNfse(providerReference: string): Promise<FocusIssueResult> {
    const response = await this.client.get(`/v2/nfse/${providerReference}`);
    return normalizeFocusResponse(
      this.environment,
      response.data as Record<string, unknown>,
    );
  }

  async cancelNfse(providerReference: string): Promise<FocusIssueResult> {
    const response = await this.client.delete(`/v2/nfse/${providerReference}`);
    return normalizeFocusResponse(
      this.environment,
      response.data as Record<string, unknown>,
    );
  }
}

async function getFiscalDocumentById(
  documentId: string,
): Promise<FiscalDocument | null> {
  const snap = await db.collection(FISCAL_DOCUMENT_COLLECTION).doc(documentId).get();
  if (!snap.exists) return null;
  const data = snap.data() as FiscalDocument;
  return {
    ...data,
    id: snap.id,
  };
}

async function saveFiscalDocument(document: FiscalDocument): Promise<void> {
  await db
    .collection(FISCAL_DOCUMENT_COLLECTION)
    .doc(document.id)
    .set(document, { merge: true });
  await syncProposalFiscalSummary(document);
}

function isFrozenFiscalStatus(status: FiscalDocumentStatus): boolean {
  return (
    status === "authorized" ||
    status === "processing" ||
    status === "cancel_requested" ||
    status === "cancelled"
  );
}

export async function syncProposalFiscalDocument(params: {
  proposalId: string;
  proposalData: ProposalLike;
  actorId: string;
  isApproved: boolean;
}): Promise<FiscalDocument | null> {
  const { proposalId, proposalData, actorId, isApproved } = params;
  const tenantId = normalizeString(proposalData.tenantId);
  if (!proposalId || !tenantId) return null;

  const documentId = buildFiscalDocumentId(proposalId);
  const existing = await getFiscalDocumentById(documentId);

  if (!isApproved) {
    if (
      existing &&
      ["pending", "manual_review", "blocked", "failed"].includes(existing.status)
    ) {
      const cancelledDocument: FiscalDocument = {
        ...existing,
        status: "cancelled",
        reasonCode: "PROPOSAL_NOT_APPROVED",
        reasonMessage:
          "A proposta deixou de estar aprovada antes da emissao fiscal.",
        updatedAt: nowIso(),
        lastProcessedAt: nowIso(),
        lockedBy: null,
        lockedUntil: null,
        auditTrail: appendAuditTrail(existing.auditTrail, {
          at: nowIso(),
          code: "proposal_reverted",
          message: "Documento fiscal local cancelado por reversao da proposta.",
          actorId,
        }),
      };
      await saveFiscalDocument(cancelledDocument);
      return cancelledDocument;
    }
    return existing;
  }

  if (existing && isFrozenFiscalStatus(existing.status)) {
    return existing;
  }

  const config = await getTenantFiscalConfig(tenantId);
  const configReadiness = validateTenantFiscalConfig(config);
  const snapshot = buildFiscalProposalSnapshot({
    ...proposalData,
    id: proposalId,
  });
  const eligibility = analyzeProposalFiscalEligibility(snapshot);

  let status: FiscalDocumentStatus = eligibility.status;
  let reasonCode = eligibility.reasonCode || null;
  let reasonMessage = eligibility.reasonMessage || null;

  if (eligibility.status === "pending" && !configReadiness.ready) {
    status = "blocked";
    reasonCode = configReadiness.reasonCode || "CONFIG_INCOMPLETE";
    reasonMessage =
      configReadiness.reasonMessage ||
      "Configuracao fiscal indisponivel para emissao.";
  }

  const baseDocument: FiscalDocument = {
    id: documentId,
    version: FISCAL_DOCUMENT_VERSION,
    tenantId,
    proposalId,
    documentType: "nfse",
    provider: "focus_nfe",
    environment: config?.environment || "homologation",
    status,
    proposalTitle: snapshot.title,
    serviceTotal: snapshot.serviceTotal,
    serviceItemsCount: snapshot.serviceItems.length,
    hasProductItems: snapshot.hasProductItems,
    reasonCode,
    reasonMessage,
    providerReference: documentId,
    providerStatus: existing?.providerStatus || null,
    providerMessage: existing?.providerMessage || null,
    providerNumber: existing?.providerNumber || null,
    pdfUrl: existing?.pdfUrl || null,
    xmlUrl: existing?.xmlUrl || null,
    cancellationXmlUrl: existing?.cancellationXmlUrl || null,
    attempts: existing?.attempts || 0,
    lastError: null,
    lastRequestedAt: existing?.lastRequestedAt || null,
    lastProcessedAt: existing?.lastProcessedAt || null,
    lockedBy: null,
    lockedUntil: null,
    payload:
      status === "pending" && config
        ? mapProposalToFocusNfsePayload(
            config,
            {
              ...(existing || ({} as FiscalDocument)),
              id: documentId,
              snapshot,
              proposalId,
              tenantId,
            } as FiscalDocument,
          )
        : null,
    providerResponse: existing?.providerResponse || null,
    snapshot,
    auditTrail: appendAuditTrail(existing?.auditTrail, {
      at: nowIso(),
      code: existing ? "proposal_synced" : "proposal_registered",
      message:
        status === "pending"
          ? "Documento fiscal preparado para emissao."
          : reasonMessage || "Documento fiscal atualizado.",
      actorId,
    }),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await saveFiscalDocument(baseDocument);
  return baseDocument;
}

export async function getProposalFiscalDocument(params: {
  tenantId: string;
  proposalId: string;
}): Promise<FiscalDocument | null> {
  const { tenantId, proposalId } = params;
  const doc = await getFiscalDocumentById(buildFiscalDocumentId(proposalId));
  if (!doc || doc.tenantId !== tenantId) return null;
  return doc;
}

export async function requestFiscalRetry(params: {
  tenantId: string;
  proposalId: string;
  actorId: string;
}): Promise<FiscalDocument> {
  const { tenantId, proposalId, actorId } = params;
  const proposalSnap = await db.collection("proposals").doc(proposalId).get();
  if (!proposalSnap.exists) {
    throw new Error("Proposta nao encontrada.");
  }

  const proposalData = proposalSnap.data() as ProposalLike;
  if (normalizeString(proposalData.tenantId) !== tenantId) {
    throw new Error("Acesso negado.");
  }

  const document = await syncProposalFiscalDocument({
    proposalId,
    proposalData: {
      ...proposalData,
      id: proposalId,
    },
    actorId,
    isApproved: true,
  });

  if (!document) {
    throw new Error("Documento fiscal nao encontrado.");
  }

  if (document.status === "manual_review") {
    throw new Error(
      "Documento em revisao manual. Ajuste a proposta antes de reenviar.",
    );
  }

  if (document.status === "blocked") {
    throw new Error(
      document.reasonMessage || "Configuracao fiscal bloqueou a emissao.",
    );
  }

  return document;
}

export async function requestFiscalCancellation(params: {
  tenantId: string;
  proposalId: string;
  actorId: string;
}): Promise<FiscalDocument> {
  const document = await getProposalFiscalDocument(params);
  if (!document) {
    throw new Error("Documento fiscal nao encontrado.");
  }

  if (document.status !== "authorized") {
    throw new Error("Somente documentos autorizados podem ser cancelados.");
  }

  const updatedDocument: FiscalDocument = {
    ...document,
    status: "cancel_requested",
    updatedAt: nowIso(),
    auditTrail: appendAuditTrail(document.auditTrail, {
      at: nowIso(),
      code: "cancel_requested",
      message: "Cancelamento fiscal solicitado manualmente.",
      actorId: params.actorId,
    }),
  };

  await saveFiscalDocument(updatedDocument);
  return updatedDocument;
}

async function acquireFiscalLease(
  documentId: string,
  acceptedStatuses: FiscalDocumentStatus[],
): Promise<FiscalDocument | null> {
  const docRef = db.collection(FISCAL_DOCUMENT_COLLECTION).doc(documentId);
  const leaseToken = `${documentId}:${Date.now()}`;
  let leasedDocument: FiscalDocument | null = null;

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) return;

    const current = snap.data() as FiscalDocument;
    if (!acceptedStatuses.includes(current.status)) return;

    const lockedUntilMs = Date.parse(String(current.lockedUntil || ""));
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
      return;
    }

    leasedDocument = {
      ...current,
      id: snap.id,
      lockedBy: leaseToken,
      lockedUntil: new Date(Date.now() + PROCESSING_LEASE_MS).toISOString(),
      updatedAt: nowIso(),
      status: current.status === "pending" ? "processing" : current.status,
      auditTrail: appendAuditTrail(current.auditTrail, {
        at: nowIso(),
        code: "lease_acquired",
        message: "Processamento fiscal iniciado.",
      }),
    };

    transaction.set(docRef, leasedDocument!, { merge: true });
  });

  if (leasedDocument) {
    await syncProposalFiscalSummary(leasedDocument);
  }

  return leasedDocument;
}

function buildFailureDocument(
  document: FiscalDocument,
  message: string,
  raw?: Record<string, unknown> | null,
): FiscalDocument {
  return {
    ...document,
    status: "failed",
    lastError: message,
    providerMessage: message,
    lockedBy: null,
    lockedUntil: null,
    lastProcessedAt: nowIso(),
    updatedAt: nowIso(),
    providerResponse: raw || document.providerResponse || null,
    auditTrail: appendAuditTrail(document.auditTrail, {
      at: nowIso(),
      code: "provider_failure",
      message,
    }),
  };
}

async function pollFocusUntilSettled(
  gateway: FocusGateway,
  providerReference: string,
): Promise<FocusIssueResult> {
  let lastResult = await gateway.consultNfse(providerReference);
  if (lastResult.status !== "processing") {
    return lastResult;
  }

  for (const delayMs of FOCUS_POLL_DELAYS_MS) {
    await sleep(delayMs);
    lastResult = await gateway.consultNfse(providerReference);
    if (lastResult.status !== "processing") {
      return lastResult;
    }
  }

  return lastResult;
}

export async function processFiscalDocumentById(
  documentId: string,
): Promise<FiscalDocument | null> {
  const initial = await getFiscalDocumentById(documentId);
  if (!initial) return null;

  if (initial.status === "pending") {
    const leased = await acquireFiscalLease(documentId, ["pending"]);
    if (!leased) {
      return initial;
    }

    try {
      const config = await getTenantFiscalConfig(leased.tenantId);
      const configReadiness = validateTenantFiscalConfig(config);
      if (!config || !configReadiness.ready) {
        const blockedDocument: FiscalDocument = {
          ...leased,
          status: "blocked",
          reasonCode: configReadiness.reasonCode || "CONFIG_INCOMPLETE",
          reasonMessage:
            configReadiness.reasonMessage ||
            "Configuracao fiscal indisponivel.",
          lastError: null,
          lockedBy: null,
          lockedUntil: null,
          lastProcessedAt: nowIso(),
          updatedAt: nowIso(),
          auditTrail: appendAuditTrail(leased.auditTrail, {
            at: nowIso(),
            code: "processing_blocked",
            message:
              configReadiness.reasonMessage ||
              "Processamento fiscal bloqueado pela configuracao.",
          }),
        };
        await saveFiscalDocument(blockedDocument);
        return blockedDocument;
      }

      const payload = mapProposalToFocusNfsePayload(config, leased);
      const gateway = createFocusGateway(config.environment);
      const issueResult = await gateway.issueNfse(leased.providerReference, payload);
      const settledResult =
        issueResult.status === "processing"
          ? await pollFocusUntilSettled(gateway, leased.providerReference)
          : issueResult;

      const nextDocument: FiscalDocument = {
        ...leased,
        environment: config.environment,
        status: settledResult.status,
        providerStatus: settledResult.providerStatus || null,
        providerMessage: settledResult.providerMessage || null,
        providerNumber: settledResult.providerNumber || null,
        pdfUrl: settledResult.pdfUrl || null,
        xmlUrl: settledResult.xmlUrl || null,
        cancellationXmlUrl: settledResult.cancellationXmlUrl || null,
        attempts: leased.attempts + 1,
        lastError:
          settledResult.status === "failed"
            ? settledResult.providerMessage || "Falha de autorizacao."
            : null,
        lastRequestedAt: nowIso(),
        lastProcessedAt: nowIso(),
        lockedBy: null,
        lockedUntil: null,
        payload,
        providerResponse: settledResult.raw,
        updatedAt: nowIso(),
        auditTrail: appendAuditTrail(leased.auditTrail, {
          at: nowIso(),
          code:
            settledResult.status === "authorized"
              ? "authorized"
              : settledResult.status === "processing"
                ? "processing"
                : "failed",
          message:
            settledResult.providerMessage ||
            (settledResult.status === "authorized"
              ? "Documento fiscal autorizado."
              : settledResult.status === "processing"
                ? "Documento fiscal segue em processamento no provedor."
                : "Falha na autorizacao fiscal."),
        }),
      };

      await saveFiscalDocument(nextDocument);
      return nextDocument;
    } catch (error) {
      const failureDocument = buildFailureDocument(
        leased,
        error instanceof Error ? error.message : "Erro ao emitir NFS-e.",
      );
      await saveFiscalDocument(failureDocument);
      return failureDocument;
    }
  }

  if (initial.status === "cancel_requested") {
    const leased = await acquireFiscalLease(documentId, ["cancel_requested"]);
    if (!leased) {
      return initial;
    }

    try {
      const config = await getTenantFiscalConfig(leased.tenantId);
      if (!config) {
        const failureDocument = buildFailureDocument(
          leased,
          "Configuracao fiscal nao encontrada para cancelamento.",
        );
        await saveFiscalDocument(failureDocument);
        return failureDocument;
      }

      const gateway = createFocusGateway(config.environment);
      const cancelResult = await gateway.cancelNfse(leased.providerReference);
      const settledResult =
        cancelResult.status === "processing"
          ? await pollFocusUntilSettled(gateway, leased.providerReference)
          : cancelResult;

      const nextStatus =
        settledResult.status === "cancelled"
          ? "cancelled"
          : settledResult.status === "processing"
            ? "cancel_requested"
            : "failed";
      const nextDocument: FiscalDocument = {
        ...leased,
        status: nextStatus,
        providerStatus: settledResult.providerStatus || null,
        providerMessage: settledResult.providerMessage || null,
        providerNumber: settledResult.providerNumber || leased.providerNumber || null,
        pdfUrl: settledResult.pdfUrl || leased.pdfUrl || null,
        xmlUrl: settledResult.xmlUrl || leased.xmlUrl || null,
        cancellationXmlUrl:
          settledResult.cancellationXmlUrl || leased.cancellationXmlUrl || null,
        lastError:
          nextStatus === "failed"
            ? settledResult.providerMessage || "Falha no cancelamento."
            : null,
        providerResponse: settledResult.raw,
        lockedBy: null,
        lockedUntil: null,
        lastProcessedAt: nowIso(),
        updatedAt: nowIso(),
        auditTrail: appendAuditTrail(leased.auditTrail, {
          at: nowIso(),
          code:
            nextStatus === "cancelled"
              ? "cancelled"
              : nextStatus === "cancel_requested"
                ? "cancel_processing"
                : "cancel_failed",
          message:
            settledResult.providerMessage ||
            (nextStatus === "cancelled"
              ? "Documento fiscal cancelado."
              : nextStatus === "cancel_requested"
                ? "Cancelamento segue em processamento no provedor."
                : "Falha no cancelamento fiscal."),
        }),
      };
      await saveFiscalDocument(nextDocument);
      return nextDocument;
    } catch (error) {
      const failureDocument = buildFailureDocument(
        leased,
        error instanceof Error ? error.message : "Erro ao cancelar NFS-e.",
      );
      await saveFiscalDocument(failureDocument);
      return failureDocument;
    }
  }

  return initial;
}

export async function syncFiscalDocumentFromWebhook(params: {
  provider: FiscalProvider;
  payload: Record<string, unknown>;
}): Promise<FiscalDocument | null> {
  if (params.provider !== "focus_nfe") {
    throw new Error("Unsupported fiscal provider.");
  }

  const providerReference =
    normalizeOptionalString(params.payload.ref) ||
    normalizeOptionalString(params.payload.referencia);
  if (!providerReference) {
    throw new Error("Webhook sem referencia da nota.");
  }

  const current = await getFiscalDocumentById(providerReference);
  if (!current) {
    return null;
  }

  const normalized = normalizeFocusResponse(current.environment, params.payload);
  const nextStatus =
    current.status === "cancel_requested" && normalized.status === "processing"
      ? "cancel_requested"
      : normalized.status;

  const nextDocument: FiscalDocument = {
    ...current,
    status: nextStatus,
    providerStatus: normalized.providerStatus || null,
    providerMessage: normalized.providerMessage || null,
    providerNumber: normalized.providerNumber || current.providerNumber || null,
    pdfUrl: normalized.pdfUrl || current.pdfUrl || null,
    xmlUrl: normalized.xmlUrl || current.xmlUrl || null,
    cancellationXmlUrl:
      normalized.cancellationXmlUrl || current.cancellationXmlUrl || null,
    lastError:
      nextStatus === "failed"
        ? normalized.providerMessage || current.lastError || "Falha fiscal."
        : null,
    providerResponse: normalized.raw,
    lockedBy: null,
    lockedUntil: null,
    lastProcessedAt: nowIso(),
    updatedAt: nowIso(),
    auditTrail: appendAuditTrail(current.auditTrail, {
      at: nowIso(),
      code: "provider_webhook",
      message:
        normalized.providerMessage ||
        `Webhook do provedor recebido com status ${normalized.providerStatus || "desconhecido"}.`,
    }),
  };

  await saveFiscalDocument(nextDocument);
  return nextDocument;
}

export async function deleteFiscalDocumentForProposal(
  proposalId: string,
): Promise<void> {
  const documentId = buildFiscalDocumentId(proposalId);
  await db.collection(FISCAL_DOCUMENT_COLLECTION).doc(documentId).delete().catch(() => {
    return;
  });
}
