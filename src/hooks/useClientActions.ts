/**
 * Hook: useClientActions
 * 
 * Securely manages client operations via Firebase Cloud Functions.
 * Replaces direct Firestore writes.
 */

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { toast } from "react-toastify";

// ============================================
// TYPES
// ============================================

export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  source?: 'manual' | 'proposal' | 'financial'; // default manual
}

interface CreateClientResult {
  success: boolean;
  clientId: string;
  message: string;
}

interface DeleteClientResult {
  success: boolean;
  message: string;
}

// ============================================
// HOOK
// ============================================

export function useClientActions() {
  const [isLoading, setIsLoading] = useState(false);

  const createClient = async (data: CreateClientData, options?: { suppressSuccessToast?: boolean }): Promise<CreateClientResult | null> => {
    setIsLoading(true);
    try {
      const createFn = httpsCallable<CreateClientData, CreateClientResult>(
        functions, 
        'createClient'
      );
      
      const result = await createFn({
        ...data,
        source: data.source || 'manual'
      });
      
      if (!options?.suppressSuccessToast) {
        toast.success("Cliente criado com sucesso!");
      }
      return result.data;
    } catch (error: unknown) {
      console.error("Error creating client:", error);
      const message = (error as { message?: string })?.message || "Erro ao criar cliente.";
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
      const deleteFn = httpsCallable<{ clientId: string }, DeleteClientResult>(
        functions,
        'deleteClient'
      );
      
      await deleteFn({ clientId });
      
      toast.success("Cliente removido com sucesso!");
      return true;
    } catch (error: unknown) {
      console.error("Error deleting client:", error);
      const message = (error as { message?: string })?.message || "Erro ao deletar cliente.";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createClient,
    deleteClient,
    isLoading
  };
}
