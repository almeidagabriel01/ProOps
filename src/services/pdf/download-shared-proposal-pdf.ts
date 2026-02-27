"use client";

import { downloadPdfFromApiEndpoint } from "@/services/pdf/download-pdf-client";

export async function downloadSharedProposalPdf(
  token: string,
  proposalTitle?: string,
): Promise<void> {
  await downloadPdfFromApiEndpoint({
    endpointPath: `/v1/share/${encodeURIComponent(token)}/pdf`,
    fallbackTitle: proposalTitle,
    requiresAuth: false,
  });
}
