"use client";

/**
 * Permissions Provider
 *
 * Provides page-level permissions for the current user.
 * Permissions are fetched from Firestore: users/{userId}/permissions/{pageId}
 *
 * IMPORTANT: This is for UI control only. Backend (Cloud Functions) is the
 * source of truth for authorization. This just hides/disables UI elements.
 */

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// ============================================
// TYPES
// ============================================

export interface PagePermission {
  pageId: string;
  pageSlug: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserPermissions {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  companyId: string;
  companyName: string;
  masterName?: string; // Only for MEMBERs
  pages: Record<string, PagePermission>;
}

interface PermissionsContextType {
  permissions: UserPermissions | null;
  isLoading: boolean;
  hasPermission: (
    pageId: string,
    action: "view" | "create" | "edit" | "delete",
  ) => boolean;
  isMaster: boolean;
  isMember: boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = React.createContext<PermissionsContextType>({
  permissions: null,
  isLoading: true,
  hasPermission: () => false,
  isMaster: false,
  isMember: false,
  refreshPermissions: async () => {},
});

// ============================================
// HELPER: Role Normalization
// ============================================

/**
 * Normalize role from various formats to MASTER/MEMBER
 * Handles backwards compatibility with old role system
 *
 * Mapping:
 * - 'MASTER' | 'admin' | 'superadmin' → 'MASTER'
 * - 'MEMBER' | 'user' | 'free' → 'MEMBER'
 */
function normalizeRole(role: string | undefined): "MASTER" | "MEMBER" {
  if (!role) return "MEMBER"; // Default to MEMBER for safety

  const normalizedRole = role.toUpperCase();

  // MASTER-level roles
  if (
    normalizedRole === "MASTER" ||
    normalizedRole === "ADMIN" ||
    normalizedRole === "SUPERADMIN"
  ) {
    return "MASTER";
  }

  // Everything else is MEMBER
  return "MEMBER";
}

// ============================================
// PROVIDER
// ============================================

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [permissions, setPermissions] = React.useState<UserPermissions | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchPermissions = React.useCallback(async () => {
    if (!user?.id) {
      setPermissions(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // 1. Derive role, masterId and companyId from the user already loaded by
      //    auth-provider — avoids a duplicate getDoc(users/{uid}) fetch.
      const role: "MASTER" | "MEMBER" = normalizeRole(user.role);
      const masterId: string | null = user.masterId ?? null;
      const companyId: string = user.tenantId || "";
      const companyName: string = "";

      // 2. If MEMBER, fetch MASTER's name (try-catch to handle permission errors)
      let masterName: string | undefined;
      if (role === "MEMBER" && masterId) {
        try {
          const masterRef = doc(db, "users", masterId);
          const masterSnap = await getDoc(masterRef);
          if (masterSnap.exists()) {
            masterName = masterSnap.data().name;
          }
        } catch (err) {
          console.warn(
            "Could not fetch master name (likely expected permission denial):",
            err,
          );
          masterName = "Administrador"; // Safe fallback
        }
      }

      // 3. Fetch page permissions from subcollection
      const permissionsRef = collection(db, "users", user.id, "permissions");
      const permissionsSnap = await getDocs(permissionsRef);

      const pages: Record<string, PagePermission> = {};

      permissionsSnap.forEach((doc) => {
        const data = doc.data();
        pages[doc.id] = {
          pageId: doc.id,
          pageSlug: data.pageSlug || `/${doc.id}`,
          canView: data.canView ?? false,
          canCreate: data.canCreate ?? false,
          canEdit: data.canEdit ?? false,
          canDelete: data.canDelete ?? false,
        };
        if (!pages["profile"]) {
          pages["profile"] = {
            pageId: "profile",
            pageSlug: "/profile",
            canView: true,
            canCreate: false,
            canEdit: true,
            canDelete: false,
          };
        }
      });

      // 4. MASTER users have ALL permissions by default
      // No need to check for specific pages - MASTER bypasses permission checks
      if (role === "MASTER") {
        // Add common pages with full permissions
        const defaultMasterPages = [
          "dashboard",
          "calendar",
          "proposals",
          "clients",
          "products",
          "services",
          "settings",
          "profile",
          "team",
          "billing",
          "financial",
        ];
        defaultMasterPages.forEach((pageId) => {
          if (!pages[pageId]) {
            pages[pageId] = {
              pageId,
              pageSlug: `/${pageId}`,
              canView: true,
              canCreate: true,
              canEdit: true,
              canDelete: true,
            };
          }
        });
      }

      setPermissions({
        role,
        masterId,
        companyId,
        companyName,
        masterName,
        pages,
      });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      // On error, if user exists, give MASTER role to admin users
      if (user?.role === "admin" || user?.role === "superadmin") {
        setPermissions({
          role: "MASTER",
          masterId: null,
          companyId: user.tenantId || "",
          companyName: "",
          pages: {},
        });
      } else {
        setPermissions(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role, user?.tenantId, user?.masterId]);

  // Fetch permissions when user changes
  React.useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Permission check helper
  const hasPermission = React.useCallback(
    (
      pageId: string,
      action: "view" | "create" | "edit" | "delete",
    ): boolean => {
      if (!permissions) return false;

      // MASTER BYPASS: MASTER users have ALL permissions unconditionally
      // This ensures MASTER never gets 403 for any page
      if (permissions.role === "MASTER") {
        return true;
      }

      // MEMBER: Check explicit page permissions
      const pagePerm = permissions.pages[pageId];
      if (!pagePerm) {
        // MEMBER with no permission doc = no access
        return false;
      }

      switch (action) {
        case "view":
          return pagePerm.canView;
        case "create":
          return pagePerm.canCreate;
        case "edit":
          return pagePerm.canEdit;
        case "delete":
          return pagePerm.canDelete;
        default:
          return false;
      }
    },
    [permissions],
  );

  const isMaster = permissions?.role === "MASTER";
  const isMember = permissions?.role === "MEMBER";

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        isLoading,
        hasPermission,
        isMaster,
        isMember,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Main hook to access permissions context
 */
export function usePermissions() {
  return React.useContext(PermissionsContext);
}

/**
 * Hook to check permission for a specific page
 */
export function usePagePermission(pageId: string) {
  const { permissions, hasPermission, isLoading } = usePermissions();

  return {
    canView: hasPermission(pageId, "view"),
    canCreate: hasPermission(pageId, "create"),
    canEdit: hasPermission(pageId, "edit"),
    canDelete: hasPermission(pageId, "delete"),
    isLoading,
    permission: permissions?.pages[pageId] ?? null,
  };
}

/**
 * Hook to get current user's role info
 */
export function useUserRole() {
  const { permissions, isLoading } = usePermissions();

  return {
    role: permissions?.role ?? null,
    isMaster: permissions?.role === "MASTER",
    isMember: permissions?.role === "MEMBER",
    masterId: permissions?.masterId ?? null,
    masterName: permissions?.masterName ?? null,
    companyId: permissions?.companyId ?? null,
    companyName: permissions?.companyName ?? null,
    isLoading,
  };
}
