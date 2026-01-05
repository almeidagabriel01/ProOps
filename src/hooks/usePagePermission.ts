import { usePermissions } from "@/providers/permissions-provider";

export function usePagePermission(pageId: string) {
  const { permissions, isMaster, isLoading } = usePermissions();

  // Treat as loading if permissions haven't been fetched yet
  // This prevents race conditions where null permissions cause incorrect denials
  if (isLoading || permissions === null) {
    return {
      isLoading: true,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    };
  }

  if (isMaster) {
    return {
      isLoading: false,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    };
  }

  const page = permissions?.pages?.[pageId];

  return {
    isLoading: false,
    canView: page?.canView ?? false,
    canCreate: page?.canCreate ?? false,
    canEdit: page?.canEdit ?? false,
    canDelete: page?.canDelete ?? false,
  };
}
