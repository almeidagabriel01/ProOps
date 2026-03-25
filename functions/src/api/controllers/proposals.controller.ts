import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { resolveUserAndTenant, checkPermission } from "../../lib/auth-helpers";
import { resolveWalletRef } from "../../lib/finance-helpers";
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

const PROPOSALS_COLLECTION = "proposals";
const TENANT_USAGE_COLLECTION = "tenant_usage";
const MAX_ATTACHMENTS_PER_PROPOSAL = 20;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_NAME_LENGTH = 180;
const MAX_ATTACHMENT_URL_LENGTH = 15 * 1024 * 1024;
const MAX_PRODUCTS_PER_PROPOSAL = 500;

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

async function isStatusApproved(
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

function sanitizeProposalNumber(value: unknown, decimals = 2): number {
  const parsed = Number(
    typeof value === "string" ? value.replace(",", ".") : value,
  );
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** decimals;
  return Math.max(0, Math.round(parsed * factor) / factor);
}

function sanitizeProposalPricingDetails(
  rawValue: unknown,
): Record<string, unknown> {
  const source =
    rawValue && typeof rawValue === "object"
      ? (rawValue as Record<string, unknown>)
      : {};
  const mode = String(source.mode || "").trim().toLowerCase();

  if (mode === "curtain_meter") {
    const width = sanitizeProposalNumber(source.width, 4);
    const height = sanitizeProposalNumber(source.height, 4);
    return {
      mode: "curtain_meter",
      width,
      height,
      area: sanitizeProposalNumber(width * height, 4),
    };
  }

  if (mode === "curtain_height") {
    return {
      mode: "curtain_height",
      width: sanitizeProposalNumber(source.width, 4),
      tierId: String(source.tierId || "").trim().slice(0, 120),
      maxHeight: sanitizeProposalNumber(source.maxHeight, 4),
    };
  }

  if (mode === "curtain_width") {
    return {
      mode: "curtain_width",
      width: sanitizeProposalNumber(source.width, 4),
    };
  }

  return { mode: "standard" };
}

function sanitizeProposalProductsInput(rawValue: unknown): Record<string, unknown>[] {
  if (typeof rawValue === "undefined" || rawValue === null) {
    return [];
  }
  if (!Array.isArray(rawValue) || rawValue.length > MAX_PRODUCTS_PER_PROPOSAL) {
    throw new Error("INVALID_PRODUCTS");
  }

  return rawValue.map((rawProduct, index) => {
    const source =
      rawProduct && typeof rawProduct === "object"
        ? (rawProduct as Record<string, unknown>)
        : {};
    const itemType =
      String(source.itemType || "product").trim().toLowerCase() === "service"
        ? "service"
        : "product";
    const status =
      String(source.status || "active").trim().toLowerCase() === "inactive"
        ? "inactive"
        : "active";

    return {
      lineItemId: String(source.lineItemId || `proposal-item-${index + 1}`)
        .trim()
        .slice(0, 160),
      productId: String(source.productId || "").trim().slice(0, 160),
      itemType,
      productName: String(source.productName || "").trim().slice(0, 300),
      productImage: String(source.productImage || "").trim().slice(0, 4096),
      productImages: Array.isArray(source.productImages)
        ? source.productImages
            .filter((image): image is string => typeof image === "string")
            .map((image) => image.trim().slice(0, 4096))
            .filter(Boolean)
            .slice(0, 12)
        : [],
      productDescription: String(source.productDescription || "")
        .trim()
        .slice(0, 4000),
      quantity: sanitizeProposalNumber(source.quantity, 4),
      unitPrice: sanitizeProposalNumber(source.unitPrice, 4),
      markup: itemType === "service" ? 0 : sanitizeProposalNumber(source.markup, 4),
      total: sanitizeProposalNumber(source.total, 4),
      manufacturer: String(source.manufacturer || "").trim().slice(0, 160),
      category: String(source.category || "").trim().slice(0, 160),
      systemInstanceId: String(source.systemInstanceId || "")
        .trim()
        .slice(0, 200),
      ambienteInstanceId: String(source.ambienteInstanceId || "")
        .trim()
        .slice(0, 200),
      isExtra: Boolean(source.isExtra),
      status,
      pricingDetails:
        itemType === "service"
          ? { mode: "standard" }
          : sanitizeProposalPricingDetails(source.pricingDetails),
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

type ProposalLinkedTransactionDraft = {
  tenantId: string;
  type: "income";
  description: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  clientId: string | null;
  clientName: string | null;
  proposalId: string;
  proposalGroupId: string | null;
  category: null;
  wallet: string | null;
  isDownPayment: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  isInstallment: boolean;
  installmentCount: number | null;
  installmentNumber: number | null;
  installmentGroupId: string | null;
  notes: string;
  createdById: string;
};

function normalizeProposalTransactionTitle(value: unknown): string {
  return String(value || "").trim() || "Proposta";
}

function buildProposalGroupId(proposalId: string): string {
  return `proposal_${proposalId}`;
}

function buildProposalInstallmentGroupId(proposalId: string): string {
  return `proposal_installments_${proposalId}`;
}

async function resolveDefaultWalletNameForTenant(
  tenantId: string,
): Promise<string | null> {
  const walletsQuery = await db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("isDefault", "==", true)
    .limit(1)
    .get();

  if (!walletsQuery.empty) {
    return walletsQuery.docs[0].data().name || null;
  }

  const anyWallet = await db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!anyWallet.empty) {
    return anyWallet.docs[0].data().name || null;
  }

  return null;
}

function buildApprovedProposalTransactionDrafts(params: {
  proposalId: string;
  proposalData: Record<string, unknown>;
  userId: string;
  defaultWalletName: string | null;
  initialStatus?: "paid" | "pending" | "overdue";
}): ProposalLinkedTransactionDraft[] {
  const { proposalId, proposalData, userId, defaultWalletName } = params;
  const initialStatus = params.initialStatus || "pending";
  const title = normalizeProposalTransactionTitle(proposalData.title);
  const tenantId = String(proposalData.tenantId || "").trim();
  const clientId = proposalData.clientId ? String(proposalData.clientId) : null;
  const clientName = proposalData.clientName
    ? String(proposalData.clientName)
    : null;
  const downPaymentEnabled =
    !!proposalData.downPaymentEnabled &&
    Number(proposalData.downPaymentValue || 0) > 0;
  const installmentsEnabled =
    !!proposalData.installmentsEnabled &&
    Number(proposalData.installmentsCount || 0) > 0 &&
    Number(proposalData.installmentValue || 0) > 0;
  const useProposalGrouping = downPaymentEnabled && installmentsEnabled;
  const proposalGroupId = useProposalGrouping
    ? buildProposalGroupId(proposalId)
    : null;
  const installmentGroupId = installmentsEnabled
    ? buildProposalInstallmentGroupId(proposalId)
    : null;
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const drafts: ProposalLinkedTransactionDraft[] = [];

  if (downPaymentEnabled) {
    drafts.push({
      tenantId,
      type: "income",
      description: title,
      amount: Number(proposalData.downPaymentValue || 0),
      date: String(proposalData.downPaymentDueDate || todayStr),
      dueDate: String(proposalData.downPaymentDueDate || todayStr),
      status: initialStatus,
      clientId,
      clientName,
      proposalId,
      proposalGroupId,
      category: null,
      wallet: proposalData.downPaymentWallet
        ? String(proposalData.downPaymentWallet)
        : defaultWalletName,
      isDownPayment: true,
      downPaymentType:
        String(proposalData.downPaymentType || "value") === "percentage"
          ? "percentage"
          : "value",
      downPaymentPercentage: Number(proposalData.downPaymentPercentage || 0),
      isInstallment: false,
      installmentCount: null,
      installmentNumber: null,
      installmentGroupId: null,
      notes: "Entrada gerada automaticamente pela proposta",
      createdById: userId,
    });
  }

  if (installmentsEnabled) {
    const walletName = proposalData.installmentsWallet
      ? String(proposalData.installmentsWallet)
      : defaultWalletName;
    const installmentsCount = Math.max(
      0,
      Number(proposalData.installmentsCount || 0),
    );
    let firstInstDate: Date;

    if (proposalData.firstInstallmentDate) {
      firstInstDate = new Date(
        String(proposalData.firstInstallmentDate) + "T12:00:00",
      );
    } else {
      firstInstDate = new Date(today);
      firstInstDate.setDate(firstInstDate.getDate() + 30);
    }

    for (let i = 0; i < installmentsCount; i++) {
      const installmentDate = new Date(firstInstDate);
      installmentDate.setMonth(firstInstDate.getMonth() + i);
      const dueDate = installmentDate.toISOString().split("T")[0];

      drafts.push({
        tenantId,
        type: "income",
        description: title,
        amount: Number(proposalData.installmentValue || 0),
        date: dueDate,
        dueDate,
        status: initialStatus,
        clientId,
        clientName,
        proposalId,
        proposalGroupId,
        category: null,
        wallet: walletName,
        isDownPayment: false,
        isInstallment: true,
        installmentCount: installmentsCount,
        installmentNumber: i + 1,
        installmentGroupId,
        notes: `Parcela ${i + 1}/${installmentsCount} gerada automaticamente`,
        createdById: userId,
      });
    }
  }

  const effectiveTotalValue = Number(proposalData.closedValue) > 0 
    ? Number(proposalData.closedValue) 
    : Number(proposalData.totalValue || 0);

  if (
    !downPaymentEnabled &&
    !installmentsEnabled &&
    effectiveTotalValue > 0
  ) {
    let dueDate = proposalData.validUntil
      ? String(proposalData.validUntil)
      : "";
    if (!dueDate) {
      const fallbackDate = new Date(today);
      fallbackDate.setDate(fallbackDate.getDate() + 30);
      dueDate = fallbackDate.toISOString().split("T")[0];
    }

    drafts.push({
      tenantId,
      type: "income",
      description: title,
      amount: effectiveTotalValue,
      date: todayStr,
      dueDate,
      status: initialStatus,
      clientId,
      clientName,
      proposalId,
      proposalGroupId: null,
      category: null,
      wallet: defaultWalletName,
      isDownPayment: false,
      isInstallment: false,
      installmentCount: null,
      installmentNumber: null,
      installmentGroupId: null,
      notes: "Receita gerada automaticamente pela aprovação da proposta",
      createdById: userId,
    });
  }

  return drafts;
}

function getProposalLinkedTransactionKey(
  transaction: Record<string, unknown>,
): string | null {
  if (transaction.isPartialPayment || transaction.parentTransactionId) {
    return null;
  }
  if (transaction.isDownPayment) return "down_payment";
  if (transaction.isInstallment) {
    return `installment_${Number(transaction.installmentNumber || 0)}`;
  }
  return "single";
}

async function syncApprovedProposalTransactions(params: {
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
  const desiredDrafts = buildApprovedProposalTransactionDrafts({
    proposalId,
    proposalData,
    userId,
    defaultWalletName,
    initialStatus,
  });
  const desiredByKey = new Map(
    desiredDrafts.map((draft) => [
      draft.isDownPayment
        ? "down_payment"
        : draft.isInstallment
          ? `installment_${draft.installmentNumber || 0}`
          : "single",
      draft,
    ]),
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

    batch.delete(doc.ref);
  }

  desiredByKey.forEach((draft, key) => {
    const existingDoc = existingByKey.get(key);
    if (!existingDoc) {
      const status =
        initialStatus ||
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

    if (
      existingData.status === "paid" &&
      existingData.type === "income" &&
      (previousAmount !== nextAmount || previousWallet !== nextWallet)
    ) {
      registerAdjustment(previousWallet, -previousAmount);
      registerAdjustment(nextWallet, nextAmount);
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
}

export const createProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = req.body;
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

    let proposalId: string;
    let createdProposal: { id: string; data: Record<string, unknown> };
    try {
      createdProposal = await db.runTransaction(async (t) => {
        // === ALL READS FIRST ===
        await t.get(masterRef);

        const companyRef = db.collection("companies").doc(userCompanyId);
        const companySnap = await t.get(companyRef);
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

        t.set(newRef, {
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
          // PDF display settings (which elements to show/hide in PDF)
          pdfSettings: input.pdfSettings || null,
          // Attachments
          attachments: sanitizedAttachments,
          createdById: userId,
          createdByName: userData?.name || "Usuário",
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
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;
    console.log("[updateProposal] request received", {
      userId,
      proposalId: id,
      updatedFields: Object.keys(updateData || {}),
    });

    if (!id) return res.status(400).json({ message: "ID inválido." });

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
      // Attachments
      "attachments",
    ];

    fields.forEach((f) => {
      if (typeof updateData[f] === "undefined") return;
      if (f === "attachments") {
        safeUpdate[f] = sanitizedAttachments || [];
        return;
      }
      if (f === "products") {
        safeUpdate[f] = sanitizedProducts || [];
        return;
      }
      safeUpdate[f] = updateData[f];
    });

    if (updateData.products) {
      const subtotal = (sanitizedProducts || []).reduce<number>(
        (sum: number, p: Record<string, unknown>) => sum + ((p.total as number) || 0),
        0,
      );
      const discountAmount =
        (subtotal * (Number(updateData.discount) || Number(proposalData?.discount) || 0)) / 100;
      const extraExpense =
        updateData.extraExpense !== undefined
          ? Number(updateData.extraExpense)
          : Number(proposalData?.extraExpense) || 0;
      safeUpdate.totalValue = subtotal - discountAmount + extraExpense;
    }

    await proposalRef.update(safeUpdate);

    if (removedAttachmentPaths.length > 0) {
      await deleteStorageObjectsBestEffort(removedAttachmentPaths, {
        reason: "proposal_update_attachment_cleanup_failed",
        tenantId: proposalTenantId,
        proposalId: id,
      });
    }

    // Criar receita automaticamente quando a proposta for aprovada
    const isCurrentlyApproved = await isStatusApproved(
      proposalData?.status as string | undefined,
      proposalTenantId,
    );
    const willBeApproved =
      updateData.status !== undefined
        ? await isStatusApproved(updateData.status as string, proposalTenantId)
        : isCurrentlyApproved;

    const isBeingApproved = willBeApproved && !isCurrentlyApproved;

    // Remover receita se sair de aprovada (Rascunho/Enviada)
    const isBeingReverted =
      isCurrentlyApproved && updateData.status !== undefined && !willBeApproved;

    const isAlreadyApproved =
      isCurrentlyApproved &&
      (updateData.status === undefined || willBeApproved);
    const approvedSyncFields = new Set([
      "title",
      "clientId",
      "clientName",
      "totalValue",
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
    ]);
    const shouldSyncApprovedTransactions =
      (isAlreadyApproved || isBeingApproved) &&
      Object.keys(updateData || {}).some((field) =>
        approvedSyncFields.has(field),
      );
    const structuralApprovedSyncFields = new Set([
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
    ]);
    const approvedSyncIsMetadataOnly =
      shouldSyncApprovedTransactions &&
      !Object.keys(updateData || {}).some((field) =>
        structuralApprovedSyncFields.has(field),
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
              category: null,
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

    if (shouldSyncApprovedTransactions) {
      await syncApprovedProposalTransactions({
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
      });
    }

    return res.json({ success: true, message: "Proposta atualizada." });
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
    const snapshot = await txRef.where("proposalId", "==", proposalId).get();

    if (snapshot.empty) return;

    await db.runTransaction(async (t) => {
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // 1. Reverse balance if paid
        if (data.status === "paid" && data.wallet && data.amount) {
          const isIncome = data.type === "income";
          const sign = isIncome ? 1 : -1;
          const offset = data.amount * sign;

          // To reverse, we subtract the offset: balance -= offset
          // But using increment: increment(-offset)
          const reverseAmount = -offset;

          const w = await resolveWalletRef(t, db, tenantId, data.wallet);
          if (w) {
            t.update(w.ref, {
              balance: FieldValue.increment(reverseAmount),
              updatedAt: Timestamp.now(),
            });
          }
        }

        // 2. Delete transaction
        t.delete(doc.ref);
      }
    });

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

