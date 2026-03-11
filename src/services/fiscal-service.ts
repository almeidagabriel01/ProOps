"use client";

import { callApi } from "@/lib/api-client";
import {
  FiscalConfigReadiness,
  FiscalDocument,
  TenantFiscalConfig,
} from "@/types/fiscal";

export const FiscalService = {
  getConfig: async (): Promise<{
    config: TenantFiscalConfig | null;
    readiness: FiscalConfigReadiness;
  }> => {
    const response = await callApi<{
      success: boolean;
      config: TenantFiscalConfig | null;
      readiness: FiscalConfigReadiness;
    }>("/v1/fiscal/config");

    return {
      config: response.config,
      readiness: response.readiness,
    };
  },

  saveConfig: async (
    payload: Partial<TenantFiscalConfig>,
  ): Promise<{
    config: TenantFiscalConfig | null;
    readiness: FiscalConfigReadiness;
  }> => {
    const response = await callApi<{
      success: boolean;
      config: TenantFiscalConfig | null;
      readiness: FiscalConfigReadiness;
    }>("/v1/fiscal/config", "PUT", payload);

    return {
      config: response.config,
      readiness: response.readiness,
    };
  },

  getProposalFiscalDocument: async (
    proposalId: string,
  ): Promise<FiscalDocument | null> => {
    const response = await callApi<{
      success: boolean;
      document: FiscalDocument | null;
    }>(`/v1/proposals/${proposalId}/fiscal-document`);

    return response.document;
  },

  retryProposalFiscalDocument: async (
    proposalId: string,
  ): Promise<FiscalDocument> => {
    const response = await callApi<{
      success: boolean;
      document: FiscalDocument;
    }>(`/v1/proposals/${proposalId}/fiscal-document/retry`, "POST");

    return response.document;
  },

  cancelProposalFiscalDocument: async (
    proposalId: string,
  ): Promise<FiscalDocument> => {
    const response = await callApi<{
      success: boolean;
      document: FiscalDocument;
    }>(`/v1/proposals/${proposalId}/fiscal-document/cancel`, "POST");

    return response.document;
  },
};
