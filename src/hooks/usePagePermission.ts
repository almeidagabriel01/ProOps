import { usePermissions } from "@/providers/permissions-provider";

export function usePagePermission(pageId: string) {
  const { permissions, isMaster } = usePermissions();

  if (isMaster) {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    };
  }

  const page = permissions?.pages?.[pageId];

  return {
    canView: page?.canView ?? false,
    canCreate: page?.canCreate ?? false,
    canEdit: page?.canEdit ?? false,
    canDelete: page?.canDelete ?? false,
  };
}
