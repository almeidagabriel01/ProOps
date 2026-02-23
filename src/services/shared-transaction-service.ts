"use client";

import { callApi, callPublicApi } from "@/lib/api-client";
import { ShareLinkResponse } from "@/types/shared-proposal";
import { Transaction } from "@/services/transaction-service";

export const SharedTransactionService = {
  /**
   * Gera um link compartilhável para um lançamento financeiro
   */
  generateShareLink: async (transactionId: string): Promise<ShareLinkResponse> => {
    try {
      const response = await callApi<ShareLinkResponse>(
        `/v1/transactions/${transactionId}/share-link`,
        "POST",
      );
      return response;
    } catch (error) {
      console.error("Error generating transaction share link:", error);
      throw error;
    }
  },

  /**
   * Busca um lançamento financeiro compartilhado via token público
   */
  getSharedTransaction: async (
    token: string,
  ): Promise<{ transaction: Transaction; relatedTransactions: Transaction[]; tenant: unknown }> => {
    try {
      const response = await callPublicApi<{
        success: boolean;
        transaction: Transaction;
        relatedTransactions: Transaction[];
        tenant: unknown;
      }>(`/v1/share/transaction/${token}`, "GET");
      
      return {
        transaction: response.transaction,
        relatedTransactions: response.relatedTransactions,
        tenant: response.tenant,
      };
    } catch (error) {
      console.error("Error getting shared transaction:", error);
      throw error;
    }
  },
};
