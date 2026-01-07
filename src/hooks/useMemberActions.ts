import { useState } from "react";
import { callApi } from "@/lib/api-client";
import { toast } from "react-toastify";

// ============================================
// TYPES
// ============================================

interface UpdateMemberData {
  memberId: string;
  name?: string;
  email?: string;
  password?: string;
}

interface ActionResult {
  success: boolean;
  message: string;
}

// ============================================
// HOOK
// ============================================

export function useMemberActions() {
  const [isLoading, setIsLoading] = useState(false);

  const deleteMember = async (memberId: string): Promise<boolean> => {
    if (!memberId) return false;

    setIsLoading(true);
    try {
      await callApi(`v1/admin/members/${memberId}`, "DELETE");

      toast.success("Membro removido com sucesso.");
      return true;
    } catch (error: unknown) {
      console.error("Error deleting member:", error);
      const message = error instanceof Error ? error.message : "Erro ao remover membro.";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateMember = async (data: UpdateMemberData): Promise<boolean> => {
    if (!data.memberId) return false;

    setIsLoading(true);
    try {
      const { memberId, ...updateData } = data;
      await callApi(`v1/admin/members/${memberId}`, "PUT", updateData);

      toast.success("Membro atualizado com sucesso.");
      return true;
    } catch (error: unknown) {
      console.error("Error updating member:", error);
      const message = error instanceof Error ? error.message : "Erro ao atualizar membro.";
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    deleteMember,
    updateMember,
    isLoading,
  };
}
