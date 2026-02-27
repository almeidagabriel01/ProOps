import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../init";
import { SharedTransactionService } from "./shared-transactions.service";
import { renderPageToPdfBuffer, resolveAppBaseUrl } from "./core-pdf.service";

// Incrementar esta constante quando o template de recibo mudar estruturalmente,
// forçando regeneração de todos os PDFs em cache.
const PDF_TEMPLATE_VERSION = "receipt-pdf-v1-playwright";

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type TransactionPdfMetadata = {
  storagePath?: string;
  versionHash?: string;
};

type TransactionDocData = {
  tenantId?: unknown;
  description?: unknown;
  pdf?: TransactionPdfMetadata;
  [key: string]: unknown;
};

type TenantDocData = {
  name?: unknown;
  logoUrl?: unknown;
  primaryColor?: unknown;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toSerializable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toSerializable);
  if (typeof value === "object") {
    if (
      "toDate" in (value as Record<string, unknown>) &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return null;
      }
    }
    const sorted = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v !== "undefined" && typeof v !== "function")
      .sort(([a], [b]) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const [k, v] of sorted) out[k] = toSerializable(v);
    return out;
  }
  return value;
}

function stableHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(toSerializable(payload)))
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Caching helpers
// ---------------------------------------------------------------------------

export function buildTransactionPdfStoragePath(
  tenantId: string,
  transactionId: string,
): string {
  return `tenants/${tenantId}/transactions/${transactionId}/pdf/receipt.pdf`;
}

function buildVersionHash(
  transactionId: string,
  transactionData: TransactionDocData,
  tenantData: TenantDocData,
): string {
  // Exclui o cache metadata para evitar ciclo de re-geração
  const { pdf: _pdfIgnored, ...transactionRelevant } = transactionData;
  void _pdfIgnored;

  return stableHash({
    templateVersion: PDF_TEMPLATE_VERSION,
    transactionId,
    transaction: transactionRelevant,
    tenant: {
      name: toStringValue(tenantData.name),
      logoUrl: toStringValue(tenantData.logoUrl),
      primaryColor: toStringValue(tenantData.primaryColor),
    },
  });
}

async function getCachedPdfIfValid(options: {
  metadata: TransactionPdfMetadata | undefined;
  expectedPath: string;
  expectedHash: string;
}): Promise<Buffer | null> {
  const { metadata, expectedPath, expectedHash } = options;
  if (
    typeof metadata?.storagePath !== "string" ||
    typeof metadata?.versionHash !== "string" ||
    metadata.storagePath !== expectedPath ||
    metadata.versionHash !== expectedHash
  ) {
    return null;
  }

  const file = getStorage().bucket().file(expectedPath);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [buffer] = await file.download();
  return buffer;
}

async function savePdfToStorage(options: {
  buffer: Buffer;
  storagePath: string;
  tenantId: string;
  transactionId: string;
  versionHash: string;
}): Promise<void> {
  const file = getStorage().bucket().file(options.storagePath);
  await file.save(options.buffer, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=3600",
      metadata: {
        tenantId: options.tenantId,
        transactionId: options.transactionId,
        versionHash: options.versionHash,
      },
    },
  });
}

