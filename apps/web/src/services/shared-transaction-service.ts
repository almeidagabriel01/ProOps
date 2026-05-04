"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import { ShareLinkResponse } from "@/types/shared-proposal";
import { Transaction } from "@/services/transaction-service";

interface ShareLinkInfoResponse {
  exists: boolean;
  shareUrl?: string;
  token?: string;
  expireDays?: number | null;
  expiresAt?: string | null;
}

export const SharedTransactionService = {
  /**
   * Gera um link compartilhável para um lançamento financeiro
   */
  generateShareLink: async (
    transactionId: string,
    expireDays: number | null,
  ): Promise<ShareLinkResponse> => {
    try {
      const response = await callApi<ShareLinkResponse>(
        `/v1/transactions/${transactionId}/share-link`,
        "POST",
        { expireDays },
      );
      return response;
    } catch (error) {
      console.error("Error generating transaction share link:", error);
      throw error;
    }
  },

  /**
   * Busca informações do link compartilhável existente de um lançamento
   */
  getShareLinkInfo: async (
    transactionId: string,
  ): Promise<ShareLinkInfoResponse> => {
    try {
      const response = await callApi<ShareLinkInfoResponse>(
        `/v1/transactions/${transactionId}/share-link`,
        "GET",
      );
      return response;
    } catch (error) {
      console.error("Error getting transaction share link info:", error);
      throw error;
    }
  },

  /**
   * Busca um lançamento financeiro compartilhado via token público
   */
  getSharedTransaction: async (
    token: string,
  ): Promise<{ transaction: Transaction; relatedTransactions: Transaction[]; tenant: unknown; client: { name: string | null; hasDocument: boolean } }> => {
    try {
      const response = await callPublicApi<{
        success: boolean;
        transaction: Transaction;
        relatedTransactions: Transaction[];
        tenant: unknown;
        client: { name: string | null; hasDocument: boolean };
      }>(`/v1/share/transaction/${token}`, "GET");

      return {
        transaction: response.transaction,
        relatedTransactions: response.relatedTransactions,
        tenant: response.tenant,
        client: response.client ?? { name: null, hasDocument: false },
      };
    } catch (error) {
      console.error("Error getting shared transaction:", error);
      throw error;
    }
  },
};
