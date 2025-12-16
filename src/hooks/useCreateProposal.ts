/**
 * Hook: useCreateProposal
 * 
 * React hook for creating proposals via Firebase Callable Function.
 * Uses Firebase Functions SDK directly for secure, serverless execution.
 * 
 * IMPORTANT: This calls a Cloud Function, NOT an API Route.
 * The Cloud Function handles all security validation.
 */

import { useState, useCallback } from "react";
import { getFunctions, httpsCallable, HttpsCallableResult } from "firebase/functions";
import { getApp } from "firebase/app";
import { toast } from "react-toastify";

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

interface CreateProposalData {
  title: string;
  clientId: string;
  clientName: string;
  sections?: ProposalSection[];
  totalValue: number;
  notes?: string;
}

interface CreateProposalResult {
  success: boolean;
  proposalId: string;
  message: string;
}

interface UseCreateProposalReturn {
  createProposal: (data: CreateProposalData) => Promise<CreateProposalResult | null>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// ERROR MESSAGES
// ============================================

const ERROR_MESSAGES: Record<string, string> = {
  'unauthenticated': 'Você precisa estar logado para criar propostas',
  'permission-denied': 'Você não tem permissão para criar propostas',
  'failed-precondition': 'Não foi possível criar a proposta. Verifique seu plano.',
  'invalid-argument': 'Dados inválidos. Verifique os campos e tente novamente.',
  'internal': 'Erro interno. Tente novamente em alguns instantes.',
};

// ============================================
// HOOK
// ============================================

export function useCreateProposal(): UseCreateProposalReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProposal = useCallback(async (data: CreateProposalData): Promise<CreateProposalResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get Firebase Functions instance
      // Using 'southamerica-east1' region - must match function deployment
      const app = getApp();
      const functions = getFunctions(app, 'southamerica-east1');
      
      // Create callable reference
      const createProposalFn = httpsCallable<CreateProposalData, CreateProposalResult>(
        functions, 
        'createProposal'
      );

      // Call the Cloud Function
      const result: HttpsCallableResult<CreateProposalResult> = await createProposalFn(data);

      // Success!
      toast.success(result.data.message || "Proposta criada com sucesso!");
      return result.data;

    } catch (err) {
      // Handle Firebase Functions errors
      const error = err as { code?: string; message?: string };
      
      // Extract error code (format: "functions/error-code")
      const errorCode = error.code?.replace('functions/', '') || 'internal';
      const errorMessage = ERROR_MESSAGES[errorCode] || error.message || "Erro desconhecido";
      
      setError(errorMessage);
      toast.error(errorMessage);
      return null;

    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createProposal,
    isLoading,
    error,
  };
}

// ============================================
// EXAMPLE USAGE
// ============================================

/*
import { useCreateProposal } from "@/hooks/useCreateProposal";

function ProposalForm() {
  const { createProposal, isLoading, error } = useCreateProposal();

  const handleSubmit = async (formData: FormData) => {
    const result = await createProposal({
      title: formData.get("title") as string,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      totalValue: calculateTotal(),
      sections: buildSections(),
    });

    if (result?.success) {
      // Navigate to proposal detail
      router.push(`/proposals/${result.proposalId}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Criando..." : "Criar Proposta"}
      </button>
    </form>
  );
}
*/
