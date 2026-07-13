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

  // Master accounts get full UI permissions.
  if (isMaster) {
    return {
      isLoading: false,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    };
  }

  // Demo/free accounts can view everything and open forms (canEdit lets the
  // read-only edit views render), but must not create or delete anything —
  // those affordances are hidden entirely so no misleading cursor/action is
  // shown. Writes are also blocked at the api-client and backend as defense in
  // depth.
  if (isDemo) {
    return {
      isLoading: false,
      canView: true,
      canCreate: false,
      canEdit: true,
      canDelete: false,
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
