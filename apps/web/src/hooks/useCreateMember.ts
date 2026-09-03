/**
 * Hook: useCreateMember
 *
 * React hook for creating MEMBER users linked to the current MASTER.
 *
 * IMPORTANT: Uses Firebase Callable Cloud Functions DIRECTLY.
 * Does NOT use Next.js API Routes - those don't have Firebase Auth context.
 *
 * The Cloud Function 'createMember' validates:
 * - User is authenticated
 * - User has MASTER role
 * - Plan limits allow creating more users
 * - All data is valid
 */

import { useState, useCallback } from "react";
import { callApi } from "@/lib/api-client";
import type { MemberPermissions } from "@/lib/permissions/pages";
import { toast } from "@/lib/toast";

// ============================================
// TYPES
// ============================================

interface CreateMemberData {
  name: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  permissions: MemberPermissions;
  targetMasterId?: string; // For super admin to create member for a specific master
}

interface CreateMemberResult {
  success: boolean;
  memberId?: string;
  message: string;
  error?: {
    code: string;
    message: string;
  };
}

interface UseCreateMemberReturn {
  createMember: (data: CreateMemberData) => Promise<CreateMemberResult>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// ERROR MESSAGE MAPPING
// ============================================

const ERROR_MESSAGES: Record<string, string> = {
  unauthenticated: "Você precisa estar logado para criar membros.",
  "permission-denied": "Apenas administradores podem criar membros.",
  "already-exists": "Este email já está cadastrado.",
  "invalid-argument": "Dados inválidos. Verifique nome e email.",
  internal: "Erro interno. Verifique se as Cloud Functions foram implantadas.",
};

const LIMIT_ERROR_CODES = ["resource-exhausted", "failed-precondition"];

// Custom error interface for Firebase/Function errors
interface FirebaseError {
  code?: string;
  message?: string;
  details?: unknown;
}

function getErrorMessage(error: unknown): string {
  const err = error as FirebaseError;
  // Firebase Functions error code
  const code = err?.code?.replace("functions/", "");
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  // Custom message from Cloud Function
  if (err?.message) {
    return err.message;
  }

  return "Erro ao criar membro. Tente novamente.";
}

// ============================================
// MAIN HOOK
// ============================================

export function useCreateMember(): UseCreateMemberReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMember = useCallback(
    async (data: CreateMemberData): Promise<CreateMemberResult> => {
      setIsLoading(true);
      setError(null);

      try {
        // Use pre-configured functions instance with correct region
        // (configured in src/lib/firebase.ts as 'southamerica-east1')
        // Use callApi
        const result = await callApi<CreateMemberResult>(
          "v1/admin/members",
          "POST",
          data,
        );

        // Success!
        // Success!
        toast.success(result.message || "Membro criado com sucesso!");
        return result;
      } catch (err: unknown) {
        const errorMessage = getErrorMessage(err);
        const errorObj = err as FirebaseError;
        const code = errorObj?.code?.replace("functions/", "") || "unknown";

        setError(errorMessage);

        // Only show toast if NOT a limit error (limit errors will show UpgradeModal)
        if (!LIMIT_ERROR_CODES.includes(code)) {
          toast.error(errorMessage);
        }

        return {
          success: false,
          message: errorMessage,
          error: {
            code,
            message: errorMessage,
          },
        };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    createMember,
    isLoading,
    error,
  };
}

// ============================================
// DEFAULT PERMISSIONS HELPER
// ============================================

/**
 * Reexportado de `lib/permissions/pages` — é função pura e vive junto da lista
 * canônica de páginas, para que a tela de criação e a de edição nunca voltem a
 * oferecer conjuntos diferentes.
 */
export { getDefaultPermissions } from "@/lib/permissions/pages";

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { useCreateMember, getDefaultPermissions } from '@/hooks/useCreateMember';

function CreateMemberForm() {
  const { createMember, isLoading, error } = useCreateMember();

  const handleSubmit = async () => {
    const result = await createMember({
      name: "João Silva",
      email: "joao@empresa.com",
      permissions: getDefaultPermissions('viewer'),
    });

    if (result?.success) {
      console.log("Member created:", result.memberId);
    }
  };
}
*/
