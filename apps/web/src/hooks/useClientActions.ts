/**
 * Hook: useClientActions
 *
 * Securely manages client operations via Firebase Cloud Functions.
 * Replaces direct Firestore writes.
 */

import { useState } from "react";
import { toast } from '@/lib/toast';
import { callApi } from "@/lib/api-client";

// ============================================
// TYPES
// ============================================

export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  document?: string; // CPF (11 digits) or CNPJ (14 digits), stored without mask
  types?: ("cliente" | "fornecedor")[]; // Array to allow both
  source?: "manual" | "proposal" | "financial"; // default manual
  targetTenantId?: string; // For super admin to create for a specific tenant
}

interface CreateClientResult {
  success: boolean;
  clientId: string;
  message: string;
}

// ============================================
// HOOK
// ============================================

export function useClientActions() {
  const [isLoading, setIsLoading] = useState(false);

  const createClient = async (
    data: CreateClientData,
    options?: { suppressSuccessToast?: boolean },
  ): Promise<CreateClientResult | null> => {
    setIsLoading(true);
    try {
      const result = await callApi<CreateClientResult>("v1/clients", "POST", {
        ...data,
        types: data.types || ["cliente"],
        source: data.source || "manual",
      });

      if (!options?.suppressSuccessToast) {
        toast.success("Cliente criado com sucesso!");
      }
      return result;
    } catch (error: unknown) {
      console.error("Error creating client:", error);
      const message =
        (error as { message?: string })?.message || "Erro ao criar cliente.";
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteClient = async (clientId: string): Promise<boolean> => {
    if (!clientId) return false;

    setIsLoading(true);
    try {
      await callApi<{ success: boolean; message: string }>(
        `v1/clients/${clientId}`,
        "DELETE",
      );

      toast.success("Cliente removido com sucesso!");
      return true;
    } catch (error: unknown) {
      console.error("Error deleting client:", error);
      const message =
        (error as { message?: string })?.message || "Erro ao deletar cliente.";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createClient,
    deleteClient,
    isLoading,
  };
}
