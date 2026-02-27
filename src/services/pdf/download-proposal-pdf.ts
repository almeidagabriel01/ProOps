"use client";

import { downloadPdfFromApiEndpoint } from "@/services/pdf/download-pdf-client";

export async function downloadProposalPdfFromBackend(
  proposalId: string,
  proposalTitle?: string,
): Promise<void> {
  await downloadPdfFromApiEndpoint({
    endpointPath: `/v1/proposals/${proposalId}/pdf`,
    fallbackTitle: proposalTitle,
    requiresAuth: true,
  });
}
