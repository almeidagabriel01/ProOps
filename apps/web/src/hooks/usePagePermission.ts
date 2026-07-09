import { usePermissions } from "@/providers/permissions-provider";

export function usePagePermission(pageId: string) {
  const { permissions, isMaster, isDemo, isLoading } = usePermissions();

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

  // Master and demo/free accounts get full UI permissions. For demo the actual
  // writes are blocked at the api-client and backend (nothing is persisted); the
  // point is to mirror a paying tenant's full flow.
  if (isMaster || isDemo) {
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
