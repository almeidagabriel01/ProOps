import { db } from "../../init";
import { SharedTransactionService } from "./shared-transactions.service";
import { renderPageToPdfBuffer, resolveAppBaseUrl } from "./core-pdf.service";

type TransactionDocData = {
  tenantId?: unknown;
  description?: unknown;
};

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

async function generatePdfFromUrl(url: string): Promise<Buffer> {
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

/**
 * Gera o PDF de um lançamento de forma autenticada (usuário logado).
 * Cria um share link interno temporário (30 dias) apenas para a página de
 * renderização — sem expor ao público — e gera o PDF via Playwright.
 *
 * Esse fluxo é análogo ao de propostas (getOrGenerateProposalPdf), evitando
 * a mistura de "download privado" com "compartilhamento público".
 */
export async function generateAuthenticatedTransactionPdf(
  tenantId: string,
  transactionId: string,
): Promise<{ buffer: Buffer; transactionDescription: string }> {
  const transactionRef = db.collection("transactions").doc(transactionId);
  const transactionSnap = await transactionRef.get();

  if (!transactionSnap.exists) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  const transactionData = (transactionSnap.data() || {}) as TransactionDocData;
  const transactionTenantId = toStringValue(transactionData.tenantId);
  if (!transactionTenantId || transactionTenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  // Cria share link interno efêmero (usado apenas para renderização Playwright).
  // O link não é enviado ao usuário final e tem a mesma expiração dos links de
  // external_share (30 dias), mas pode ser revisado para menor no futuro.
  const shareResult = await SharedTransactionService.createShareLink(
    transactionId,
    tenantId,
    "system-pdf-generator",
  );

  const shareUrl = shareResult.shareUrl;
  const buffer = await generatePdfFromUrl(shareUrl);

  return {
    buffer,
    transactionDescription:
      toStringValue(transactionData.description) || transactionSnap.id,
  };
}

export async function generateSharedTransactionPdf(token: string): Promise<{
  buffer: Buffer;
  transactionDescription: string;
}> {
  const sharedTransaction = await SharedTransactionService.getSharedTransaction(token);
  if (!sharedTransaction) {
    throw new Error("SHARED_TRANSACTION_NOT_FOUND");
  }

  const transactionRef = db.collection("transactions").doc(sharedTransaction.transactionId);
  const transactionSnap = await transactionRef.get();
  if (!transactionSnap.exists) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  const transactionData = (transactionSnap.data() || {}) as TransactionDocData;
  const transactionTenantId = toStringValue(transactionData.tenantId);
  if (!transactionTenantId || transactionTenantId !== sharedTransaction.tenantId) {
    throw new Error("SHARED_TRANSACTION_NOT_FOUND");
  }

  const shareUrl = new URL(
    `/share/transaction/${encodeURIComponent(token)}`,
    resolveAppBaseUrl(),
  ).toString();
  const buffer = await generatePdfFromUrl(shareUrl);

  return {
    buffer,
    transactionDescription:
      toStringValue(transactionData.description) || transactionSnap.id,
  };
}
