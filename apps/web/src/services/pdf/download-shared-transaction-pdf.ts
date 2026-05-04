"use client";

import { downloadPdfFromApiEndpoint } from "@/services/pdf/download-pdf-client";
import { buildReceiptPdfFilename } from "@/services/pdf/pdf-filename";

export async function downloadSharedTransactionPdf(
  token: string,
  transactionDescription?: string,
): Promise<void> {
  await downloadPdfFromApiEndpoint({
    endpointPath: `/v1/share/transaction/${encodeURIComponent(token)}/pdf`,
    fallbackFilename: buildReceiptPdfFilename(transactionDescription),
    requiresAuth: false,
  });
}
