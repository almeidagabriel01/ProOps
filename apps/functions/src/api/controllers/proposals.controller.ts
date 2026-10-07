import { PROPOSAL_INCOME_CATEGORY } from "../services/finance-reports/dre-model";
import { syncedTransactionCategory } from "./proposals.helpers";
import { Request, Response } from "express";
import { db } from "../../init";
import { tryAutoIssue } from "../services/fiscal/invoice-issue.service";
import {
  isDriveConnected,
  isStatusDeliverableToDrive,
  shouldSuggestDriveConnection,
} from "../services/drive/proposal-drive-sync.service";
import { enqueueDriveDelivery } from "../services/drive/drive-delivery-queue";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { resolveUserAndTenant, checkPermission } from "../../lib/auth-helpers";
import {
  assertTenantExists,
  auditSuperAdminCrossTenantWrite,
} from "../../lib/tenant-resolution";
import { buildProposalTransactionsCleanupQuery } from "../../lib/proposal-transactions-query";
import { applyProposalTransactionsCleanup } from "../../lib/proposal-transactions-cleanup";
import {
  enforceTenantPlanLimit,
  buildMonthlyPeriodWindowUtc,
} from "../../lib/tenant-plan-policy";
import {
  incrementSecurityCounter,
  logSecurityEvent,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";
import {
  enqueueStorageGcPath,
  type StorageGcReason,
} from "../../lib/storage-gc";
import { z } from "zod";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";
import { buildSearchTokens } from "../../lib/search-tokens";
import { productRefsFields } from "../../lib/proposal-product-refs";
import { logger, recordPhase } from "../../lib/logger";
import { PDF_IRRELEVANT_PROPOSAL_FIELDS } from "../services/proposal-pdf.service";
import { resolveProjectOnApproval } from "../services/projects/project.service";
import { resolveContractOnApproval } from "../services/field-service/contract.service";
import { sumProductTotals } from "../services/proposals.service";
import {
  isAcceptancePending,
  isChangeRequestOpen,
  isStatusClosedWithoutApproval,
  resolveAcceptanceOnSave,
  resolveChangeRequestOnSave,
} from "../services/proposal-online-approval";
import {
  normalizeProposalTransactionTitle,
  resolveDefaultWalletNameForTenant,
  buildApprovedProposalTransactionDrafts,
  getProposalLinkedTransactionKey,
} from "./proposals.helpers";
import {
  MAX_COMMISSIONS_PER_PROPOSAL,
  sanitizeProposalCommissionsInput,
} from "./proposal-commissions";
import {
  allocateProposalNumberInTransaction,
  readNumberingStateInTransaction,
} from "../services/proposal-numbering.service";
import { approvalTimestampUpdate, resolveSeller } from "../services/sales-goals";
import { sanitizeProposalProductsInput } from "../services/proposal-products-sanitize";
import type { CommissionLine } from "../services/proposal-fine-permissions";
import { checkProposalFineActions } from "../services/proposal-fine-actions";
import {
  MAX_PARTNER_CONTACTS,
  contactResponsiblesErrorMessage,
  resolvePartnerContactIds,
} from "../services/contact-responsibles";

const CreateProposalSchema = z.object({
  title: z.string().max(300).trim().optional(),
  // Vendedor da proposta (metas de vendas): membro da empresa, conferido no
  // controller. Ausente na criação, é quem criou.
  sellerId: z.string().max(128).nullable().optional(),
  // Parceiros externos (contatos vendedor ou arquiteto) que cuidam da venda.
  // Herdados do cliente pela tela; conferidos no controller.
  partnerContactIds: z.array(z.string().min(1).max(128)).max(MAX_PARTNER_CONTACTS).optional(),
  clientId: z.string().max(100).optional(),
  clientName: z.string().max(200).trim().optional().or(z.literal("")),
  clientEmail: z.string().max(254).optional().or(z.literal("")),
  clientPhone: z.string().max(30).optional().or(z.literal("")),
  clientAddress: z.string().max(500).optional().or(z.literal("")),
  status: z.string().max(30).optional(),
  notes: z.string().max(5000).trim().optional().or(z.literal("")),
  customNotes: z.string().max(5000).trim().optional().or(z.literal("")),
  totalValue: z.number().min(0).nullable().optional(),
  discount: z.number().min(0).max(100).nullable().optional(),
  extraExpense: z.number().min(0).nullable().optional(),
  validUntil: z.string().max(30).optional(),
  targetTenantId: z.string().max(100).optional(),
  // Complex fields — passed through, already validated by sanitizeAttachmentsInput/sanitizeProposalProductsInput
  products: z.array(z.unknown()).max(500).optional(),
  attachments: z.array(z.unknown()).max(20).optional(),
  sistemas: z.unknown().optional(),
  sections: z.unknown().optional(),
  pdfSettings: z.unknown().optional(),
  // Denormalized sort fields — computed by the frontend from `sistemas`
  // (computeProposalSortFields em proposal-service.ts)
  primarySystem: z.string().max(2000).optional(),
  primaryEnvironment: z.string().max(2000).optional(),
  // Payment options — passed through
  downPaymentEnabled: z.boolean().optional(),
  downPaymentType: z.string().max(50).optional(),
  downPaymentPercentage: z.number().nullable().optional(),
  downPaymentValue: z.number().nullable().optional(),
  downPaymentWallet: z.string().max(200).optional(),
  downPaymentDueDate: z.string().max(30).optional(),
  downPaymentMethod: z.string().max(50).optional(),
  installmentsEnabled: z.boolean().optional(),
  installmentsCount: z.number().int().min(0).max(120).nullable().optional(),
  installmentValue: z.number().nullable().optional(),
  installmentsWallet: z.string().max(200).optional(),
  firstInstallmentDate: z.string().max(30).optional(),
  installmentsPaymentMethod: z.string().max(50).optional(),
  paymentMethod: z.string().max(50).optional(),
  closedValue: z.number().nullable().optional(),
  // Comissoes — normalizadas por sanitizeProposalCommissionsInput. Declaradas
  // aqui mesmo com o .passthrough() ligado: e o que impede um percentual
  // absurdo de chegar ao calculo das despesas.
  commissions: z.array(z.unknown()).max(MAX_COMMISSIONS_PER_PROPOSAL).optional(),
  // Praca da numeracao (ex. "SP"). O codigo em si nao vem do cliente: e o
  // backend que aloca o sequencial, dentro da transacao de criacao.
  proposalPraca: z.string().max(20).nullable().optional(),
}).passthrough();

const UpdateProposalSchema = CreateProposalSchema.partial();

/**
 * Campos cuja edicao numa proposta APROVADA obriga a ressincronizar os
 * lancamentos. Um campo que afete os lancamentos gerados e nao esteja aqui
 * falha em silencio: a proposta salva, e o financeiro fica desatualizado sem
 * erro em lugar nenhum.
 *
 * Foi o que aconteceu com `commissions` quando o modulo de comissao entrou:
 * mudar so o percentual do arquiteto nao reescrevia despesa nenhuma.
 * Guard: `proposals.approved-sync-fields.test.ts`.
 */
export const APPROVED_SYNC_FIELDS = new Set([
  "title",
  "clientId",
  "clientName",
  "totalValue",
  // `closedValue` estava so na lista estrutural, que e um SUBCONJUNTO desta e
  // por isso nunca era alcancado por ele sozinho. Latente enquanto o formulario
  // manda o payload inteiro (o `totalValue` junto disparava o sync), mas uma
  // chamada parcial a API mudaria o valor fechado sem mexer nos lancamentos.
  // Passou a importar mais com a comissao, que calcula sobre este valor.
  "closedValue",
  "validUntil",
  "downPaymentEnabled",
  "downPaymentType",
  "downPaymentPercentage",
  "downPaymentValue",
  "downPaymentWallet",
  "downPaymentDueDate",
  "installmentsEnabled",
  "installmentsCount",
  "installmentValue",
  "installmentsWallet",
  "firstInstallmentDate",
  "products",
  "discount",
  "extraExpense",
  "status",
  "commissions",
]);

/**
 * Subconjunto que muda VALOR ou CRONOGRAMA, e nao so rotulo. Fora daqui o sync
 * roda em `metadataOnly`, que diante de pagamento parcial apenas atualiza a
 * descricao em vez de recusar a operacao. Percentual de comissao muda valor,
 * entao entra.
 */
export const STRUCTURAL_APPROVED_SYNC_FIELDS = new Set([
  "totalValue",
  "closedValue",
  "validUntil",
  "downPaymentEnabled",
  "downPaymentType",
  "downPaymentPercentage",
  "downPaymentValue",
  "downPaymentWallet",
  "downPaymentDueDate",
  "installmentsEnabled",
  "installmentsCount",
  "installmentValue",
  "installmentsWallet",
  "firstInstallmentDate",
  "products",
  "discount",
  "extraExpense",
  "status",
  "commissions",
]);

const PROPOSALS_COLLECTION = "proposals";
const TENANT_USAGE_COLLECTION = "tenant_usage";
const MAX_ATTACHMENTS_PER_PROPOSAL = 20;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_NAME_LENGTH = 180;
const MAX_ATTACHMENT_URL_LENGTH = 15 * 1024 * 1024;

type SanitizedAttachment = {
  id: string;
  name: string;
  url: string;
  type: "image" | "pdf";
  size: number;
  uploadedAt: string;
  storagePath?: string;
};

type ProposalMonthlyLimitPayload = {
  code: string;
  message: string;
  used: number;
  limit: number;
  projected: number;
  tier: string;
  source: string;
  periodStart?: string;
  periodEnd?: string;
  resetAt?: string;
};

class ProposalMonthlyLimitError extends Error {
  payload: ProposalMonthlyLimitPayload;

  constructor(payload: ProposalMonthlyLimitPayload) {
    super(payload.message);
    this.name = "ProposalMonthlyLimitError";
    this.payload = payload;
  }
}

function buildTenantUsageMonthId(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeMonthlyUsageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function sanitizeAttachmentName(
  value: unknown,
  fallbackType: "image" | "pdf",
): string {
  const normalized = String(value || "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ATTACHMENT_NAME_LENGTH);

  if (normalized) return normalized;
  return fallbackType === "pdf" ? "documento.pdf" : "imagem";
}

function sanitizeAttachmentId(value: unknown, index: number): string {
  const normalized = String(value || "").trim();
  if (/^[A-Za-z0-9._:-]{6,120}$/.test(normalized)) {
    return normalized;
  }
  return `att-${Date.now()}-${index + 1}`;
}

function normalizeAttachmentType(value: unknown): "image" | "pdf" {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "pdf") return "pdf";
  return "image";
}

function isSafeAttachmentUrl(url: string, type: "image" | "pdf"): boolean {
  if (!url || url.length > MAX_ATTACHMENT_URL_LENGTH) return false;

  if (url.startsWith("data:")) {
    const dataUrlMatch = url.match(/^data:([^;,]+);base64,/i);
    if (!dataUrlMatch) return false;
    const mime = String(dataUrlMatch[1] || "").toLowerCase();
    if (type === "pdf") {
      return mime === "application/pdf";
    }
    return (
      mime === "image/jpeg" ||
      mime === "image/jpg" ||
      mime === "image/png" ||
      mime === "image/webp" ||
      mime === "image/gif" ||
      mime === "image/avif"
    );
  }

  try {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const isDevHttp =
      parsed.protocol === "http:" && process.env.NODE_ENV !== "production";
    if (!isHttps && !isDevHttp) return false;
    if (parsed.username || parsed.password) return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function sanitizeAttachmentStoragePath(value: unknown): string | undefined {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/");
  if (!normalized) return undefined;
  if (normalized.length > 512) return undefined;
  if (!normalized.startsWith("tenants/")) return undefined;
  if (!normalized.includes("/proposals/")) return undefined;
  if (!normalized.includes("/attachments/")) return undefined;
  if (normalized.includes("..")) return undefined;
  return normalized;
}

function normalizeStatusIdentifier(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function isStatusApproved(
  statusId: string | undefined | null,
  tenantId?: string | null,
): Promise<boolean> {
  const normalizedStatus = normalizeStatusIdentifier(statusId);
  if (!normalizedStatus) return false;

  // Legacy canonical values persisted directly in proposal.status
  if (normalizedStatus === "approved") return true;
  // Handle virtual default kanban column from frontend
  if (normalizedStatus === "default_2") return true;
  if (["draft", "in_progress", "sent", "rejected", "default_0", "default_1", "default_3"].includes(normalizedStatus)) {
    return false;
  }

  try {
    const statusDoc = await db
      .collection("kanban_statuses")
      .doc(String(statusId))
      .get();
    if (!statusDoc.exists) return false;

    const statusData = statusDoc.data() as
      | {
          tenantId?: string;
          mappedStatus?: string | null;
          category?: string | null;
          label?: string | null;
        }
      | undefined;
    const statusTenantId = String(statusData?.tenantId || "").trim();

    // Hard guard: never infer approval from a kanban column owned by another tenant.
    if (tenantId && statusTenantId && statusTenantId !== tenantId) {
      return false;
    }

    const mappedStatus = normalizeStatusIdentifier(statusData?.mappedStatus);
    if (mappedStatus === "approved") return true;

    // Newer status model is category-based; "won" semantically means approved.
    const category = normalizeStatusIdentifier(statusData?.category);
    if (category === "won") return true;

    // Fallback: Infer from label for older columns
    const label = normalizeStatusIdentifier(statusData?.label);
    if (label.includes("aprovad") || label.includes("ganha") || label.includes("approved")) {
      return true;
    }

    return false;
  } catch (err) {
    console.error("isStatusApproved error checking kanban_statuses", err);
  }
  return false;
}

function sanitizeAttachmentsInput(rawValue: unknown): SanitizedAttachment[] {
  if (typeof rawValue === "undefined" || rawValue === null) {
    return [];
  }
  if (!Array.isArray(rawValue)) {
    throw new Error("INVALID_ATTACHMENTS");
  }
  if (rawValue.length > MAX_ATTACHMENTS_PER_PROPOSAL) {
    throw new Error("INVALID_ATTACHMENTS");
  }

  return rawValue.map((rawAttachment, index) => {
    const source =
      rawAttachment && typeof rawAttachment === "object"
        ? (rawAttachment as Record<string, unknown>)
        : {};

    const type = normalizeAttachmentType(source.type);
    const id = sanitizeAttachmentId(source.id, index);
    const name = sanitizeAttachmentName(source.name, type);
    const url = String(source.url || "").trim();
    const size = Number(source.size || 0);
    const uploadedAtRaw = String(source.uploadedAt || "").trim();
    const uploadedAtDate = uploadedAtRaw ? new Date(uploadedAtRaw) : null;
    const storagePath = sanitizeAttachmentStoragePath(source.storagePath);

    if (!isSafeAttachmentUrl(url, type)) {
      throw new Error("INVALID_ATTACHMENTS");
    }
    if (
      !Number.isFinite(size) ||
      size < 0 ||
      size > MAX_ATTACHMENT_SIZE_BYTES
    ) {
      throw new Error("INVALID_ATTACHMENTS");
    }
    if (!uploadedAtDate || Number.isNaN(uploadedAtDate.getTime())) {
      throw new Error("INVALID_ATTACHMENTS");
    }

    return {
      id,
      name,
      url,
      type,
      size,
      uploadedAt: uploadedAtDate.toISOString(),
      ...(storagePath ? { storagePath } : {}),
    };
  });
}

function parseStoragePathFromUrl(rawUrl: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";

  if (value.startsWith("tenants/")) return value;
  if (value.startsWith("gs://")) {
    const noProtocol = value.slice(5);
    const firstSlash = noProtocol.indexOf("/");
    if (firstSlash > 0 && firstSlash < noProtocol.length - 1) {
      return noProtocol.slice(firstSlash + 1);
    }
  }

  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname || "");

    if (
      url.hostname.includes("firebasestorage.googleapis.com") ||
      url.hostname.includes("firebasestorage.app")
    ) {
      const markerIndex = pathname.indexOf("/o/");
      if (markerIndex >= 0) {
        return pathname.slice(markerIndex + 3);
      }
    }

    if (url.hostname.includes("storage.googleapis.com")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return parts.slice(1).join("/");
      }
    }
  } catch {
    return "";
  }

  return "";
}

function isManagedProposalPath(
  path: string,
  tenantId: string,
  proposalId: string,
): boolean {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) return false;
  if (normalizedPath.includes("..")) return false;
  return (
    normalizedPath.startsWith(
      `tenants/${tenantId}/proposals/${proposalId}/attachments/`,
    ) ||
    normalizedPath.startsWith(
      `tenants/${tenantId}/proposals/${proposalId}/pdf/`,
    )
  );
}

function collectAttachmentStoragePaths(
  rawAttachments: unknown,
  tenantId: string,
  proposalId: string,
): string[] {
  if (!Array.isArray(rawAttachments)) return [];

  const result = new Set<string>();
  rawAttachments.forEach((rawAttachment) => {
    const attachment =
      rawAttachment && typeof rawAttachment === "object"
        ? (rawAttachment as Record<string, unknown>)
        : null;
    if (!attachment) return;

    const explicitPath = sanitizeAttachmentStoragePath(attachment.storagePath);
    if (
      explicitPath &&
      isManagedProposalPath(explicitPath, tenantId, proposalId)
    ) {
      result.add(explicitPath);
      return;
    }

    const parsedPath = parseStoragePathFromUrl(String(attachment.url || ""));
    if (parsedPath && isManagedProposalPath(parsedPath, tenantId, proposalId)) {
      result.add(parsedPath);
    }
  });

  return Array.from(result);
}

function collectProposalPdfStoragePaths(
  proposalData: Record<string, unknown> | undefined,
  tenantId: string,
  proposalId: string,
): string[] {
  const result = new Set<string>();
  if (!proposalData) return [];

  const pdfData =
    proposalData.pdf && typeof proposalData.pdf === "object"
      ? (proposalData.pdf as Record<string, unknown>)
      : {};

  const explicitPath = String(pdfData.storagePath || "").trim();
  if (
    explicitPath &&
    isManagedProposalPath(explicitPath, tenantId, proposalId)
  ) {
    result.add(explicitPath);
  }

  const legacyPdfPath = String(proposalData.pdfPath || "").trim();
  if (
    legacyPdfPath &&
    isManagedProposalPath(legacyPdfPath, tenantId, proposalId)
  ) {
    result.add(legacyPdfPath);
  }

  const legacyPdfUrlPath = parseStoragePathFromUrl(
    String(proposalData.pdfUrl || ""),
  );
  if (
    legacyPdfUrlPath &&
    isManagedProposalPath(legacyPdfUrlPath, tenantId, proposalId)
  ) {
    result.add(legacyPdfUrlPath);
  }

  return Array.from(result);
}

type StorageCleanupContext = {
  reason: StorageGcReason;
  tenantId?: string;
  proposalId?: string;
};

async function deleteStorageObjectsBestEffort(
  paths: string[],
  context: StorageCleanupContext,
): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) return;

  const bucket = getStorage().bucket();
  await Promise.allSettled(
    uniquePaths.map(async (path) => {
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
      } catch (error) {
        console.warn("[proposal-storage-cleanup] failed to delete object", {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
        await enqueueStorageGcPath({
          path,
          reason: context.reason,
          tenantId: context.tenantId,
          proposalId: context.proposalId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}

export async function syncApprovedProposalTransactions(params: {
  proposalId: string;
  proposalTenantId: string;
  proposalData: Record<string, unknown>;
  userId: string;
  initialStatus?: "paid" | "pending" | "overdue";
  metadataOnly?: boolean;
}): Promise<void> {
  const {
    proposalId,
    proposalTenantId,
    proposalData,
    userId,
    initialStatus,
    metadataOnly,
  } = params;
  const defaultWalletName =
    await resolveDefaultWalletNameForTenant(proposalTenantId);
  const { drafts: desiredDrafts, effectiveDownPaymentValue, effectiveInstallmentValue } = buildApprovedProposalTransactionDrafts({
    proposalId,
    proposalData,
    userId,
    defaultWalletName,
    initialStatus,
  });
  // A chave sai da MESMA funcao que le os docs ja gravados. Derivar aqui de
  // novo faria uma comissao (que tambem tem installmentNumber) colidir com a
  // parcela de receita de mesmo numero, e uma sobrescreveria a outra.
  const desiredByKey = new Map(
    desiredDrafts.flatMap((draft) => {
      const key = getProposalLinkedTransactionKey(
        draft as unknown as Record<string, unknown>,
      );
      return key ? [[key, draft] as const] : [];
    }),
  );

  const transactionsQuery = await db
    .collection("transactions")
    .where("tenantId", "==", proposalTenantId)
    .where("proposalId", "==", proposalId)
    .get();

  const existingByKey = new Map<
    string,
    FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
  >();
  const duplicateKeys = new Set<string>();
  const complexDocs = transactionsQuery.docs.filter((doc) => {
    const data = doc.data();
    if (data.isPartialPayment || data.parentTransactionId) {
      return true;
    }

    const key = getProposalLinkedTransactionKey(data);
    if (!key) return true;
    if (existingByKey.has(key)) {
      duplicateKeys.add(key);
      return true;
    }
    existingByKey.set(key, doc);
    return false;
  });

  if ((complexDocs.length > 0 || duplicateKeys.size > 0) && metadataOnly) {
    const now = Timestamp.now();
    const title = normalizeProposalTransactionTitle(proposalData.title);
    const clientId = proposalData.clientId
      ? String(proposalData.clientId)
      : null;
    const clientName = proposalData.clientName
      ? String(proposalData.clientName)
      : null;
    const batch = db.batch();

    transactionsQuery.docs.forEach((doc) => {
      // Comissao fica de fora: a descricao dela nomeia o parceiro e o
      // `clientId` dela APONTA para o parceiro, nao para o comprador.
      // Reescrever aqui trocaria o destinatario da despesa em silencio.
      if (doc.data().isCommission) return;
      batch.update(doc.ref, {
        description: title,
        clientId,
        clientName,
        updatedAt: now,
      });
    });

    await batch.commit();
    return;
  }

  if (complexDocs.length > 0 || duplicateKeys.size > 0) {
    throw new Error(
      "Nao foi possivel sincronizar automaticamente os lancamentos desta proposta porque existem parcelas parciais ou multiplos registros para a mesma parcela.",
    );
  }

  const now = Timestamp.now();
  const batch = db.batch();
  const walletAdjustments = new Map<string, number>();
  const registerAdjustment = (walletName: unknown, amount: number) => {
    const normalizedWallet = String(walletName || "").trim();
    if (!normalizedWallet || amount === 0) return;
    const current = walletAdjustments.get(normalizedWallet) || 0;
    walletAdjustments.set(normalizedWallet, current + amount);
  };

  for (const [key, doc] of existingByKey.entries()) {
    if (desiredByKey.has(key)) continue;

    const data = doc.data();
    if (data.status === "paid" && data.type === "income") {
      throw new Error(
        "Nao e possivel remover ou reduzir parcelas/entradas ja pagas de uma proposta aprovada.",
      );
    }
    // Apagar uma DESPESA paga em lote nao devolve o valor a carteira: o saldo
    // ficaria errado em silencio, e so apareceria numa conciliacao semanas
    // depois. Reverta o pagamento da comissao antes de mexer no percentual.
    if (data.status === "paid" && data.isCommission) {
      throw new Error(
        "Nao e possivel remover uma comissao ja paga. Reverta o pagamento dela antes de alterar as comissoes da proposta.",
      );
    }

    batch.delete(doc.ref);
  }

  desiredByKey.forEach((draft, key) => {
    const existingDoc = existingByKey.get(key);
    if (!existingDoc) {
      // Comissao nasce sempre pendente, inclusive quando a receita nasce paga:
      // ter recebido do cliente nao significa ter pago o parceiro.
      const status = draft.isCommission
        ? draft.status
        : initialStatus ||
          (key === "down_payment"
            ? String(
                existingByKey.get("installment_1")?.data().status || "pending",
              )
            : "pending");

      batch.set(db.collection("transactions").doc(), {
        ...draft,
        status,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    const existingData = existingDoc.data();
    const nextWallet = String(draft.wallet || "").trim() || null;
    const previousWallet = String(existingData.wallet || "").trim() || null;
    const nextAmount = Number(draft.amount || 0);
    const previousAmount = Number(existingData.amount || 0);

    const amountOrWalletChanged =
      previousAmount !== nextAmount || previousWallet !== nextWallet;

    if (
      existingData.status === "paid" &&
      existingData.type === "income" &&
      amountOrWalletChanged
    ) {
      registerAdjustment(previousWallet, -previousAmount);
      registerAdjustment(nextWallet, nextAmount);
    }

    // Mesma razao do guard de exclusao: mexer no valor de uma despesa ja paga
    // por este caminho nao compensa o saldo da carteira.
    if (
      existingData.status === "paid" &&
      existingData.isCommission &&
      amountOrWalletChanged
    ) {
      throw new Error(
        "Nao e possivel alterar uma comissao ja paga. Reverta o pagamento dela antes de alterar as comissoes da proposta.",
      );
    }

    const updatePayload = {
      description: draft.description,
      amount: nextAmount,
      date: draft.date,
      dueDate: draft.dueDate,
      clientId: draft.clientId,
      clientName: draft.clientName,
      proposalId: draft.proposalId,
      proposalGroupId: draft.proposalGroupId,
      wallet: draft.wallet,
      isDownPayment: draft.isDownPayment,
      downPaymentType: draft.downPaymentType || null,
      downPaymentPercentage: draft.downPaymentPercentage || 0,
      isInstallment: draft.isInstallment,
      installmentCount: draft.installmentCount,
      installmentNumber: draft.installmentNumber,
      installmentGroupId: draft.installmentGroupId,
      notes: draft.notes,
      // Campos de comissao: sem eles, mudar o percentual reescreveria o valor
      // e deixaria `commissionPercentage` mostrando o numero antigo.
      category: syncedTransactionCategory(draft, existingData),
      isCommission: draft.isCommission ?? false,
      commissionContactId: draft.commissionContactId ?? null,
      commissionContactName: draft.commissionContactName ?? null,
      commissionRole: draft.commissionRole ?? null,
      commissionPercentage: draft.commissionPercentage ?? null,
      commissionSourceKey: draft.commissionSourceKey ?? null,
      updatedAt: now,
    };

    batch.update(existingDoc.ref, updatePayload);
  });

  if (walletAdjustments.size > 0) {
    const walletNames = Array.from(walletAdjustments.keys());
    const walletSnap = await db
      .collection("wallets")
      .where("tenantId", "==", proposalTenantId)
      .where("name", "in", walletNames)
      .get();

    const walletRefMap = new Map(
      walletSnap.docs.map((doc) => [doc.data().name as string, doc.ref]),
    );

    walletAdjustments.forEach((adjustment, walletName) => {
      if (!adjustment) return;
      const walletRef = walletRefMap.get(walletName);
      if (!walletRef) return;
      batch.update(walletRef, {
        balance: FieldValue.increment(adjustment),
        updatedAt: now,
      });
    });
  }

  await batch.commit();

  await db.collection(PROPOSALS_COLLECTION).doc(proposalId).update({
    installmentValue: effectiveInstallmentValue,
    downPaymentValue: effectiveDownPaymentValue,
    updatedAt: now,
  });

  // Emissao automatica opt-in, so quando o tenant escolheu "ao aprovar a
  // proposta". Best-effort: a proposta ja foi aprovada e as transacoes ja foram
  // criadas — falhar a nota nao pode desfazer a venda. tryAutoIssue nunca lanca.
  if (!metadataOnly) {
    await tryAutoIssue(proposalTenantId, "on_proposal_approved", {
      proposalId,
      createdBy: userId,
    });
  }
}

export const createProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    const parseResult = CreateProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const input = req.body;

    // Sanitize text fields
    if (typeof input.title === "string") input.title = sanitizeText(input.title);
    if (typeof input.clientName === "string") input.clientName = sanitizeText(input.clientName);
    if (typeof input.notes === "string") input.notes = sanitizeRichText(input.notes);
    if (typeof input.customNotes === "string") input.customNotes = sanitizeRichText(input.customNotes);
    if (typeof input.clientAddress === "string") input.clientAddress = sanitizeRichText(input.clientAddress);

    console.log("[createProposal] request received", {
      userId,
      status: input?.status,
      hasProducts: Array.isArray(input?.products),
    });

    // Relaxed validation for drafts
    const normalizedStatus = String(input.status || "draft")
      .trim()
      .toLowerCase();
    const isDraft = normalizedStatus === "draft";

    if (!isDraft) {
      if (!input.title || input.title.trim().length < 3) {
        return res
          .status(400)
          .json({ message: "Título deve ter pelo menos 3 caracteres" });
      }
      if (!input.clientId || !input.clientName) {
        return res.status(400).json({ message: "Cliente é obrigatório" });
      }
      if (typeof input.totalValue !== "number" || input.totalValue < 0) {
        return res.status(400).json({ message: "Valor total inválido" });
      }
    } else {
      // Draft specific defaults/validation
      if (!input.title) {
        input.title = `Rascunho ${new Date().toLocaleString()}`;
      }
      // Allow missing client for drafts (though frontend might enforce it usually)
      if (!input.clientName) input.clientName = "";
      if (input.totalValue === undefined || input.totalValue < 0)
        input.totalValue = 0;
    }

    let sanitizedAttachments: SanitizedAttachment[] = [];
    try {
      sanitizedAttachments = sanitizeAttachmentsInput(input.attachments);
    } catch {
      return res.status(400).json({ message: "Anexos invalidos" });
    }

    let sanitizedProducts: Record<string, unknown>[] = [];
    try {
      sanitizedProducts = sanitizeProposalProductsInput(input.products);
    } catch {
      return res.status(400).json({ message: "Produtos invalidos" });
    }

    const { masterRef, tenantId, isMaster, isSuperAdmin, userData } =
      await resolveUserAndTenant(userId, req.user);

    if (!isMaster && !isSuperAdmin) {
      const canCreate = await checkPermission(userId, "proposals", "canCreate");
      if (!canCreate) {
        return res
          .status(403)
          .json({ message: "Sem permissão para criar propostas." });
      }
    }

    const userCompanyId =
      input.targetTenantId && isSuperAdmin ? input.targetTenantId : tenantId;

    // Adjust masterRef and masterData if Super Admin is acting on behalf of another tenant
    let targetMasterRef = masterRef;

    // We already resolved masterData for the logged user (Super Admin).
    // If target is different, we must find the actual master of that tenant.
    if (isSuperAdmin && userCompanyId && userCompanyId !== tenantId) {
      try {
        await assertTenantExists(userCompanyId);
      } catch {
        return res
          .status(400)
          .json({ message: "Empresa inválida ou inexistente." });
      }
      auditSuperAdminCrossTenantWrite({
        uid: userId,
        tenantId: userCompanyId,
        route: req.originalUrl || req.path,
        requestId: req.requestId,
      });

      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", userCompanyId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find((d) => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
        ownerDoc = ownerQuery.docs.find((d) =>
          ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role),
        );
        if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
      }

      if (ownerDoc) {
        targetMasterRef = db.collection("users").doc(ownerDoc.id);
      }
    }

    // Vendedor: o escolhido, ou quem criou. Só um vendedor pedido e inválido
    // recusa a criação; um padrão que não confere (superadmin criando em nome
    // da empresa) só deixa a proposta sem vendedor.
    const requestedSellerId =
      typeof input.sellerId === "string" && input.sellerId ? input.sellerId : null;
    let seller: { sellerId: string | null; sellerName: string | null } = {
      sellerId: null,
      sellerName: null,
    };
    try {
      seller = await resolveSeller(userCompanyId, requestedSellerId ?? userId);
    } catch {
      if (requestedSellerId) {
        return res.status(400).json({ message: "Vendedor inválido para esta empresa." });
      }
    }
    if (!isMaster && !isSuperAdmin) {
      // Na criação, o automático é o que o formulário põe sozinho: quem cria,
      // ou o responsável e os parceiros que vêm do cadastro do cliente.
      const clientSnap = input.clientId ? await db.collection("clients").doc(String(input.clientId)).get() : null;
      const client = clientSnap?.exists && clientSnap.data()?.tenantId === userCompanyId ? clientSnap.data() : null;
      const inheritedSeller = (client?.responsibleMemberId as string | undefined) || null;
      const sellerBase = {
        sellerId: requestedSellerId && requestedSellerId === inheritedSeller ? inheritedSeller : userId,
        partnerContactIds: Array.isArray(client?.partnerContactIds) ? client?.partnerContactIds : [],
      };
      const commissionsAfter = sanitizeProposalCommissionsInput(input.commissions);
      const willBeApproved =
        input.status !== "draft" && (await isStatusApproved(input.status as string | undefined, userCompanyId));
      const denied = await checkProposalFineActions({
        userId,
        tenantId: userCompanyId,
        current: { ...sellerBase, discount: 0, closedValue: null, commissions: [] },
        input: {
          ...input,
          sellerId: requestedSellerId ?? userId,
          partnerContactIds: input.partnerContactIds ?? sellerBase.partnerContactIds,
        } as Record<string, unknown>,
        commissionsAfter,
        approvalChanges: willBeApproved,
        paidOnApproval: willBeApproved && input.initialPaymentStatus === "paid",
      });
      if (denied) return res.status(403).json({ message: denied });
    }
    let partnerContactIds: string[] = [];
    if (Array.isArray(input.partnerContactIds) && input.partnerContactIds.length > 0) {
      try {
        partnerContactIds = await resolvePartnerContactIds(userCompanyId, input.partnerContactIds);
      } catch (error) {
        const message = contactResponsiblesErrorMessage(error);
        if (message) return res.status(400).json({ message });
        throw error;
      }
    }
    // Proposta que já nasce aprovada conta na meta do mês em que foi criada.
    const approvedOnCreate =
      !isDraft && (await isStatusApproved(input.status as string | undefined, userCompanyId));

    let proposalId: string;
    let createdProposal: { id: string; data: Record<string, unknown> };
    try {
      createdProposal = await db.runTransaction(async (t) => {
        // === ALL READS FIRST ===
        const companyRef = db.collection("companies").doc(userCompanyId);
        const companySnap = await t.get(companyRef);
        const numberingConfig = await readNumberingStateInTransaction(
          t,
          userCompanyId,
        );
        const now = Timestamp.now();

        // Monthly proposals quota policy:
        // count every new proposal except drafts.
        if (!isDraft) {
          const period = buildMonthlyPeriodWindowUtc();
          const monthId = buildTenantUsageMonthId(period.startDate);
          const monthUsageRef = db
            .collection(TENANT_USAGE_COLLECTION)
            .doc(userCompanyId)
            .collection("months")
            .doc(monthId);

          try {
            const monthUsageSnap = await t.get(monthUsageRef);
            const currentUsage = normalizeMonthlyUsageCount(
              monthUsageSnap.data()?.proposalsCreated,
            );
            const projectedUsage = currentUsage + 1;

            const proposalLimitDecision = await enforceTenantPlanLimit({
              tenantId: userCompanyId,
              feature: "maxProposalsPerMonth",
              currentUsage,
              usageKnown: true,
              incrementBy: 1,
              uid: userId,
              requestId: req.requestId,
              route: req.path,
              isSuperAdmin,
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              resetAt: period.resetAt,
            });

            if (!proposalLimitDecision.allowed) {
              throw new ProposalMonthlyLimitError({
                code: proposalLimitDecision.code || "PLAN_LIMIT_EXCEEDED",
                message:
                  proposalLimitDecision.message ||
                  "Limite mensal de propostas atingido.",
                used: proposalLimitDecision.currentUsage,
                limit: proposalLimitDecision.limit,
                projected: proposalLimitDecision.projectedUsage,
                tier: proposalLimitDecision.profile.tier,
                source: proposalLimitDecision.profile.source,
                periodStart: proposalLimitDecision.periodStart,
                periodEnd: proposalLimitDecision.periodEnd,
                resetAt: proposalLimitDecision.resetAt,
              });
            }

            t.set(
              monthUsageRef,
              {
                proposalsCreated: projectedUsage,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
                resetAt: period.resetAt,
                updatedAt: now.toDate().toISOString(),
              },
              { merge: true },
            );
          } catch (monthlyEnforcementError) {
            if (monthlyEnforcementError instanceof ProposalMonthlyLimitError) {
              throw monthlyEnforcementError;
            }

            const failOpenReason =
              monthlyEnforcementError instanceof Error
                ? monthlyEnforcementError.message
                : "MONTHLY_ENFORCEMENT_INTERNAL_ERROR";

            logSecurityEvent(
              "tenant_plan_monthly_enforcement_fail_open",
              {
                requestId: req.requestId,
                route: req.path,
                tenantId: userCompanyId,
                uid: userId,
                reason: failOpenReason,
                source: "proposals_controller",
                status: 200,
              },
              "WARN",
            );
            void incrementSecurityCounter("plan_limit_would_block", {
              requestId: req.requestId,
              route: req.path,
              tenantId: userCompanyId,
              uid: userId,
              reason: "monthly_enforcement_fail_open",
              source: "proposals_controller",
              status: 200,
            });
            void writeSecurityAuditEvent({
              eventType: "TENANT_PLAN_MONTHLY_ENFORCEMENT_FAIL_OPEN",
              requestId: req.requestId,
              route: req.path,
              status: 200,
              tenantId: userCompanyId,
              uid: userId,
              reason: failOpenReason,
              source: "proposals_controller",
            });

            t.set(
              monthUsageRef,
              {
                proposalsCreated: FieldValue.increment(1),
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
                resetAt: period.resetAt,
                updatedAt: now.toDate().toISOString(),
              },
              { merge: true },
            );
          }
        }

        // === ALL WRITES AFTER READS ===
        const newRef = db.collection(PROPOSALS_COLLECTION).doc();

        // `null` quando a empresa nao ligou a numeracao, que e o padrao: a
        // proposta e gravada sem campo nenhum de codigo, como sempre foi.
        const numbering = allocateProposalNumberInTransaction({
          t,
          tenantId: userCompanyId,
          config: numberingConfig,
          praca: input.proposalPraca,
          now,
        });

        t.set(newRef, {
          proposalNumber: numbering?.proposalNumber ?? null,
          proposalYear: numbering?.proposalYear ?? null,
          proposalPraca: numbering?.proposalPraca ?? null,
          proposalCode: numbering?.proposalCode ?? null,
          title: input.title.trim(),
          status: input.status || "draft",
          totalValue: input.totalValue,
          notes: input.notes?.trim() || null,
          customNotes: input.customNotes?.trim() || null,
          discount: input.discount || 0,
          closedValue: input.closedValue ?? null,
          extraExpense: input.extraExpense || 0,
          validUntil: input.validUntil || null,
          clientId: input.clientId,
          clientName: input.clientName,
          clientEmail: input.clientEmail || null,
          clientPhone: input.clientPhone || null,
          clientAddress: input.clientAddress || null,
          products: sanitizedProducts,
          ...productRefsFields(sanitizedProducts),
          sistemas: input.sistemas || [],
          sections: input.sections || [],
          // Denormalized sort fields (computed client-side from sistemas);
          // "" keeps the doc present in the sort indexes.
          primarySystem:
            typeof input.primarySystem === "string" ? input.primarySystem : "",
          primaryEnvironment:
            typeof input.primaryEnvironment === "string"
              ? input.primaryEnvironment
              : "",
          // Indexed search tokens (array-contains as-you-type search)
          searchTokens: buildSearchTokens(input.title, input.clientName),
          // Payment options
          downPaymentEnabled: input.downPaymentEnabled || false,
          downPaymentType: input.downPaymentType || "value",
          downPaymentPercentage: input.downPaymentPercentage || 0,
          downPaymentValue: input.downPaymentValue || 0,
          downPaymentWallet: input.downPaymentWallet || null,
          downPaymentDueDate: input.downPaymentDueDate || null,
          downPaymentMethod: input.downPaymentMethod || null,
          installmentsEnabled: input.installmentsEnabled || false,
          installmentsCount: input.installmentsCount || 1,
          installmentValue: input.installmentValue || 0,
          installmentsWallet: input.installmentsWallet || null,
          firstInstallmentDate: input.firstInstallmentDate || null,
          installmentsPaymentMethod: input.installmentsPaymentMethod || null,
          paymentMethod: input.paymentMethod || null,
          // Comissoes de vendedor/arquiteto (informacao interna, fora do PDF)
          commissions: sanitizeProposalCommissionsInput(input.commissions),
          // PDF display settings (which elements to show/hide in PDF)
          pdfSettings: input.pdfSettings || null,
          // Attachments
          attachments: sanitizedAttachments,
          createdById: userId,
          createdByName: userData?.name || "Usuário",
          sellerId: seller.sellerId,
          sellerName: seller.sellerName,
          partnerContactIds,
          approvedAt: approvedOnCreate ? now.toDate().toISOString() : null,
          companyId: userCompanyId,
          tenantId: userCompanyId,
          createdAt: now,
          updatedAt: now,
        });

        t.update(targetMasterRef, {
          "usage.proposals": FieldValue.increment(1),
          updatedAt: now,
        });

        if (companySnap.exists) {
          t.update(companyRef, {
            "usage.proposals": FieldValue.increment(1),
            updatedAt: now,
          });
        }

        return {
          id: newRef.id,
          data: {
            proposalNumber: numbering?.proposalNumber ?? null,
            proposalYear: numbering?.proposalYear ?? null,
            proposalPraca: numbering?.proposalPraca ?? null,
            proposalCode: numbering?.proposalCode ?? null,
            title: input.title.trim(),
            status: input.status || "draft",
            totalValue: input.totalValue,
            notes: input.notes?.trim() || null,
            customNotes: input.customNotes?.trim() || null,
            discount: input.discount || 0,
          closedValue: input.closedValue ?? null,
            extraExpense: input.extraExpense || 0,
            validUntil: input.validUntil || null,
            clientId: input.clientId,
            clientName: input.clientName,
            clientEmail: input.clientEmail || null,
            clientPhone: input.clientPhone || null,
            clientAddress: input.clientAddress || null,
            products: sanitizedProducts,
            sistemas: input.sistemas || [],
            sections: input.sections || [],
            downPaymentEnabled: input.downPaymentEnabled || false,
            downPaymentType: input.downPaymentType || "value",
            downPaymentPercentage: input.downPaymentPercentage || 0,
            downPaymentValue: input.downPaymentValue || 0,
            downPaymentWallet: input.downPaymentWallet || null,
            downPaymentDueDate: input.downPaymentDueDate || null,
            downPaymentMethod: input.downPaymentMethod || null,
            installmentsEnabled: input.installmentsEnabled || false,
            installmentsCount: input.installmentsCount || 1,
            installmentValue: input.installmentValue || 0,
            installmentsWallet: input.installmentsWallet || null,
            firstInstallmentDate: input.firstInstallmentDate || null,
            installmentsPaymentMethod: input.installmentsPaymentMethod || null,
            paymentMethod: input.paymentMethod || null,
            pdfSettings: input.pdfSettings || null,
            attachments: sanitizedAttachments,
            createdById: userId,
            createdByName: userData?.name || "Usuário",
            companyId: userCompanyId,
            tenantId: userCompanyId,
          },
        };
      });

      if (
        await isStatusApproved(
          createdProposal.data.status as string,
          createdProposal.data.tenantId as string,
        )
      ) {
        await syncApprovedProposalTransactions({
          proposalId: createdProposal.id,
          proposalTenantId: createdProposal.data.tenantId as string,
          proposalData: createdProposal.data as Record<string, unknown>,
          userId: createdProposal.data.createdById as string,
          initialStatus: input.initialPaymentStatus || "pending",
        });
        await resolveContractOnApproval({
          tenantId: createdProposal.data.tenantId as string,
          proposalId: createdProposal.id,
          proposal: createdProposal.data as Record<string, unknown>,
          uid: createdProposal.data.createdById as string,
        });
      }

      proposalId = createdProposal.id;
    } catch (transactionError) {
      if (transactionError instanceof ProposalMonthlyLimitError) {
        return res.status(402).json({
          message: transactionError.payload.message,
          code: transactionError.payload.code,
          used: transactionError.payload.used,
          limit: transactionError.payload.limit,
          projected: transactionError.payload.projected,
          tier: transactionError.payload.tier,
          source: transactionError.payload.source,
          periodStart: transactionError.payload.periodStart,
          periodEnd: transactionError.payload.periodEnd,
          resetAt: transactionError.payload.resetAt,
        });
      }
      throw transactionError;
    }

    return res.status(201).json({
      success: true,
      proposalId,
      message: "Proposta criada com sucesso!",
    });
  } catch (error: unknown) {
    console.error("createProposal Error:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(500).json({ message });
  }
};

export const updateProposal = async (req: Request, res: Response) => {
  const requestStartedAt = Date.now();
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const parseResult = UpdateProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const updateData = req.body;

    // Sanitize text fields
    if (typeof updateData.title === "string") updateData.title = sanitizeText(updateData.title);
    if (typeof updateData.clientName === "string") updateData.clientName = sanitizeText(updateData.clientName);
    if (typeof updateData.notes === "string") updateData.notes = sanitizeRichText(updateData.notes);
    if (typeof updateData.customNotes === "string") updateData.customNotes = sanitizeRichText(updateData.customNotes);
    if (typeof updateData.clientAddress === "string") updateData.clientAddress = sanitizeRichText(updateData.clientAddress);

    console.log("[updateProposal] request received", {
      userId,
      proposalId: id,
      updatedFields: Object.keys(updateData || {}),
    });

    // Parallel fetch: auth resolution and proposal doc are independent reads
    const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(id);
    const [{ tenantId, isMaster, isSuperAdmin }, proposalSnap] =
      await Promise.all([
        resolveUserAndTenant(userId, req.user),
        proposalRef.get(),
      ]);

    if (!proposalSnap.exists)
      return res.status(404).json({ message: "Proposta não encontrada." });

    const proposalData = proposalSnap.data();
    if (!isSuperAdmin && proposalData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });
    const proposalTenantId = String(proposalData?.tenantId || tenantId).trim();

    if (!isMaster && !isSuperAdmin) {
      const canEdit = await checkPermission(userId, "proposals", "canEdit");
      if (!canEdit) {
        return res
          .status(403)
          .json({ message: "Sem permissão para editar propostas." });
      }
    }

    const previousAttachmentPaths = collectAttachmentStoragePaths(
      proposalData?.attachments,
      proposalTenantId,
      id,
    );

    let sanitizedAttachments: SanitizedAttachment[] | undefined;
    if (typeof updateData.attachments !== "undefined") {
      try {
        sanitizedAttachments = sanitizeAttachmentsInput(updateData.attachments);
      } catch {
        return res.status(400).json({ message: "Anexos invalidos" });
      }
    }

    let sanitizedProducts: Record<string, unknown>[] | undefined;
    if (typeof updateData.products !== "undefined") {
      try {
        sanitizedProducts = sanitizeProposalProductsInput(updateData.products);
      } catch {
        return res.status(400).json({ message: "Produtos invalidos" });
      }
    }

    const nextAttachmentPaths =
      typeof sanitizedAttachments !== "undefined"
        ? collectAttachmentStoragePaths(
            sanitizedAttachments,
            proposalTenantId,
            id,
          )
        : [];
    const nextAttachmentPathSet = new Set(nextAttachmentPaths);
    const removedAttachmentPaths =
      typeof sanitizedAttachments !== "undefined"
        ? previousAttachmentPaths.filter(
            (path) => !nextAttachmentPathSet.has(path),
          )
        : [];

    // Marca a entrada no handler. Sem isto nao da para distinguir "o handler
    // nem comecou" (auth, assinatura, rate limit) de "travou la dentro".
    logger.info("proposal_update_start", {
      proposalId: id,
      untilHandlerMs: Date.now() - requestStartedAt,
    });

    // Cronometra as etapas caras, logando CADA UMA assim que termina.
    //
    // Logar so um resumo no fim era inutil justamente no caso que interessa: se
    // a request estoura o timeout, o fim nunca chega e o terminal fica mudo,
    // sem dizer onde travou. Com uma linha por etapa, o rastro que ja saiu
    // mostra ate onde foi.
    const timings: Record<string, number> = {};
    const timed = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
      const startedAt = Date.now();
      try {
        return await run();
      } finally {
        timings[label] = Date.now() - startedAt;
        // Vai para o log E para `res.locals`, que e o que sobrevive a um
        // timeout: o resumo final nunca chega quando a request estoura.
        recordPhase(res, "proposal_update_phase", {
          proposalId: id,
          phase: label,
          ms: timings[label],
          sinceStartMs: Date.now() - requestStartedAt,
        });
      }
    };

    // Contado de volta para a tela: sem isso o aviso de "vai para o Drive"
    // apareceria tambem para quem nao usa a integracao, prometendo algo que
    // nunca acontece.
    const safeUpdate: Record<string, unknown> = { updatedAt: Timestamp.now() };
    const fields = [
      "title",
      "clientId",
      "clientName",
      "clientEmail",
      "clientPhone",
      "clientAddress",
      "validUntil",
      "status",
      "products",
      "sistemas",
      "discount",
      "closedValue",
      "extraExpense",
      "notes",
      "customNotes",
      "sections",
      "pdfSettings",
      "totalValue",
      // Denormalized sort fields (sent by the frontend when sistemas change)
      "primarySystem",
      "primaryEnvironment",
      // Payment options
      "downPaymentEnabled",
      "downPaymentType",
      "downPaymentPercentage",
      "downPaymentValue",
      "downPaymentWallet",
      "downPaymentDueDate",
      "downPaymentMethod",
      "installmentsEnabled",
      "installmentsCount",
      "installmentValue",
      "installmentsWallet",
      "firstInstallmentDate",
      "installmentsPaymentMethod",
      "paymentMethod",
      // Comissoes
      "commissions",
      // Attachments
      "attachments",
      // Vendedor (metas de vendas); conferido abaixo
      "sellerId",
      // Parceiros que cuidam da venda; conferidos abaixo
      "partnerContactIds",
    ];

    fields.forEach((f) => {
      if (typeof updateData[f] === "undefined") return;
      if (f === "attachments") {
        safeUpdate[f] = sanitizedAttachments || [];
        return;
      }
      if (f === "products") {
        safeUpdate[f] = sanitizedProducts || [];
        Object.assign(safeUpdate, productRefsFields(sanitizedProducts || []));
        return;
      }
      if (f === "commissions") {
        safeUpdate[f] = sanitizeProposalCommissionsInput(updateData[f]);
        return;
      }
      if (f === "sellerId" || f === "partnerContactIds") return; // conferidos abaixo
      safeUpdate[f] = updateData[f];
    });

    if (typeof updateData.sellerId !== "undefined") {
      try {
        Object.assign(
          safeUpdate,
          await resolveSeller(proposalTenantId, (updateData.sellerId as string | null) || null),
        );
      } catch {
        return res.status(400).json({ message: "Vendedor inválido para esta empresa." });
      }
    }

    if (typeof updateData.partnerContactIds !== "undefined") {
      try {
        safeUpdate.partnerContactIds = await resolvePartnerContactIds(
          proposalTenantId,
          Array.isArray(updateData.partnerContactIds) ? (updateData.partnerContactIds as string[]) : [],
        );
      } catch (error) {
        const message = contactResponsiblesErrorMessage(error);
        if (message) return res.status(400).json({ message });
        throw error;
      }
    }

    // Keep indexed search tokens in sync when title/clientName change
    if (
      typeof updateData.title !== "undefined" ||
      typeof updateData.clientName !== "undefined"
    ) {
      const nextTitle =
        typeof updateData.title !== "undefined"
          ? updateData.title
          : proposalData?.title;
      const nextClientName =
        typeof updateData.clientName !== "undefined"
          ? updateData.clientName
          : proposalData?.clientName;
      safeUpdate.searchTokens = buildSearchTokens(nextTitle, nextClientName);
    }

    if (updateData.products) {
      // A mensalidade (`isMonthly`) fica fora do total, como na tela.
      const subtotal = sumProductTotals((sanitizedProducts || []) as Record<string, unknown>[]);
      const discountAmount =
        (subtotal * (Number(updateData.discount) || Number(proposalData?.discount) || 0)) / 100;
      const extraExpense =
        updateData.extraExpense !== undefined
          ? Number(updateData.extraExpense)
          : Number(proposalData?.extraExpense) || 0;
      const computedTotal = subtotal - discountAmount + extraExpense;

      // If closedValue was explicitly included in the payload, use safeUpdate.closedValue (already processed).
      // If not included, fall back to the existing document value.
      // hasOwnProperty is required: frontend sends closedValue: null when the user clears the field,
      // so safeUpdate.closedValue may already be null — using ?? would incorrectly fall back to the old doc value.
      const effectiveClosedValue = Object.prototype.hasOwnProperty.call(
        updateData,
        "closedValue",
      )
        ? Number(safeUpdate.closedValue) || 0
        : Number(proposalData?.closedValue) || 0;

      safeUpdate.totalValue =
        effectiveClosedValue > 0
          ? effectiveClosedValue
          : Math.max(0, computedTotal);
    }

    // Aprovação decidida ANTES da escrita: a data da aprovação (metas de vendas)
    // entra na mesma gravação do status.
    const isCurrentlyApproved = await isStatusApproved(
      proposalData?.status as string | undefined,
      proposalTenantId,
    );
    const willBeApproved =
      updateData.status !== undefined
        ? await isStatusApproved(updateData.status as string, proposalTenantId)
        : isCurrentlyApproved;
    Object.assign(
      safeUpdate,
      approvalTimestampUpdate(isCurrentlyApproved, willBeApproved, new Date().toISOString()),
    );

    if (!isMaster && !isSuperAdmin) {
      const denied = await checkProposalFineActions({
        userId,
        tenantId: proposalTenantId,
        current: (proposalData ?? null) as Record<string, unknown> | null,
        input: updateData as Record<string, unknown>,
        commissionsAfter:
          typeof updateData.commissions !== "undefined"
            ? (safeUpdate.commissions as CommissionLine[])
            : null,
        approvalChanges: willBeApproved !== isCurrentlyApproved,
        paidOnApproval: willBeApproved && !isCurrentlyApproved && updateData.initialPaymentStatus === "paid",
      });
      if (denied) return res.status(403).json({ message: denied });
    }

    await timed("proposalWriteMs", () => proposalRef.update(safeUpdate));

    if (removedAttachmentPaths.length > 0) {
      await deleteStorageObjectsBestEffort(removedAttachmentPaths, {
        reason: "proposal_update_attachment_cleanup_failed",
        tenantId: proposalTenantId,
        proposalId: id,
      });
    }

    // Criar receita automaticamente quando a proposta for aprovada
    const isBeingApproved = willBeApproved && !isCurrentlyApproved;

    // Projeto de instalação na aprovação (Pro e Enterprise): conforme a
    // empresa configurou, cria, pergunta (padrão) ou não faz nada. Nunca
    // derruba a aprovação.
    let projectOutcome: { createdProjectId: string | null; suggest: boolean } | null = null;
    // Contrato de manutenção: as linhas de mensalidade viram um contrato em
    // rascunho, que a empresa ativa escolhendo o início. Também nunca derruba.
    let contractCreated: string | null = null;
    if (isBeingApproved) {
      projectOutcome = await resolveProjectOnApproval({
        tenantId: proposalTenantId,
        proposalId: id,
        proposal: { ...proposalData, ...safeUpdate },
        uid: userId,
      });
      contractCreated = await resolveContractOnApproval({
        tenantId: proposalTenantId,
        proposalId: id,
        proposal: { ...proposalData, ...safeUpdate },
        uid: userId,
      });
    }

    // Aceite do cliente pelo link, ainda pendente: confirmar é aprovar a
    // proposta (este mesmo caminho, da lista, do quadro ou do formulário), e
    // editar o que o cliente viu anula o aceite, porque ele aceitou outra versão.
    // O pedido de mudanças aberto se resolve do mesmo jeito: editar o conteúdo
    // é atender, e aprovar ou fechar encerra a conversa.
    const hasPendingAcceptance = isAcceptancePending(proposalData?.clientAcceptance);
    const hasOpenChangeRequest = isChangeRequestOpen(proposalData?.clientChangeRequest);
    if (hasPendingAcceptance || hasOpenChangeRequest) {
      const statusChanged =
        updateData.status !== undefined && updateData.status !== proposalData?.status;
      const closedWithoutApproval =
        statusChanged &&
        (await isStatusClosedWithoutApproval(String(updateData.status), proposalTenantId));
      const proposalAfter = { ...proposalData, ...safeUpdate };
      const resolvedAt = new Date().toISOString();
      const responseUpdate: Record<string, unknown> = {};

      const nextAcceptance = resolveAcceptanceOnSave({
        acceptance: proposalData?.clientAcceptance,
        proposalAfter,
        isBeingApproved,
        closedWithoutApproval,
      });
      if (nextAcceptance) {
        responseUpdate["clientAcceptance.status"] = nextAcceptance;
        responseUpdate["clientAcceptance.resolvedAt"] = resolvedAt;
        responseUpdate["clientAcceptance.resolvedBy"] = userId;
      }
      const nextChangeRequest = resolveChangeRequestOnSave({
        request: proposalData?.clientChangeRequest,
        proposalAfter,
        isBeingApproved,
        closedWithoutApproval,
      });
      if (nextChangeRequest) {
        responseUpdate["clientChangeRequest.status"] = nextChangeRequest;
        responseUpdate["clientChangeRequest.resolvedAt"] = resolvedAt;
        responseUpdate["clientChangeRequest.resolvedBy"] = userId;
      }
      if (Object.keys(responseUpdate).length > 0) {
        await proposalRef.update(responseUpdate);
      }
    }

    // Remover receita se sair de aprovada (Rascunho/Enviada)
    const isBeingReverted =
      isCurrentlyApproved && updateData.status !== undefined && !willBeApproved;

    const isAlreadyApproved =
      isCurrentlyApproved &&
      (updateData.status === undefined || willBeApproved);
    const shouldSyncApprovedTransactions =
      (isAlreadyApproved || isBeingApproved) &&
      Object.keys(updateData || {}).some((field) =>
        APPROVED_SYNC_FIELDS.has(field),
      );
    const approvedSyncIsMetadataOnly =
      shouldSyncApprovedTransactions &&
      !Object.keys(updateData || {}).some((field) =>
        STRUCTURAL_APPROVED_SYNC_FIELDS.has(field),
      );

    if (false && isAlreadyApproved) {
      const mergedData = { ...proposalData, ...safeUpdate } as any;
      const nowDateStr = new Date().toISOString().split("T")[0];

      // Check for changes (undefined check is important because partial updates are possible)
      const changes = {
        dpEnabled:
          updateData.downPaymentEnabled !== undefined &&
          updateData.downPaymentEnabled !== proposalData?.downPaymentEnabled,
        dpType:
          updateData.downPaymentType !== undefined &&
          updateData.downPaymentType !== proposalData?.downPaymentType,
        dpPercentage:
          updateData.downPaymentPercentage !== undefined &&
          updateData.downPaymentPercentage !==
            proposalData?.downPaymentPercentage,
        dpValue:
          updateData.downPaymentValue !== undefined &&
          updateData.downPaymentValue !== proposalData?.downPaymentValue,
        dpWallet:
          updateData.downPaymentWallet !== undefined &&
          updateData.downPaymentWallet !== proposalData?.downPaymentWallet,
        dpDate:
          updateData.downPaymentDueDate !== undefined &&
          updateData.downPaymentDueDate !== proposalData?.downPaymentDueDate,

        instValue:
          updateData.installmentValue !== undefined &&
          updateData.installmentValue !== proposalData?.installmentValue,
        instWallet:
          updateData.installmentsWallet !== undefined &&
          updateData.installmentsWallet !== proposalData?.installmentsWallet,
        instDate:
          updateData.firstInstallmentDate !== undefined &&
          updateData.firstInstallmentDate !==
            proposalData?.firstInstallmentDate,

        title:
          updateData.title !== undefined &&
          updateData.title !== proposalData?.title,
      };

      if (Object.values(changes).some(Boolean)) {
        // Find transactions for this proposal
        const transactionsQuery = await db
          .collection("transactions")
          .where("tenantId", "==", proposalTenantId)
          .where("proposalGroupId", "==", id)
          .get();

        if (!transactionsQuery.empty) {
          const batch = db.batch();
          const walletAdjustments = new Map<string, number>();
          const existingDownPaymentDoc = transactionsQuery.docs.find(
            (doc) => doc.data().isDownPayment,
          );
          const firstInstallmentDoc = transactionsQuery.docs.find(
            (doc) => doc.data().isInstallment,
          );
          const shouldHaveDownPayment =
            !!mergedData.downPaymentEnabled &&
            Number(mergedData.downPaymentValue || 0) > 0;

          // Helper for balance adjustments
          const registerAdjustment = (walletName: string, amount: number) => {
            if (!walletName) return;
            const current = walletAdjustments.get(walletName) || 0;
            walletAdjustments.set(walletName, current + amount);
          };

          transactionsQuery.docs.forEach((doc) => {
            const txData = doc.data();
            const updatePayload: any = { updatedAt: Timestamp.now() };
            let shouldUpdate = false;

            // --- 0. Title Sync ---
            if (changes.title) {
              // Preserve prefixes like "Entrada: ", "Parcela X/Y: "
              let newDesc = updateData.title;
              if (txData.description.startsWith("Entrada: ")) {
                newDesc = `Entrada: ${newDesc}`;
              } else if (txData.description.includes("Parcela")) {
                // Regex to keep prefix? Or simpler reconstruction if we have context.
                // txData.description format: "Parcela 1/12: Old Title"
                const parts = txData.description.split(":");
                if (parts.length > 1) {
                  newDesc = `${parts[0]}: ${newDesc}`;
                }
              }
              updatePayload.description = newDesc;
              shouldUpdate = true;
            }

            // --- 1. Down Payment Handling ---
            if (txData.isDownPayment) {
              // Value Change
              if (changes.dpValue) {
                const newAmount = updateData.downPaymentValue;

                // If paid, revert old amount from old wallet, add new amount to (potentially new) wallet later
                if (txData.status === "paid" && txData.type === "income") {
                  registerAdjustment(txData.wallet, -txData.amount); // Revert OLD
                  // We will add NEW later, but wait, if wallet ALSO changes, we need to handle that.
                  // The "Add NEW" should happen using the *final* destination wallet.
                }

                updatePayload.amount = newAmount;
                shouldUpdate = true;
              }

              // Wallet Change
              if (changes.dpWallet) {
                // If paid, move money
                if (
                  txData.status === "paid" &&
                  txData.type === "income" &&
                  !changes.dpValue
                ) {
                  // Only wallet changed, amount same
                  registerAdjustment(txData.wallet, -txData.amount); // Remove from OLD
                  // Add to NEW comes later
                }
                updatePayload.wallet = updateData.downPaymentWallet;
                shouldUpdate = true;
              }

              // Date Change
              if (changes.dpDate) {
                updatePayload.dueDate = updateData.downPaymentDueDate;
                updatePayload.date = updateData.downPaymentDueDate;
                shouldUpdate = true;
              }

              if (changes.dpType) {
                updatePayload.downPaymentType = updateData.downPaymentType;
                shouldUpdate = true;
              }

              if (changes.dpPercentage) {
                updatePayload.downPaymentPercentage =
                  updateData.downPaymentPercentage;
                shouldUpdate = true;
              }

              // Apply Balance Logic for Down Payment (Income only)
              if (
                txData.status === "paid" &&
                txData.type === "income" &&
                (changes.dpValue || changes.dpWallet)
              ) {
                const finalAmount = changes.dpValue
                  ? updateData.downPaymentValue
                  : txData.amount;
                const finalWallet = changes.dpWallet
                  ? updateData.downPaymentWallet
                  : txData.wallet;
                registerAdjustment(finalWallet, finalAmount); // Add to NEW/CURRENT
              }
            }

            // --- 2. Installment Handling ---
            else if (txData.isInstallment) {
              // Value Change
              if (changes.instValue) {
                const newAmount = updateData.installmentValue;

                if (txData.status === "paid" && txData.type === "income") {
                  registerAdjustment(txData.wallet, -txData.amount);
                }

                updatePayload.amount = newAmount;
                shouldUpdate = true;
              }

              // Wallet Change
              if (changes.instWallet) {
                if (
                  txData.status === "paid" &&
                  txData.type === "income" &&
                  !changes.instValue
                ) {
                  registerAdjustment(txData.wallet, -txData.amount);
                }
                updatePayload.wallet = updateData.installmentsWallet;
                shouldUpdate = true;
              }

              // Date Change (First Installment Date shift)
              if (changes.instDate) {
                const installmentNumber = txData.installmentNumber || 1;
                if (updateData.firstInstallmentDate) {
                  const firstInstDate = new Date(
                    updateData.firstInstallmentDate + "T12:00:00",
                  );
                  const installmentDate = new Date(firstInstDate);
                  installmentDate.setMonth(
                    firstInstDate.getMonth() + (installmentNumber - 1),
                  );
                  const newDueDate = installmentDate
                    .toISOString()
                    .split("T")[0];

                  updatePayload.dueDate = newDueDate;
                  updatePayload.date = newDueDate;
                  shouldUpdate = true;
                }
              }

              // Apply Balance Logic for Installment
              if (
                txData.status === "paid" &&
                txData.type === "income" &&
                (changes.instValue || changes.instWallet)
              ) {
                const finalAmount = changes.instValue
                  ? updateData.installmentValue
                  : txData.amount;
                const finalWallet = changes.instWallet
                  ? updateData.installmentsWallet
                  : txData.wallet;
                registerAdjustment(finalWallet, finalAmount);
              }
            }

            if (shouldUpdate) {
              batch.update(doc.ref, updatePayload);
            }
          });

          // --- 2.5. Down Payment presence sync for already approved proposals ---
          if (shouldHaveDownPayment && !existingDownPaymentDoc) {
            const installData = firstInstallmentDoc?.data() || {};
            const downPaymentRef = db.collection("transactions").doc();

            batch.set(downPaymentRef, {
              tenantId: proposalTenantId,
              type: "income",
              description: `Entrada: ${mergedData.title || proposalData?.title || "Proposta"}`,
              amount: Number(mergedData.downPaymentValue || 0),
              date:
                mergedData.downPaymentDueDate || installData.date || nowDateStr,
              dueDate:
                mergedData.downPaymentDueDate ||
                installData.dueDate ||
                nowDateStr,
              status: installData.status || "pending",
              clientId: mergedData.clientId || null,
              clientName: mergedData.clientName || null,
              proposalId: id,
              proposalGroupId: installData.proposalGroupId || null,
              category: PROPOSAL_INCOME_CATEGORY,
              wallet:
                mergedData.downPaymentWallet ||
                installData.wallet ||
                proposalData?.downPaymentWallet ||
                null,
              isDownPayment: true,
              downPaymentType: mergedData.downPaymentType || "value",
              downPaymentPercentage: mergedData.downPaymentPercentage || 0,
              isInstallment: false,
              installmentCount: installData.installmentCount || null,
              installmentNumber: 0,
              installmentGroupId: installData.installmentGroupId || null,
              notes: "Entrada gerada automaticamente pela proposta",
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              createdById: userId,
            });
          }

          if (!shouldHaveDownPayment && existingDownPaymentDoc) {
            const existingData = existingDownPaymentDoc!.data();

            if (
              existingData.status === "paid" &&
              existingData.type === "income" &&
              existingData.wallet &&
              existingData.amount
            ) {
              registerAdjustment(existingData.wallet, -existingData.amount);
            }

            batch.delete(existingDownPaymentDoc!.ref);
          }

          // --- 3. Consolidate Wallet Updates ---
          // Batched wallet lookup: single query instead of N sequential ones
          if (walletAdjustments.size > 0) {
            const walletNames = Array.from(walletAdjustments.keys());
            const wSnap = await db
              .collection("wallets")
              .where("tenantId", "==", proposalTenantId)
              .where("name", "in", walletNames)
              .get();

            const walletRefMap = new Map(
              wSnap.docs.map((d) => [d.data().name as string, d.ref]),
            );

            for (const [wName, adjustment] of walletAdjustments.entries()) {
              if (!adjustment) continue;
              const ref = walletRefMap.get(wName);
              if (ref) {
                batch.update(ref as FirebaseFirestore.DocumentReference, {
                  balance: FieldValue.increment(adjustment),
                  updatedAt: Timestamp.now(),
                });
              }
            }
          }

          await batch.commit();
          console.log(
            `Updated transactions/wallets for proposal ${id}. Changes: ${JSON.stringify(changes)}`,
          );
        }
      }
    }

    if (isBeingReverted) {
      await cleanupProposalTransactions(id, proposalData?.tenantId || tenantId);
    }

    // Lancamentos ANTES da entrega no Drive. Os dois sao awaited, mas o Drive
    // pode gastar dezenas de segundos gerando o PDF (Chromium) e subindo o
    // arquivo. Com ele na frente, uma request que estoure o timeout do cliente
    // deixava a proposta aprovada e o financeiro vazio ate alguem recarregar a
    // pagina; agora o dinheiro ja esta gravado quando a parte lenta comeca.
    //
    // O erro do sync e guardado em vez de lancado na hora: ele precisa chegar
    // ao cliente (e o que avisa sobre comissao paga, por exemplo), mas nao
    // pode cancelar uma entrega de PDF que nada tem a ver com ele.
    let driveDeliveryQueued = false;
    let driveNotConnected = false;
    let approvedSyncError: unknown = null;
    if (shouldSyncApprovedTransactions) {
      try {
        await timed("approvedSyncMs", () =>
          syncApprovedProposalTransactions({
            proposalId: id,
            proposalTenantId,
            proposalData: {
              ...proposalData,
              ...safeUpdate,
            } as Record<string, unknown>,
            userId,
            initialStatus: isBeingApproved
              ? updateData.initialPaymentStatus || "pending"
              : undefined,
            metadataOnly: approvedSyncIsMetadataOnly,
          }),
        );
      } catch (error) {
        approvedSyncError = error;
      }
    }

    // Entrega no Google Drive: acontece ao a proposta SAIR do rascunho, e nao
    // a cada geracao do PDF — o PDF e gerado sob demanda, e subir em cada
    // geracao encheria a pasta do cliente de rascunho. `await` de proposito:
    // no Cloud Run a CPU so fica alocada durante a request, entao dispare-e-
    // esqueca aqui perderia o upload em silencio.
    //
    // "SAIR do rascunho" e uma TRANSICAO, e ate agora o codigo olhava so o
    // destino: o formulario manda `status` em todo salvamento, entao editar uma
    // proposta ja aprovada reentregava o arquivo — e, quando o PDF nao estava
    // em cache, pagava um Chromium inteiro dentro da request do usuario. Agora
    // so entrega quando ha motivo: a proposta acabou de ficar entregavel, o
    // conteudo que vai NO PDF mudou, ou nunca houve entrega bem-sucedida.
    if (updateData.status !== undefined) {
      const nextStatus = String(updateData.status);
      const [podeEntregar, jaEraEntregavel] = await Promise.all([
        isStatusDeliverableToDrive(nextStatus, proposalTenantId),
        isStatusDeliverableToDrive(
          proposalData?.status as string | undefined,
          proposalTenantId,
        ),
      ]);

      const conteudoDoPdfMudou = Object.keys(safeUpdate).some(
        (field) => !PDF_IRRELEVANT_PROPOSAL_FIELDS.has(field),
      );
      const nuncaEntregue = !proposalData?.driveFileId;

      const deveEntregar =
        podeEntregar &&
        (!jaEraEntregavel || conteudoDoPdfMudou || nuncaEntregue);

      if (deveEntregar) {
        // Sem Drive conectado nao ha o que enfileirar: o cron descartaria o
        // job com `skipped: "sem_integracao"`, que e TERMINAL e nao retenta.
        // Em vez de criar um documento para ser jogado fora, respondemos o
        // convite para conectar, que e a unica acao que resolve.
        if (await timed("driveCheckMs", () => isDriveConnected(proposalTenantId))) {
          // Enfileira e responde. A entrega em si (Chromium + upload) roda no
          // cron `processDriveDeliveries`; ver `drive-delivery-queue.ts`.
          await timed("driveEnqueueMs", () =>
            enqueueDriveDelivery({ tenantId: proposalTenantId, proposalId: id }),
          );
          driveDeliveryQueued = true;
        } else {
          driveNotConnected = await shouldSuggestDriveConnection(
            proposalTenantId,
          );
        }
      }
    }

    logger.info("proposal_update_done", {
      tenantId: proposalTenantId,
      proposalId: id,
      totalMs: Date.now() - requestStartedAt,
      ...timings,
    });

    if (approvedSyncError) throw approvedSyncError;

    return res.json({
      success: true,
      message: "Proposta atualizada.",
      driveDeliveryQueued,
      driveNotConnected,
      // Projeto de instalação: criado agora (modo "sempre") ou a perguntar
      // se a venda tem instalação (modo padrão). A tela avisa ou pergunta.
      projectCreated: projectOutcome?.createdProjectId ?? null,
      projectSuggested: projectOutcome?.suggest ?? false,
      contractCreated,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};

export const deleteProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const { tenantId, isMaster, isSuperAdmin, masterRef } =
      await resolveUserAndTenant(userId, req.user);

    const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(id);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists)
      return res.status(404).json({ message: "Proposta não encontrada." });

    const proposalData = proposalSnap.data();
    if (!isSuperAdmin && proposalData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });
    const proposalTenantId = String(proposalData?.tenantId || tenantId).trim();

    if (!isMaster && !isSuperAdmin) {
      const canDelete = await checkPermission(userId, "proposals", "canDelete");
      if (!canDelete) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar propostas." });
      }
    }

    // Determine correct masterRef for usage decrement
    let targetMasterRef = masterRef;

    if (
      isSuperAdmin &&
      proposalData?.tenantId &&
      proposalData.tenantId !== tenantId
    ) {
      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", proposalData.tenantId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find((d) => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
        ownerDoc = ownerQuery.docs.find((d) =>
          ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role),
        );
        if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
      }

      if (ownerDoc) {
        targetMasterRef = db.collection("users").doc(ownerDoc.id);
      }
    }

    // Cleanup associated transactions (revenue) if they exist
    await cleanupProposalTransactions(id, proposalTenantId);

    const storagePathsToDelete = Array.from(
      new Set([
        ...collectAttachmentStoragePaths(
          proposalData?.attachments,
          proposalTenantId,
          id,
        ),
        ...collectProposalPdfStoragePaths(
          proposalData as Record<string, unknown> | undefined,
          proposalTenantId,
          id,
        ),
      ]),
    );

    await db.runTransaction(async (t) => {
      const pSnap = await t.get(proposalRef);
      if (!pSnap.exists) throw new Error("Proposta não encontrada.");

      const companyRef = db.collection("companies").doc(proposalTenantId);
      const companySnap = await t.get(companyRef);

      t.delete(proposalRef);
      t.update(targetMasterRef, {
        "usage.proposals": FieldValue.increment(-1),
      });

      if (companySnap.exists) {
        t.update(companyRef, { "usage.proposals": FieldValue.increment(-1) });
      }
    });

    if (storagePathsToDelete.length > 0) {
      await deleteStorageObjectsBestEffort(storagePathsToDelete, {
        reason: "proposal_delete_cleanup_failed",
        tenantId: proposalTenantId,
        proposalId: id,
      });
    }

    return res.json({ success: true, message: "Proposta excluída." });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Helper to remove transactions associated with a proposal.
 * Reverses balance if transaction was already paid.
 */
async function cleanupProposalTransactions(
  proposalId: string,
  tenantId: string,
) {
  try {
    const txRef = db.collection("transactions");
    const snapshot = await buildProposalTransactionsCleanupQuery(
      txRef,
      proposalId,
      tenantId,
    ).get();

    if (snapshot.empty) return;

    await db.runTransaction((t) =>
      applyProposalTransactionsCleanup(t, db, tenantId, snapshot.docs),
    );

    console.log(
      `Transactions cleaned up for reverted/deleted proposal ${proposalId}`,
    );
  } catch (error) {
    console.error(
      `Error cleaning up transactions for proposal ${proposalId}:`,
      error,
    );
  }
}

