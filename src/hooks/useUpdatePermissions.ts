import { useState } from "react";
import { toast } from "react-toastify";
import { callApi } from "@/lib/api-client";

export function useUpdatePermissions() {
  const [loading, setLoading] = useState(false);

  const updatePermissions = async (
    targetUserId: string,
    permissions: string[]
  ): Promise<boolean> => {
    setLoading(true);
    try {
      await callApi("/v1/admin/members/permissions", "PUT", {
        targetUserId,
        permissions,
      });

      toast.success("Permissões atualizadas com sucesso!");
      return true;
    } catch (error: unknown) {
      console.error("Error updating permissions:", error);
      const message = error instanceof Error ? error.message : "Erro ao atualizar permissões.";
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateSinglePermission = async (
    targetUserId: string,
    pageId: string,
    key: string,
    value: boolean,
    _currentPermissions: unknown
  ) => {
    setLoading(true);
    try {
      // Calling API with granular update
      // Assuming backend can handle this or we effectively ignore currentPermissions if not needed by backend
      // Using a slightly different path or payload structure
      await callApi("/v1/admin/members/permissions", "PUT", {
        targetUserId,
        pageId,
        key,
        value,
        mode: "single", // Flag to tell backend it's a single update
      });

      return { success: true };
    } catch (error: unknown) {
      console.error("Error updating permissions:", error);
      const message = error instanceof Error ? error.message : "Erro ao atualizar permissões.";
      toast.error(message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return { updatePermissions, updateSinglePermission, isLoading: loading };
}
