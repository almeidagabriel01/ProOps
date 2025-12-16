/**
 * Hook: useCreateMember
 * 
 * React hook for creating MEMBER users linked to the current MASTER.
 * Handles loading states, error handling, and toast notifications.
 */

import { useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { toast } from "react-toastify";

interface MemberPermissions {
  [pageSlug: string]: {
    canView: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  };
}

interface CreateMemberData {
  name: string;
  email: string;
  password?: string;
  permissions: MemberPermissions;
}

interface CreateMemberResult {
  success: boolean;
  memberId?: string;
  message: string;
}

interface UseCreateMemberReturn {
  createMember: (data: CreateMemberData) => Promise<CreateMemberResult | null>;
  isLoading: boolean;
  error: string | null;
}

export function useCreateMember(): UseCreateMemberReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMember = useCallback(async (data: CreateMemberData): Promise<CreateMemberResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current user's token
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error("Você precisa estar logado para criar membros");
      }

      const token = await user.getIdToken();

      // Call the API
      const response = await fetch("/api/members/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao criar membro");
      }

      // Success!
      toast.success(result.message || "Membro criado com sucesso!");
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast.error(errorMessage);
      return null;

    } finally {
      setIsLoading(false);
    }
  }, []);

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
 * Returns default permissions for a new MEMBER based on role type
 */
export function getDefaultPermissions(roleType: 'viewer' | 'editor' | 'admin' = 'viewer'): MemberPermissions {
  const basePermissions: MemberPermissions = {
    '/dashboard': { canView: true },
    '/proposals': { canView: true },
    '/clients': { canView: true },
    '/products': { canView: true },
  };

  if (roleType === 'editor') {
    return {
      '/dashboard': { canView: true },
      '/proposals': { canView: true, canCreate: true, canEdit: true },
      '/clients': { canView: true, canCreate: true, canEdit: true },
      '/products': { canView: true, canCreate: true, canEdit: true },
    };
  }

  if (roleType === 'admin') {
    return {
      '/dashboard': { canView: true },
      '/proposals': { canView: true, canCreate: true, canEdit: true, canDelete: true },
      '/clients': { canView: true, canCreate: true, canEdit: true, canDelete: true },
      '/products': { canView: true, canCreate: true, canEdit: true, canDelete: true },
      '/settings': { canView: true, canEdit: true },
    };
  }

  return basePermissions;
}
