/**
 * Hook: useCreateProposal
 *
 * React hook for creating proposals via REST API.
 * Uses the unified API client for secure, authenticated requests.
 */

import { useState, useCallback } from "react";
import { toast } from '@/lib/toast';
import { callApi } from "@/lib/api-client";

// ============================================
// TYPES
// ============================================

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
}

interface ProposalProduct {
  productId: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  manufacturer?: string;
  category?: string;
  systemInstanceId?: string;
  isExtra?: boolean;
}

interface ProposalAmbiente {
  ambienteId: string;
  ambienteName: string;
  description?: string;
  productIds: string[];
}

interface ProposalSistema {
  sistemaId: string;
  sistemaName: string;
  description?: string;
  ambientes?: ProposalAmbiente[];
  // Legacy
  ambienteId?: string;
  ambienteName?: string;
  productIds?: string[];
}

interface CreateProposalData {
  title: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  status?: string;
  sections?: ProposalSection[];
  products?: ProposalProduct[];
  sistemas?: ProposalSistema[];
  totalValue: number;
  discount?: number;
  notes?: string;
  customNotes?: string;
  targetTenantId?: string; // For super admin to create as specific tenant
}

interface CreateProposalResult {
  success: boolean;
  proposalId: string;
  message: string;
}

interface UseCreateProposalReturn {
  createProposal: (
    data: CreateProposalData
  ) => Promise<CreateProposalResult | null>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// HOOK
// ============================================

export function useCreateProposal(): UseCreateProposalReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProposal = useCallback(
    async (data: CreateProposalData): Promise<CreateProposalResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await callApi<CreateProposalResult>(
          "/v1/proposals",
          "POST",
          data
        );

        toast.success(result.message || "Proposta criada com sucesso!");
        return result;
      } catch (err) {
        console.error("Error creating proposal:", err);

        const errorMessage =
          err instanceof Error ? err.message : "Erro ao criar proposta";

        setError(errorMessage);
        toast.error(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    createProposal,
    isLoading,
    error,
  };
}
