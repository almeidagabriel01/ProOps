"use client";

import { downloadPdfFromApiEndpoint } from "@/services/pdf/download-pdf-client";
import { buildReceiptPdfFilename } from "@/services/pdf/pdf-filename";

/**
 * Download autenticado do PDF de recibo de um lançamento.
 *
 * Usa o endpoint privado GET /v1/transactions/:id/pdf que exige Bearer token —
 * sem criar share links públicos de 30 dias apenas para baixar um arquivo.
 * Esse padrão é idêntico ao de propostas (downloadProposalPdfFromBackend).
 */
export async function downloadTransactionPdfFromBackend(
  transactionId: string,
  transactionDescription?: string,
): Promise<void> {
  await downloadPdfFromApiEndpoint({
    endpointPath: `/v1/transactions/${encodeURIComponent(transactionId)}/pdf`,
    fallbackFilename: buildReceiptPdfFilename(transactionDescription),
    requiresAuth: true,
  });
}
