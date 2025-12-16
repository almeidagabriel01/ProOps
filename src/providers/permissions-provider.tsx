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
    role: 'MASTER' | 'MEMBER';
    masterId: string | null;
    companyId: string;
    companyName: string;
    masterName?: string; // Only for MEMBERs
    pages: Record<string, PagePermission>;
}

interface PermissionsContextType {
    permissions: UserPermissions | null;
    isLoading: boolean;
    hasPermission: (pageId: string, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
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
    refreshPermissions: async () => { },
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
function normalizeRole(role: string | undefined): 'MASTER' | 'MEMBER' {
    if (!role) return 'MEMBER'; // Default to MEMBER for safety

    const normalizedRole = role.toUpperCase();

    // MASTER-level roles
    if (normalizedRole === 'MASTER' ||
        normalizedRole === 'ADMIN' ||
        normalizedRole === 'SUPERADMIN') {
        return 'MASTER';
    }

    // Everything else is MEMBER
    return 'MEMBER';
}

// ============================================
// PROVIDER
// ============================================

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [permissions, setPermissions] = React.useState<UserPermissions | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    const fetchPermissions = React.useCallback(async () => {
        if (!user?.id) {
            setPermissions(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);

            // 1. Fetch user document for role and company info
            const userRef = doc(db, "users", user.id);
            const userSnap = await getDoc(userRef);

            // If user doc doesn't exist, use role from auth-provider
            // This handles the case where Firestore doc is missing
            let role: 'MASTER' | 'MEMBER';
            let masterId: string | null = null;
            let companyId: string = '';
            let companyName: string = '';

            if (userSnap.exists()) {
                const userData = userSnap.data();
                // IMPORTANT: Normalize role to handle old 'admin' format
                role = normalizeRole(userData.role);
                masterId = userData.masterId || null;
                companyId = userData.companyId || userData.tenantId || '';
                companyName = userData.companyName || '';
            } else {
                // Fallback: use role from auth context
                console.warn("User document not found in Firestore, using auth role");
                role = normalizeRole(user.role);
                companyId = user.tenantId || '';
            }

            // 2. If MEMBER, fetch MASTER's name
            let masterName: string | undefined;
            if (role === 'MEMBER' && masterId) {
                const masterRef = doc(db, "users", masterId);
                const masterSnap = await getDoc(masterRef);
                if (masterSnap.exists()) {
                    masterName = masterSnap.data().name;
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
            if (role === 'MASTER') {
                // Add common pages with full permissions
                const defaultMasterPages = [
                    'dashboard', 'proposals', 'clients', 'products',
                    'settings', 'profile', 'team', 'billing', 'financial'
                ];
                defaultMasterPages.forEach(pageId => {
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
            if (user?.role === 'admin' || user?.role === 'superadmin') {
                setPermissions({
                    role: 'MASTER',
                    masterId: null,
                    companyId: user.tenantId || '',
                    companyName: '',
                    pages: {},
                });
            } else {
                setPermissions(null);
            }
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, user?.role, user?.tenantId]);

    // Fetch permissions when user changes
    React.useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    // Permission check helper
    const hasPermission = React.useCallback(
        (pageId: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
            if (!permissions) return false;

            // MASTER BYPASS: MASTER users have ALL permissions unconditionally
            // This ensures MASTER never gets 403 for any page
            if (permissions.role === 'MASTER') {
                return true;
            }

            // MEMBER: Check explicit page permissions
            const pagePerm = permissions.pages[pageId];
            if (!pagePerm) {
                // MEMBER with no permission doc = no access
                return false;
            }

            switch (action) {
                case 'view':
                    return pagePerm.canView;
                case 'create':
                    return pagePerm.canCreate;
                case 'edit':
                    return pagePerm.canEdit;
                case 'delete':
                    return pagePerm.canDelete;
                default:
                    return false;
            }
        },
        [permissions]
    );

    const isMaster = permissions?.role === 'MASTER';
    const isMember = permissions?.role === 'MEMBER';

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
        canView: hasPermission(pageId, 'view'),
        canCreate: hasPermission(pageId, 'create'),
        canEdit: hasPermission(pageId, 'edit'),
        canDelete: hasPermission(pageId, 'delete'),
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
        isMaster: permissions?.role === 'MASTER',
        isMember: permissions?.role === 'MEMBER',
        masterId: permissions?.masterId ?? null,
        masterName: permissions?.masterName ?? null,
        companyId: permissions?.companyId ?? null,
        companyName: permissions?.companyName ?? null,
        isLoading,
    };
}
