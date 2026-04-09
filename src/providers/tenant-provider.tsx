"use client";

import * as React from "react";
import { Tenant, User } from "@/types"; // Keep Type
import { TenantService } from "@/services/tenant-service";
import { useAuth } from "@/providers/auth-provider";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import {
  clearViewingTenantId,
  readViewingTenantId,
  writeViewingTenantId,
} from "@/lib/viewing-tenant-session";
import type { TenantBillingInfo } from "@/services/admin-service";
import {
  ensureDarkModeContrast,
  ensureLightModeContrast,
  computePrimaryForeground,
} from "@/utils/color-utils";

interface TenantContextType {
  tenant: Tenant | null;
  tenantOwner: User | null;
  tenantOwnerPlanName: string | null;
  isLoading: boolean;
  refreshTenant: () => void;
  clearViewingTenant: () => void;
  setViewingTenant: (tenant: Tenant) => void;
  isGlobalLoading: boolean;
  setGlobalLoading: (isLoading: boolean, reason?: string) => void;
  beginGlobalLoading: (reason?: string) => void;
  endGlobalLoading: (reason?: string) => void;
}

const TenantContext = React.createContext<TenantContextType>({
  tenant: null,
  tenantOwner: null,
  tenantOwnerPlanName: null,
  isLoading: true,
  refreshTenant: () => {},
  clearViewingTenant: () => {},
  setViewingTenant: () => {},
  isGlobalLoading: false,
  setGlobalLoading: () => {},
  beginGlobalLoading: () => {},
  endGlobalLoading: () => {},
});

function resolveSafeTenantColor(input: unknown): string {
  const normalized = String(input || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    return normalized;
  }
  return "#3b82f6";
}

