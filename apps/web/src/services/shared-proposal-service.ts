"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import { ShareLinkResponse } from "@/types/shared-proposal";
import { Proposal } from "@/types/proposal";

/** Um pedido de mudanças como o cliente o vê no link. */
export interface SharedChangeRequest {
  name: string | null;
  message: string;
  requestedAt: string;
  /** "open": a empresa está revisando. */
  status: "open" | "resolved";
  resolvedAt: string | null;
}

/** Estado do aceite online devolvido pelo link público. */
export interface OnlineApprovalState {
  canApprove: boolean;
  approved: boolean;
  expired: boolean;
  /** O cliente já aceitou e a empresa ainda não confirmou a aprovação. */
  awaitingConfirmation: boolean;
  acceptance: { name: string; acceptedAt: string } | null;
  /** O botão "Solicitar mudanças" aparece. */
  canRequestChanges: boolean;
  /** Pedido de mudanças ainda aberto: a empresa está revisando. */
  changeRequest: { requestedAt: string } | null;
  /**
   * Todos os pedidos de mudanças, do mais novo para o mais antigo. Ausente
   * quando o backend ainda não o devolve.
   */
  changeRequests?: SharedChangeRequest[];
  /** Aprovada e com algo a pagar online ("Pagar entrada" ou "Pagar parcela"). */
  payment: { label: string } | null;
}

export interface RequestChangesInput {
  name?: string;
  message: string;
}

export interface ApproveSharedProposalInput {
  name: string;
  document: string;
  accepted: true;
}

export interface ApproveSharedProposalResult {
  acceptedAt: string;
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

  /** Registra o aceite do cliente. A empresa confirma a aprovação no ERP. */
  accept: async (
    token: string,
    input: ApproveSharedProposalInput,
  ): Promise<ApproveSharedProposalResult> =>
    callPublicApi<ApproveSharedProposalResult>(
      `/v1/share/${token}/accept`,
      "POST",
      input,
    ),

  /** O cliente aponta o que precisa mudar (justificativa obrigatória). */
  requestChanges: async (
    token: string,
    input: RequestChangesInput,
  ): Promise<{ requestedAt: string }> =>
    callPublicApi<{ requestedAt: string }>(
      `/v1/share/${token}/request-changes`,
      "POST",
      input,
    ),

  /** Link de pagamento da entrada (ou da próxima parcela) da proposta aprovada. */
  paymentLink: async (token: string): Promise<{ url: string }> =>
    callPublicApi<{ url: string }>(`/v1/share/${token}/payment-link`, "POST", {}),
};
