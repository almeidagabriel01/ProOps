import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
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
        const deleteFn = httpsCallable<{ memberId: string }, ActionResult>(
            functions, 
            'deleteMember'
        );
        
        await deleteFn({ memberId });
        
        toast.success("Membro removido com sucesso.");
        return true;
    } catch (error: any) {
        console.error("Error deleting member:", error);
        toast.error(error.message || "Erro ao remover membro.");
        return false;
    } finally {
        setIsLoading(false);
    }
  };

  const updateMember = async (data: UpdateMemberData): Promise<boolean> => {
    if (!data.memberId) return false;

    setIsLoading(true);
    try {
        const updateFn = httpsCallable<UpdateMemberData, ActionResult>(
            functions,
            'updateMember'
        );

        await updateFn(data);
        
        toast.success("Membro atualizado com sucesso.");
        return true;
    } catch (error: any) {
        console.error("Error updating member:", error);
        toast.error(error.message || "Erro ao atualizar membro.");
        return false;
    } finally {
        setIsLoading(false);
    }
  };

  return {
    deleteMember,
    updateMember,
    isLoading
  };
}