function normalizePlanId(input?: string): string | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toLowerCase();

  if (["free", "gratuito", "grátis", "gratis"].includes(normalized)) {
    return "free";
  }
  if (["starter", "inicial", "start"].includes(normalized)) {
    return "starter";
  }
  if (["pro", "professional", "profissional"].includes(normalized)) {
    return "pro";
  }
  if (["enterprise", "empresarial"].includes(normalized)) {
    return "enterprise";
  }

  return normalized;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const shellBlockingLoadingReasons = React.useMemo(
    () => new Set(["tenant-switch", "return-admin"]),
    [],
  );
  const routeTransitionTargetsRef = React.useRef<
    Partial<Record<"tenant-switch" | "return-admin", string>>
  >({});
  const [globalLoadingReasons, setGlobalLoadingReasons] = React.useState<
    Record<string, true>
  >({});
  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [tenantOwner, setTenantOwner] = React.useState<User | null>(null);
  const [tenantOwnerPlanName, setTenantOwnerPlanName] = React.useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const { user, isLoading: isAuthLoading } = useAuth();
  const pathname = usePathname();

  const currentTenantIdRef = React.useRef<string | null>(null);
  const lastResolvedContextKeyRef = React.useRef<string | null>(null);
  // Track the last refreshTrigger value to detect when explicit refresh was requested
  const lastRefreshTriggerRef = React.useRef(0);
  // Track explicit tenant setting to avoid clearing during router transitions
  const bypassAdminClearRef = React.useRef(false);
  const isGlobalLoading = React.useMemo(
    () =>
      Object.keys(globalLoadingReasons).some((reason) =>
        shellBlockingLoadingReasons.has(reason),
      ),
    [globalLoadingReasons, shellBlockingLoadingReasons],
  );

  const beginGlobalLoading = React.useCallback((reason = "manual") => {
    setGlobalLoadingReasons((currentReasons) => {
      if (currentReasons[reason]) {
        return currentReasons;
      }

      return {
        ...currentReasons,
        [reason]: true,
      };
    });
  }, []);

  const endGlobalLoading = React.useCallback((reason = "manual") => {
    setGlobalLoadingReasons((currentReasons) => {
      if (!currentReasons[reason]) {
        return currentReasons;
      }

      const nextReasons = { ...currentReasons };
      delete nextReasons[reason];
      return nextReasons;
    });
  }, []);

  const setGlobalLoading = React.useCallback(
    (nextIsLoading: boolean, reason = "manual") => {
      if (nextIsLoading) {
        beginGlobalLoading(reason);
        return;
      }

      endGlobalLoading(reason);
    },
    [beginGlobalLoading, endGlobalLoading],
  );

  const loadTenant = React.useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    // Check for "Viewing As" override (Super Admin feature)
    let viewingAsId = readViewingTenantId();

    // Reset bypass flag once we've safely left the admin routes
    if (pathname && !pathname.startsWith("/admin")) {
      bypassAdminClearRef.current = false;
    }

    // If superadmin is accessing any admin page, forcefully clear/ignore the tenant
    if (
      pathname &&
      pathname.startsWith("/admin") &&
      !bypassAdminClearRef.current
    ) {
      viewingAsId = null;
      clearViewingTenantId();
    }

    if (viewingAsId && user?.role?.toLowerCase() !== "superadmin") {
      clearViewingTenantId();
      viewingAsId = null;
    }

    let tenantIdToLoad = viewingAsId;

    if (!tenantIdToLoad && user && user.tenantId) {
      if (user.role === "superadmin") {
        // If superadmin, do NOT auto-load their "default" tenant.
        // They should legally be viewing "No Tenant" unless Impersonating.
        tenantIdToLoad = null;
      } else {
        tenantIdToLoad = user.tenantId;
      }
    }

    // Check if this is a forced refresh (refreshTrigger changed)
    const isForceRefresh = refreshTrigger !== lastRefreshTriggerRef.current;
    lastRefreshTriggerRef.current = refreshTrigger;
    const contextKey = [
      tenantIdToLoad || "no-tenant",
      user?.id || "anonymous",
      user?.role || "no-role",
    ].join(":");
    const needsSuperAdminHydration =
      user?.role?.toLowerCase() === "superadmin" &&
      !!tenantIdToLoad &&
      !tenantOwnerPlanName;

    // Skip if we already have the correct tenant loaded AND this is not a forced refresh
    if (
      currentTenantIdRef.current === tenantIdToLoad &&
      lastResolvedContextKeyRef.current === contextKey &&
      !isLoading &&
      !isForceRefresh &&
      !needsSuperAdminHydration
    ) {
      return;
    }

    setIsLoading(true);

    if (tenantIdToLoad) {
      try {
        let fetchedTenant: Tenant | null = null;
        let superAdminTenantBillingMatch: TenantBillingInfo | null = null;

        const resolveSuperAdminTenantBillingMatch = async () => {
          if (superAdminTenantBillingMatch) {
            return superAdminTenantBillingMatch;
          }

          const { AdminService } = await import("@/services/admin-service");
          const allTenants = await AdminService.getAllTenantsBilling();
          superAdminTenantBillingMatch =
            allTenants.find((item) => item.tenant.id === tenantIdToLoad) ||
            null;

          return superAdminTenantBillingMatch;
        };

        try {
          fetchedTenant = await TenantService.getTenantById(tenantIdToLoad);
        } catch (fetchTenantError) {
          console.warn(
            "Primary tenant fetch failed, trying local fallback.",
            fetchTenantError,
          );
        }

        if (!fetchedTenant && user?.role?.toLowerCase() === "superadmin") {
          try {
            const match = await resolveSuperAdminTenantBillingMatch();
            if (match?.tenant) {
              fetchedTenant = {
                id: match.tenant.id,
                name: match.tenant.name,
                slug: match.tenant.slug,
                createdAt: match.tenant.createdAt,
                logoUrl: match.tenant.logoUrl,
                primaryColor: match.tenant.primaryColor,
                niche: match.tenant.niche,
                whatsappEnabled: match.tenant.whatsappEnabled,
              } as Tenant;
            }
          } catch (fallbackError) {
            console.warn(
              "Tenant fallback via admin API failed.",
              fallbackError,
            );
          }
        }

        if (fetchedTenant) {
          setTenant(fetchedTenant);
          currentTenantIdRef.current = fetchedTenant.id;
          setTenantOwnerPlanName(null);

          // Fetch Tenant Owner
          try {
            // For members, fetch owner directly by masterId (they have permission)
            // For admins/masters, use query to find owner in tenant
            const isMember =
              user?.masterId && user?.role?.toLowerCase() === "member";
            const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";

            if (isMember && user.masterId) {
              // Member: fetch their master directly
              const masterDoc = await getDoc(doc(db, "users", user.masterId));
              if (masterDoc.exists()) {
                setTenantOwner({
                  id: masterDoc.id,
                  ...masterDoc.data(),
                } as User);
                setTenantOwnerPlanName(null);
              } else {
                setTenantOwner(null);
                setTenantOwnerPlanName(null);
              }
            } else if (isSuperAdmin) {
              try {
                const usersQuery = query(
                  collection(db, "users"),
                  where("tenantId", "==", fetchedTenant.id),
                  limit(20),
                );
                const usersSnap = await getDocs(usersQuery);
                const ownerFromUsers = usersSnap.docs
                  .map((d) => ({ id: d.id, ...d.data() }) as User)
                  .find((u) => !u.masterId);

                if (ownerFromUsers) {
                  setTenantOwner(ownerFromUsers);
                  setTenantOwnerPlanName(null);
                } else {
                  const targetTenant =
                    await resolveSuperAdminTenantBillingMatch();

                  if (targetTenant?.admin?.id) {
                    setTenantOwner({
                      id: targetTenant.admin.id,
                      name: targetTenant.admin.name || fetchedTenant.name,
                      email: targetTenant.admin.email,
                      role: "admin",
                      tenantId: fetchedTenant.id,
                      planId:
                        normalizePlanId(
                          (targetTenant as { planId?: string }).planId,
                        ) ||
                        normalizePlanId(targetTenant.planName) ||
                        "free",
                      billingInterval:
                        targetTenant.billingInterval === "yearly"
                          ? "yearly"
                          : "monthly",
                    } as User);
                    setTenantOwnerPlanName(targetTenant.planName || null);
                  } else {
                    setTenantOwner(null);
                    setTenantOwnerPlanName(null);
                  }
                }
              } catch (superAdminOwnerError) {
                console.warn(
                  "Error resolving tenant owner for superadmin via API",
                  superAdminOwnerError,
                );
                setTenantOwner(null);
                setTenantOwnerPlanName(null);
              }
            } else if (!user?.masterId) {
              // Admin/Master/SuperAdmin: query users in tenant to find owner
              const q = query(
                collection(db, "users"),
                where("tenantId", "==", fetchedTenant.id),
                limit(20),
              );

              const usersSnap = await getDocs(q);
              if (!usersSnap.empty) {
                // Client-side filter for the "Master" / Owner
                // The owner is the one with no masterId
                const owner = usersSnap.docs
                  .map((d) => ({ id: d.id, ...d.data() }) as User)
                  .find((u) => !u.masterId);

                if (owner) {
                  setTenantOwner(owner);
                  setTenantOwnerPlanName(null);
                } else {
                  // Fallback: pick the first one or one with admin role?
                  setTenantOwner(
                    usersSnap.docs.map(
                      (d) => ({ id: d.id, ...d.data() }) as User,
                    )[0],
                  );
                  setTenantOwnerPlanName(null);
                  console.warn(
                    `Could not identify explicit owner for tenant ${fetchedTenant.id}, using first user.`,
                  );
                }
              } else {
                setTenantOwner(null);
                setTenantOwnerPlanName(null);
              }
            } else {
              setTenantOwner(null);
              setTenantOwnerPlanName(null);
            }
          } catch (ownerErr) {
            console.error("Error fetching tenant owner", ownerErr);
            setTenantOwner(null);
            setTenantOwnerPlanName(null);
          }
          lastResolvedContextKeyRef.current = contextKey;
        } else {
          console.warn(`Tenant ${tenantIdToLoad} not found in Firestore`);
          if (viewingAsId === tenantIdToLoad) {
            clearViewingTenantId();
          }
          setTenant(null);
          setTenantOwner(null);
          setTenantOwnerPlanName(null);
          currentTenantIdRef.current = null;
          lastResolvedContextKeyRef.current = contextKey;
        }
      } catch (error) {
        console.error("Error loading tenant", error);
        setTenant(null);
        setTenantOwner(null);
        setTenantOwnerPlanName(null);
        currentTenantIdRef.current = null;
        lastResolvedContextKeyRef.current = null;
      }
    } else {
      setTenant(null);
      setTenantOwner(null);
      setTenantOwnerPlanName(null);
      currentTenantIdRef.current = null;
      lastResolvedContextKeyRef.current = contextKey;
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    refreshTrigger,
    pathname,
    isAuthLoading,
    tenantOwnerPlanName,
    endGlobalLoading,
  ]);

  React.useEffect(() => {
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    loadTenant();
  }, [isAuthLoading, loadTenant]);

  React.useEffect(() => {
    const tenantSwitchTarget =
      routeTransitionTargetsRef.current["tenant-switch"];
    if (
      tenantSwitchTarget &&
      pathname === tenantSwitchTarget &&
      !pathname.startsWith("/admin") &&
      !isLoading &&
      !!tenant
    ) {
      endGlobalLoading("tenant-switch");
      delete routeTransitionTargetsRef.current["tenant-switch"];
    }

    const returnAdminTarget = routeTransitionTargetsRef.current["return-admin"];
    if (
      returnAdminTarget &&
      pathname === returnAdminTarget &&
      !isLoading &&
      !tenant
    ) {
      endGlobalLoading("return-admin");
      delete routeTransitionTargetsRef.current["return-admin"];
    }
  }, [pathname, isLoading, tenant, endGlobalLoading]);

  // Apply tenant theme synchronously to avoid flash.
  // Uses a <style> tag with :root / .dark selectors so the browser cascade
  // automatically picks the right variant when the theme toggles — no
  // re-render needed. The stored brand color is the "seed"; lightness is
  // adjusted per-theme while hue+saturation (brand identity) are preserved.
  React.useLayoutEffect(() => {
    const styleId = "tenant-styles";
    if (tenant) {
      const seed = resolveSafeTenantColor(tenant.primaryColor);
      const lightPrimary = ensureLightModeContrast(seed);
      const darkPrimary = ensureDarkModeContrast(seed);
      const lightFg = computePrimaryForeground(lightPrimary);
      const darkFg = computePrimaryForeground(darkPrimary);

      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        :root {
          --primary: ${lightPrimary};
          --primary-foreground: ${lightFg};
          --ring: ${lightPrimary};
        }
        .dark {
          --primary: ${darkPrimary};
          --primary-foreground: ${darkFg};
          --ring: ${darkPrimary};
        }
        ::selection {
          background-color: var(--primary) !important;
          color: var(--primary-foreground) !important;
        }
        .tenant-border {
          border-color: var(--primary) !important;
        }
      `;
    } else {
      // Reset to default system theme (e.g. Blue) when no tenant aka Admin View
      const styleTag = document.getElementById(styleId);
      if (styleTag) styleTag.remove();
    }
  }, [tenant]);

  const refreshTenant = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const clearViewingTenant = React.useCallback(() => {
    routeTransitionTargetsRef.current["return-admin"] = "/admin";
    beginGlobalLoading("return-admin");
    clearViewingTenantId();
    setRefreshTrigger((prev) => prev + 1);
  }, [beginGlobalLoading]);

  const setViewingTenant = (newTenant: Tenant) => {
    bypassAdminClearRef.current = true;
    routeTransitionTargetsRef.current["tenant-switch"] = "/dashboard";
    beginGlobalLoading("tenant-switch");
    writeViewingTenantId(newTenant.id);
    refreshTenant();
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantOwner,
        tenantOwnerPlanName,
        isLoading,
        refreshTenant,
        clearViewingTenant,
        setViewingTenant,
        isGlobalLoading,
        setGlobalLoading,
        beginGlobalLoading,
        endGlobalLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => React.useContext(TenantContext);
