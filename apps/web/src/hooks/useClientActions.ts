/**
 * Hook: useClientActions
 *
 * Securely manages client operations via Firebase Cloud Functions.
 * Replaces direct Firestore writes.
 */

import { useState } from "react";
import { toast } from '@/lib/toast';
import { callApi } from "@/lib/api-client";
import type { ClientType } from "@/services/client-service";
import { describeContactTypes } from "@/lib/contacts/commission-partner";

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
  types?: ClientType[]; // Array to allow both
  /** Comissao padrao do parceiro; `null` = nao informada. */
  commissionPercentage?: number | null;
  /**
   * Endereco fiscal do destinatario, exigido so pela NF-e. Separado do
   * `address` livre porque a SEFAZ valida logradouro, numero, bairro, UF e o
   * codigo IBGE do municipio, que uma string unica nao entrega.
   */
  enderecoFiscal?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    codigoIbge?: string;
    uf?: string;
    cep?: string;
  };
  inscricaoEstadual?: string;
  /** Ausente = derivado do documento pelo backend (CPF nunca e "isento"). */
  indicadorIe?: "contribuinte" | "isento" | "nao_contribuinte";
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
        // Diz o QUE foi cadastrado. "Cliente criado" era literalmente falso
        // para quem acabou de cadastrar um arquiteto.
        toast.success(
          `Contato cadastrado como ${describeContactTypes(data.types || ["cliente"]).toLowerCase()}.`,
        );
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

      toast.success("Contato removido com sucesso!");
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
