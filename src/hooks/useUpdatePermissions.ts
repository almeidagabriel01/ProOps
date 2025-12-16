/**
 * Hook: useUpdatePermissions
 * 
 * React hook for updating MEMBER permissions.
 * Uses Firebase Callable Cloud Function - NOT direct Firestore writes.
 * 
 * Only MASTER users can update permissions for their MEMBERs.
 */

import { useState, useCallback } from "react";
import { httpsCallable, HttpsCallableResult } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { toast } from "react-toastify";

// ============================================
// TYPES
// ============================================

interface PagePermission {
  canView: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface UpdatePermissionsData {
  memberId: string;
  permissions: {
    [pageId: string]: PagePermission;
  };
}

interface UpdatePermissionsResult {
  success: boolean;
  message: string;
  memberId: string;
}

interface UseUpdatePermissionsReturn {
  updatePermissions: (data: UpdatePermissionsData) => Promise<UpdatePermissionsResult | null>;
  updateSinglePermission: (
    memberId: string,
    pageId: string,
    key: keyof PagePermission,
    value: boolean,
    currentPermissions: Record<string, PagePermission>
  ) => Promise<UpdatePermissionsResult | null>;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// ERROR MAPPING
// ============================================

const ERROR_MESSAGES: Record<string, string> = {
  'unauthenticated': 'Você precisa estar logado.',
  'permission-denied': 'Você não tem permissão para editar este usuário.',
  'not-found': 'Membro não encontrado.',
  'invalid-argument': 'Dados inválidos.',
  'internal': 'Erro interno. Verifique se as Cloud Functions foram implantadas.',
};

function getErrorMessage(error: any): string {
  const code = error?.code?.replace('functions/', '');
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return error?.message || 'Erro ao atualizar permissões.';
}

// ============================================
// MAIN HOOK
// ============================================

export function useUpdatePermissions(): UseUpdatePermissionsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePermissions = useCallback(async (
    data: UpdatePermissionsData
  ): Promise<UpdatePermissionsResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Use pre-configured functions instance with correct region
      // (configured in src/lib/firebase.ts as 'southamerica-east1')
      const updatePermissionsFn = httpsCallable<UpdatePermissionsData, UpdatePermissionsResult>(
        functions,
        'updateMemberPermissions'
      );

      const result: HttpsCallableResult<UpdatePermissionsResult> = await updatePermissionsFn(data);
      
      toast.success(result.data.message || "Permissões atualizadas!");
      return result.data;

    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      toast.error(errorMessage);
      return null;

    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper to update a single permission
  const updateSinglePermission = useCallback(async (
    memberId: string,
    pageId: string,
    key: keyof PagePermission,
    value: boolean,
    currentPermissions: Record<string, PagePermission>
  ): Promise<UpdatePermissionsResult | null> => {
    // Build the new permission object
    const currentPagePerm = currentPermissions[pageId] || { canView: false };
    const newPagePerm = { ...currentPagePerm, [key]: value };

    // If turning off canView, turn off everything else
    if (key === 'canView' && !value) {
      newPagePerm.canCreate = false;
      newPagePerm.canEdit = false;
      newPagePerm.canDelete = false;
    }

    return updatePermissions({
      memberId,
      permissions: {
        ...currentPermissions,
        [pageId]: newPagePerm,
      },
    });
  }, [updatePermissions]);

  return {
    updatePermissions,
    updateSinglePermission,
    isLoading,
    error,
  };
}
