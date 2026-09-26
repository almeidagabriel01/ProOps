"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import { ShareLinkResponse } from "@/types/shared-proposal";
import { Proposal } from "@/types/proposal";

/** Estado da aprovação online devolvido pelo link público. */
export interface OnlineApprovalState {
  canApprove: boolean;
  approved: boolean;
  expired: boolean;
  acceptance: { name: string; acceptedAt: string } | null;
}

export interface ApproveSharedProposalInput {
  name: string;
  document: string;
  accepted: true;
}

export interface ApproveSharedProposalResult {
  acceptedAt: string;
  /** Link para pagar o sinal, quando a empresa recebe online. */
  paymentUrl: string | null;
}

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
  ): Promise<{
    proposal: Proposal;
    tenant: unknown;
    onlineApproval: OnlineApprovalState | null;
  }> => {
    try {
      const response = await callPublicApi<{
        success: boolean;
        proposal: Proposal;
        tenant: unknown;
        onlineApproval?: OnlineApprovalState | null;
      }>(`/v1/share/${token}`, "GET");
      return {
        proposal: response.proposal,
        tenant: response.tenant,
        onlineApproval: response.onlineApproval ?? null,
      };
    } catch (error) {
      console.error("Error getting shared proposal:", error);
      throw error;
    }
  },

  /** O cliente final aprova a proposta pelo link (nome, documento e aceite). */
  approve: async (
    token: string,
    input: ApproveSharedProposalInput,
  ): Promise<ApproveSharedProposalResult> =>
    callPublicApi<ApproveSharedProposalResult>(
      `/v1/share/${token}/approve`,
      "POST",
      input,
    ),
};
