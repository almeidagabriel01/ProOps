"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import { ShareLinkResponse } from "@/types/shared-proposal";
import { Proposal } from "@/types/proposal";

export const SharedProposalService = {
  /**
   * Gera um link compartilhável para uma proposta
   */
  generateShareLink: async (proposalId: string): Promise<ShareLinkResponse> => {
    try {
      const response = await callApi<ShareLinkResponse>(
        `/v1/proposals/${proposalId}/share-link`,
        "POST",
      );
      return response;
    } catch (error) {
      console.error("Error generating share link:", error);
      throw error;
    }
  },

  /**
   * Busca uma proposta compartilhada via token público
   */
  getSharedProposal: async (
    token: string,
  ): Promise<{ proposal: Proposal; tenant: unknown }> => {
    try {
      const response = await callPublicApi<{
        success: boolean;
        proposal: Proposal;
        tenant: unknown;
      }>(`/v1/share/${token}`, "GET");
      return {
        proposal: response.proposal,
        tenant: response.tenant,
      };
    } catch (error) {
      console.error("Error getting shared proposal:", error);
      throw error;
    }
  },
};