async function updateTransactionPdfMetadata(
  transactionId: string,
  storagePath: string,
  versionHash: string,
): Promise<void> {
  await db
    .collection("transactions")
    .doc(transactionId)
    .set(
      {
        pdf: {
          storagePath,
          versionHash,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
}

// ---------------------------------------------------------------------------
// Core rendering
// ---------------------------------------------------------------------------

async function renderTransactionFromUrl(url: string): Promise<Buffer> {
  const appBaseUrl = resolveAppBaseUrl();
  try {
    return await renderPageToPdfBuffer({
      url: `${url}?print=1`,
      readySelector: '[data-pdf-transaction-ready="1"]',
      appOrigin: appBaseUrl,
      vercelBypassSecret: process.env.VERCEL_PROTECTION_BYPASS_SECRET || "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`TRANSACTION_${message}`);
  }
}

// ---------------------------------------------------------------------------
// Pipeline interno: busca cache → gera → salva
// ---------------------------------------------------------------------------

async function resolveTransactionPdf(options: {
  tenantId: string;
  transactionId: string;
  transactionData: TransactionDocData;
  tenantData: TenantDocData;
  /** URL completa da página de renderização (share link já resolvido) */
  renderUrl: string;
}): Promise<Buffer> {
  const { tenantId, transactionId, transactionData, tenantData, renderUrl } = options;

  const storagePath = buildTransactionPdfStoragePath(tenantId, transactionId);
  const versionHash = buildVersionHash(transactionId, transactionData, tenantData);

  // Tenta servir do cache
  const cached = await getCachedPdfIfValid({
    metadata: transactionData.pdf,
    expectedPath: storagePath,
    expectedHash: versionHash,
  });
  if (cached) return cached;

  // Cache miss → gera via Playwright
  const buffer = await renderTransactionFromUrl(renderUrl);

  // Persiste em background (sem bloquear a resposta ao cliente em caso de falha)
  Promise.all([
    savePdfToStorage({ buffer, storagePath, tenantId, transactionId, versionHash }),
    updateTransactionPdfMetadata(transactionId, storagePath, versionHash),
  ]).catch((err) => {
    console.warn(
      `[transaction-pdf] Falha ao persistir cache para transação ${transactionId}:`,
      err,
    );
  });

  return buffer;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Gera o PDF de um lançamento de forma autenticada (usuário logado).
 *
 * Cria um share link interno temporário apenas se houver cache miss,
 * evitando side-effects desnecessários quando o PDF já está em cache.
 */
export async function generateAuthenticatedTransactionPdf(
  tenantId: string,
  transactionId: string,
): Promise<{ buffer: Buffer; transactionDescription: string }> {
  const [transactionSnap, tenantSnap] = await Promise.all([
    db.collection("transactions").doc(transactionId).get(),
    db.collection("tenants").doc(tenantId).get(),
  ]);

  if (!transactionSnap.exists) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  const transactionData = (transactionSnap.data() || {}) as TransactionDocData;
  const transactionTenantId = toStringValue(transactionData.tenantId);
  if (!transactionTenantId || transactionTenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const tenantData = (tenantSnap.data() || {}) as TenantDocData;

  // Verifica cache antes de criar share link (evita side-effects desnecessários)
  const storagePath = buildTransactionPdfStoragePath(tenantId, transactionId);
  const versionHash = buildVersionHash(transactionId, transactionData, tenantData);
  const cached = await getCachedPdfIfValid({
    metadata: transactionData.pdf,
    expectedPath: storagePath,
    expectedHash: versionHash,
  });
  if (cached) {
    return {
      buffer: cached,
      transactionDescription:
        toStringValue(transactionData.description) || transactionSnap.id,
    };
  }

  // Cache miss: cria share link efêmero apenas para o Playwright
  const shareResult = await SharedTransactionService.createShareLink(
    transactionId,
    tenantId,
    "system-pdf-generator",
  );

  const buffer = await resolveTransactionPdf({
    tenantId,
    transactionId,
    transactionData,
    tenantData,
    renderUrl: shareResult.shareUrl,
  });

  return {
    buffer,
    transactionDescription:
      toStringValue(transactionData.description) || transactionSnap.id,
  };
}

/**
 * Gera o PDF de um lançamento via token público de compartilhamento.
 * Valida o token e usa o mesmo pipeline de cache do endpoint autenticado.
 */
export async function generateSharedTransactionPdf(token: string): Promise<{
  buffer: Buffer;
  transactionDescription: string;
}> {
  const sharedTransaction = await SharedTransactionService.getSharedTransaction(token);
  if (!sharedTransaction) {
    throw new Error("SHARED_TRANSACTION_NOT_FOUND");
  }

  const { transactionId, tenantId } = sharedTransaction;
  const [transactionSnap, tenantSnap] = await Promise.all([
    db.collection("transactions").doc(transactionId).get(),
    db.collection("tenants").doc(tenantId).get(),
  ]);

  if (!transactionSnap.exists) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  const transactionData = (transactionSnap.data() || {}) as TransactionDocData;
  const transactionTenantId = toStringValue(transactionData.tenantId);
  if (!transactionTenantId || transactionTenantId !== tenantId) {
    throw new Error("SHARED_TRANSACTION_NOT_FOUND");
  }

  const tenantData = (tenantSnap.data() || {}) as TenantDocData;

  // URL de renderização é o share link público (já existente)
  const renderUrl = new URL(
    `/share/transaction/${encodeURIComponent(token)}`,
    resolveAppBaseUrl(),
  ).toString();

  const buffer = await resolveTransactionPdf({
    tenantId,
    transactionId,
    transactionData,
    tenantData,
    renderUrl,
  });

  return {
    buffer,
    transactionDescription:
      toStringValue(transactionData.description) || transactionSnap.id,
  };
}
