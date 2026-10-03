"use client";

import { downloadPdfFromApiEndpoint } from "@/services/pdf/download-pdf-client";

/** Download autenticado do PDF da OS (GET /v1/service-orders/:id/pdf). */
export async function downloadServiceOrderPdf(orderId: string, code: string): Promise<void> {
  await downloadPdfFromApiEndpoint({
    endpointPath: `/v1/service-orders/${encodeURIComponent(orderId)}/pdf`,
    fallbackFilename: `${code || "OS"}.pdf`,
    requiresAuth: true,
  });
}
